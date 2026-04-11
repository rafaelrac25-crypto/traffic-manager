const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuário e senha obrigatórios' });
  if (!process.env.JWT_SECRET) {
    console.error('[auth] JWT_SECRET não configurado nas variáveis de ambiente');
    return res.status(500).json({ error: 'Configuração do servidor incompleta' });
  }
  try {
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    console.error('[auth] Erro no login:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.post('/setup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuário e senha obrigatórios' });
  try {
    const existing = await db.query('SELECT id FROM users LIMIT 1');
    if (existing.rows.length > 0) return res.status(403).json({ error: 'Setup já realizado' });
    const hash = await bcrypt.hash(password, 10);
    await db.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [username, hash]);
    res.json({ message: 'Usuário criado com sucesso' });
  } catch (err) {
    console.error('[auth] Erro no setup:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
