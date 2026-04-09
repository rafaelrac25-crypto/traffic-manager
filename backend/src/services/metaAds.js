/**
 * Integração Meta Marketing API
 * Documentação: https://developers.facebook.com/docs/marketing-api
 * Requer: account_id (act_XXXXXXX) e access_token de longa duração
 */
const https = require('https');

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

async function fetchCampaigns(creds) {
  const { access_token, account_id } = creds;
  if (!account_id) throw new Error('account_id não configurado para Meta Ads');

  const fields = 'id,name,status,daily_budget,lifetime_budget,insights{spend,clicks,impressions,actions}';
  const url = `https://graph.facebook.com/v20.0/${account_id}/campaigns?fields=${fields}&access_token=${access_token}`;

  const json = await get(url);
  if (json.error) throw new Error(json.error.message);

  return (json.data || []).map(c => {
    const insights = c.insights?.data?.[0] || {};
    const conversions = (insights.actions || []).find(a => a.action_type === 'purchase')?.value || 0;
    return {
      id: c.id,
      name: c.name,
      status: c.status === 'ACTIVE' ? 'active' : 'paused',
      budget: parseFloat(c.daily_budget || c.lifetime_budget || 0) / 100,
      spent: parseFloat(insights.spend || 0),
      clicks: parseInt(insights.clicks || 0),
      impressions: parseInt(insights.impressions || 0),
      conversions: parseInt(conversions),
    };
  });
}

module.exports = { fetchCampaigns };
