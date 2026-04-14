const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../dev.db');
const db = new Database(dbPath);

// Habilitar WAL para melhor performance
db.pragma('journal_mode = WAL');

// Criar tabelas
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
    impressions INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    scheduled_for TEXT,
    submitted_at TEXT,
    review_started_at TEXT,
    live_at TEXT,
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
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS alert_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
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
`);

// Migração: adiciona colunas novas em bancos já existentes (ignora erro se já existir)
const newCols = [
  'ALTER TABLE campaigns ADD COLUMN publish_mode TEXT DEFAULT "immediate"',
  'ALTER TABLE campaigns ADD COLUMN scheduled_for TEXT',
  'ALTER TABLE campaigns ADD COLUMN submitted_at TEXT',
  'ALTER TABLE campaigns ADD COLUMN review_started_at TEXT',
  'ALTER TABLE campaigns ADD COLUMN live_at TEXT',
];
for (const sql of newCols) {
  try { db.exec(sql); } catch {}
}

// Adapter compatível com a interface do pg (query com callback de promessa)
const pool = {
  query: (text, params = []) => {
    try {
      // Converter $1, $2... para ? do SQLite
      const sqliteText = text.replace(/\$(\d+)/g, '?');

      const upper = text.trim().toUpperCase();
      if (upper.startsWith('SELECT') || upper.startsWith('WITH')) {
        const stmt = db.prepare(sqliteText);
        const rows = stmt.all(...params);
        return Promise.resolve({ rows });
      } else if (upper.startsWith('INSERT')) {
        // Se tem RETURNING, busca o registro inserido
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
          // Extrair tabela e condição WHERE id
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
