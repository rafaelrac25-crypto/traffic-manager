const https = require('https');
const { URL } = require('url');
const { decrypt } = require('./crypto');
const { parseMetaError } = require('./metaErrors');

const API_VERSION = 'v20.0';
const GRAPH_HOST = 'graph.facebook.com';
const GRAPH_BASE = `/${API_VERSION}`;

function getToken(creds) {
  if (!creds?.access_token) throw new Error('Plataforma não conectada');
  if (String(creds.access_token).includes(':')) {
    try { return decrypt(creds.access_token); }
    catch { return creds.access_token; }
  }
  return creds.access_token;
}

function request(method, path, params = {}, { token } = {}) {
  return new Promise((resolve, reject) => {
    const search = new URLSearchParams();
    if (token) search.set('access_token', token);
    if (method === 'GET') {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) search.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
      });
    }
    const fullPath = `${GRAPH_BASE}${path}?${search.toString()}`;
    const body = method !== 'GET' ? new URLSearchParams(Object.entries(params).reduce((acc, [k, v]) => {
      if (v !== undefined && v !== null) acc[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return acc;
    }, {})).toString() : null;

    const req = https.request({
      host: GRAPH_HOST,
      path: fullPath,
      method,
      headers: body ? {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      } : {},
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
            e.status = res.statusCode;
            return reject(e);
          }
          resolve(json);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function updateCampaignStatus(creds, platformCampaignId, status) {
  const token = getToken(creds);
  const metaStatus = status === 'active' ? 'ACTIVE' : status === 'paused' ? 'PAUSED' : String(status).toUpperCase();
  return request('POST', `/${platformCampaignId}`, { status: metaStatus }, { token });
}

async function deleteCampaign(creds, platformCampaignId) {
  const token = getToken(creds);
  return request('DELETE', `/${platformCampaignId}`, {}, { token });
}

module.exports = { updateCampaignStatus, deleteCampaign, request, getToken };
