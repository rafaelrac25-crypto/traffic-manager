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
