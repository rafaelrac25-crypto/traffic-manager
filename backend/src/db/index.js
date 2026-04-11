// Usa SQLite em desenvolvimento (sem DATABASE_URL) e PostgreSQL em produção
if (process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
    // Wrapper: converte placeholders ? para $1, $2... (compatibilidade SQLite -> PG)
  const originalQuery = pool.query.bind(pool);
    pool.query = (text, params) => {
          if (typeof text === 'string' && text.includes('?')) {
                  let i = 0;
                  text = text.replace(/\?/g, () => `$${++i}`);
          }
          // Converte INSERT OR IGNORE para ON CONFLICT DO NOTHING (PG)
          if (typeof text === 'string') {
                  text = text.replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO');
                  if (text.match(/INSERT INTO/i) && !text.match(/ON CONFLICT/i)) {
                            text = text.replace(/VALUES\s*\([^)]+\)/i, (match) => match + ' ON CONFLICT DO NOTHING');
                  }
          }
          return originalQuery(text, params);
    };
    module.exports = pool;
} else {
    module.exports = require('./sqlite');
}
