const router = require('express').Router();
const crypto = require('crypto');
const https = require('https');
const db = require('../db');
const { encrypt } = require('../services/crypto');
const { metaGet } = require('../services/metaHttp');

const GRAPH = 'https://graph.facebook.com/v20.0';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; /* 10 minutos */
const HTTPS_TIMEOUT_MS = 15000;

/* Scopes necessários pra publicar/ler anúncios e mensagens em IG.
   instagram_manage_insights opcional mas necessário pra reach/impressões
   a nível de conta IG — inclui por segurança. */
const SCOPES = [
  'ads_management',
  'ads_read',
  'business_management',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'instagram_basic',
  'instagram_manage_insights',
];

function redirectUri(req) {
  const base = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
  return `${base.replace(/\/$/, '')}/api/platforms/meta/oauth/callback`;
}

/* GET com timeout — evita pendurar a function se Meta ficar lento */
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: HTTPS_TIMEOUT_MS }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => req.destroy(new Error(`Meta timeout (${HTTPS_TIMEOUT_MS}ms)`)));
    req.on('error', reject);
  });
}

/* OAuth state persistido em DB — sobrevive a multi-instância de serverless */
async function saveOAuthState(state, platform) {
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString();
  /* Expira estados antigos antes de inserir — mantém a tabela enxuta */
  try { await db.query(`DELETE FROM oauth_states WHERE expires_at < datetime('now')`); } catch {}
  await db.query(
    `INSERT INTO oauth_states (state, platform, expires_at) VALUES (?, ?, ?)`,
    [state, platform, expiresAt]
  );
}

async function consumeOAuthState(state) {
  const sel = await db.query(
    `SELECT state, platform, expires_at FROM oauth_states WHERE state = ?`,
    [state]
  );
  const row = sel.rows[0];
  if (!row) return null;
  /* One-shot: apaga imediatamente pra bloquear replay */
  await db.query(`DELETE FROM oauth_states WHERE state = ?`, [state]);
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row;
}

router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT platform, account_id, page_id, ig_business_id, token_expires_at, scopes, needs_reconnect, updated_at FROM platform_credentials'
    );
    const connected = {};
    result.rows.forEach(r => { connected[r.platform] = r; });
    const platforms = ['google', 'meta'];
    res.json(platforms.map(p => ({
      platform: p,
      connected: !!connected[p],
      account_id: connected[p]?.account_id || null,
      page_id: connected[p]?.page_id || null,
      ig_business_id: connected[p]?.ig_business_id || null,
      token_expires_at: connected[p]?.token_expires_at || null,
      scopes: connected[p]?.scopes || null,
      needs_reconnect: connected[p] ? !!connected[p].needs_reconnect : false,
      updated_at: connected[p]?.updated_at || null,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar plataformas' });
  }
});

router.get('/meta/billing', async (req, res) => {
  try {
    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });
    const accountId = creds.account_id;
    if (!accountId) return res.status(400).json({ error: 'Ad Account ID ausente' });

    /* Renova proativamente se faltar <15 dias — mantém a conexão permanente */
    const { refreshIfNeeded } = require('../services/metaToken');
    const token = await refreshIfNeeded(creds);
    if (!token) return res.status(400).json({ error: 'Token Meta ausente' });

    /* metaGet aplica timeout + rate limit + auto needs_reconnect em 190/102 */
    let json;
    try {
      json = await metaGet(`/${accountId}`, {
        fields: 'balance,amount_spent,spend_cap,currency,account_status,name',
      }, { token });
    } catch (e) {
      if (e.meta?.reconnect) {
        return res.status(401).json({ error: e.message, needs_reconnect: true });
      }
      return res.status(502).json({ error: e.message, meta: e.meta || null });
    }

    const toReal = (cents) => {
      const n = Number(cents);
      return Number.isFinite(n) ? n / 100 : 0;
    };
    const balance = toReal(json.balance);
    const amount_spent = toReal(json.amount_spent);
    const spend_cap = json.spend_cap != null ? toReal(json.spend_cap) : null;
    /* "Disponível": quanto ainda pode gastar antes de bater no limite da conta.
       Pra contas pós-pago (balance sempre ~0), usa spend_cap - amount_spent.
       Pra contas pré-pago ou sem cap, cai no balance. Pode divergir em centavos
       do Meta Ads Manager por créditos promocionais/reembolsos não expostos aqui. */
    const available = spend_cap != null
      ? Math.max(0, spend_cap - amount_spent)
      : balance;
    res.json({
      account_id: accountId,
      account_name: json.name || null,
      currency: json.currency || 'BRL',
      balance,
      amount_spent,
      spend_cap,
      available,
      account_status: json.account_status,
    });
  } catch (err) {
    console.error('[meta/billing]', err);
    res.status(500).json({ error: err.message || 'Erro ao buscar saldo Meta' });
  }
});

router.get('/meta/oauth/start', async (req, res) => {
  const appId = process.env.FB_APP_ID;
  if (!appId) return res.status(500).json({ error: 'FB_APP_ID ausente' });
  const state = crypto.randomBytes(16).toString('hex');
  try { await saveOAuthState(state, 'meta'); }
  catch (e) {
    console.error('[oauth/start] saveOAuthState:', e.message);
    return res.status(500).json({ error: 'Erro ao iniciar OAuth' });
  }
  const url = new URL(`${GRAPH}/dialog/oauth`.replace('graph.facebook.com', 'www.facebook.com'));
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri(req));
  url.searchParams.set('state', state);
  url.searchParams.set('scope', SCOPES.join(','));
  url.searchParams.set('response_type', 'code');
  res.redirect(url.toString());
});

/* Escolhe a página mais provável de ser a "correta" — a que tem Instagram
   Business conectado. Se nenhuma tem, cai pra primeira da lista. */
function pickBestPage(pages) {
  if (!Array.isArray(pages) || pages.length === 0) return null;
  const withIG = pages.find(p => p?.instagram_business_account?.id);
  return withIG || pages[0];
}

router.get('/meta/oauth/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  const frontBase = (process.env.FRONTEND_URL || '/').replace(/\/$/, '');
  if (error) {
    return res.redirect(`${frontBase}/investment?meta_error=${encodeURIComponent(error_description || error)}`);
  }
  if (!code || !state) {
    return res.redirect(`${frontBase}/investment?meta_error=${encodeURIComponent('código ou state ausente')}`);
  }

  let stateRow = null;
  try { stateRow = await consumeOAuthState(state); }
  catch (e) { console.error('[oauth/callback] consumeOAuthState:', e.message); }
  if (!stateRow) {
    return res.redirect(`${frontBase}/investment?meta_error=${encodeURIComponent('state inválido ou expirado')}`);
  }

  try {
    const appId = process.env.FB_APP_ID;
    const appSecret = process.env.FB_APP_SECRET;
    if (!appId || !appSecret) throw new Error('Credenciais do App ausentes');

    const shortUrl = `${GRAPH}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri(req))}&code=${code}`;
    const shortResp = await httpsGet(shortUrl);
    if (shortResp.error) throw new Error(shortResp.error.message);
    const shortToken = shortResp.access_token;

    const longUrl = `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`;
    const longResp = await httpsGet(longUrl);
    if (longResp.error) throw new Error(longResp.error.message);
    const longToken = longResp.access_token;
    const expiresIn = longResp.expires_in || 60 * 24 * 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    /* Lista páginas com instagram_business_account e escolhe a melhor */
    const pagesResp = await httpsGet(`${GRAPH}/me/accounts?fields=id,name,instagram_business_account&access_token=${longToken}`);
    const bestPage = pickBestPage(pagesResp?.data);
    const pageId = bestPage?.id || null;
    const igBusinessId = bestPage?.instagram_business_account?.id || null;

    /* Descobre ad account automaticamente quando env var não foi setada.
       Evita cair no caso "account_id=null silencioso" que quebra publicação. */
    let accountId = process.env.FB_AD_ACCOUNT_ID || null;
    if (!accountId) {
      try {
        const adsResp = await httpsGet(`${GRAPH}/me/adaccounts?fields=id,account_id,account_status,currency,name&access_token=${longToken}`);
        /* Prefere conta ACTIVE (status=1) pra evitar contas desabilitadas */
        const active = (adsResp?.data || []).find(a => a.account_status === 1);
        const chosen = active || adsResp?.data?.[0];
        if (chosen?.id) accountId = chosen.id; /* formato 'act_123...' que Meta exige em endpoints */
      } catch (e) {
        console.warn('[oauth/callback] auto-descoberta de ad account falhou:', e.message);
      }
    }

    const encToken = encrypt(longToken);
    await db.query(
      `INSERT INTO platform_credentials (platform, access_token, account_id, token_expires_at, token_type, scopes, page_id, ig_business_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(platform) DO UPDATE
       SET access_token = excluded.access_token,
           account_id = COALESCE(excluded.account_id, platform_credentials.account_id),
           token_expires_at = excluded.token_expires_at,
           token_type = excluded.token_type,
           scopes = excluded.scopes,
           page_id = excluded.page_id,
           ig_business_id = excluded.ig_business_id,
           needs_reconnect = 0,
           updated_at = datetime('now')`,
      ['meta', encToken, accountId, expiresAt, 'long_lived_user', SCOPES.join(','), pageId, igBusinessId]
    );

    res.redirect(`${frontBase}/investment?connected=meta`);
  } catch (err) {
    console.error('[meta/oauth/callback]', err);
    res.redirect(`${frontBase}/investment?meta_error=${encodeURIComponent(err.message || 'erro ao conectar')}`);
  }
});

/* Endpoint admin temporário pra deletar órfãos no Meta (campanhas criadas
   parcialmente antes do cleanup automático existir). Cola a URL no
   navegador: /api/platforms/meta/delete-orphan?id=120245280065460627
   Será removido após uso. */
router.get('/meta/delete-orphan', async (req, res) => {
  const targetId = String(req.query.id || '').trim();
  if (!targetId || !/^\d{6,}$/.test(targetId)) {
    return res.status(400).json({ error: 'Parâmetro id obrigatório (apenas dígitos do ID da Campaign no Meta)' });
  }
  try {
    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });
    const { deleteCampaign } = require('../services/metaWrite');
    await deleteCampaign(creds, targetId);
    return res.json({ deleted: targetId, ok: true });
  } catch (e) {
    console.error('[delete-orphan]', e);
    return res.status(502).json({ error: e.message, meta: e.meta || null });
  }
});

router.post('/:platform/connect', async (req, res) => {
  const { platform } = req.params;
  if (platform === 'meta') {
    return res.status(400).json({ error: 'Meta só aceita OAuth — use /api/platforms/meta/oauth/start' });
  }
  if (!['google'].includes(platform)) return res.status(400).json({ error: 'Plataforma inválida' });
  const { access_token, refresh_token, account_id } = req.body;
  if (!access_token) return res.status(400).json({ error: 'access_token obrigatório' });
  try {
    const encAccess = encrypt(access_token);
    const encRefresh = refresh_token ? encrypt(refresh_token) : null;
    await db.query(
      `INSERT INTO platform_credentials (platform, access_token, refresh_token, account_id, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(platform) DO UPDATE
       SET access_token = excluded.access_token, refresh_token = excluded.refresh_token,
           account_id = excluded.account_id, updated_at = datetime('now')`,
      [platform, encAccess, encRefresh, account_id || null]
    );
    res.json({ message: `Plataforma ${platform} conectada` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao salvar credenciais' });
  }
});

router.delete('/:platform', async (req, res) => {
  try {
    await db.query('DELETE FROM platform_credentials WHERE platform = ?', [req.params.platform]);
    res.json({ message: 'Plataforma desconectada' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao desconectar' });
  }
});

module.exports = router;
