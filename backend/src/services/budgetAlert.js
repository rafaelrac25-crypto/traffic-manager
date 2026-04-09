/**
 * Serviço de monitoramento e alertas de orçamento do Meta Ads
 */
const https = require('https');
const { sendAlertToAll } = require('./whatsapp');
const db = require('../db');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

/**
 * Busca o saldo atual da conta de anúncios no Meta Ads
 * Retorna valor em BRL (reais)
 */
async function fetchMetaBalance(access_token, account_id) {
  const url = `https://graph.facebook.com/v20.0/${account_id}?fields=balance,amount_spent,currency&access_token=${access_token}`;
  const json = await get(url);
  if (json.error) throw new Error(json.error.message);

  const balance = parseFloat(json.balance || 0) / 100;
  const spent = parseFloat(json.amount_spent || 0) / 100;
  const currency = json.currency || 'BRL';
  return { balance, spent, currency };
}

/**
 * Estima horas restantes com base na taxa de gasto médio
 * Usa os últimos 7 dias de gasto para calcular a média diária
 */
async function fetchSpendRate(access_token, account_id) {
  const until = new Date().toISOString().split('T')[0];
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const url = `https://graph.facebook.com/v20.0/${account_id}/insights?fields=spend&time_range={'since':'${since}','until':'${until}'}&access_token=${access_token}`;
  const json = await get(url);
  if (json.error || !json.data || !json.data[0]) return 0;
  const totalSpent7d = parseFloat(json.data[0].spend || 0);
  return totalSpent7d / 7; // gasto médio diário em BRL
}

/**
 * Formata mensagem de alerta
 */
function formatAlertMessage(balance, dailyRate, reason) {
  const hoursLeft = dailyRate > 0 ? (balance / dailyRate) * 24 : null;
  let tempoEstimado = '';
  if (hoursLeft !== null) {
    if (hoursLeft < 24) {
      tempoEstimado = `⏳ Tempo estimado: *${Math.round(hoursLeft)}h restantes*`;
    } else {
      const dias = (hoursLeft / 24).toFixed(1);
      tempoEstimado = `⏳ Tempo estimado: *${dias} dias restantes*`;
    }
  }

  return `🚨 *ALERTA DE ORÇAMENTO — Meta Ads*\n\n${reason}\n\n💰 Saldo atual: *R$ ${balance.toFixed(2)}*\n${tempoEstimado}\n\n_Acesse o painel para recarregar o saldo._`;
}

/**
 * Lê o estado anterior do alerta (último saldo registrado)
 */
async function getAlertState() {
  try {
    const result = await db.query(`SELECT value FROM alert_state WHERE key = 'budget_alert'`);
    if (result.rows.length > 0) return JSON.parse(result.rows[0].value);
  } catch {}
  return { lastBalance: null, lastAlertAt: null, lastAlertThreshold: null };
}

async function saveAlertState(state) {
  const value = JSON.stringify(state);
  await db.query(`
    INSERT INTO alert_state (key, value) VALUES ('budget_alert', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `, [value]);
}

/**
 * Verifica saldo e dispara alertas se necessário
 */
async function checkAndAlert() {
  // Busca credenciais Meta Ads do banco
  const credsResult = await db.query(
    `SELECT access_token, account_id FROM platform_credentials WHERE platform = 'meta' LIMIT 1`
  );
  if (!credsResult.rows.length) {
    return { skipped: true, reason: 'Nenhuma credencial Meta Ads configurada' };
  }

  const { access_token, account_id } = credsResult.rows[0];

  let balance, dailyRate;
  try {
    const balanceData = await fetchMetaBalance(access_token, account_id);
    balance = balanceData.balance;
    dailyRate = await fetchSpendRate(access_token, account_id);
  } catch (err) {
    return { error: err.message };
  }

  const state = await getAlertState();
  const alerts = [];
  const now = Date.now();

  const LOW_THRESHOLD = 20;     // R$20 — limite principal
  const STEP = 5;               // alertar a cada R$5 abaixo de R$20
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // Verifica se está dentro de 1 dia de zerar (com base na taxa de gasto)
  const hoursLeft = dailyRate > 0 ? (balance / dailyRate) * 24 : Infinity;
  if (hoursLeft <= 24 && hoursLeft > 0) {
    const lastAlertWasRecent = state.lastAlertAt && (now - state.lastAlertAt) < ONE_DAY_MS;
    if (!lastAlertWasRecent || state.lastAlertThreshold !== 'oneday') {
      alerts.push({ reason: `⚠️ Menos de 1 dia de saldo restante!`, threshold: 'oneday' });
    }
  }

  // Verifica limiar de R$20
  if (balance < LOW_THRESHOLD) {
    const currentStep = Math.floor(balance / STEP) * STEP; // ex: R$17 → step 15
    const lastStep = state.lastAlertThreshold !== 'oneday'
      ? state.lastAlertThreshold
      : null;

    if (lastStep === null || currentStep < lastStep) {
      alerts.push({
        reason: `⚠️ Saldo abaixo de R$ ${LOW_THRESHOLD.toFixed(2)}!`,
        threshold: currentStep
      });
    }
  }

  if (alerts.length === 0) {
    await saveAlertState({ ...state, lastBalance: balance });
    return { balance, dailyRate, alerted: false };
  }

  // Dispara alertas
  const alert = alerts[0];
  const message = formatAlertMessage(balance, dailyRate, alert.reason);
  const results = await sendAlertToAll(message);

  await saveAlertState({
    lastBalance: balance,
    lastAlertAt: now,
    lastAlertThreshold: alert.threshold,
  });

  return { balance, dailyRate, alerted: true, message, results };
}

module.exports = { checkAndAlert, fetchMetaBalance };
