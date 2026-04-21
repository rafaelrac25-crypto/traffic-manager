const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

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
];

async function runMigrations(pool) {
  try {
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    const statements = schema.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
    for (const s of statements) {
      try { await pool.query(s); }
      catch (e) { console.warn('[migrate] skip:', e.message.slice(0, 120)); }
    }
    for (const s of ADD_COLUMNS) {
      try { await pool.query(s); }
      catch (e) { console.warn('[migrate] skip col:', e.message.slice(0, 120)); }
    }
    console.log('[migrate] OK');
  } catch (e) {
    console.error('[migrate] failed:', e.message);
  }
}

module.exports = { runMigrations };
