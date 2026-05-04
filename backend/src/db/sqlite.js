const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../dev.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    platform_campaign_id TEXT,
    status TEXT DEFAULT 'active',
    publish_mode TEXT DEFAULT 'immediate',
    budget REAL,
    spent REAL DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    link_clicks INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    scheduled_for TEXT,
    submitted_at TEXT,
    review_started_at TEXT,
    live_at TEXT,
    payload TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(platform, platform_campaign_id)
  );

  CREATE TABLE IF NOT EXISTS platform_credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT UNIQUE NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    account_id TEXT,
    token_expires_at TEXT,
    token_type TEXT,
    scopes TEXT,
    page_id TEXT,
    ig_business_id TEXT,
    needs_reconnect INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id INTEGER,
    description TEXT,
    meta TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ad_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    platform_ad_set_id TEXT UNIQUE,
    name TEXT,
    status TEXT,
    daily_budget REAL,
    lifetime_budget REAL,
    targeting TEXT,
    optimization_goal TEXT,
    billing_event TEXT,
    start_time TEXT,
    end_time TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS creatives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform_creative_id TEXT UNIQUE,
    name TEXT,
    title TEXT,
    body TEXT,
    cta_type TEXT,
    link_url TEXT,
    image_hash TEXT,
    video_id TEXT,
    page_id TEXT,
    ig_actor_id TEXT,
    format TEXT,
    payload TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad_set_id INTEGER REFERENCES ad_sets(id) ON DELETE CASCADE,
    creative_id INTEGER REFERENCES creatives(id) ON DELETE SET NULL,
    platform_ad_id TEXT UNIQUE,
    name TEXT,
    status TEXT,
    review_status TEXT,
    service TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    kind TEXT NOT NULL,
    image_hash TEXT,
    video_id TEXT,
    source_url TEXT,
    width INTEGER,
    height INTEGER,
    byte_size INTEGER,
    sha256 TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE (platform, sha256)
  );

  CREATE TABLE IF NOT EXISTS insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad_id INTEGER REFERENCES ads(id) ON DELETE CASCADE,
    ad_set_id INTEGER REFERENCES ad_sets(id) ON DELETE CASCADE,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    date_start TEXT NOT NULL,
    date_stop TEXT NOT NULL,
    spend REAL DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    unique_clicks INTEGER DEFAULT 0,
    ctr REAL DEFAULT 0,
    cpc REAL DEFAULT 0,
    cpm REAL DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    cost_per_conversion REAL DEFAULT 0,
    raw TEXT,
    fetched_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS insights_by_district (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad_id INTEGER REFERENCES ads(id) ON DELETE CASCADE,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    district TEXT NOT NULL,
    service TEXT,
    date_start TEXT NOT NULL,
    date_stop TEXT NOT NULL,
    spend REAL DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    ad_set_id TEXT,
    ring_key TEXT,
    region TEXT,
    city TEXT,
    fetched_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_insights_campaign_date ON insights(campaign_id, date_start);
  CREATE INDEX IF NOT EXISTS idx_insights_district ON insights_by_district(district, date_start);
  CREATE INDEX IF NOT EXISTS idx_insights_district_service ON insights_by_district(district, service);
  /* Índices em ring_key/ad_set_id criados no loop de migrações abaixo,
     porque dependem das colunas adicionadas via ALTER TABLE (db.exec
     executa ANTES do loop de migrations). */

  CREATE TABLE IF NOT EXISTS oauth_states (
    state TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

  /* Análises de concorrente — feature "Espionar Concorrente". JSON em TEXT. */
  CREATE TABLE IF NOT EXISTS competitor_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    source_url TEXT,
    items TEXT,
    descriptions TEXT,
    insights TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_competitor_analyses_created ON competitor_analyses(created_at DESC);

  /* Dedup de eventos webhook — replay guard contra reentregas do Meta.
     processed_at usa TEXT/CURRENT_TIMESTAMP (sem fuso) pois SQLite não tem
     tipo TIMESTAMPTZ nativo; equivale ao TIMESTAMPTZ do schema PG. */
  CREATE TABLE IF NOT EXISTS processed_webhook_events (
    event_id TEXT PRIMARY KEY,
    source TEXT NOT NULL DEFAULT 'meta',
    processed_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_pwe_processed_at ON processed_webhook_events(processed_at);

  /* Token bucket compartilhado para rate limit da Meta API.
     REAL equivale a DOUBLE PRECISION do PG. last_refill em TEXT (ISO 8601). */
  CREATE TABLE IF NOT EXISTS rate_limit_buckets (
    key TEXT PRIMARY KEY,
    tokens REAL NOT NULL DEFAULT 180,
    last_refill TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const migrations = [
  'ALTER TABLE campaigns ADD COLUMN publish_mode TEXT DEFAULT "immediate"',
  'ALTER TABLE campaigns ADD COLUMN scheduled_for TEXT',
  'ALTER TABLE campaigns ADD COLUMN submitted_at TEXT',
  'ALTER TABLE campaigns ADD COLUMN review_started_at TEXT',
  'ALTER TABLE campaigns ADD COLUMN live_at TEXT',
  'ALTER TABLE campaigns ADD COLUMN payload TEXT',
  'ALTER TABLE platform_credentials ADD COLUMN token_expires_at TEXT',
  'ALTER TABLE platform_credentials ADD COLUMN token_type TEXT',
  'ALTER TABLE platform_credentials ADD COLUMN scopes TEXT',
  'ALTER TABLE platform_credentials ADD COLUMN page_id TEXT',
  'ALTER TABLE platform_credentials ADD COLUMN ig_business_id TEXT',
  'ALTER TABLE platform_credentials ADD COLUMN needs_reconnect INTEGER DEFAULT 0',
  /* Insights por anel/ad_set — pra HeatMap e card "Performance por anel" usar dado real do Meta */
  'ALTER TABLE insights_by_district ADD COLUMN ad_set_id TEXT',
  'ALTER TABLE insights_by_district ADD COLUMN ring_key TEXT',
  'ALTER TABLE insights_by_district ADD COLUMN region TEXT',
  'ALTER TABLE insights_by_district ADD COLUMN city TEXT',
  /* Índices nas colunas novas — DEPOIS dos ALTER TABLE acima */
  'CREATE INDEX IF NOT EXISTS idx_insights_ring ON insights_by_district(ring_key, date_start)',
  'CREATE INDEX IF NOT EXISTS idx_insights_adset ON insights_by_district(ad_set_id, date_start)',
  /* UNIQUE parcial pra dedup de insights — espelha schema.sql do PG.
     SQLite suporta partial indexes desde 3.8.0. */
  'CREATE UNIQUE INDEX IF NOT EXISTS uniq_insights_period_camp ON insights (campaign_id, date_start, date_stop) WHERE ad_id IS NULL',
  'CREATE UNIQUE INDEX IF NOT EXISTS uniq_insights_period_ad ON insights (campaign_id, ad_id, date_start, date_stop) WHERE ad_id IS NOT NULL',
];
for (const sql of migrations) {
  try { db.exec(sql); } catch {}
}

const pool = {
  query: (text, params = []) => {
    try {
      const sqliteText = text.replace(/\$(\d+)/g, '?');
      const upper = text.trim().toUpperCase();
      if (upper.startsWith('SELECT') || upper.startsWith('WITH')) {
        const stmt = db.prepare(sqliteText);
        const rows = stmt.all(...params);
        return Promise.resolve({ rows });
      } else if (upper.startsWith('INSERT')) {
        const hasReturning = /RETURNING/i.test(text);
        const cleanSql = sqliteText.replace(/RETURNING\s+\*/i, '');
        const stmt = db.prepare(cleanSql);
        const result = stmt.run(...params);
        if (hasReturning) {
          const table = text.match(/INTO\s+(\w+)/i)?.[1];
          if (table) {
            const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(result.lastInsertRowid);
            return Promise.resolve({ rows: row ? [row] : [] });
          }
        }
        return Promise.resolve({ rows: [], rowCount: result.changes });
      } else if (upper.startsWith('UPDATE')) {
        const hasReturning = /RETURNING/i.test(text);
        const cleanSql = sqliteText.replace(/RETURNING\s+\*/i, '');
        const stmt = db.prepare(cleanSql);
        const result = stmt.run(...params);
        if (hasReturning && result.changes > 0) {
          const table = text.match(/UPDATE\s+(\w+)/i)?.[1];
          const idParam = params[params.length - 1];
          if (table) {
            const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(idParam);
            return Promise.resolve({ rows: row ? [row] : [] });
          }
        }
        return Promise.resolve({ rows: [], rowCount: result.changes });
      } else if (upper.startsWith('DELETE')) {
        const stmt = db.prepare(sqliteText);
        const result = stmt.run(...params);
        return Promise.resolve({ rows: [], rowCount: result.changes });
      } else {
        db.exec(text);
        return Promise.resolve({ rows: [] });
      }
    } catch (err) {
      return Promise.reject(err);
    }
  }
};

module.exports = pool;
