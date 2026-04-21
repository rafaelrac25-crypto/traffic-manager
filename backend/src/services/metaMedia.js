const https = require('https');
const { decrypt } = require('./crypto');
const { parseMetaError } = require('./metaErrors');

const API_VERSION = 'v20.0';
const GRAPH_HOST = 'graph.facebook.com';

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

function uploadImage(creds, base64OrDataUrl) {
  const token = getToken(creds);
  const accountId = creds.account_id;
  if (!accountId) throw new Error('account_id ausente');
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
            return reject(e);
          }
          const images = json.images || {};
          const first = Object.values(images)[0];
          if (!first?.hash) return reject(new Error('Meta não retornou image_hash'));
          resolve({ hash: first.hash, url: first.url || null });
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/* Upload de vídeo pro Meta via POST /act_XXX/advideos com multipart/form-data.
   Meta retorna {id} do vídeo que vira video_id no creative. Para vídeos grandes
   (>1GB) Meta exige chunked upload, mas nosso limite cliente é 8MB — simples. */
async function uploadVideo(creds, base64OrDataUrl) {
  const token = getToken(creds);
  const accountId = creds.account_id;
  if (!accountId) throw new Error('account_id ausente');
  const clean = stripDataPrefix(base64OrDataUrl);
  const buffer = Buffer.from(clean, 'base64');

  const form = new FormData();
  const blob = new Blob([buffer], { type: 'video/mp4' });
  form.append('source', blob, 'video.mp4');
  form.append('access_token', token);

  const url = `https://${GRAPH_HOST}/${API_VERSION}/${accountId}/advideos`;
  const res = await fetch(url, { method: 'POST', body: form });
  const json = await res.json();
  if (json.error) {
    const parsed = parseMetaError(json.error);
    const e = new Error(parsed.pt);
    e.meta = parsed;
    throw e;
  }
  if (!json.id) throw new Error('Meta não retornou video_id');
  return { id: json.id };
}

module.exports = { uploadImage, uploadVideo };
