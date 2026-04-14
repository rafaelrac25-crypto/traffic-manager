const router = require('express').Router();
const db = require('../db');

// GET /api/history — lista as ações registradas (mais recentes primeiro)
router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  try {
    const result = await db.query(
      `SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?`,
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
});

// POST /api/history — registrar ação (uso interno)
router.post('/', async (req, res) => {
  const { action, entity, entity_id, description, meta } = req.body;
  if (!action || !entity) return res.status(400).json({ error: 'action e entity obrigatórios' });
  try {
    await db.query(
      `INSERT INTO activity_log (action, entity, entity_id, description, meta) VALUES (?, ?, ?, ?, ?)`,
      [action, entity, entity_id || null, description || null, meta ? JSON.stringify(meta) : null]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar ação' });
  }
});

module.exports = router;
