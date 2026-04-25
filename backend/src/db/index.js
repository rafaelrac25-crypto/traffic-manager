// Usa SQLite em desenvolvimento (sem DATABASE_URL) e PostgreSQL em produção
if (process.env.DATABASE_URL) {
    /* HTTP-only Neon driver. Pool/WebSocket mantém conexão persistente que o
       Neon fecha por idle em serverless, gerando "Connection terminated
       unexpectedly" — confirmado em produção mesmo com driver oficial.
       neon() faz 1 HTTP POST por query, sem conexão persistente, sem zumbi
       possível. fullResults:true retorna { rows, rowCount, ... } compatível
       com pg.Result que o resto do app espera. */
    const { neon } = require('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL, { fullResults: true });

    async function query(text, params = []) {
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
          /* Defesa em profundidade: 1 retry em erro de rede transitório.
             Mesmo HTTP pode dar fetch failed em troca de pod do Neon. */
          try {
                  return await sql.query(text, params);
          } catch (e) {
                  const msg = String(e?.message || '');
                  if (/Connection terminated|ECONN|fetch failed|network|socket hang up|ETIMEDOUT/i.test(msg)) {
                            console.warn('[db] retry após erro transitório:', msg.slice(0, 120));
                            return await sql.query(text, params);
                  }
                  throw e;
          }
    }

    const pool = { query };
    require('./migrate').runMigrations(pool);
    module.exports = pool;
} else {
    module.exports = require('./sqlite');
}
