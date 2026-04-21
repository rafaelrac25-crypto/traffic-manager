/**
 * Rota de upload de mídia dedicada — aceita multipart/form-data pra bypassar
 * o limite de ~4.5MB que o Vercel impõe em body JSON. O binário é streamado
 * via Buffer direto pro Meta Graph API.
 *
 * POST /api/upload/media
 *   Content-Type: multipart/form-data
 *   Body: file (binary)
 *   Retorna: { type: 'image'|'video', hash?, id?, url? }
 */

const router = require('express').Router();
const multer = require('multer');
const db = require('../db');

/* memoryStorage: vídeo vai pra RAM durante request, não toca no disco (Vercel
   serverless não tem /tmp persistente mesmo). 15MB de limite — cobre vídeos
   até ~15MB reais, suficiente pra ads curtos de Instagram/Facebook. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

router.post('/media', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });

    const mime = req.file.mimetype || '';
    const buffer = req.file.buffer;

    if (mime.startsWith('video/')) {
      const { uploadVideoBuffer } = require('../services/metaMedia');
      const out = await uploadVideoBuffer(creds, buffer, req.file.originalname || 'video.mp4');
      return res.json({ type: 'video', id: out.id });
    }
    if (mime.startsWith('image/')) {
      const { uploadImage } = require('../services/metaMedia');
      const base64 = buffer.toString('base64');
      const out = await uploadImage(creds, base64);
      return res.json({ type: 'image', hash: out.hash, url: out.url });
    }
    return res.status(400).json({ error: `Tipo de mídia não suportado: ${mime}` });
  } catch (err) {
    console.error('[upload/media]', err);
    const pt = err?.meta?.pt || err.message;
    res.status(502).json({ error: pt, meta: err?.meta || null });
  }
});

module.exports = router;
