/**
 * Serviço de envio de mensagens via CallMeBot (WhatsApp)
 * Cadastro gratuito em: https://www.callmebot.com/blog/free-api-whatsapp-messages/
 */
const https = require('https');

/**
 * Envia mensagem WhatsApp para um número via CallMeBot
 * @param {string} phone - Número no formato internacional sem + (ex: 5547999990000)
 * @param {string} apikey - API key obtida ao cadastrar o número no CallMeBot
 * @param {string} message - Texto da mensagem
 */
function sendWhatsApp(phone, apikey, message) {
  return new Promise((resolve, reject) => {
    const text = encodeURIComponent(message);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&apikey=${apikey}&text=${text}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

/**
 * Envia alerta para todos os destinatários configurados
 * @param {string} message
 */
async function sendAlertToAll(message) {
  const recipients = [
    { name: 'Cristiane', phone: process.env.ALERT_PHONE_1, apikey: process.env.ALERT_APIKEY_1 },
    { name: 'Rafael',    phone: process.env.ALERT_PHONE_2, apikey: process.env.ALERT_APIKEY_2 },
  ];

  const results = [];
  for (const r of recipients) {
    if (!r.phone || !r.apikey) {
      results.push({ name: r.name, success: false, error: 'Número ou API key não configurados' });
      continue;
    }
    try {
      const res = await sendWhatsApp(r.phone, r.apikey, message);
      results.push({ name: r.name, success: res.status === 200 });
    } catch (err) {
      results.push({ name: r.name, success: false, error: err.message });
    }
  }
  return results;
}

module.exports = { sendWhatsApp, sendAlertToAll };
