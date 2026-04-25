// Usa SQLite em desenvolvimento (sem DATABASE_URL) e PostgreSQL em produção
if (process.env.DATABASE_URL) {
    /* Driver oficial do Neon pra serverless. Resolve "Connection terminated
       unexpectedly" causado pelo `pg` puro tentando reusar conexões que o
       Neon fechou por idle timeout em Vercel Functions. API drop-in com pg.Pool. */
    const { Pool, neonConfig } = require('@neondatabase/serverless');
    neonConfig.webSocketConstructor = require('ws');
    const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
    });
    const originalQuery = pool.query.bind(pool);
    pool.query = (text, params) => {
          if (typeof text === 'string' && text.includes('?')) {
                  let i = 0;
                  text = text.replace(/\?/g, () => `$${++i}`);
          }
          if (typeof text === 'string') {
                  text = text.replace(/datetime\s*\(\s*'now'\s*\)/gi, 'NOW()');
                  text = text.replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO');
                  if (text.match(/INSERT INTO/i) && !text.match(/ON CONFLICT/i)) {
                            text = text.replace(/VALUES\s*\([^)]+\)/i, (match) => match + ' ON CONFLICT DO NOTHING');
                  }
          }
          return originalQuery(text, params);
    };
    require('./migrate').runMigrations(pool);
    module.exports = pool;
} else {
    module.exports = require('./sqlite');
}
