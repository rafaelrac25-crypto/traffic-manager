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
    return {
      key: 'meta',
      label: 'Meta Ads',
      status: 'ok',
      details: daysLeft != null
        ? `Conectado · conta ${creds.account_id || '—'} · token válido por ${daysLeft} dias.`
        : `Conectado · conta ${creds.account_id || '—'}.`,
      meta: { account_id: creds.account_id, page_id: creds.page_id, ig_business_id: creds.ig_business_id, days_left: daysLeft },
    };
  } catch (e) {
    return { key: 'meta', label: 'Meta Ads', status: 'error', details: `Erro ao verificar: ${e.message}` };
  }
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
    const items = [dbCheck, metaCheck, checkGroq(), checkWebhook()];

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
