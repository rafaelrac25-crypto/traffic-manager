const https = require('https');
const { decrypt } = require('./crypto');
const { parseMetaError } = require('./metaErrors');

const API_VERSION = 'v20.0';
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function getToken(creds) {
  if (!creds?.access_token) throw new Error('Plataforma não conectada');
  if (String(creds.access_token).includes(':')) {
    try { return decrypt(creds.access_token); }
    catch { return creds.access_token; }
  }
  return creds.access_token;
}

function sumActions(actions, types) {
  if (!Array.isArray(actions)) return 0;
  return actions
    .filter(a => types.includes(a.action_type))
    .reduce((s, a) => s + parseInt(a.value || 0, 10), 0);
}

async function fetchCampaigns(creds) {
  const token = getToken(creds);
  const accountId = creds.account_id;
  if (!accountId) throw new Error('account_id não configurado para Meta Ads');

  const fields = [
    'id', 'name', 'status', 'effective_status', 'objective',
    'daily_budget', 'lifetime_budget', 'start_time', 'stop_time',
    'insights.date_preset(maximum){spend,clicks,impressions,reach,ctr,cpc,cpm,actions,cost_per_action_type}',
  ].join(',');

  const url = `${GRAPH}/${accountId}/campaigns?fields=${encodeURIComponent(fields)}&limit=100&access_token=${token}`;
  const json = await httpsGet(url);
  if (json.error) {
    const err = parseMetaError(json.error);
    const e = new Error(err.pt);
    e.meta = err;
    throw e;
  }

  return (json.data || []).map(c => {
    const insights = c.insights?.data?.[0] || {};
    const conversions =
      sumActions(insights.actions, ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead', 'purchase', 'complete_registration']);
    const messageContacts =
      sumActions(insights.actions, ['onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.messaging_first_reply']);
    return {
      id: c.id,
      name: c.name,
      status: (c.effective_status === 'ACTIVE' || c.status === 'ACTIVE') ? 'active'
        : (c.effective_status === 'PAUSED' || c.status === 'PAUSED') ? 'paused'
        : (c.status || 'unknown').toLowerCase(),
      effective_status: c.effective_status,
      objective: c.objective,
      budget: parseFloat(c.daily_budget || c.lifetime_budget || 0) / 100,
      spent: parseFloat(insights.spend || 0),
      clicks: parseInt(insights.clicks || 0, 10),
      impressions: parseInt(insights.impressions || 0, 10),
      reach: parseInt(insights.reach || 0, 10),
      ctr: parseFloat(insights.ctr || 0),
      cpc: parseFloat(insights.cpc || 0),
      cpm: parseFloat(insights.cpm || 0),
      conversions: conversions + messageContacts,
      start_date: c.start_time ? c.start_time.slice(0, 10) : null,
      end_date: c.stop_time ? c.stop_time.slice(0, 10) : null,
      raw: c,
    };
  });
}

async function fetchAccountInsights(creds, { since, until, level = 'campaign', breakdowns } = {}) {
  const token = getToken(creds);
  const accountId = creds.account_id;
  if (!accountId) throw new Error('account_id não configurado');

  const fields = 'campaign_id,campaign_name,spend,clicks,impressions,reach,ctr,cpc,cpm,actions,cost_per_action_type,date_start,date_stop';
  const params = new URLSearchParams({
    fields,
    level,
    access_token: token,
    limit: '500',
  });
  if (since && until) {
    params.set('time_range', JSON.stringify({ since, until }));
  } else {
    params.set('date_preset', 'maximum');
  }
  if (breakdowns) params.set('breakdowns', breakdowns);

  const url = `${GRAPH}/${accountId}/insights?${params.toString()}`;
  const json = await httpsGet(url);
  if (json.error) {
    const err = parseMetaError(json.error);
    const e = new Error(err.pt);
    e.meta = err;
    throw e;
  }
  return json.data || [];
}

module.exports = { fetchCampaigns, fetchAccountInsights };
