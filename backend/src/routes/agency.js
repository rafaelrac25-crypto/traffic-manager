/**
 * Agency 2D — pipeline em tempo real de eventos do Claude Code.
 *
 * Hooks do CLI fazem POST /api/agency/event a cada PostToolUse.
 * Frontend (/agencia) escuta /api/agency/stream via SSE e anima bonecos.
 *
 * Storage: in-memory (ring buffer de 200). Reseta em cold start — aceitável
 * pra Fase 1; histórico em DB fica pra fase futura se valer a pena.
 *
 * Auth: header X-Agency-Secret comparado com env AGENCY_SECRET via
 * timingSafeEqual. Se AGENCY_SECRET ausente, deixa passar com warning
 * (modo bootstrap — facilita primeira iteração antes de setar env no Vercel).
 */
const express = require('express');
const crypto = require('crypto');
const EventEmitter = require('events');

const router = express.Router();

const MAX_EVENTS = 200;
const RECENT_DEFAULT = 50;
const RECENT_MAX = 100;

/* Buffer FIFO simples — array com cap MAX_EVENTS. */
const events = [];
const emitter = new EventEmitter();
emitter.setMaxListeners(50);

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

/* Limpa buckets antigos a cada 5 min pra não vazar memória. */
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [ip, b] of buckets) {
    if (b.last < cutoff) buckets.delete(ip);
  }
}, 5 * 60 * 1000).unref?.();

function authOk(req) {
  const expected = process.env.AGENCY_SECRET;
  if (!expected) return true; /* modo bootstrap */
  const got = req.header('x-agency-secret') || '';
  if (got.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  } catch {
    return false;
  }
}

/* Sanitiza payload — barra paths absolutos completos, limita tamanhos.
   Hook já filtra antes; este é defesa em profundidade. */
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
      /* aceita só basename — sem path absoluto, sem traversal */
      const basename = raw.meta.file.split(/[\\\/]/).pop().slice(0, 80);
      if (basename && !/^\.env|secret|credential|password|token/i.test(basename)) {
        m.file = basename;
      }
    }
    if (raw.meta.cmd && typeof raw.meta.cmd === 'string') {
      m.cmd = raw.meta.cmd.slice(0, 60);
    }
    if (typeof raw.meta.bytes === 'number') m.bytes = Math.round(raw.meta.bytes);
    if (Object.keys(m).length > 0) ev.meta = m;
  }
  return ev;
}

router.post('/event', (req, res) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  if (!take(String(ip))) return res.status(429).json({ ok: false, error: 'rate_limit' });
  if (!authOk(req)) return res.status(401).json({ ok: false, error: 'auth' });

  const ev = sanitize(req.body || {});
  events.push(ev);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  emitter.emit('event', ev);
  res.json({ ok: true, id: ev.id });
});

router.get('/recent', (req, res) => {
  const limit = Math.min(RECENT_MAX, Math.max(1, parseInt(req.query.limit, 10) || RECENT_DEFAULT));
  const slice = events.slice(-limit).reverse();
  res.json({ events: slice, total: events.length });
});

router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  res.write(`: connected ${Date.now()}\n\n`);

  const onEvent = (ev) => {
    try { res.write(`data: ${JSON.stringify(ev)}\n\n`); } catch { /* connection died */ }
  };
  emitter.on('event', onEvent);

  /* Heartbeat 30s — mantém conexão viva atrás de proxies (Vercel Fluid Compute,
     CDN, browsers que matam SSE ocioso). Linha de comentário no SSE não dispara
     handler client-side. */
  const heartbeat = setInterval(() => {
    try { res.write(`: heartbeat ${Date.now()}\n\n`); } catch { /* ok */ }
  }, 30_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    emitter.off('event', onEvent);
  });
});

module.exports = router;
