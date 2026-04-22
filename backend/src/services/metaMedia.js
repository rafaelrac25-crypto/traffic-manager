const https = require('https');
const { decrypt } = require('./crypto');
const { parseMetaError } = require('./metaErrors');
const rateLimit = require('./metaRateLimit');

const API_VERSION = 'v20.0';
const GRAPH_HOST = 'graph.facebook.com';
const IMAGE_TIMEOUT_MS = 60000;    /* uploads podem demorar em imagens grandes */
const VIDEO_TIMEOUT_MS = 180000;   /* Meta aceita até ~15MB; rede lenta → até 3min */

function getToken(creds) {
  if (!creds?.access_token) throw new Error('Plataforma não conectada');
  if (String(creds.access_token).includes(':')) {
    try { return decrypt(creds.access_token); }
    catch { return creds.access_token; }
  }
  return creds.access_token;
}

function stripDataPrefix(s) {
  if (!s) return s;
  const idx = String(s).indexOf('base64,');
  return idx >= 0 ? s.slice(idx + 7) : s;
}

async function maybeMarkReconnect(err) {
  const meta = err?.meta || {};
  if (meta.code === 190 || meta.code === 102) {
    try {
      const { markNeedsReconnect } = require('./metaToken');
      await markNeedsReconnect('meta');
    } catch { /* best-effort */ }
  }
}

async function uploadImage(creds, base64OrDataUrl) {
  const token = getToken(creds);
  const accountId = creds.account_id;
  if (!accountId) throw new Error('account_id ausente');
  await rateLimit.take(token, 1);
  const bytes = stripDataPrefix(base64OrDataUrl);
  const body = new URLSearchParams({ bytes, access_token: token }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request({
      host: GRAPH_HOST,
      path: `/${API_VERSION}/${accountId}/adimages`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: IMAGE_TIMEOUT_MS,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data || '{}');
          if (json.error) {
            const parsed = parseMetaError(json.error);
            const e = new Error(parsed.pt);
            e.meta = parsed;
            maybeMarkReconnect(e).finally(() => reject(e));
            return;
          }
          const images = json.images || {};
          const first = Object.values(images)[0];
          if (!first?.hash) return reject(new Error('Meta não retornou image_hash'));
          resolve({ hash: first.hash, url: first.url || null });
        } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error(`Meta timeout (${IMAGE_TIMEOUT_MS}ms) em upload de imagem`));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/* Upload com AbortController → timeout via AbortSignal.timeout.
   Meta /advideos retorna {id} IMEDIATAMENTE, mas o vídeo ainda é processado
   async no lado deles — use waitForVideoReady antes de referenciar o
   video_id num creative pra evitar erro 1492013 (ad media processing). */
async function postVideoMultipart(token, accountId, buffer, filename) {
  await rateLimit.take(token, 1);
  const form = new FormData();
  const blob = new Blob([buffer], { type: 'video/mp4' });
  form.append('source', blob, filename);
  form.append('access_token', token);

  const url = `https://${GRAPH_HOST}/${API_VERSION}/${accountId}/advideos`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new Error(`Meta timeout (${VIDEO_TIMEOUT_MS}ms) em upload de vídeo`)), VIDEO_TIMEOUT_MS);
  let json;
  try {
    const res = await fetch(url, { method: 'POST', body: form, signal: ctrl.signal });
    json = await res.json();
  } finally {
    clearTimeout(t);
  }
  if (json.error) {
    const parsed = parseMetaError(json.error);
    const e = new Error(parsed.pt);
    e.meta = parsed;
    await maybeMarkReconnect(e);
    throw e;
  }
  if (!json.id) throw new Error('Meta não retornou video_id');
  return { id: json.id };
}

async function uploadVideo(creds, base64OrDataUrl) {
  const token = getToken(creds);
  const accountId = creds.account_id;
  if (!accountId) throw new Error('account_id ausente');
  const clean = stripDataPrefix(base64OrDataUrl);
  const buffer = Buffer.from(clean, 'base64');
  return postVideoMultipart(token, accountId, buffer, 'video.mp4');
}

async function uploadVideoBuffer(creds, buffer, filename = 'video.mp4') {
  const token = getToken(creds);
  const accountId = creds.account_id;
  if (!accountId) throw new Error('account_id ausente');
  return postVideoMultipart(token, accountId, buffer, filename);
}

/* Polling do status de processamento do vídeo no Meta.
   GET /{video_id}?fields=status → { status: { video_status: 'ready'|'processing'|'error' } }
   Retorna quando ficar 'ready' ou lança se 'error'/timeout.
   maxWaitMs default 60s — vídeos curtos ficam ready em <10s; limite máximo
   pra não deixar creative fase pendurar em serverless. */
async function waitForVideoReady(creds, videoId, { maxWaitMs = 60000, pollEveryMs = 3000 } = {}) {
  const token = getToken(creds);
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const url = `https://${GRAPH_HOST}/${API_VERSION}/${videoId}?fields=status&access_token=${encodeURIComponent(token)}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    let json;
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      json = await res.json();
    } catch (e) {
      /* Falha transiente de rede — tenta de novo na próxima iteração */
      await new Promise(r => setTimeout(r, pollEveryMs));
      continue;
    } finally { clearTimeout(t); }

    if (json.error) {
      const parsed = parseMetaError(json.error);
      const e = new Error(parsed.pt);
      e.meta = parsed;
      await maybeMarkReconnect(e);
      throw e;
    }
    const vstatus = json?.status?.video_status || json?.status || 'processing';
    if (vstatus === 'ready') return { ready: true, status: vstatus };
    if (vstatus === 'error') {
      const e = new Error('Meta rejeitou o vídeo durante processamento');
      e.meta = { code: null, subcode: null, pt: e.message };
      throw e;
    }
    await new Promise(r => setTimeout(r, pollEveryMs));
  }
  /* Timeout: não lança — retorna ready:false pra caller decidir (prosseguir
     e deixar Meta resolver, ou abortar). publishCampaign opta por prosseguir
     porque Meta aceita creative com vídeo "processing" em muitos casos. */
  return { ready: false, status: 'processing_timeout' };
}

module.exports = { uploadImage, uploadVideo, uploadVideoBuffer, waitForVideoReady };
