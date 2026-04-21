const router = require('express').Router();
const crypto = require('crypto');
const https = require('https');
const db = require('../db');
const { encrypt } = require('../services/crypto');

const GRAPH = 'https://graph.facebook.com/v20.0';
const SCOPES = [
  'ads_management',
  'ads_read',
  'business_management',
  'pages_show_list',
  'pages_read_engagement',
  'instagram_basic',
];

const OAUTH_STATE = new Map();

function redirectUri(req) {
  const base = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
  return `${base.replace(/\/$/, '')}/api/platforms/meta/oauth/callback`;
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT platform, account_id, page_id, ig_business_id, token_expires_at, scopes, updated_at FROM platform_credentials'
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
    const { getToken } = require('../services/metaWrite');
    const token = getToken(creds);
    const accountId = creds.account_id;
    if (!accountId) return res.status(400).json({ error: 'Ad Account ID ausente' });

    const fields = 'balance,amount_spent,spend_cap,currency,account_status,name';
    const url = `${GRAPH}/${accountId}?fields=${fields}&access_token=${token}`;
    const json = await httpsGet(url);
    if (json.error) return res.status(502).json({ error: json.error.message });

    const toReal = (cents) => Number(cents || 0) / 100;
    res.json({
      account_id: accountId,
      account_name: json.name || null,
      currency: json.currency || 'BRL',
      balance: toReal(json.balance),
      amount_spent: toReal(json.amount_spent),
      spend_cap: json.spend_cap ? toReal(json.spend_cap) : null,
      account_status: json.account_status,
    });
  } catch (err) {
    console.error('[meta/billing]', err);
    res.status(500).json({ error: err.message || 'Erro ao buscar saldo Meta' });
  }
});

router.get('/meta/oauth/start', (req, res) => {
  const appId = process.env.FB_APP_ID;
  if (!appId) return res.status(500).json({ error: 'FB_APP_ID ausente' });
  const state = crypto.randomBytes(16).toString('hex');
  OAUTH_STATE.set(state, Date.now());
  setTimeout(() => OAUTH_STATE.delete(state), 10 * 60 * 1000);
  const url = new URL(`${GRAPH}/dialog/oauth`.replace('graph.facebook.com', 'www.facebook.com'));
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri(req));
  url.searchParams.set('state', state);
  url.searchParams.set('scope', SCOPES.join(','));
  url.searchParams.set('response_type', 'code');
  res.redirect(url.toString());
});

router.get('/meta/oauth/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  const frontBase = (process.env.FRONTEND_URL || '/').replace(/\/$/, '');
  if (error) {
    return res.redirect(`${frontBase}/investment?meta_error=${encodeURIComponent(error_description || error)}`);
  }
  if (!code || !state || !OAUTH_STATE.has(state)) {
    return res.redirect(`${frontBase}/investment?meta_error=${encodeURIComponent('state inválido ou expirado')}`);
  }
  OAUTH_STATE.delete(state);

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

    const pagesUrl = `${GRAPH}/me/accounts?fields=id,name,instagram_business_account&access_token=${longToken}`;
    const pagesResp = await httpsGet(pagesUrl);
    const firstPage = pagesResp?.data?.[0] || {};
    const pageId = firstPage.id || null;
    const igBusinessId = firstPage.instagram_business_account?.id || null;

    const accountId = process.env.FB_AD_ACCOUNT_ID || null;

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
           updated_at = datetime('now')`,
      ['meta', encToken, accountId, expiresAt, 'long_lived_user', SCOPES.join(','), pageId, igBusinessId]
    );

    res.redirect(`${frontBase}/investment?connected=meta`);
  } catch (err) {
    console.error('[meta/oauth/callback]', err);
    res.redirect(`${frontBase}/investment?meta_error=${encodeURIComponent(err.message || 'erro ao conectar')}`);
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
