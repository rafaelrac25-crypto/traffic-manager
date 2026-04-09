require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function init() {
  if (!process.env.DATABASE_URL) {
    // SQLite: schema já é criado automaticamente ao importar sqlite.js
    require('./sqlite');
    console.log('Banco SQLite inicializado com sucesso! (tabelas criadas/migradas)');
    process.exit(0);
  }

  // PostgreSQL
  const pool = require('./index');
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Banco PostgreSQL inicializado com sucesso!');
  process.exit(0);
}

init().catch(err => { console.error(err); process.exit(1); });
