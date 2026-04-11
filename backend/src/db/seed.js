require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./index');

async function seed() {
  const hash = await bcrypt.hash('criscosta123', 10);

  if (process.env.DATABASE_URL) {
    // PostgreSQL (produção)
    await db.query(
      `INSERT INTO users (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING`,
      ['criscosta', hash]
    );

    const campaigns = [
      { name: 'Promoção Verão — Maquiagem', platform: 'meta', status: 'active', budget: 50, spent: 312, clicks: 743, impressions: 15480, conversions: 18, start_date: '2026-01-01', end_date: '2026-01-31' },
      { name: 'Skincare Rotina Diária', platform: 'google', status: 'paused', budget: 30, spent: 360, clicks: 300, impressions: 25000, conversions: 5, start_date: '2025-12-15', end_date: '2026-01-15' },
      { name: 'Esmalte Tendência #UnhasPerfeitas', platform: 'tiktok', status: 'active', budget: 70, spent: 175, clicks: 2187, impressions: 32000, conversions: 14, start_date: '2026-01-05', end_date: '2026-02-05' },
    ];

    for (const c of campaigns) {
      await db.query(
        `INSERT INTO campaigns (name, platform, status, budget, spent, clicks, impressions, conversions, start_date, end_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`,
        [c.name, c.platform, c.status, c.budget, c.spent, c.clicks, c.impressions, c.conversions, c.start_date, c.end_date]
      );
    }
  } else {
    // SQLite (local)
    const sqlite = require('./sqlite');
    await db.query(`INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)`, ['criscosta', hash]);
    const campaigns = [
      { name: 'Promoção Verão — Maquiagem', platform: 'meta', status: 'active', budget: 50, spent: 312, clicks: 743, impressions: 15480, conversions: 18, start_date: '2026-01-01', end_date: '2026-01-31' },
      { name: 'Skincare Rotina Diária', platform: 'google', status: 'paused', budget: 30, spent: 360, clicks: 300, impressions: 25000, conversions: 5, start_date: '2025-12-15', end_date: '2026-01-15' },
      { name: 'Esmalte Tendência #UnhasPerfeitas', platform: 'tiktok', status: 'active', budget: 70, spent: 175, clicks: 2187, impressions: 32000, conversions: 14, start_date: '2026-01-05', end_date: '2026-02-05' },
    ];
    for (const c of campaigns) {
      await db.query(
        `INSERT OR IGNORE INTO campaigns (name, platform, status, budget, spent, clicks, impressions, conversions, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.name, c.platform, c.status, c.budget, c.spent, c.clicks, c.impressions, c.conversions, c.start_date, c.end_date]
      );
    }
  }

  console.log('✅ Banco populado! Usuário: criscosta / Senha: criscosta123');
  process.exit(0);
}

seed().catch(err => { console.error('Erro no seed:', err.message); process.exit(1); });
