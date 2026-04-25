/**
 * Mantém a conexão Meta da Cris permanente.
 *
 * Estratégia:
 *  - Meta emite long-lived user tokens (60 dias).
 *  - Sempre que um token está a <15 dias de expirar, trocamos por um novo
 *    via fb_exchange_token (stride contínua — o token nunca vence enquanto
 *    o sistema estiver de pé).
 *  - Se a renovação falhar, marcamos needs_reconnect=true para a UI avisar
 *    o Rafa — mas NUNCA apagamos account_id/page_id/ig_business_id.
 *  - O ÚNICO caminho que apaga a credential é DELETE /api/platforms/:platform
 *    (quando o Rafa clica "Desconectar" explicitamente).
 */

const https = require('https');
const { encrypt, safeDecrypt } = require('./crypto');
const db = require('../db');

const API_VERSION = 'v20.0';
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;
const REFRESH_THRESHOLD_DAYS = 15;
const REQUEST_TIMEOUT_MS = 15000;

/* GET com timeout — sem ele, Vercel pode pendurar function até 300s
   quando Meta fica lento, e o refresh silenciosamente bloqueia o sync. */
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: REQUEST_TIMEOUT_MS }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error(`Meta timeout (${REQUEST_TIMEOUT_MS}ms) em token refresh`));
    });
    req.on('error', reject);
  });
}

function daysUntil(iso) {
  if (!iso) return Infinity;
  const ms = new Date(iso).getTime() - Date.now();
  return ms / (1000 * 60 * 60 * 24);
}

function getRawToken(creds) {
  if (!creds?.access_token) return null;
  return safeDecrypt(creds.access_token, 'metaToken');
}

/* Lock por plataforma pra evitar race condition em refresh concorrente.
   Sem isso, 2 requests simultâneas com token <15 dias chamavam fb_exchange_token
   ao mesmo tempo e a 2ª escrita no banco invalidava o token retornado pra 1ª
   request, que então tentava usar token zumbi e tomava erro 190 do Meta.
   Compartilhar a Promise garante 1 único refresh por plataforma. */
const refreshLocks = new Map();

/**
 * Se o token long-lived está a <15 dias de expirar, troca por um novo de 60 dias
 * e persiste. Nunca lança — em caso de falha, retorna o token atual e loga.
 * Concorrência: chamadas simultâneas pra mesma plataforma compartilham 1 promise.
 */
async function refreshIfNeeded(creds, platform = 'meta') {
  if (refreshLocks.has(platform)) {
    return refreshLocks.get(platform);
  }

  const promise = (async () => {
    const appId = process.env.FB_APP_ID;
    const appSecret = process.env.FB_APP_SECRET;
    const currentToken = getRawToken(creds);
    if (!currentToken) return null;
    if (!appId || !appSecret) return currentToken;

    const daysLeft = daysUntil(creds.token_expires_at);
    if (daysLeft > REFRESH_THRESHOLD_DAYS) return currentToken;

    try {
      const url = `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${currentToken}`;
      const resp = await httpsGet(url);
      if (resp.error || !resp.access_token) {
        console.warn('[metaToken] refresh falhou:', resp.error?.message || 'sem access_token');
        return currentToken;
      }
      const newToken = resp.access_token;
      const expiresIn = resp.expires_in || 60 * 24 * 3600;
      const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      const encNew = encrypt(newToken);
      await db.query(
        `UPDATE platform_credentials
         SET access_token = ?, token_expires_at = ?, needs_reconnect = 0, updated_at = datetime('now')
         WHERE platform = ?`,
        [encNew, newExpiresAt, platform]
      );
      console.log(`[metaToken] refresh OK — token ${platform} renovado, expira em ${newExpiresAt}`);
      return newToken;
    } catch (e) {
      console.warn('[metaToken] refresh exception:', e.message);
      return currentToken;
    }
  })();

  refreshLocks.set(platform, promise);
  try {
    return await promise;
  } finally {
    refreshLocks.delete(platform);
  }
}

/**
 * Marca credential como "precisa reconectar" sem deletar nada.
 * Preserva account_id, page_id, ig_business_id — OAuth de reconexão é seamless.
 */
async function markNeedsReconnect(platform = 'meta') {
  try {
    await db.query(
      `UPDATE platform_credentials
       SET needs_reconnect = 1, updated_at = datetime('now')
       WHERE platform = ?`,
      [platform]
    );
  } catch (e) {
    console.warn('[metaToken] markNeedsReconnect falhou:', e.message);
  }
}

async function clearNeedsReconnect(platform = 'meta') {
  try {
    await db.query(
      `UPDATE platform_credentials
       SET needs_reconnect = 0, updated_at = datetime('now')
       WHERE platform = ?`,
      [platform]
    );
  } catch (e) {
    console.warn('[metaToken] clearNeedsReconnect falhou:', e.message);
  }
}

function isTokenExpiredError(err) {
  const meta = err?.meta || {};
  return meta.code === 190 || meta.code === 102 || meta.reconnect === true;
}

module.exports = {
  refreshIfNeeded,
  markNeedsReconnect,
  clearNeedsReconnect,
  isTokenExpiredError,
  daysUntil,
  getRawToken,
  REFRESH_THRESHOLD_DAYS,
};
