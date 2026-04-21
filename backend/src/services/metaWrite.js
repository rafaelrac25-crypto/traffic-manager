const https = require('https');
const { decrypt } = require('./crypto');
const { parseMetaError } = require('./metaErrors');
const { uploadImage } = require('./metaMedia');

const API_VERSION = 'v20.0';
const GRAPH_HOST = 'graph.facebook.com';
const GRAPH_BASE = `/${API_VERSION}`;

function getToken(creds) {
  if (!creds?.access_token) throw new Error('Plataforma não conectada');
  if (String(creds.access_token).includes(':')) {
    try { return decrypt(creds.access_token); }
    catch { return creds.access_token; }
  }
  return creds.access_token;
}

function toBody(params) {
  const out = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    out[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
  });
  return new URLSearchParams(out).toString();
}

function request(method, path, params = {}, { token } = {}) {
  return new Promise((resolve, reject) => {
    const fullParams = { ...params };
    if (token) fullParams.access_token = token;
    let fullPath = `${GRAPH_BASE}${path}`;
    let body = null;
    if (method === 'GET') {
      fullPath += `?${toBody(fullParams)}`;
    } else {
      body = toBody(fullParams);
    }
    const req = https.request({
      host: GRAPH_HOST,
      path: fullPath,
      method,
      headers: body ? {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      } : {},
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data || '{}');
          if (json.error) {
            const parsed = parseMetaError(json.error);
            const e = new Error(parsed.pt);
            e.meta = parsed;
            e.status = res.statusCode;
            return reject(e);
          }
          resolve(json);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function updateCampaignStatus(creds, platformCampaignId, status) {
  const token = getToken(creds);
  const metaStatus = status === 'active' ? 'ACTIVE' : status === 'paused' ? 'PAUSED' : String(status).toUpperCase();
  return request('POST', `/${platformCampaignId}`, { status: metaStatus }, { token });
}

async function deleteCampaign(creds, platformCampaignId) {
  const token = getToken(creds);
  return request('DELETE', `/${platformCampaignId}`, {}, { token });
}

/**
 * Publica uma campanha completa no Meta:
 * 1. Upload de mídia (se houver base64)
 * 2. Cria Campaign
 * 3. Cria AdSet
 * 4. Cria Creative (com image_hash real)
 * 5. Cria Ad
 * Retorna IDs reais do Meta.
 */
async function publishCampaign(creds, metaPayload, mediaItems = []) {
  const token = getToken(creds);
  const accountId = creds.account_id;
  if (!accountId) throw new Error('account_id ausente');
  if (!metaPayload?.campaign || !metaPayload?.ad_set || !metaPayload?.creative || !metaPayload?.ad) {
    throw new Error('Payload Meta incompleto (precisa de campaign, ad_set, creative, ad)');
  }

  // 1. Upload de mídia
  const uploadedImages = [];
  for (const m of mediaItems) {
    if (m?.base64 && (m.type === 'image' || !m.type)) {
      try {
        const img = await uploadImage(creds, m.base64);
        uploadedImages.push({ ...img, originalId: m.id });
      } catch (e) {
        throw new Error(`Falha ao enviar mídia "${m.name || 'imagem'}": ${e.message}`);
      }
    }
  }
  const mainImageHash = uploadedImages[0]?.hash || metaPayload.creative?.object_story_spec?.link_data?.image_hash;

  // 2. Campaign
  const c = metaPayload.campaign;
  const campParams = {
    name: c.name,
    objective: c.objective,
    status: 'PAUSED',
    buying_type: c.buying_type || 'AUCTION',
    special_ad_categories: c.special_ad_categories || [],
  };
  if (c.daily_budget) campParams.daily_budget = c.daily_budget;
  if (c.lifetime_budget) campParams.lifetime_budget = c.lifetime_budget;
  const campResp = await request('POST', `/${accountId}/campaigns`, campParams, { token });
  const campaignId = campResp.id;

  // 3. AdSet
  const a = metaPayload.ad_set;
  const asParams = {
    campaign_id: campaignId,
    name: a.name,
    optimization_goal: a.optimization_goal,
    billing_event: a.billing_event,
    bid_strategy: a.bid_strategy || 'LOWEST_COST_WITHOUT_CAP',
    status: 'PAUSED',
    targeting: a.targeting,
  };
  if (a.daily_budget) asParams.daily_budget = a.daily_budget;
  if (a.lifetime_budget) asParams.lifetime_budget = a.lifetime_budget;
  if (a.start_time) asParams.start_time = a.start_time;
  if (a.end_time) asParams.end_time = a.end_time;
  if (a.promoted_object) asParams.promoted_object = a.promoted_object;
  const asResp = await request('POST', `/${accountId}/adsets`, asParams, { token });
  const adSetId = asResp.id;

  // 4. Creative
  const cr = { ...metaPayload.creative };
  const storySpec = JSON.parse(JSON.stringify(cr.object_story_spec || {}));
  if (storySpec.link_data) {
    if (mainImageHash) storySpec.link_data.image_hash = mainImageHash;
    if (!storySpec.page_id && creds.page_id) storySpec.page_id = creds.page_id;
  }
  const crResp = await request('POST', `/${accountId}/adcreatives`, {
    name: cr.name || `${c.name} — Criativo`,
    object_story_spec: storySpec,
  }, { token });
  const creativeId = crResp.id;

  // 5. Ad
  const ad = metaPayload.ad;
  const adResp = await request('POST', `/${accountId}/ads`, {
    name: ad.name,
    adset_id: adSetId,
    creative: { creative_id: creativeId },
    status: 'PAUSED',
  }, { token });
  const adId = adResp.id;

  return {
    platform_campaign_id: campaignId,
    ad_set_id: adSetId,
    creative_id: creativeId,
    ad_id: adId,
    uploaded_images: uploadedImages,
  };
}

module.exports = { updateCampaignStatus, deleteCampaign, publishCampaign, request, getToken };
