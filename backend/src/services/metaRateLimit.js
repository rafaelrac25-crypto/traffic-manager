/* Persistência via Postgres compartilhado entre instâncias serverless.
   Fallback in-memory se DB indisponível.
   Token bucket: 180 req/h por chave (1 token a cada 20s). */

const db = require('../db');

const CAPACITY = 180;
const REFILL_PER_SEC = CAPACITY / (60 * 60); // 0.05 tokens/seg

/* ─── Fallback in-memory (usado apenas quando DB está indisponível) ─── */
const FALLBACK = new Map();

function fallbackGetBucket(key) {
  const now = Date.now();
  let b = FALLBACK.get(key);
  if (!b) {
    b = { tokens: CAPACITY, lastMs: now };
    FALLBACK.set(key, b);
    return b;
  }
  const elapsedSec = (now - b.lastMs) / 1000;
  b.tokens = Math.min(CAPACITY, b.tokens + elapsedSec * REFILL_PER_SEC);
  b.lastMs = now;
  return b;
}

function fallbackDebit(key, cost) {
  const b = fallbackGetBucket(key);
  if (b.tokens >= cost) {
    b.tokens -= cost;
    return true;
  }
  return false;
}

/* ─── Query atômica: UPSERT + refill + debit em único CTE ─── */
/*
  Parâmetros (7 no total):
    $1 = key           (INSERT — chave nova)
    $2 = CAPACITY      (INSERT — tokens inicial)
    $3 = CAPACITY      (LEAST — cap máximo do refill)
    $4 = REFILL_PER_SEC (multiplicador do refill)
    $5 = cost          (débito a subtrair)
    $6 = key           (WHERE key = no UPDATE)
    $7 = cost          (AND tokens >= no UPDATE — guarda contra corrida)

  db/index.js converte ? → $N em ordem, então passamos os 7 valores
  nessa sequência exata em `params`.

  Retorna 1 row com tokens restantes se o débito foi aceito.
  Retorna 0 rows se tokens insuficientes (UPDATE não satisfez a condição).
*/
const UPSERT_SQL = `
  WITH upsert AS (
    INSERT INTO rate_limit_buckets (key, tokens, last_refill)
    VALUES (?, ?, NOW())
    ON CONFLICT (key) DO UPDATE SET
      tokens = LEAST(?::float,
        rate_limit_buckets.tokens
        + EXTRACT(EPOCH FROM (NOW() - rate_limit_buckets.last_refill)) * ?::float),
      last_refill = NOW()
    RETURNING tokens
  )
  UPDATE rate_limit_buckets
     SET tokens = (SELECT tokens FROM upsert) - ?::float
   WHERE key = ?
     AND (SELECT tokens FROM upsert) >= ?::float
  RETURNING tokens
`;

async function refillAndDebit(key, cost) {
  const params = [key, CAPACITY, CAPACITY, REFILL_PER_SEC, cost, key, cost];
  const result = await db.query(UPSERT_SQL, params);
  return result.rows; // array vazio = sem tokens; array com 1 item = débito aceito
}

async function safeRefillAndDebit(key, cost) {
  try {
    return await refillAndDebit(key, cost);
  } catch (e) {
    console.warn('[rateLimit] DB indisponível, usando fallback in-memory:', e.message);
    const ok = fallbackDebit(key, cost);
    // Simula o shape de retorno: 1 row com tokens se ok, array vazio se não
    return ok ? [{ tokens: FALLBACK.get(key)?.tokens ?? CAPACITY - cost }] : [];
  }
}

/* ─── status: tokens atuais sem debitar ─── */
async function safeStatus(key) {
  try {
    const result = await db.query(
      'SELECT tokens FROM rate_limit_buckets WHERE key = ?',
      [key]
    );
    if (result.rows.length === 0) return { tokens: CAPACITY, capacity: CAPACITY };
    return { tokens: Math.floor(result.rows[0].tokens), capacity: CAPACITY };
  } catch (e) {
    console.warn('[rateLimit] DB indisponível (status), usando fallback:', e.message);
    const b = fallbackGetBucket(key);
    return { tokens: Math.floor(b.tokens), capacity: CAPACITY };
  }
}

/* ─── Interface pública ─── */

/**
 * take(key, cost) → Promise<{ ok: true, waitedMs: number }>
 * Espera até ter tokens suficientes (timeout de 60s).
 */
async function take(key = 'default', cost = 1) {
  const deadline = Date.now() + 60_000;
  let totalWaited = 0;

  while (true) {
    const rows = await safeRefillAndDebit(key, cost);
    if (rows.length > 0) {
      return { ok: true, waitedMs: totalWaited };
    }

    // Sem tokens: calcular tempo de espera baseado no déficit atual
    const st = await safeStatus(key);
    const deficit = cost - st.tokens;
    const waitMs = Math.max(200, Math.ceil((deficit / REFILL_PER_SEC) * 1000));

    if (totalWaited > 5_000) {
      console.warn(`[rateLimit] aguardando token há ${totalWaited}ms (key=${key})`);
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      // Timeout: deixa passar com aviso (não bloqueia chamadas Meta para sempre)
      console.warn(`[rateLimit] timeout 60s atingido, liberando mesmo sem token (key=${key})`);
      return { ok: true, waitedMs: totalWaited };
    }

    const sleepMs = Math.min(waitMs, remaining);
    await new Promise(r => setTimeout(r, sleepMs));
    totalWaited += sleepMs;
  }
}

/**
 * tryTake(key, cost) → boolean
 * Não espera — retorna false imediatamente se não há tokens.
 */
async function tryTake(key = 'default', cost = 1) {
  const rows = await safeRefillAndDebit(key, cost);
  return rows.length > 0;
}

/**
 * status(key) → Promise<{ tokens, capacity }>
 */
async function status(key = 'default') {
  return safeStatus(key);
}

module.exports = { take, tryTake, status };
