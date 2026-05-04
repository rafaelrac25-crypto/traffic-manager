const router = require('express').Router();
const crypto = require('crypto');
const https = require('https');
const db = require('../db');
const { encrypt, safeDecrypt } = require('../services/crypto');
const { metaGet } = require('../services/metaHttp');
const { GRAPH_BASE: GRAPH } = require('../services/metaApiVersion');

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

/* Diagnostica a Page atual: retorna se tem WhatsApp Business linkado,
   IG Business linkado, e capabilities relevantes pra publicar Click-to-WhatsApp.
   Útil pra debug do erro 100/2446885 ("Page sem WhatsApp Business"). */
router.get('/meta/diagnose-page', async (req, res) => {
  try {
    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });
    if (!creds.page_id) return res.status(400).json({ error: 'page_id ausente em platform_credentials' });

    const { refreshIfNeeded } = require('../services/metaToken');
    const token = await refreshIfNeeded(creds);
    if (!token) return res.status(400).json({ error: 'Token Meta ausente' });

    /* Campos válidos no Meta v20 pra inspecionar Page:
       - whatsapp_number: número exibido publicamente como contato (pode ser
         qualquer WhatsApp pessoal, não necessariamente Business API)
       - phone: telefone publicado
       - instagram_business_account: IG Business linkado
       - link, username, fan_count: identidade da Page */
    let json = {};
    try {
      json = await metaGet(`/${creds.page_id}`, {
        fields: 'name,whatsapp_number,phone,instagram_business_account,link,username,fan_count',
      }, { token });
    } catch (e) {
      return res.status(502).json({ error: e.message, meta: e.meta || null });
    }

    /* Verifica WhatsApp Business API conectado via endpoint específico —
       /{page_id}/whatsapp_numbers ou /me/businesses retorna WA Business
       Accounts (WABA). Esse SIM identifica a integracão oficial. */
    let waBusinessAccounts = null;
    try {
      const wabaJson = await metaGet(`/${creds.page_id}/businesses`, {}, { token });
      waBusinessAccounts = wabaJson?.data || null;
    } catch (e) {
      /* sem permissão ou Page sem WABA — não é fatal pro diagnóstico */
      waBusinessAccounts = { error: e?.meta?.code || e.message };
    }

    const hasWhatsappNumber = !!json.whatsapp_number;
    const canRunClickToWhatsApp = hasWhatsappNumber;

    res.json({
      page_id: creds.page_id,
      page_name: json.name || null,
      page_username: json.username || null,
      whatsapp: {
        number_publicly_listed: json.whatsapp_number || null,
        phone_listed: json.phone || null,
        can_run_click_to_whatsapp: canRunClickToWhatsApp,
      },
      instagram_business_account: json.instagram_business_account || null,
      whatsapp_businesses_associated: waBusinessAccounts,
      diagnosis: canRunClickToWhatsApp
        ? '✅ Page tem WhatsApp listado publicamente — Click-to-WhatsApp deveria funcionar'
        : '❌ Page NÃO mostra WhatsApp listado nas info públicas — provavelmente está em outro local. Cris precisa adicionar WhatsApp em "Sobre" / "Informações" da Page do Facebook',
    });
  } catch (err) {
    console.error('[meta/diagnose-page]', err);
    res.status(500).json({ error: err.message || 'Erro ao diagnosticar Page' });
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

/* Busca de interesses no Ad Interest Library do Meta — usado pelo modal
   de edição de público em Campaigns.jsx. Retorna IDs reais que podem ser
   enviados em `targeting.interests` no PUT /api/campaigns/:id.
   Query: ?q=texto&limit=8 (limit default 8, max 25). Read-only. */
router.get('/meta/search-interests', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 25);
  if (q.length < 2) return res.json({ results: [] });
  try {
    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });

    const { refreshIfNeeded } = require('../services/metaToken');
    const token = await refreshIfNeeded(creds);
    if (!token) return res.status(400).json({ error: 'Token Meta ausente' });

    try {
      const json = await metaGet('/search', {
        type: 'adinterest',
        q,
        limit,
        locale: 'pt_BR',
      }, { token });
      const results = (json?.data || []).map(it => ({
        id: it.id,
        name: it.name,
        audience_size: it.audience_size_lower_bound != null
          ? { lower: it.audience_size_lower_bound, upper: it.audience_size_upper_bound }
          : (it.audience_size != null ? { lower: it.audience_size, upper: it.audience_size } : null),
        path: Array.isArray(it.path) ? it.path : null,
        topic: it.topic || null,
      }));
      return res.json({ results });
    } catch (e) {
      if (e.meta?.reconnect) {
        return res.status(401).json({ error: e.message, needs_reconnect: true });
      }
      return res.status(502).json({ error: e.message, meta: e.meta || null });
    }
  } catch (err) {
    console.error('[meta/search-interests]', err);
    return res.status(500).json({ error: err.message || 'Erro na busca' });
  }
});

/* Check rápido do status de uma campanha direto no Meta (usando o
   platform_campaign_id, não o ID local). Útil pra verificar se um
   DELETE propagou ou pra diagnosticar fora do fluxo normal. Read-only. */
router.get('/meta/campaign-status', async (req, res) => {
  const targetId = String(req.query.id || '').trim();
  if (!targetId || !/^\d{6,}$/.test(targetId)) {
    return res.status(400).json({ error: 'Parâmetro id obrigatório (ID da Campaign no Meta, só dígitos)' });
  }
  try {
    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });
    const token = safeDecrypt(creds.access_token);
    try {
      const info = await metaGet(`/${targetId}`, {
        fields: 'id,name,status,effective_status,configured_status,created_time,updated_time',
      }, { token });
      return res.json({ exists: true, ...info });
    } catch (e) {
      /* Meta retorna erro 803 quando o objeto não existe (foi deletado). */
      const code = e.meta?.code;
      const isNotFound = code === 803 || String(e.message).toLowerCase().includes('does not exist');
      return res.json({
        exists: !isNotFound,
        deleted_confirmed: isNotFound,
        error_code: code || null,
        message: e.message,
      });
    }
  } catch (err) {
    console.error('[campaign-status]', err);
    return res.status(500).json({ error: err.message });
  }
});

/* Busca foto de perfil + username + nome do Instagram Business conectado.
   Usado pelo avatar da sidebar (Cris Costa Beauty no canto inferior esquerdo).
   Cache em memória 30 min — a profile_picture_url da CDN do Facebook é
   estável por horas mas pode rotacionar. */
let _igProfileCache = null;
const IG_PROFILE_CACHE_TTL_MS = 30 * 60 * 1000;

router.get('/meta/instagram-profile', async (req, res) => {
  try {
    if (_igProfileCache && (Date.now() - _igProfileCache.at < IG_PROFILE_CACHE_TTL_MS)) {
      return res.json({ ..._igProfileCache.data, cached: true });
    }
    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) return res.status(404).json({ error: 'Meta não conectado' });
    if (!creds.ig_business_id) return res.status(404).json({ error: 'IG Business não vinculado à conta Meta' });

    const token = safeDecrypt(creds.access_token);

    const info = await metaGet(`/${creds.ig_business_id}`, {
      fields: 'id,username,name,profile_picture_url',
    }, { token });

    const data = {
      ig_business_id: info.id,
      username: info.username || null,
      name: info.name || null,
      profile_picture_url: info.profile_picture_url || null,
    };
    _igProfileCache = { at: Date.now(), data };
    return res.json({ ...data, cached: false });
  } catch (err) {
    console.error('[instagram-profile]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/* Deleta uma campanha órfã direto no Meta pelo platform_campaign_id.
   Usado quando: (a) "descartar" em /reprovados precisa propagar, (b) limpar
   órfãos deixados por publish que falhou no meio (campaign criada, adset
   rejeitado). Sem isso, lixo acumula no Ads Manager.
   Body: { id: "120245720XXXXXXXXX" } */
router.post('/meta/delete-by-meta-id', async (req, res) => {
  const targetId = String(req.body?.id || '').trim();
  if (!targetId || !/^\d{6,}$/.test(targetId)) {
    return res.status(400).json({ error: 'Body.id obrigatório (Meta campaign ID, só dígitos)' });
  }
  try {
    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });

    const { deleteCampaign } = require('../services/metaWrite');
    try {
      await deleteCampaign(creds, targetId);
      return res.json({ deleted: true, meta_campaign_id: targetId });
    } catch (e) {
      /* Meta retorna 404 se já foi deletada — tratar como sucesso */
      if (e.meta?.code === 100 || /does not exist|not found/i.test(e.message || '')) {
        return res.json({ deleted: true, meta_campaign_id: targetId, note: 'Já não existia no Meta' });
      }
      return res.status(502).json({ error: `Meta recusou: ${e.message}`, meta: e.meta || null });
    }
  } catch (err) {
    console.error('[delete-by-meta-id]', err);
    return res.status(500).json({ error: err.message });
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
