const BUCKETS = new Map();
const CAPACITY = 180;
const REFILL_PER_MS = CAPACITY / (60 * 60 * 1000);

function getBucket(key) {
  const now = Date.now();
  let b = BUCKETS.get(key);
  if (!b) {
    b = { tokens: CAPACITY, last: now };
    BUCKETS.set(key, b);
    return b;
  }
  const elapsed = now - b.last;
  b.tokens = Math.min(CAPACITY, b.tokens + elapsed * REFILL_PER_MS);
  b.last = now;
  return b;
}

async function take(key = 'default', cost = 1) {
  const b = getBucket(key);
  if (b.tokens >= cost) {
    b.tokens -= cost;
    return { ok: true, waitedMs: 0 };
  }
  const deficit = cost - b.tokens;
  const waitMs = Math.ceil(deficit / REFILL_PER_MS);
  await new Promise(r => setTimeout(r, waitMs));
  const b2 = getBucket(key);
  b2.tokens = Math.max(0, b2.tokens - cost);
  return { ok: true, waitedMs: waitMs };
}

function tryTake(key = 'default', cost = 1) {
  const b = getBucket(key);
  if (b.tokens >= cost) {
    b.tokens -= cost;
    return true;
  }
  return false;
}

function status(key = 'default') {
  const b = getBucket(key);
  return { tokens: Math.floor(b.tokens), capacity: CAPACITY };
}

module.exports = { take, tryTake, status };
