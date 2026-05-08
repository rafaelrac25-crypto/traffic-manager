/**
 * Rotas de saúde do sistema.
 *
 * GET /api/health      → ping básico (usado por monitores de uptime)
 * GET /api/health/full → estado detalhado das integrações pro widget
 *                         "Status do Sistema" no canto inferior esquerdo do painel
 *
 * Cada peça retorna:
 *   { status: 'ok' | 'warn' | 'error', label, details, [meta] }
 *
 * O overall é calculado pelo pior status encontrado (error > warn > ok).
 */

const router = require('express').Router();
const db = require('../db');
const { metaGet, getLastUsage } = require('../services/metaHttp');
const { decrypt } = require('../services/crypto');

router.get('/', (_, res) => res.json({ status: 'ok' }));

async function checkDatabase() {
  try {
    const r = await db.query('SELECT 1 AS ok');
    const rows = r?.rows || r;
    if (!rows || rows.length === 0) throw new Error('SELECT 1 retornou vazio');
    const isPg = !!process.env.DATABASE_URL;
    return {
      key: 'db',
      label: isPg ? 'Banco Neon (PostgreSQL)' : 'Banco local (SQLite)',
      status: 'ok',
      details: isPg ? 'Conectado — conta e dados salvos em nuvem.' : 'Banco local em desenvolvimento.',
    };
  } catch (e) {
    return {
      key: 'db',
      label: 'Banco de dados',
      status: 'error',
      details: `Não consegui conectar: ${e.message}`,
    };
  }
}

async function checkMeta() {
  try {
    const r = await db.query(`SELECT * FROM platform_credentials WHERE platform = ?`, ['meta']);
    const creds = (r?.rows || [])[0];
    if (!creds || !creds.access_token) {
      return {
        key: 'meta',
        label: 'Meta Ads',
        status: 'error',
        details: 'Meta não conectado. Vá em Investimento → Conectar Meta.',
      };
    }
    if (creds.needs_reconnect) {
      return {
        key: 'meta',
        label: 'Meta Ads',
        status: 'error',
        details: 'Token expirou. Desconecte e reconecte em Investimento.',
      };
    }
    /* Avisa com antecedência antes do token de 60 dias expirar */
    const expiresAt = creds.token_expires_at ? new Date(creds.token_expires_at) : null;
    const daysLeft = expiresAt ? Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24)) : null;
    if (daysLeft != null && daysLeft < 10) {
      return {
        key: 'meta',
        label: 'Meta Ads',
        status: 'warn',
        details: `Token expira em ${daysLeft} dias. Sistema vai renovar automático, mas vale ficar de olho.`,
        meta: { account_id: creds.account_id, days_left: daysLeft },
      };
    }
    /* Validação LIVE contra Meta Graph API. Antes deste check, healthCheck
       confiava só na flag `needs_reconnect` do banco — se o token fosse
       revogado externamente (Rafa removendo acesso no Facebook), a flag
       não sabia e o health mentia "ok". Agora batemos `/me?fields=id` com
       timeout curto pra confirmar que o token está vivo. */
    const rawToken = String(creds.access_token).includes(':')
      ? (() => { try { return decrypt(creds.access_token); } catch { return creds.access_token; } })()
      : creds.access_token;

    let liveStatus = 'ok';
    let liveDetail = null;
    try {
      const livePing = await Promise.race([
        metaGet('/me', { fields: 'id' }, { token: rawToken }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout 8s')), 8000)),
      ]);
      if (!livePing?.id) {
        liveStatus = 'error';
        liveDetail = 'Token retornou resposta inválida do Meta (sem id).';
      }
    } catch (e) {
      const msg = String(e?.message || e);
      /* Erro 190 / 102 = token inválido/expirado (não detectado pela flag) */
      if (/190|102|invalid|expired|access_token/i.test(msg)) {
        liveStatus = 'error';
        liveDetail = 'Token rejeitado pelo Meta. Reconecte em Investimento.';
      } else if (/timeout|ETIMEDOUT|ECONNRESET/i.test(msg)) {
        liveStatus = 'warn';
        liveDetail = `Meta lento ao validar token (${msg}). Token pode estar ok, mas vale verificar.`;
      } else {
        liveStatus = 'warn';
        liveDetail = `Não consegui validar token agora: ${msg.slice(0, 80)}`;
      }
    }

    if (liveStatus === 'error') {
      return {
        key: 'meta',
        label: 'Meta Ads',
        status: 'error',
        details: liveDetail,
        meta: { account_id: creds.account_id, page_id: creds.page_id, ig_business_id: creds.ig_business_id, days_left: daysLeft },
      };
    }

    const baseDetails = daysLeft != null
      ? `Conectado · conta ${creds.account_id || '—'} · token válido por ${daysLeft} dias.`
      : `Conectado · conta ${creds.account_id || '—'}.`;

    return {
      key: 'meta',
      label: 'Meta Ads',
      status: liveStatus, /* 'ok' se ping passou, 'warn' se Meta lento */
      details: liveStatus === 'warn' ? `${baseDetails} ${liveDetail}` : baseDetails,
      meta: { account_id: creds.account_id, page_id: creds.page_id, ig_business_id: creds.ig_business_id, days_left: daysLeft },
    };
  } catch (e) {
    return { key: 'meta', label: 'Meta Ads', status: 'error', details: `Erro ao verificar: ${e.message}` };
  }
}

function checkMetaUsage() {
  /* Mostra o último % visto do header X-App-Usage. Adicionado em 2026-05-08
     após Meta rebaixar tier de 1500 → 500 e bloquear conta da Cris por uso
     excessivo da API. Valor é populado a cada call Meta bem-sucedida. */
  const u = getLastUsage();
  if (!u || !u.observed_at) {
    return {
      key: 'meta_usage',
      label: 'Uso da API Meta',
      status: 'ok',
      details: 'Nenhuma chamada Meta feita ainda nesta instância — sem dados.',
    };
  }
  const pct = u.peak_pct;
  let status = 'ok';
  let prefix = 'Saudável';
  if (pct >= 90) { status = 'error'; prefix = 'CRÍTICO — chamadas serão abortadas'; }
  else if (pct >= 70) { status = 'warn'; prefix = 'Alto — moderar chamadas'; }
  else if (pct >= 50) { status = 'warn'; prefix = 'Atenção'; }
  return {
    key: 'meta_usage',
    label: 'Uso da API Meta',
    status,
    details: `${prefix} — pico ${pct}% (call_count=${u.call_count_pct}%, cputime=${u.total_cputime_pct}%, time=${u.total_time_pct}%, ad_acct=${u.ad_account_pct}%, buc=${u.buc_peak_pct}%) · medido ${u.observed_at}`,
    meta: u,
  };
}

function checkGroq() {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return {
      key: 'groq',
      label: 'IA (Groq)',
      status: 'warn',
      details: 'Chave não configurada. Chat de IA e análise de imagem ficam desligados.',
    };
  }
  return {
    key: 'groq',
    label: 'IA (Groq)',
    status: 'ok',
    details: 'Configurado — chat e análise de imagem disponíveis.',
  };
}

function checkWebhook() {
  const hasToken = !!process.env.FB_WEBHOOK_VERIFY_TOKEN;
  const hasSecret = !!process.env.FB_APP_SECRET;
  if (!hasToken || !hasSecret) {
    return {
      key: 'webhook',
      label: 'Webhook Meta',
      status: 'warn',
      details: hasToken
        ? 'Token de verificação ok, mas FB_APP_SECRET faltando — assinatura não pode ser validada.'
        : 'Webhook não ativado — você não recebe aviso imediato quando o Meta aprova/reprova um anúncio. Sync manual continua funcionando.',
    };
  }
  return {
    key: 'webhook',
    label: 'Webhook Meta',
    status: 'ok',
    details: 'Ativo — Meta avisa o painel automaticamente quando status dos anúncios muda.',
  };
}

router.get('/full', async (_, res) => {
  try {
    const [dbCheck, metaCheck] = await Promise.all([checkDatabase(), checkMeta()]);
    const items = [dbCheck, metaCheck, checkMetaUsage(), checkGroq(), checkWebhook()];

    const order = { ok: 0, warn: 1, error: 2 };
    const worst = items.reduce((w, it) => (order[it.status] > order[w] ? it.status : w), 'ok');

    res.json({
      overall: worst,
      checked_at: new Date().toISOString(),
      items,
    });
  } catch (err) {
    console.error('[health/full]', err);
    res.status(500).json({
      overall: 'error',
      checked_at: new Date().toISOString(),
      items: [{ key: 'internal', label: 'Verificação interna', status: 'error', details: err.message }],
    });
  }
});

module.exports = router;
