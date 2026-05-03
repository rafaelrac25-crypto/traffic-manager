/* Cron jobs do Vercel.
   Configurado em vercel.json sob "crons" — Vercel chama estes endpoints
   nos horarios definidos. Hobby plan: 1x/dia.
   Implementacao usa https.request nativo (compativel com qualquer Node)
   em vez de fetch global, pra evitar quebra silenciosa em runtimes antigos. */

const express = require('express');
const https = require('https');
const http = require('http');
const router = express.Router();

/* Helper: valida auth do cron.
   Em prod, defina CRON_SECRET no Vercel e o cron precisa enviar
   Authorization: Bearer <CRON_SECRET>. Vercel injeta isso automaticamente
   se a env var existir. Se nao definida, aceita qualquer (uso local). */
function requireCronAuth(req, res, next) {
  /* Trim defensivo — se admin colou env var com espaco/newline, ainda funciona */
  const expected = (process.env.CRON_SECRET || '').trim();
  if (!expected) return next();
  const auth = (req.headers.authorization || '').trim();
  if (auth === `Bearer ${expected}`) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

/* Promisified request usando http(s) nativo do Node.
   Compativel com Node 14+, sem depender de fetch global. */
function httpRequest(url, { method = 'GET', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return reject(new Error(`invalid url: ${url}`));
    }
    const lib = parsed.protocol === 'https:' ? https : http;
    const reqOpts = {
      method,
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers,
    };
    const r = lib.request(reqOpts, (resp) => {
      let chunks = [];
      resp.on('data', (c) => chunks.push(c));
      resp.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch (_) { /* not json */ }
        resolve({ status: resp.statusCode, text, json });
      });
    });
    r.on('error', reject);
    if (body) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}

/* GET /api/cron/ping — sonda de diagnostico (sem auth, sem dependencia
   externa). Se isso responder JSON, a rota /api/cron esta montada ok. */
router.get('/ping', (req, res) => {
  res.json({
    ok: true,
    pong: true,
    at: new Date().toISOString(),
    node: process.version,
    vercel_url: process.env.VERCEL_URL || null,
    has_cron_secret: !!process.env.CRON_SECRET,
  });
});

/* GET /api/cron/sync-meta — dispara sync das metricas Meta.
   Self-call pro POST /api/campaigns/sync-meta-status (que ja contem
   toda a logica). Trade-off: 1 invocacao extra por chamada, evita
   duplicar 177 linhas de logica. */
router.get('/sync-meta', requireCronAuth, async (req, res) => {
  const startedAt = new Date().toISOString();
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://127.0.0.1:${process.env.PORT || 3001}`;

    const r = await httpRequest(`${baseUrl}/api/campaigns/sync-meta-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = r.json || {};
    const updated = Array.isArray(data.updated) ? data.updated.length : 0;

    console.log(`[cron/sync-meta] ok startedAt=${startedAt} status=${r.status} updated=${updated}`);
    return res.json({
      ok: true,
      triggered_at: startedAt,
      finished_at: new Date().toISOString(),
      sync_status: r.status,
      updated_count: updated,
      detail: data,
    });
  } catch (e) {
    console.error('[cron/sync-meta] erro:', e.message);
    return res.status(500).json({
      ok: false,
      triggered_at: startedAt,
      error: e.message,
    });
  }
});

module.exports = router;
