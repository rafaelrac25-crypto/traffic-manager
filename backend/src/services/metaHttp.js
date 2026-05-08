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
const { parseMetaError, isRetryableForMethod } = require('./metaErrors');
const { API_VERSION, GRAPH_HOST } = require('./metaApiVersion');

/* Reduzido pra caber publishCampaign em 300s do Vercel.
   Antes: 30s × 3 retries × 6 calls = até 540s pior caso (estourava 504).
   Agora: 12s × 2 tentativas × 6 calls = ate 144s pior caso. */
const DEFAULT_TIMEOUT_MS = 12000;
const MAX_RETRIES = 2;
const DEFAULT_BACKOFF_MS = 2000;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ─── Monitor X-App-Usage (Meta envia em CADA response) ───
   Headers que importam:
   - x-app-usage: { call_count, total_cputime, total_time }
   - x-business-use-case-usage: idem por BUC
   - x-ad-account-usage: { acc_id_util_pct, reset_time_duration }
   Cada % vai de 0 a 100. Quando passar de ~90, Meta começa a throttlar
   e (visto em 2026-05-08) PODE rebaixar tier permanentemente + bloquear
   conta. Abortamos em ≥90 pra proteger. */

let LAST_USAGE = {
  peak_pct: 0,
  call_count_pct: 0,
  total_cputime_pct: 0,
  total_time_pct: 0,
  ad_account_pct: 0,
  buc_peak_pct: 0,
  observed_at: null,
};

function safeParseJson(s) {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

function parseUsageHeaders(headers) {
  if (!headers) return null;
  const appU = safeParseJson(headers['x-app-usage']) || {};
  const bucU = safeParseJson(headers['x-business-use-case-usage']) || {};
  const adU = safeParseJson(headers['x-ad-account-usage']) || {};

  const call_count = Number(appU.call_count || 0);
  const total_cputime = Number(appU.total_cputime || 0);
  const total_time = Number(appU.total_time || 0);

  // BUC vem aninhado por id: { "<id>": [{ call_count, total_cputime, ... }] }
  let buc_peak = 0;
  for (const arr of Object.values(bucU)) {
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      buc_peak = Math.max(
        buc_peak,
        Number(item.call_count || 0),
        Number(item.total_cputime || 0),
        Number(item.total_time || 0),
        Number(item.estimated_time_to_regain_access || 0)
      );
    }
  }

  const ad_account_pct = Number(adU.acc_id_util_pct || 0);
  const peak = Math.max(call_count, total_cputime, total_time, buc_peak, ad_account_pct);

  LAST_USAGE = {
    peak_pct: peak,
    call_count_pct: call_count,
    total_cputime_pct: total_cputime,
    total_time_pct: total_time,
    ad_account_pct,
    buc_peak_pct: buc_peak,
    observed_at: new Date().toISOString(),
  };

  return LAST_USAGE;
}

function getLastUsage() {
  return LAST_USAGE;
}

const ABORT_THRESHOLD = 90;
const WARN_THRESHOLD = 70;

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
 * Faz uma única tentativa HTTP ao Meta — sem retry, sem rate limit.
 * Usado por metaRequest dentro do loop de retry.
 */
async function singleAttempt(method, endpoint, params, opts) {
  const { token, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;
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

  return new Promise((resolve, reject) => {
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
        try { resolve({ json: JSON.parse(data || '{}'), headers: res.headers }); }
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
}

/**
 * Faz uma request ao Meta e aplica rate limit + timeout + parse de erro + retry.
 * Em erro 190/102 (token inválido/expirado), marca needs_reconnect no DB.
 *
 * Retry policy:
 * - Até MAX_RETRIES (3) tentativas para erros marcados `retry: true` no map.
 * - Backoff exponencial: backoffMs * 2^(tentativa-1).
 * - Em POST/DELETE, só faz retry se code está em POST_RETRY_WHITELIST
 *   (rate limit confirmado pré-execução) — evita duplicar criação de recurso.
 * - Rate limit é consumido ANTES de cada tentativa (não só na primeira),
 *   senão retry burlaria o limit.
 *
 * @param {'GET'|'POST'|'DELETE'} method
 * @param {string} endpoint — ex: '/act_123/campaigns' ou 'me/accounts'
 * @param {object} params — query/body params (serializados via URLSearchParams)
 * @param {object} opts — { token, rateLimitKey, timeoutMs }
 */
async function metaRequest(method, endpoint, params = {}, opts = {}) {
  const { token, rateLimitKey = token || 'global' } = opts;

  let attempt = 0;
  let lastError = null;

  while (attempt < MAX_RETRIES) {
    attempt++;

    /* Rate limit bloqueia curto se necessário — Meta retorna 4/17/613 se exceder.
       Consome 1 token a cada tentativa pra retry não burlar o limit. */
    await rateLimit.take(rateLimitKey, 1);

    let json, headers;
    try {
      ({ json, headers } = await singleAttempt(method, endpoint, params, opts));
    } catch (netErr) {
      /* Erro de rede/timeout (não é resposta JSON do Meta).
         Trata como retryável em GET; em POST/DELETE propaga
         (não dá pra saber se request foi processada). */
      lastError = netErr;
      if (method === 'GET' && attempt < MAX_RETRIES) {
        const backoff = DEFAULT_BACKOFF_MS * Math.pow(2, attempt - 1);
        console.warn(`[metaHttp] retry ${attempt}/${MAX_RETRIES} para ${method} ${endpoint} após erro de rede com backoff ${backoff}ms: ${netErr.message}`);
        await sleep(backoff);
        continue;
      }
      throw netErr;
    }

    /* Processa X-App-Usage / X-Business-Use-Case-Usage / X-Ad-Account-Usage.
       Roda em SUCESSO e em ERRO — Meta envia esses headers em ambos os casos. */
    const usage = parseUsageHeaders(headers);
    if (usage && usage.peak_pct >= ABORT_THRESHOLD) {
      const abortErr = new Error(
        `Uso da API Meta em ${usage.peak_pct}% — abortando pra proteger conta. ` +
        `Aguarde ~1h pro contador zerar. Detalhes: call_count=${usage.call_count_pct}%, ` +
        `cputime=${usage.total_cputime_pct}%, time=${usage.total_time_pct}%, buc=${usage.buc_peak_pct}%, ad_acct=${usage.ad_account_pct}%`
      );
      abortErr.code = 'META_USAGE_CRITICAL';
      abortErr.usage = usage;
      console.error(`[metaHttp] 🚨 ABORT: ${abortErr.message}`);
      throw abortErr;
    }
    if (usage && usage.peak_pct >= WARN_THRESHOLD) {
      console.warn(`[metaHttp] ⚠️ Uso Meta em ${usage.peak_pct}% (limite ${ABORT_THRESHOLD}%) — endpoint=${endpoint}`);
    }

    if (!json.error) {
      return json; /* sucesso */
    }

    /* Resposta de erro do Meta */
    const parsed = parseMetaError(json.error);

    /* Auto-marca needs_reconnect pra qualquer endpoint bater 190/102.
       Lazy require pra evitar ciclo (metaToken → db → ...). */
    if (parsed.reconnect === true) {
      try {
        const { markNeedsReconnect } = require('./metaToken');
        await markNeedsReconnect('meta');
      } catch { /* best-effort, não quebra o erro original */ }
    }

    const err = new Error(parsed.pt);
    err.meta = parsed;
    err.endpoint = endpoint;
    err.params = params;
    lastError = err;

    /* Decide se faz retry: respeita whitelist de POST/DELETE */
    const canRetry = isRetryableForMethod(parsed, method);
    if (!canRetry || attempt >= MAX_RETRIES) {
      throw err;
    }

    const backoff = (parsed.backoffMs || DEFAULT_BACKOFF_MS) * Math.pow(2, attempt - 1);
    console.warn(`[metaHttp] retry ${attempt}/${MAX_RETRIES} para code ${parsed.code} com backoff ${backoff}ms (${method} ${endpoint})`);
    await sleep(backoff);
  }

  /* Se sair do loop sem return/throw, propaga o último erro (defensivo) */
  throw lastError || new Error(`metaRequest: esgotou ${MAX_RETRIES} tentativas em ${method} ${endpoint}`);
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
  getLastUsage,
  API_VERSION,
  GRAPH_HOST,
  DEFAULT_TIMEOUT_MS,
};
