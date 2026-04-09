const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { checkAndAlert, fetchMetaBalance } = require('../services/budgetAlert');
const db = require('../db');

// GET /api/alerts/status — saldo atual + estado dos alertas
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const credsResult = await db.query(
      `SELECT access_token, account_id FROM platform_credentials WHERE platform = 'meta' LIMIT 1`
    );
    if (!credsResult.rows.length) {
      return res.json({ connected: false, message: 'Meta Ads não conectado' });
    }
    const { access_token, account_id } = credsResult.rows[0];
    const { balance, spent } = await fetchMetaBalance(access_token, account_id);

    const stateResult = await db.query(`SELECT value FROM alert_state WHERE key = 'budget_alert'`);
    const state = stateResult.rows.length ? JSON.parse(stateResult.rows[0].value) : {};

    res.json({
      connected: true,
      balance,
      spent,
      lastAlertAt: state.lastAlertAt || null,
      lastBalance: state.lastBalance || null,
      recipients: {
        phone1: process.env.ALERT_PHONE_1 ? `...${process.env.ALERT_PHONE_1.slice(-4)}` : null,
        phone2: process.env.ALERT_PHONE_2 ? `...${process.env.ALERT_PHONE_2.slice(-4)}` : null,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts/check — dispara verificação manualmente (também usado pelo cron)
router.post('/check', async (req, res) => {
  // Aceita requisição do cron sem auth (protegida por CRON_SECRET)
  const cronSecret = req.headers['x-cron-secret'];
  const isAuthorizedCron = cronSecret && cronSecret === process.env.CRON_SECRET;
  const isAuthenticated = req.headers.authorization?.startsWith('Bearer ');

  if (!isAuthorizedCron && !isAuthenticated) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  try {
    const result = await checkAndAlert();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts/test — envia mensagem de teste para os 2 números
router.post('/test', authMiddleware, async (req, res) => {
  const { sendAlertToAll } = require('../services/whatsapp');
  const message = `✅ *Teste de Alerta — AdManager Cris Costa Beauty*\n\nSistema de alertas de orçamento configurado com sucesso!\n\nVocê receberá avisos quando o saldo do Meta Ads estiver baixo.`;
  try {
    const results = await sendAlertToAll(message);
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
