/**
 * Integração TikTok for Business API
 * Documentação: https://ads.tiktok.com/marketing_api/docs
 * Requer: account_id (advertiser_id) e access_token OAuth2
 */
const https = require('https');

function get(url, token) {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      headers: { 'Access-Token': token },
    };
    https.get(url, options, (res) => {
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
  if (!account_id) throw new Error('account_id não configurado para TikTok Ads');

  const url = `https://business-api.tiktok.com/open_api/v1.3/campaign/get/?advertiser_id=${account_id}&fields=["campaign_id","campaign_name","status","budget","budget_mode"]`;
  const json = await get(url, access_token);

  if (json.code !== 0) throw new Error(json.message || 'Erro TikTok Ads');

  const campaigns = json.data?.list || [];

  // Buscar métricas dos últimos 30 dias
  const today = new Date();
  const start = new Date(today); start.setDate(today.getDate() - 30);
  const fmt = d => d.toISOString().split('T')[0];

  const metricsUrl = `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?advertiser_id=${account_id}&report_type=BASIC&data_level=AUCTION_CAMPAIGN&dimensions=["campaign_id"]&metrics=["spend","clicks","impressions","conversion"]&start_date=${fmt(start)}&end_date=${fmt(today)}`;
  const metricsJson = await get(metricsUrl, access_token).catch(() => ({ data: { list: [] } }));

  const metricsMap = {};
  (metricsJson.data?.list || []).forEach(m => {
    metricsMap[m.dimensions.campaign_id] = m.metrics;
  });

  return campaigns.map(c => {
    const m = metricsMap[c.campaign_id] || {};
    return {
      id: c.campaign_id,
      name: c.campaign_name,
      status: c.status === 'ENABLE' ? 'active' : 'paused',
      budget: parseFloat(c.budget || 0),
      spent: parseFloat(m.spend || 0),
      clicks: parseInt(m.clicks || 0),
      impressions: parseInt(m.impressions || 0),
      conversions: parseInt(m.conversion || 0),
    };
  });
}

module.exports = { fetchCampaigns };
