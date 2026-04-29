const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

/* Buffer temporário pra upload chunked de imagens grandes (Vercel limita
   request body em 4.5MB, então imagem > 4MB precisa subir em chunks que
   o backend acumula até completar pra disparar upload pro Meta /adimages
   numa única chamada). Chunks são deletados após /finish ou via cleanup
   de sessões antigas (24h). */
const CREATE_TABLES = [
  `CREATE TABLE IF NOT EXISTS image_upload_sessions (
    session_id TEXT PRIMARY KEY,
    mime TEXT NOT NULL,
    total_size INTEGER NOT NULL,
    received_size INTEGER NOT NULL DEFAULT 0,
    chunks BYTEA,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
];

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

module.exports = { runMigrations };
