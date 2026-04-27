/**
 * Helper HTTP centralizado pra TODAS as chamadas ao Meta Graph API.
 *
 * Provê:
 * - Timeout de 30s (evita requests pendurados em serverless)
 * - Rate limit via token bucket (180 req/h por token)
 * - Detecção automática de erro 190/102 → marca needs_reconnect
 * - Parse de erros padronizado com code/subcode/user_msg
 *
 * TODAS as chamadas ao graph.facebook.com devem passar por aqui.
 */

const https = require('https');
const rateLimit = require('./metaRateLimit');
const { parseMetaError } = require('./metaErrors');
const { API_VERSION, GRAPH_HOST } = require('./metaApiVersion');

const DEFAULT_TIMEOUT_MS = 30000;

function pathFor(endpoint) {
  if (endpoint.startsWith('/')) return `/${API_VERSION}${endpoint}`;
  return `/${API_VERSION}/${endpoint}`;
}

function encodeParams(params) {
  const out = {};
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    out[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
  });
  return new URLSearchParams(out).toString();
}

/**
 * Faz uma request ao Meta e aplica rate limit + timeout + parse de erro.
 * Em erro 190/102 (token inválido/expirado), marca needs_reconnect no DB.
 *
 * @param {'GET'|'POST'|'DELETE'} method
 * @param {string} endpoint — ex: '/act_123/campaigns' ou 'me/accounts'
 * @param {object} params — query/body params (serializados via URLSearchParams)
 * @param {object} opts — { token, rateLimitKey, timeoutMs }
 */
async function metaRequest(method, endpoint, params = {}, opts = {}) {
  const { token, rateLimitKey = token || 'global', timeoutMs = DEFAULT_TIMEOUT_MS } = opts;
  /* Rate limit bloqueia curto se necessário — Meta retorna 4/17/613 se exceder */
  await rateLimit.take(rateLimitKey, 1);

  const fullParams = { ...params };
  if (token) fullParams.access_token = token;
  const qs = encodeParams(fullParams);

  let fullPath = pathFor(endpoint);
  let body = null;
  if (method === 'GET' || method === 'DELETE') {
    if (qs) fullPath += `?${qs}`;
  } else {
    body = qs;
  }

  const json = await new Promise((resolve, reject) => {
    const req = https.request({
      host: GRAPH_HOST,
      path: fullPath,
      method,
      headers: body ? {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      } : {},
      timeout: timeoutMs,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data || '{}')); }
        catch (e) { reject(new Error(`Resposta inválida do Meta: ${e.message}`)); }
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error(`Meta timeout (${timeoutMs}ms) em ${method} ${endpoint}`));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });

  if (json.error) {
    const parsed = parseMetaError(json.error);
    /* Auto-marca needs_reconnect pra qualquer endpoint bater 190/102.
       Lazy require pra evitar ciclo (metaToken → db → ...). */
    if (parsed.reconnect === true) {
      try {
        const { markNeedsReconnect } = require('./metaToken');
        await markNeedsReconnect('meta');
      } catch { /* best-effort, não quebra o erro original */ }
    }
    const e = new Error(parsed.pt);
    e.meta = parsed;
    e.endpoint = endpoint;
    e.params = params;
    throw e;
  }

  return json;
}

function metaGet(endpoint, params, opts)    { return metaRequest('GET',    endpoint, params, opts); }
function metaPost(endpoint, params, opts)   { return metaRequest('POST',   endpoint, params, opts); }
function metaDelete(endpoint, params, opts) { return metaRequest('DELETE', endpoint, params, opts); }

/* Builder de URL GET p/ uso com fetch quando precisar de multipart
   (upload de vídeo) — aplica rate limit ao mesmo tempo. */
async function prepareFetchUrl(endpoint, params = {}, opts = {}) {
  const { token, rateLimitKey = token || 'global' } = opts;
  await rateLimit.take(rateLimitKey, 1);
  const fullParams = { ...params };
  if (token) fullParams.access_token = token;
  const qs = encodeParams(fullParams);
  const path = pathFor(endpoint);
  return `https://${GRAPH_HOST}${path}${qs ? '?' + qs : ''}`;
}

module.exports = {
  metaRequest,
  metaGet,
  metaPost,
  metaDelete,
  prepareFetchUrl,
  API_VERSION,
  GRAPH_HOST,
  DEFAULT_TIMEOUT_MS,
};
