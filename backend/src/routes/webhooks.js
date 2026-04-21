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

router.post('/meta', (req, res) => {
  const sig = req.header('x-hub-signature-256');
  const appSecret = process.env.FB_APP_SECRET;
  if (!sig || !appSecret) return res.status(401).send('unauthorized');
  const raw = req.rawBody || JSON.stringify(req.body || {});
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(raw).digest('hex');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).send('invalid signature');
    }
  } catch {
    return res.status(401).send('invalid signature');
  }
  console.log('[webhook/meta]', JSON.stringify(req.body).slice(0, 500));
  res.status(200).send('ok');
});

module.exports = router;
