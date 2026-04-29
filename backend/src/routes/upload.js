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

/* Multer separado pro endpoint de chunk: aceita até 4.4MB (margem do limite
   Vercel 4.5MB). Frontend deve mandar chunks de 3.5-4MB. */
const uploadChunk = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4.4 * 1024 * 1024 },
});

async function getMetaCreds() {
  const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
  return credResult.rows[0];
}

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

/* ============================================================
 * RESUMABLE UPLOAD (chunked) — pra vídeos > 4 MB.
 * Frontend chama nessa ordem:
 *   1. POST /api/upload/video/start   { file_size }
 *   2. POST /api/upload/video/chunk   (multipart: chunk file + start_offset + upload_session_id) — em loop
 *   3. POST /api/upload/video/finish  { upload_session_id }
 * Token Meta NUNCA sai do backend.
 * ============================================================ */

router.post('/video/start', async (req, res) => {
  try {
    const fileSize = Number(req.body?.file_size);
    if (!fileSize || fileSize <= 0) {
      return res.status(400).json({ error: 'file_size obrigatório (bytes)' });
    }
    const creds = await getMetaCreds();
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });

    const { startVideoUpload } = require('../services/metaMedia');
    const out = await startVideoUpload(creds, fileSize);
    return res.json(out);
  } catch (err) {
    console.error('[upload/video/start]', err);
    const pt = err?.meta?.pt || err.message;
    res.status(502).json({ error: pt, meta: err?.meta || null });
  }
});

router.post('/video/chunk', uploadChunk.single('chunk'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'chunk obrigatório' });
    const uploadSessionId = req.body?.upload_session_id;
    const startOffset = Number(req.body?.start_offset);
    if (!uploadSessionId) return res.status(400).json({ error: 'upload_session_id obrigatório' });
    if (!Number.isFinite(startOffset) || startOffset < 0) {
      return res.status(400).json({ error: 'start_offset inválido' });
    }
    const creds = await getMetaCreds();
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });

    const { transferVideoChunk } = require('../services/metaMedia');
    const out = await transferVideoChunk(creds, uploadSessionId, startOffset, req.file.buffer);
    return res.json(out);
  } catch (err) {
    console.error('[upload/video/chunk]', err);
    const pt = err?.meta?.pt || err.message;
    res.status(502).json({ error: pt, meta: err?.meta || null });
  }
});

router.post('/video/finish', async (req, res) => {
  try {
    const uploadSessionId = req.body?.upload_session_id;
    if (!uploadSessionId) return res.status(400).json({ error: 'upload_session_id obrigatório' });
    const creds = await getMetaCreds();
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });

    const { finishVideoUpload } = require('../services/metaMedia');
    const out = await finishVideoUpload(creds, uploadSessionId, {
      title: req.body?.title,
      description: req.body?.description,
    });
    return res.json(out);
  } catch (err) {
    console.error('[upload/video/finish]', err);
    const pt = err?.meta?.pt || err.message;
    res.status(502).json({ error: pt, meta: err?.meta || null });
  }
});

/* ============================================================
 * IMAGE CHUNKED UPLOAD — pra imagens > 4 MB.
 * Meta /adimages NÃO suporta resumable nativo, então o backend acumula
 * os chunks no DB (image_upload_sessions table) e dispara o upload
 * inteiro pra Meta no /finish.
 *
 * Fluxo:
 *   1. POST /api/upload/image/start   { file_size, mime } → { session_id }
 *   2. POST /api/upload/image/chunk   (multipart: chunk + session_id + start_offset) [loop]
 *   3. POST /api/upload/image/finish  { session_id } → { hash, url }
 * ============================================================ */

function newSessionId() {
  return 'img_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

router.post('/image/start', async (req, res) => {
  try {
    const fileSize = Number(req.body?.file_size);
    const mime = String(req.body?.mime || 'image/jpeg');
    if (!fileSize || fileSize <= 0) return res.status(400).json({ error: 'file_size obrigatório' });
    if (!mime.startsWith('image/')) return res.status(400).json({ error: 'mime deve ser image/*' });
    /* Meta /adimages limita ~30MB; rejeita aqui pra economizar tráfego. */
    if (fileSize > 30 * 1024 * 1024) {
      return res.status(400).json({ error: 'Imagem maior que 30 MB — Meta não aceita' });
    }
    const creds = await getMetaCreds();
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });

    const sessionId = newSessionId();
    const emptyBuffer = Buffer.alloc(0);
    await db.query(
      'INSERT INTO image_upload_sessions (session_id, mime, total_size, received_size, chunks) VALUES (?, ?, ?, ?, ?)',
      [sessionId, mime, fileSize, 0, emptyBuffer]
    );
    return res.json({ session_id: sessionId });
  } catch (err) {
    console.error('[upload/image/start]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/image/chunk', uploadChunk.single('chunk'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'chunk obrigatório' });
    const sessionId = req.body?.session_id;
    const startOffset = Number(req.body?.start_offset);
    if (!sessionId) return res.status(400).json({ error: 'session_id obrigatório' });
    if (!Number.isFinite(startOffset) || startOffset < 0) {
      return res.status(400).json({ error: 'start_offset inválido' });
    }

    const r = await db.query('SELECT * FROM image_upload_sessions WHERE session_id = ?', [sessionId]);
    const session = r.rows[0];
    if (!session) return res.status(404).json({ error: 'session_id não encontrado' });

    const expectedOffset = Number(session.received_size);
    if (startOffset !== expectedOffset) {
      return res.status(409).json({
        error: `offset inválido — esperado ${expectedOffset}, recebido ${startOffset}`,
        expected_offset: expectedOffset,
      });
    }

    /* Concatena chunk: prev (BYTEA do DB) + chunk novo (Buffer). pg/Neon
       devolve BYTEA como Buffer/Uint8Array. */
    const prev = session.chunks
      ? (Buffer.isBuffer(session.chunks) ? session.chunks : Buffer.from(session.chunks))
      : Buffer.alloc(0);
    const merged = Buffer.concat([prev, req.file.buffer]);
    const newOffset = expectedOffset + req.file.buffer.length;

    await db.query(
      'UPDATE image_upload_sessions SET chunks = ?, received_size = ? WHERE session_id = ?',
      [merged, newOffset, sessionId]
    );
    return res.json({ start_offset: newOffset });
  } catch (err) {
    console.error('[upload/image/chunk]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/image/finish', async (req, res) => {
  try {
    const sessionId = req.body?.session_id;
    if (!sessionId) return res.status(400).json({ error: 'session_id obrigatório' });

    const r = await db.query('SELECT * FROM image_upload_sessions WHERE session_id = ?', [sessionId]);
    const session = r.rows[0];
    if (!session) return res.status(404).json({ error: 'session_id não encontrado' });
    if (Number(session.received_size) !== Number(session.total_size)) {
      return res.status(400).json({
        error: `upload incompleto: ${session.received_size}/${session.total_size} bytes`,
      });
    }

    const creds = await getMetaCreds();
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });

    const buffer = Buffer.isBuffer(session.chunks) ? session.chunks : Buffer.from(session.chunks);
    const { uploadImage } = require('../services/metaMedia');
    const base64 = buffer.toString('base64');
    const out = await uploadImage(creds, base64);

    /* Limpa sessão pra liberar storage */
    await db.query('DELETE FROM image_upload_sessions WHERE session_id = ?', [sessionId]);

    return res.json({ hash: out.hash, url: out.url });
  } catch (err) {
    console.error('[upload/image/finish]', err);
    const pt = err?.meta?.pt || err.message;
    res.status(502).json({ error: pt, meta: err?.meta || null });
  }
});

module.exports = router;
