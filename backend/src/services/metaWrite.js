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
 * 3. Cria Creative (ÚNICO, reutilizado entre N ads)
 * 4. Para cada ad_set do payload: cria AdSet + Ad (referenciando o creative compartilhado)
 *
 * Se payload traz `ad_sets` (array) → 1 campaign → N ad sets + N ads (anéis)
 * Se traz `ad_set` (objeto) → 1 campaign → 1 ad set + 1 ad (legado)
 */
async function publishCampaign(creds, metaPayload, mediaItems = []) {
  const token = getToken(creds);
  const accountId = creds.account_id;
  if (!accountId) throw new Error('account_id ausente');

  /* Normaliza: aceita ad_sets (array) ou ad_set (objeto único) */
  const adSetsList = Array.isArray(metaPayload?.ad_sets)
    ? metaPayload.ad_sets
    : (metaPayload?.ad_set ? [metaPayload.ad_set] : []);

  if (!metaPayload?.campaign || !metaPayload?.creative || !metaPayload?.ad || adSetsList.length === 0) {
    throw new Error('Payload Meta incompleto (precisa de campaign, ad_set(s), creative, ad)');
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

  // 3. Creative ÚNICO — reutilizado entre N ads
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

  // 4. Para cada ad_set: cria AdSet + Ad. Erro em um dos anéis é fatal pra consistência.
  const adSetResults = [];
  for (let i = 0; i < adSetsList.length; i++) {
    const a = adSetsList[i];
    const asParams = {
      campaign_id:       campaignId,
      name:              a.name,
      optimization_goal: a.optimization_goal,
      billing_event:     a.billing_event,
      bid_strategy:      a.bid_strategy || 'LOWEST_COST_WITHOUT_CAP',
      status:            'PAUSED',
      targeting:         a.targeting,
    };
    if (a.daily_budget) asParams.daily_budget = a.daily_budget;
    if (a.lifetime_budget) asParams.lifetime_budget = a.lifetime_budget;
    if (a.start_time) asParams.start_time = a.start_time;
    if (a.end_time) asParams.end_time = a.end_time;
    if (a.promoted_object) asParams.promoted_object = a.promoted_object;
    /* CONVERSATIONS (objetivo Mensagens) exige promoted_object.page_id.
       Fallback: se frontend não mandou, usa page_id das credenciais. */
    if (asParams.optimization_goal === 'CONVERSATIONS' && !asParams.promoted_object && creds.page_id) {
      asParams.promoted_object = { page_id: creds.page_id };
    }

    let asResp;
    try {
      asResp = await request('POST', `/${accountId}/adsets`, asParams, { token });
    } catch (e) {
      e.message = `Falha ao criar AdSet "${a.name}" (anel ${i + 1}/${adSetsList.length}): ${e.message}`;
      throw e;
    }
    const adSetId = asResp.id;

    const baseAdName = metaPayload.ad.name || a.name;
    const adName = adSetsList.length > 1 ? `${baseAdName} — Anúncio ${i + 1}` : baseAdName;
    let adResp;
    try {
      adResp = await request('POST', `/${accountId}/ads`, {
        name: adName,
        adset_id: adSetId,
        creative: { creative_id: creativeId },
        status: 'PAUSED',
      }, { token });
    } catch (e) {
      e.message = `Falha ao criar Ad "${adName}" (anel ${i + 1}/${adSetsList.length}): ${e.message}`;
      throw e;
    }

    adSetResults.push({
      ad_set_id:     adSetId,
      ad_id:         adResp.id,
      ring_key:      a._ring_key || null,
      ring_percent:  a._ring_percent ?? null,
      daily_budget:  a.daily_budget ?? null,
    });
  }

  return {
    platform_campaign_id: campaignId,
    creative_id:          creativeId,
    uploaded_images:      uploadedImages,
    ad_sets:              adSetResults,
    /* Campos legados — apontam pro primeiro ad set/ad criado */
    ad_set_id:            adSetResults[0]?.ad_set_id || null,
    ad_id:                adSetResults[0]?.ad_id || null,
  };
}

module.exports = { updateCampaignStatus, deleteCampaign, publishCampaign, request, getToken };
