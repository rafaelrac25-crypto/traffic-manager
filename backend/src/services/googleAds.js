/**
 * Integração Google Ads API
 * Documentação: https://developers.google.com/google-ads/api/docs/start
 * Requer: customer_id (account_id) e access_token OAuth2
 */
const https = require('https');

async function fetchCampaigns(creds) {
  const { access_token, account_id } = creds;
  if (!account_id) throw new Error('account_id não configurado para Google Ads');

  const query = `
    SELECT campaign.id, campaign.name, campaign.status,
           campaign_budget.amount_micros,
           metrics.cost_micros, metrics.clicks,
           metrics.impressions, metrics.conversions
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
  `;

  const body = JSON.stringify({ query });
  const customerId = account_id.replace(/-/g, '');

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'googleads.googleapis.com',
      path: `/v18/customers/${customerId}/googleAds:searchStream`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'developer-token': process.env.GOOGLE_DEVELOPER_TOKEN,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error.message));
          const campaigns = [];
          (json.results || []).forEach(r => {
            campaigns.push({
              id: r.campaign.id,
              name: r.campaign.name,
              status: r.campaign.status?.toLowerCase() === 'enabled' ? 'active' : 'paused',
              budget: r.campaignBudget?.amountMicros ? r.campaignBudget.amountMicros / 1_000_000 : 0,
              spent: r.metrics?.costMicros ? r.metrics.costMicros / 1_000_000 : 0,
              clicks: r.metrics?.clicks || 0,
              impressions: r.metrics?.impressions || 0,
              conversions: r.metrics?.conversions || 0,
            });
          });
          resolve(campaigns);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { fetchCampaigns };
