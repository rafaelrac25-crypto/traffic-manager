const router = require('express').Router();
const crypto = require('crypto');

router.get('/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.FB_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.status(403).send('forbidden');
});

router.post('/meta', async (req, res) => {
  const sig = req.header('x-hub-signature-256');
  const appSecret = process.env.FB_APP_SECRET;
  if (!sig || !appSecret) {
    /* Defensivo: se o secret sumir do ambiente (ex.: rotação no Vercel sem
       redeploy), webhook começa a 401 silenciosamente e o painel fica
       desatualizado. Loga ALTO pra Sentry/Vercel pegarem. */
    console.warn('[webhook/meta] rejeitado: ', !sig ? 'header x-hub-signature-256 ausente' : 'FB_APP_SECRET ausente no ambiente');
    return res.status(401).send('unauthorized');
  }
  if (!req.rawBody) {
    /* rawBody fica undefined quando express.json não parseia (content-type
       diferente de application/json). Signature vai divergir e cair em 401 —
       comportamento correto, mas silencioso. Log explícito ajuda debug. */
    console.warn('[webhook/meta] rawBody undefined — content-type:', req.header('content-type') || '(ausente)');
  }
  const raw = req.rawBody || JSON.stringify(req.body || {});
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(raw).digest('hex');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      /* Signature mismatch persistente = secret divergente entre Meta App
         e Vercel (FB_APP_SECRET foi rotacionado de um lado só). */
      console.warn('[webhook/meta] signature mismatch — verifique se FB_APP_SECRET no Vercel bate com o App Secret atual no Meta');
      return res.status(401).send('invalid signature');
    }
  } catch (e) {
    console.warn('[webhook/meta] erro ao validar signature:', e.message);
    return res.status(401).send('invalid signature');
  }

  /* Meta exige responder em <=20s — responde 200 imediatamente e processa
     em background. Evita retry do Meta marcando webhook como instável. */
  res.status(200).send('ok');

  const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];
  const shouldSync = entries.some(e => {
    const changes = e?.changes || e?.messaging || [];
    return changes.some(c => {
      const field = c?.field || '';
      /* Eventos que exigem refresh de status/métricas do painel */
      return /^(ads|ad_account|campaign|adset|creative|delivery|feed|status)/i.test(field);
    });
  });

  if (shouldSync) {
    /* Fire-and-forget: sync não-bloqueante.
       IMPORTANTE: como já respondemos 200, qualquer erro aqui some no
       console.warn se não for capturado explicitamente pelo Sentry. */
    (async () => {
      try {
        /* Proteção anti-replay: cada evento Meta é identificado por
           entry[].id + entry[].time (Meta não garante unicidade só do id).
           Tentamos INSERT; se já existe (ON CONFLICT DO NOTHING), abortamos
           sem disparar sync — evita double-process em fanout de CDN. */
        const eventId = entries.map(e => `${e.id}:${e.time}`).join('|');
        let shouldSkip = false;
        try {
          const db = require('../db');
          const result = await db.query(
            'INSERT INTO processed_webhook_events(event_id) VALUES($1) ON CONFLICT DO NOTHING RETURNING event_id',
            [eventId]
          );
          if (result.rowCount === 0) {
            console.warn('[webhook/meta] evento já processado, ignorando:', eventId);
            shouldSkip = true;
          }
        } catch (dbErr) {
          /* Se INSERT falhar (ex.: tabela ainda não existe em dev), logar e
             prosseguir — preferimos double-process a deixar de processar. */
          console.warn('[webhook/meta] falha ao registrar evento no DB, prosseguindo mesmo assim:', dbErr.message);
        }

        if (!shouldSkip) {
          const { syncPlatform } = require('../services/sync');
          await syncPlatform('meta');
        }
      } catch (err) {
        console.error('[webhook/meta] sync background error:', err);
        try {
          const { Sentry } = require('../services/sentry');
          Sentry.captureException(err, {
            tags: { component: 'webhook', event: 'meta_sync' },
            extra: { webhookEntries: entries?.length || 0 },
          });
        } catch { /* Sentry pode não estar configurado em dev — best-effort */ }
      }
    })();
  }
});

module.exports = router;
