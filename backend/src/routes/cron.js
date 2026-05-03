/* Cron jobs do Vercel.
   Configurado em vercel.json sob "crons" — Vercel chama estes endpoints
   nos horarios definidos. Hobby plan: 1x/dia. */

const express = require('express');
const router = express.Router();

/* Helper: valida auth do cron.
   Em prod, defina CRON_SECRET no Vercel e o cron precisa enviar
   Authorization: Bearer <CRON_SECRET>. Vercel injeta isso automaticamente
   se a env var existir. Se nao definida, aceita qualquer (uso local). */
function requireCronAuth(req, res, next) {
  /* Trim defensivo — se admin colou env var com espaco/newline, ainda funciona */
  const expected = (process.env.CRON_SECRET || '').trim();
  if (!expected) return next();
  const auth = (req.headers.authorization || '').trim();
  if (auth === `Bearer ${expected}`) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

/* GET /api/cron/sync-meta — dispara sync das metricas Meta.
   Faz self-call pro POST /api/campaigns/sync-meta-status (que ja contem
   toda a logica). Trade-off: 1 invocacao extra por chamada, mas evita
   duplicar 177 linhas de logica. */
router.get('/sync-meta', requireCronAuth, async (req, res) => {
  const startedAt = new Date().toISOString();
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://127.0.0.1:${process.env.PORT || 3001}`;

    const r = await fetch(`${baseUrl}/api/campaigns/sync-meta-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await r.json().catch(() => ({}));
    const updated = Array.isArray(data?.updated) ? data.updated.length : 0;

    console.log(`[cron/sync-meta] ok startedAt=${startedAt} updated=${updated}`);
    return res.json({
      ok: true,
      triggered_at: startedAt,
      finished_at: new Date().toISOString(),
      updated_count: updated,
      detail: data,
    });
  } catch (e) {
    console.error('[cron/sync-meta] erro:', e.message);
    return res.status(500).json({
      ok: false,
      triggered_at: startedAt,
      error: e.message,
    });
  }
});

module.exports = router;
