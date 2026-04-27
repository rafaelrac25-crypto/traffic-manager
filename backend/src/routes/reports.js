/* Rotas de Relatórios — recebe relatórios automatizados (routines do Claude
   ou outras fontes) e expõe pra UI listar e ler.

   Tabela criada lazy aqui pra não exigir migration manual em prod nem alterar
   sqlite.js / schema.sql do core. CREATE IF NOT EXISTS é idempotente.

   Auth: POST exige header X-Report-Secret = REPORT_INGEST_SECRET (env var).
   Se a env não estiver setada, POST é aceito sem header (modo dev/bootstrap).
   GETs são abertos (uso interno, sem auth no resto do sistema mesmo). */

const router = require('express').Router();
const db = require('../db');

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  try {
    /* SQL portável: o pool.query do PG converte datetime('now') → NOW().
       Em SQLite roda direto. INTEGER PRIMARY KEY AUTOINCREMENT funciona em
       SQLite; em PG vamos usar SERIAL via path separado. */
    if (process.env.DATABASE_URL) {
      await db.query(`
        CREATE TABLE IF NOT EXISTS reports (
          id SERIAL PRIMARY KEY,
          kind VARCHAR(30) DEFAULT 'campaign',
          title TEXT NOT NULL,
          summary TEXT,
          source VARCHAR(60) DEFAULT 'manual',
          severity VARCHAR(20) DEFAULT 'info',
          campaign_id INTEGER,
          body_md TEXT,
          data_json TEXT,
          read INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      /* Migração idempotente — pra instâncias que já tinham a tabela antes
         dos campos kind/summary. ALTER ... ADD COLUMN IF NOT EXISTS é PG-only. */
      try { await db.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS kind VARCHAR(30) DEFAULT 'campaign'"); } catch {}
      try { await db.query('ALTER TABLE reports ADD COLUMN IF NOT EXISTS summary TEXT'); } catch {}
    } else {
      await db.query(`
        CREATE TABLE IF NOT EXISTS reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          kind TEXT DEFAULT 'campaign',
          title TEXT NOT NULL,
          summary TEXT,
          source TEXT DEFAULT 'manual',
          severity TEXT DEFAULT 'info',
          campaign_id INTEGER,
          body_md TEXT,
          data_json TEXT,
          read INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `);
      /* SQLite não tem ADD COLUMN IF NOT EXISTS — try/catch dá conta. */
      try { await db.query("ALTER TABLE reports ADD COLUMN kind TEXT DEFAULT 'campaign'"); } catch {}
      try { await db.query('ALTER TABLE reports ADD COLUMN summary TEXT'); } catch {}
    }
    tableReady = true;
  } catch (e) {
    console.error('[reports] ensureTable falhou:', e.message);
  }
}

function rowToReport(row) {
  if (!row) return null;
  const out = { ...row };
  if (out.data_json && typeof out.data_json === 'string') {
    try { out.data = JSON.parse(out.data_json); } catch { out.data = null; }
  } else {
    out.data = out.data_json || null;
  }
  delete out.data_json;
  out.read = !!out.read;
  return out;
}

/* ── GET /api/reports — lista relatórios (mais recentes primeiro) ── */
router.get('/', async (req, res) => {
  await ensureTable();
  const { kind, severity, campaign_id, limit } = req.query;
  let query = 'SELECT * FROM reports WHERE 1=1';
  const params = [];
  if (kind)        { query += ' AND kind = ?'; params.push(kind); }
  if (severity)    { query += ' AND severity = ?'; params.push(severity); }
  if (campaign_id) { query += ' AND campaign_id = ?'; params.push(Number(campaign_id)); }
  query += ' ORDER BY created_at DESC';
  const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
  query += ` LIMIT ${lim}`;
  try {
    const result = await db.query(query, params);
    res.json(result.rows.map(rowToReport));
  } catch (err) {
    console.error('[reports] list:', err.message);
    res.status(500).json({ error: 'Erro ao buscar relatórios' });
  }
});

/* ── GET /api/reports/:id — detalhe ── */
router.get('/:id', async (req, res) => {
  await ensureTable();
  try {
    const result = await db.query('SELECT * FROM reports WHERE id = ?', [Number(req.params.id)]);
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Relatório não encontrado' });
    res.json(rowToReport(row));
  } catch (err) {
    console.error('[reports] get:', err.message);
    res.status(500).json({ error: 'Erro ao buscar relatório' });
  }
});

/* ── POST /api/reports — cria relatório (ingestão de routines) ── */
router.post('/', async (req, res) => {
  const requiredSecret = process.env.REPORT_INGEST_SECRET;
  if (requiredSecret) {
    const got = req.headers['x-report-secret'];
    if (got !== requiredSecret) {
      return res.status(401).json({ error: 'X-Report-Secret inválido' });
    }
  }

  const { kind, title, summary, source, severity, campaign_id, body_md, data } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title obrigatório' });

  const kindAllowed = ['campaign', 'system', 'reminder'];
  const k = kindAllowed.includes(kind) ? kind : 'campaign';
  const sevAllowed = ['info', 'success', 'warn', 'critical'];
  const sev = sevAllowed.includes(severity) ? severity : 'info';
  const src = (source || 'manual').slice(0, 60);
  const dataJson = data ? JSON.stringify(data) : null;

  await ensureTable();
  try {
    const result = await db.query(
      `INSERT INTO reports (kind, title, summary, source, severity, campaign_id, body_md, data_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      [k, title, summary || null, src, sev, campaign_id || null, body_md || null, dataJson]
    );
    res.status(201).json(rowToReport(result.rows[0]));
  } catch (err) {
    console.error('[reports] create:', err.message);
    res.status(500).json({ error: 'Erro ao criar relatório' });
  }
});

/* ── PATCH /api/reports/:id/read — marca como lido ── */
router.patch('/:id/read', async (req, res) => {
  await ensureTable();
  try {
    const result = await db.query(
      'UPDATE reports SET read = 1 WHERE id = ? RETURNING *',
      [Number(req.params.id)]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Relatório não encontrado' });
    res.json(rowToReport(row));
  } catch (err) {
    console.error('[reports] mark read:', err.message);
    res.status(500).json({ error: 'Erro ao marcar como lido' });
  }
});

/* ── POST /api/reports/generate/campaign — snapshot manual da campanha ──
   Não usa IA. Lê dados locais e gera resumo determinístico. Custo zero. */
router.post('/generate/campaign', async (req, res) => {
  await ensureTable();
  try {
    const camps = await db.query(
      `SELECT * FROM campaigns
       WHERE platform IN ('meta','instagram')
         AND status IN ('active','review','live')
       ORDER BY created_at DESC LIMIT 5`
    );
    const ads = camps.rows;
    if (ads.length === 0) {
      const r = await db.query(
        `INSERT INTO reports (kind, title, summary, source, severity, body_md)
         VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
        ['campaign', 'Nenhuma campanha ativa',
         'Você não tem nenhuma campanha rodando agora. Quando publicar uma, ela aparece aqui automaticamente.',
         'manual-snapshot', 'info', null]
      );
      return res.status(201).json(rowToReport(r.rows[0]));
    }

    const lines = [];
    let critical = 0, warn = 0;
    const summaryParts = [];

    for (const ad of ads) {
      const created = ad.created_at ? new Date(ad.created_at) : null;
      const ageH = created ? (Date.now() - created.getTime()) / 3600_000 : 0;
      const ageDays = ageH / 24;
      const clicks = Number(ad.clicks || 0);
      const spent = Number(ad.spent || 0);
      const cpc = clicks > 0 && spent > 0 ? (spent / clicks) : null;
      const inLearning = ageDays < 7;
      const ageLabel = ageDays < 1
        ? `${Math.round(ageH)}h de vida`
        : `${Math.floor(ageDays)}d de vida`;

      lines.push(`### ${ad.name || `Campanha #${ad.id}`}`);
      lines.push(`- ID Meta: \`${ad.platform_campaign_id || '—'}\``);
      lines.push(`- Status: ${ad.effective_status || ad.status || '—'}`);
      lines.push(`- Idade: ${ageLabel}${inLearning ? ' (em aprendizado)' : ''}`);
      lines.push(`- Cliques registrados: ${clicks}`);
      lines.push(`- Gasto registrado: R$ ${spent.toFixed(2)}`);
      if (cpc != null) lines.push(`- CPC implícito: R$ ${cpc.toFixed(2)}`);
      lines.push('');

      // Veredito leigo por campanha
      if (inLearning) {
        summaryParts.push(`"${ad.name || 'Sua campanha'}" está em aprendizado (${Math.ceil(7 - ageDays)} dia(s) restantes). Não mexa em nada.`);
      } else if (clicks === 0 && ageH >= 24) {
        summaryParts.push(`"${ad.name || 'Sua campanha'}" não recebeu nenhum clique em 24h — vale verificar.`);
        critical++;
      } else if (cpc != null && cpc > 2) {
        summaryParts.push(`"${ad.name || 'Sua campanha'}" tem CPC alto (R$ ${cpc.toFixed(2)}). Pode valer testar criativo novo.`);
        warn++;
      } else {
        summaryParts.push(`"${ad.name || 'Sua campanha'}" está rodando bem: ${clicks} cliques, R$ ${cpc?.toFixed(2) || '—'}/clique.`);
      }
    }

    const severity = critical > 0 ? 'critical' : warn > 0 ? 'warn' : 'success';
    const summary = summaryParts.join(' ');
    const title = ads.length === 1
      ? `Acompanhamento — ${ads[0].name || 'campanha'}`
      : `Acompanhamento — ${ads.length} campanhas ativas`;

    const result = await db.query(
      `INSERT INTO reports (kind, title, summary, source, severity, campaign_id, body_md)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      ['campaign', title, summary, 'manual-snapshot', severity,
       ads.length === 1 ? ads[0].id : null,
       lines.join('\n')]
    );
    res.status(201).json(rowToReport(result.rows[0]));
  } catch (err) {
    console.error('[reports] generate campaign:', err.message);
    res.status(500).json({ error: 'Erro ao gerar snapshot da campanha' });
  }
});

/* ── POST /api/reports/generate/system — snapshot manual de saúde ── */
router.post('/generate/system', async (req, res) => {
  await ensureTable();
  try {
    const items = [];

    // 1. Banco
    try {
      await db.query('SELECT 1');
      items.push({ key: 'db', label: 'Banco de dados', ok: true, note: 'Conectado.' });
    } catch (e) {
      items.push({ key: 'db', label: 'Banco de dados', ok: false, note: e.message });
    }

    // 2. Credenciais Meta
    try {
      const cred = await db.query("SELECT account_id, page_id, ig_business_id, needs_reconnect, token_expires_at FROM platform_credentials WHERE platform='meta'");
      const c = cred.rows[0];
      if (!c) {
        items.push({ key: 'meta', label: 'Meta Ads', ok: false, note: 'Não conectado.' });
      } else if (c.needs_reconnect) {
        items.push({ key: 'meta', label: 'Meta Ads', ok: false, note: 'Precisa reconectar.' });
      } else {
        const exp = c.token_expires_at ? new Date(c.token_expires_at) : null;
        const days = exp ? Math.floor((exp - Date.now()) / 86_400_000) : null;
        items.push({ key: 'meta', label: 'Meta Ads', ok: days == null || days > 7, note: days != null ? `Token válido por ${days} dia(s).` : 'Token sem prazo definido.' });
      }
    } catch (e) {
      items.push({ key: 'meta', label: 'Meta Ads', ok: false, note: e.message });
    }

    // 3. Groq
    items.push({ key: 'groq', label: 'IA (Groq)', ok: !!process.env.GROQ_API_KEY, note: process.env.GROQ_API_KEY ? 'Configurado.' : 'Sem API key.' });

    // 4. Webhook secret — webhooks.js usa FB_APP_SECRET pra validar HMAC
    items.push({ key: 'webhook', label: 'Webhook Meta', ok: !!process.env.FB_APP_SECRET, note: process.env.FB_APP_SECRET ? 'Secret configurado.' : 'Sem secret.' });

    const broken = items.filter(i => !i.ok);
    const severity = broken.length === 0 ? 'success' : broken.length === 1 ? 'warn' : 'critical';
    const summary = broken.length === 0
      ? 'Tudo está funcionando. Banco conectado, Meta autenticada, IA pronta, webhook ativo.'
      : `${broken.length} item(s) com atenção: ${broken.map(b => b.label).join(', ')}.`;
    const title = broken.length === 0 ? 'Sistema saudável' : `Sistema com ${broken.length} alerta(s)`;
    const body = items.map(i => `${i.ok ? '✅' : '⚠️'} **${i.label}** — ${i.note}`).join('\n');

    const result = await db.query(
      `INSERT INTO reports (kind, title, summary, source, severity, body_md, data_json)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      ['system', title, summary, 'manual-snapshot', severity, body, JSON.stringify({ items })]
    );
    res.status(201).json(rowToReport(result.rows[0]));
  } catch (err) {
    console.error('[reports] generate system:', err.message);
    res.status(500).json({ error: 'Erro ao gerar snapshot do sistema' });
  }
});

/* ── DELETE /api/reports/:id ── */
router.delete('/:id', async (req, res) => {
  await ensureTable();
  try {
    await db.query('DELETE FROM reports WHERE id = ?', [Number(req.params.id)]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[reports] delete:', err.message);
    res.status(500).json({ error: 'Erro ao deletar' });
  }
});

module.exports = router;
