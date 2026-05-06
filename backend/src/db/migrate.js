const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

/* Buffer temporário pra upload chunked de imagens grandes (Vercel limita
   request body em 4.5MB, então imagem > 4MB precisa subir em chunks que
   o backend acumula até completar pra disparar upload pro Meta /adimages
   numa única chamada). Chunks são deletados após /finish ou via cleanup
   de sessões antigas (24h). */
/* DDL exportado pra reuso em routes/upload.js (ensureImageSessionsTable).
   Single source — qualquer mudança aqui propaga automaticamente. */
const IMAGE_UPLOAD_SESSIONS_DDL = `CREATE TABLE IF NOT EXISTS image_upload_sessions (
    session_id TEXT PRIMARY KEY,
    mime TEXT NOT NULL,
    total_size INTEGER NOT NULL,
    received_size INTEGER NOT NULL DEFAULT 0,
    chunks BYTEA,
    created_at TIMESTAMP DEFAULT NOW()
  )`;

const CREATE_TABLES = [IMAGE_UPLOAD_SESSIONS_DDL];

const ADD_COLUMNS = [
  'ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS publish_mode VARCHAR(20) DEFAULT \'immediate\'',
  'ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP',
  'ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP',
  'ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS review_started_at TIMESTAMP',
  'ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS live_at TIMESTAMP',
  'ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS payload TEXT',
  'ALTER TABLE platform_credentials ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP',
  'ALTER TABLE platform_credentials ADD COLUMN IF NOT EXISTS token_type VARCHAR(40)',
  'ALTER TABLE platform_credentials ADD COLUMN IF NOT EXISTS scopes TEXT',
  'ALTER TABLE platform_credentials ADD COLUMN IF NOT EXISTS page_id VARCHAR(255)',
  'ALTER TABLE platform_credentials ADD COLUMN IF NOT EXISTS ig_business_id VARCHAR(255)',
  'ALTER TABLE platform_credentials ADD COLUMN IF NOT EXISTS needs_reconnect INTEGER DEFAULT 0',
  /* effective_status: status real do Meta (ACTIVE/PENDING_REVIEW/IN_PROCESS/DISAPPROVED/WITH_ISSUES/PAUSED) */
  'ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS effective_status TEXT',
  'ALTER TABLE ad_sets ADD COLUMN IF NOT EXISTS effective_status TEXT',
  'ALTER TABLE ads ADD COLUMN IF NOT EXISTS effective_status TEXT',
  /* link_clicks: Meta inline_link_clicks (cliques no CTA/link, exclui likes/follows).
     Mantido aqui mesmo com a coluna já no CREATE TABLE original — ADD COLUMN IF NOT EXISTS
     é idempotente em PG; o try/catch do loop cobre DBs antigos sem a coluna. */
  'ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS link_clicks INTEGER DEFAULT 0',
];

/* Tabelas adicionadas após o schema.sql original — criadas aqui pra garantir
   que instâncias de prod com schema antigo recebam a tabela sem recriar o DB.
   Idempotente: IF NOT EXISTS + try/catch no loop de runMigrations. */
const CREATE_TABLES_EXTRA = [
  `CREATE TABLE IF NOT EXISTS processed_webhook_events (
    event_id TEXT PRIMARY KEY,
    source TEXT NOT NULL DEFAULT 'meta',
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pwe_processed_at ON processed_webhook_events(processed_at)`,
  /* Token bucket compartilhado entre instâncias serverless para rate limit
     da Meta API (180 req/h por chave). Idempotente: IF NOT EXISTS. */
  `CREATE TABLE IF NOT EXISTS rate_limit_buckets (
    key TEXT PRIMARY KEY,
    tokens DOUBLE PRECISION NOT NULL DEFAULT 180,
    last_refill TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  /* Agency 2D events — persistido pra sobreviver a cold starts em multi-instance.
     POST /event insere; GET /recent lê últimos 50. Cleanup mantém só 200. */
  `CREATE TABLE IF NOT EXISTS agency_events (
    id TEXT PRIMARY KEY,
    ts BIGINT NOT NULL,
    agent TEXT NOT NULL,
    tool TEXT NOT NULL,
    action TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'ok',
    duration_ms INTEGER,
    meta JSONB
  )`,
  `CREATE INDEX IF NOT EXISTS idx_agency_events_ts ON agency_events(ts DESC)`,
  /* Jobs de publicação assíncrona — resolve timeout 504 em campanhas com múltiplos adsets */
  `CREATE TABLE IF NOT EXISTS publish_jobs (
    id TEXT PRIMARY KEY,
    campaign_id_local INTEGER,
    status TEXT NOT NULL DEFAULT 'queued',
    current_step INTEGER NOT NULL DEFAULT 0,
    total_steps INTEGER NOT NULL DEFAULT 0,
    message TEXT,
    payload TEXT,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_publish_jobs_status ON publish_jobs(status, updated_at DESC)`,
];

async function runMigrations(pool) {
  try {
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    const statements = schema.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
    for (const s of statements) {
      try { await pool.query(s); }
      catch (e) { console.warn('[migrate] skip:', e.message.slice(0, 120)); }
    }
    for (const s of CREATE_TABLES) {
      try { await pool.query(s); }
      catch (e) { console.warn('[migrate] skip table:', e.message.slice(0, 120)); }
    }
    for (const s of CREATE_TABLES_EXTRA) {
      try { await pool.query(s); }
      catch (e) { console.warn('[migrate] skip table extra:', e.message.slice(0, 120)); }
    }
    for (const s of ADD_COLUMNS) {
      try { await pool.query(s); }
      catch (e) { console.warn('[migrate] skip col:', e.message.slice(0, 120)); }
    }
    /* Cleanup de sessões de upload abandonadas (>24h, não finalizaram). */
    try {
      await pool.query("DELETE FROM image_upload_sessions WHERE created_at < NOW() - INTERVAL '24 hours'");
    } catch (e) {
      /* SQLite usa sintaxe diferente — ignora silencioso em dev */
    }
    console.log('[migrate] OK');
  } catch (e) {
    console.error('[migrate] failed:', e.message);
  }
}

module.exports = { runMigrations, IMAGE_UPLOAD_SESSIONS_DDL };
