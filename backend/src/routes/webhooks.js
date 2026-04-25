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
    /* Fire-and-forget: sync não-bloqueante */
    (async () => {
      try {
        const { syncPlatform } = require('../services/sync');
        await syncPlatform('meta');
      } catch (e) {
        console.warn('[webhook/meta] sync falhou:', e.message);
      }
    })();
  }
});

module.exports = router;
