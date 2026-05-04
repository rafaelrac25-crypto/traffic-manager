/**
 * Agency 2D — pipeline em tempo real de eventos do Claude Code.
 *
 * Storage: tabela `agency_events` no Postgres (compartilhada entre instâncias
 * serverless do Vercel — sobrevive a cold starts).
 *
 * Hooks do CLI fazem POST /api/agency/event a cada PostToolUse.
 * Frontend (/agencia) faz polling de GET /recent a cada 1.5s — não usa SSE
 * porque SSE em multi-instance Vercel não dá pra rotear pra mesma instance
 * que recebe o POST.
 *
 * Auth: header X-Agency-Secret comparado com env AGENCY_SECRET via
 * timingSafeEqual. Se AGENCY_SECRET ausente, deixa passar com modo bootstrap.
 */
const express = require('express');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();

const RECENT_DEFAULT = 50;
const RECENT_MAX = 100;
const KEEP_CAP = 200;

/* Token bucket por IP — 10 req/s, capacidade 20.
   Protege contra hook bug em loop floodando o backend. */
const buckets = new Map();
const BUCKET_CAPACITY = 20;
const BUCKET_REFILL_PER_MS = 10 / 1000;

function take(ip) {
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b) {
    b = { tokens: BUCKET_CAPACITY, last: now };
    buckets.set(ip, b);
  } else {
    const elapsed = now - b.last;
    b.tokens = Math.min(BUCKET_CAPACITY, b.tokens + elapsed * BUCKET_REFILL_PER_MS);
    b.last = now;
  }
  if (b.tokens >= 1) {
    b.tokens -= 1;
    return true;
  }
  return false;
}

setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [ip, b] of buckets) {
    if (b.last < cutoff) buckets.delete(ip);
  }
}, 5 * 60 * 1000).unref?.();

function authOk(req) {
  const expected = process.env.AGENCY_SECRET;
  if (!expected) return true;
  const got = req.header('x-agency-secret') || '';
  if (got.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  } catch {
    return false;
  }
}

/* Sanitiza payload — barra paths absolutos completos, limita tamanhos. */
function sanitize(raw) {
  const ev = {
    id: crypto.randomBytes(8).toString('hex'),
    ts: Date.now(),
    agent: String(raw.agent || 'main').slice(0, 40),
    tool: String(raw.tool || 'unknown').slice(0, 30),
    action: String(raw.action || '').slice(0, 200),
    status: raw.status === 'error' ? 'error' : 'ok',
  };
  if (typeof raw.duration_ms === 'number' && raw.duration_ms >= 0 && raw.duration_ms < 600_000) {
    ev.duration_ms = Math.round(raw.duration_ms);
  }
  if (raw.meta && typeof raw.meta === 'object') {
    const m = {};
    if (raw.meta.file && typeof raw.meta.file === 'string') {
      const basename = raw.meta.file.split(/[\\\/]/).pop().slice(0, 80);
      if (basename && !/^\.env|secret|credential|password|token/i.test(basename)) {
        m.file = basename;
      }
    }
    if (raw.meta.cmd && typeof raw.meta.cmd === 'string') m.cmd = raw.meta.cmd.slice(0, 60);
    if (typeof raw.meta.bytes === 'number') m.bytes = Math.round(raw.meta.bytes);
    if (Object.keys(m).length > 0) ev.meta = m;
  }
  return ev;
}

/* Cleanup a cada N inserts (não a cada um — overhead).
   Mantém só os KEEP_CAP eventos mais recentes pra tabela não crescer infinito. */
let insertsSinceCleanup = 0;
async function maybeCleanup() {
  insertsSinceCleanup += 1;
  if (insertsSinceCleanup < 10) return;
  insertsSinceCleanup = 0;
  try {
    await db.query(
      'DELETE FROM agency_events WHERE id NOT IN (SELECT id FROM agency_events ORDER BY ts DESC LIMIT ?)',
      [KEEP_CAP],
    );
  } catch (e) {
    console.warn('[agency] cleanup falhou:', e.message);
  }
}

router.post('/event', async (req, res) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  if (!take(String(ip))) return res.status(429).json({ ok: false, error: 'rate_limit' });
  if (!authOk(req)) return res.status(401).json({ ok: false, error: 'auth' });

  const ev = sanitize(req.body || {});
  try {
    await db.query(
      'INSERT INTO agency_events (id, ts, agent, tool, action, status, duration_ms, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        ev.id,
        ev.ts,
        ev.agent,
        ev.tool,
        ev.action,
        ev.status,
        ev.duration_ms ?? null,
        ev.meta ? JSON.stringify(ev.meta) : null,
      ],
    );
    maybeCleanup().catch(() => {});
    res.json({ ok: true, id: ev.id });
  } catch (e) {
    console.warn('[agency] insert falhou:', e.message);
    res.status(500).json({ ok: false, error: 'db' });
  }
});

router.get('/recent', async (req, res) => {
  const limit = Math.min(RECENT_MAX, Math.max(1, parseInt(req.query.limit, 10) || RECENT_DEFAULT));
  const since = parseInt(req.query.since, 10) || 0;

  try {
    let result;
    if (since > 0) {
      /* Polling incremental — só eventos novos depois de `since` (epoch ms). */
      result = await db.query(
        'SELECT id, ts, agent, tool, action, status, duration_ms, meta FROM agency_events WHERE ts > ? ORDER BY ts DESC LIMIT ?',
        [since, limit],
      );
    } else {
      result = await db.query(
        'SELECT id, ts, agent, tool, action, status, duration_ms, meta FROM agency_events ORDER BY ts DESC LIMIT ?',
        [limit],
      );
    }
    const events = (result.rows || []).map(r => ({
      id: r.id,
      ts: Number(r.ts),
      agent: r.agent,
      tool: r.tool,
      action: r.action || '',
      status: r.status || 'ok',
      duration_ms: r.duration_ms != null ? Number(r.duration_ms) : undefined,
      meta: parseMeta(r.meta),
    }));
    res.json({ events, total: events.length, server_ts: Date.now() });
  } catch (e) {
    console.warn('[agency] select falhou:', e.message);
    res.json({ events: [], total: 0, server_ts: Date.now(), error: 'db' });
  }
});

function parseMeta(m) {
  if (!m) return undefined;
  if (typeof m === 'object') return m; /* PG JSONB já volta parseado */
  try { return JSON.parse(m); } catch { return undefined; }
}

module.exports = router;
