const router = require('express').Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT platform, account_id, updated_at FROM platform_credentials');
    const connected = {};
    result.rows.forEach(r => { connected[r.platform] = r; });
    const platforms = ['google', 'meta', 'tiktok'];
    res.json(platforms.map(p => ({
      platform: p,
      connected: !!connected[p],
      account_id: connected[p]?.account_id || null,
      updated_at: connected[p]?.updated_at || null,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar plataformas' });
  }
});

router.post('/:platform/connect', async (req, res) => {
  const { platform } = req.params;
  if (!['google', 'meta', 'tiktok'].includes(platform)) return res.status(400).json({ error: 'Plataforma inválida' });
  const { access_token, refresh_token, account_id } = req.body;
  if (!access_token) return res.status(400).json({ error: 'access_token obrigatório' });
  try {
    await db.query(
      `INSERT INTO platform_credentials (platform, access_token, refresh_token, account_id, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(platform) DO UPDATE
       SET access_token = excluded.access_token, refresh_token = excluded.refresh_token,
           account_id = excluded.account_id, updated_at = datetime('now')`,
      [platform, access_token, refresh_token || null, account_id || null]
    );
    res.json({ message: `Plataforma ${platform} conectada` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao salvar credenciais' });
  }
});

router.delete('/:platform', async (req, res) => {
  try {
    await db.query('DELETE FROM platform_credentials WHERE platform = ?', [req.params.platform]);
    res.json({ message: 'Plataforma desconectada' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao desconectar' });
  }
});

module.exports = router;
