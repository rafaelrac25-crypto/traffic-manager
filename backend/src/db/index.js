// Usa SQLite em desenvolvimento (sem DATABASE_URL) e PostgreSQL em produção
if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  module.exports = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
} else {
  module.exports = require('./sqlite');
}
