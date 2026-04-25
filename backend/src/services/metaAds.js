const { safeDecrypt } = require('./crypto');
const { metaGet } = require('./metaHttp');

function getToken(creds) {
  if (!creds?.access_token) throw new Error('Plataforma não conectada');
  return safeDecrypt(creds.access_token, 'metaAds');
}

function sumActions(actions, types) {
  if (!Array.isArray(actions)) return 0;
  return actions
    .filter(a => types.includes(a.action_type))
    .reduce((s, a) => s + parseInt(a.value || 0, 10), 0);
}

/* Tipos de ação que contam como "conversão" pro nosso painel.
   Unificado entre fetchCampaigns e fetchAccountInsights (senão divergem). */
const CONVERSION_ACTION_TYPES = [
  'lead',
  'onsite_conversion.lead_grouped',
  'offsite_conversion.fb_pixel_lead',
  'purchase',
  'complete_registration',
  'onsite_conversion.messaging_conversation_started_7d',
  'onsite_conversion.messaging_first_reply',
];

function safeFloat(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}
function safeInt(v) {
  const n = parseInt(v || 0, 10);
  return Number.isFinite(n) ? n : 0;
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

  const json = await metaGet(`/${accountId}/campaigns`, { fields, limit: 100 }, { token });

  return (json.data || []).map(c => {
    const insights = c.insights?.data?.[0] || {};
    const conversions = sumActions(insights.actions, CONVERSION_ACTION_TYPES);
    return {
      id: c.id,
      name: c.name,
      status: (() => {
        const eff = c.effective_status;
        const st  = c.status;
        if (eff === 'ACTIVE' || st === 'ACTIVE') return 'active';
        if (eff === 'PAUSED' || st === 'PAUSED') return 'paused';
        /* Estados intermediários de revisão do Meta → frontend mostra "Em revisão" */
        if (['IN_PROCESS','PENDING_REVIEW','PREAPPROVED','PENDING_BILLING_INFO','WITH_ISSUES','PENDING_PROCESSING'].includes(eff)) return 'review';
        if (['DISAPPROVED','ADSET_PAUSED','CAMPAIGN_PAUSED','ARCHIVED','DELETED'].includes(eff)) return 'ended';
        return (st || 'unknown').toLowerCase();
      })(),
      effective_status: c.effective_status,
      objective: c.objective,
      budget: safeFloat(c.daily_budget || c.lifetime_budget || 0) / 100,
      spent: safeFloat(insights.spend),
      clicks: safeInt(insights.clicks),
      impressions: safeInt(insights.impressions),
      reach: safeInt(insights.reach),
      ctr: safeFloat(insights.ctr),
      cpc: safeFloat(insights.cpc),
      cpm: safeFloat(insights.cpm),
      conversions,
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

  const params = {
    fields: 'campaign_id,campaign_name,spend,clicks,impressions,reach,ctr,cpc,cpm,actions,cost_per_action_type,date_start,date_stop',
    level,
    limit: 500,
    /* Janela de atribuição unificada pra conversations_started em OUTCOME_ENGAGEMENT */
    action_attribution_windows: ['7d_click', '1d_view'],
  };
  if (since && until) {
    params.time_range = { since, until };
  } else {
    params.date_preset = 'maximum';
  }
  if (breakdowns) params.breakdowns = breakdowns;

  const json = await metaGet(`/${accountId}/insights`, params, { token });
  return json.data || [];
}

module.exports = { fetchCampaigns, fetchAccountInsights, CONVERSION_ACTION_TYPES };
