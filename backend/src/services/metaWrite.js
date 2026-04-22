const { decrypt } = require('./crypto');
const { uploadImage } = require('./metaMedia');
const { metaRequest } = require('./metaHttp');

function getToken(creds) {
  if (!creds?.access_token) throw new Error('Plataforma não conectada');
  if (String(creds.access_token).includes(':')) {
    try { return decrypt(creds.access_token); }
    catch { return creds.access_token; }
  }
  return creds.access_token;
}

/* Thin wrapper: preserva a assinatura antiga `request(method, path, params, {token})`
   mas delega pro helper central (timeout, rate limit, auto needs_reconnect em 190/102). */
function request(method, path, params = {}, { token } = {}) {
  return metaRequest(method, path, params, { token });
}

async function updateCampaignStatus(creds, platformCampaignId, status) {
  const token = getToken(creds);
  const metaStatus = status === 'active' ? 'ACTIVE' : status === 'paused' ? 'PAUSED' : String(status).toUpperCase();
  const result = await request('POST', `/${platformCampaignId}`, { status: metaStatus }, { token });

  /* Defensivo: ao PAUSAR, também pausa todos os ad_sets descendentes.
     Meta já pausa cascata via effective_status quando campaign pausa, mas
     alguns cenários (CBO em reativação parcial) deixam ad_sets em ACTIVE.
     Pausar explícito garante que a Cris pare de gastar imediatamente. */
  if (metaStatus === 'PAUSED') {
    try {
      const { metaGet } = require('./metaHttp');
      const adsetsResp = await metaGet(`/${platformCampaignId}/adsets`, { fields: 'id,status', limit: 100 }, { token });
      for (const as of (adsetsResp?.data || [])) {
        if (as?.id && as?.status !== 'PAUSED') {
          try { await request('POST', `/${as.id}`, { status: 'PAUSED' }, { token }); }
          catch (e) { console.warn('[metaWrite] pause adset falhou:', as.id, e.message); }
        }
      }
    } catch (e) {
      /* Não bloqueia: a campaign JÁ está pausada, ad_sets em cascata é defensivo */
      console.warn('[metaWrite] pause cascade falhou:', e.message);
    }
  }

  return result;
}

/* Atualiza campos mutáveis de uma Campaign no Meta (ex: name). */
async function updateCampaignMeta(creds, platformCampaignId, fields) {
  const token = getToken(creds);
  const clean = {};
  if (fields.name != null) clean.name = fields.name;
  if (Object.keys(clean).length === 0) return null;
  return request('POST', `/${platformCampaignId}`, clean, { token });
}

/* Atualiza campos mutáveis de um AdSet (budget, datas, nome). */
async function updateAdSetMeta(creds, platformAdSetId, fields) {
  const token = getToken(creds);
  const clean = {};
  if (fields.name != null) clean.name = fields.name;
  if (fields.daily_budget != null) clean.daily_budget = Math.round(fields.daily_budget);
  if (fields.lifetime_budget != null) clean.lifetime_budget = Math.round(fields.lifetime_budget);
  if (fields.start_time != null) clean.start_time = fields.start_time;
  if (fields.end_time != null) clean.end_time = fields.end_time;
  if (Object.keys(clean).length === 0) return null;
  return request('POST', `/${platformAdSetId}`, clean, { token });
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

  /* Helper: envelopa chamadas Meta pra enriquecer erro com contexto
     (qual etapa + qual payload). Facilita debug quando Meta retorna
     'Invalid parameter' sem error_user_msg específico. */
  async function metaCall(stage, params, endpoint) {
    try {
      return await request('POST', endpoint, params, { token });
    } catch (err) {
      err.stage = stage;
      err.params = params;
      err.endpoint = endpoint;
      throw err;
    }
  }

  /* Busca ID real de um interesse no Meta Ad Library via /search.
     Frontend envia IDs fake ('interest_beleza') que o Meta rejeita — aqui
     trocamos pelo ID oficial ({id: '6003107', name: 'Beauty'}). Se não
     achar, remove o interesse (melhor broader do que rejeitar).
     Usa metaGet pra herdar timeout + rate limit + auto-reconnect em 190/102. */
  const { metaGet } = require('./metaHttp');
  async function resolveInterestIds(interests) {
    if (!Array.isArray(interests) || interests.length === 0) return [];
    const resolved = [];
    for (const it of interests) {
      const name = it?.name || (typeof it === 'string' ? it : null);
      const hasValidId = it?.id && !String(it.id).startsWith('interest_');
      if (hasValidId) { resolved.push({ id: it.id, name: it.name || name }); continue; }
      if (!name) continue;
      try {
        const result = await metaGet('/search', {
          type: 'adinterest',
          q: name,
          limit: 1,
        }, { token });
        const first = result?.data?.[0];
        if (first?.id) resolved.push({ id: first.id, name: first.name || name });
        /* Sem match → simplesmente não inclui esse interesse */
      } catch { /* ignora erro de search — só não inclui */ }
    }
    return resolved;
  }

  // 1. Upload de mídia — detecta image vs video
  const { uploadVideo, waitForVideoReady } = require('./metaMedia');
  const uploadedImages = [];
  const uploadedVideos = [];
  for (const m of mediaItems) {
    if (!m?.base64) continue;
    try {
      if (m.type === 'video' || (m.mime || '').startsWith('video/')) {
        const vid = await uploadVideo(creds, m.base64);
        uploadedVideos.push({ ...vid, originalId: m.id });
      } else {
        const img = await uploadImage(creds, m.base64);
        uploadedImages.push({ ...img, originalId: m.id });
      }
    } catch (e) {
      throw new Error(`Falha ao enviar "${m.name || 'mídia'}": ${e.message}`);
    }
  }
  const mainImageHash = uploadedImages[0]?.hash || metaPayload.creative?.object_story_spec?.link_data?.image_hash;
  const mainVideoId   = uploadedVideos[0]?.id || metaPayload.creative?.object_story_spec?.video_data?.video_id;
  const isVideo = !!mainVideoId && !mainImageHash;

  /* Meta processa vídeo de forma assíncrona — se criarmos o creative antes
     do processamento terminar, dá erro 1492013. Aguarda até 60s. */
  if (isVideo && mainVideoId && uploadedVideos.length > 0) {
    try { await waitForVideoReady(creds, mainVideoId); }
    catch (e) { throw new Error(`Vídeo não ficou pronto no Meta: ${e.message}`); }
  }

  /* Cleanup transacional: se qualquer etapa depois da criação da campaign
     falhar, deleta os recursos já criados no Meta antes de propagar o erro.
     Evita acumular campanhas/creatives órfãos no Ads Manager quando
     publicação falha no meio. Best-effort — se o delete também falhar,
     loga e continua (não ofusca o erro original). */
  let createdCampaignId = null;
  let createdCreativeId = null;
  async function cleanupOrphans() {
    if (createdCreativeId) {
      try { await request('DELETE', `/${createdCreativeId}`, {}, { token }); }
      catch (e) { console.warn('[cleanup] creative falhou:', createdCreativeId, e.message); }
    }
    if (createdCampaignId) {
      /* Deletar a Campaign cascateia pra AdSets e Ads filhos no Meta */
      try { await request('DELETE', `/${createdCampaignId}`, {}, { token }); }
      catch (e) { console.warn('[cleanup] campaign falhou:', createdCampaignId, e.message); }
    }
  }

  try {

  // 2. Campaign
  const c = metaPayload.campaign;
  const hasCampaignBudget = !!(c.daily_budget || c.lifetime_budget);
  const campParams = {
    name: c.name,
    objective: c.objective,
    status: 'PAUSED',
    buying_type: c.buying_type || 'AUCTION',
    special_ad_categories: c.special_ad_categories || [],
  };
  if (c.daily_budget) campParams.daily_budget = c.daily_budget;
  if (c.lifetime_budget) campParams.lifetime_budget = c.lifetime_budget;
  /* Meta v20: campo obrigatório quando NÃO tem budget na campaign (ABO).
     false = cada ad_set com seu orçamento fixo, sem compartilhar 20% entre eles.
     true = permitiria Meta realocar 20% entre ad_sets (similar ao CBO light). */
  if (!hasCampaignBudget) {
    campParams.is_adset_budget_sharing_enabled = false;
  }
  const campResp = await metaCall('campaign', campParams, `/${accountId}/campaigns`);
  const campaignId = campResp.id;
  createdCampaignId = campaignId;

  // 3. Creative ÚNICO — reutilizado entre N ads
  const cr = { ...metaPayload.creative };
  const storySpec = JSON.parse(JSON.stringify(cr.object_story_spec || {}));
  if (!storySpec.page_id && creds.page_id) storySpec.page_id = creds.page_id;

  /* Fallback seguro p/ link_data.link: Meta v20 exige URL válida. Se o frontend
     mandou null (destUrl vazio em CTA de Mensagens), usa URL da própria Page. */
  const pageUrlFallback = storySpec.page_id
    ? `https://www.facebook.com/${storySpec.page_id}`
    : null;

  if (isVideo) {
    /* Creative de VÍDEO: video_data precisa de video_id + image_hash (capa).
       Meta v20 REJEITA video_data sem image_hash com erro 1815575. */
    const existingVideo = storySpec.video_data || {};
    const linkData = storySpec.link_data || {};
    const videoImageHash = existingVideo.image_hash || mainImageHash;
    if (!videoImageHash) {
      throw new Error('Capa do vídeo (image_hash) ausente — Meta exige uma imagem de capa pra publicar vídeo');
    }
    storySpec.video_data = {
      video_id:       mainVideoId,
      image_hash:     videoImageHash,
      message:        existingVideo.message || linkData.message || cr.primary_text || '',
      title:          existingVideo.title || linkData.name || linkData.title || '',
      call_to_action: existingVideo.call_to_action || linkData.call_to_action || { type: 'LEARN_MORE' },
    };
    delete storySpec.link_data;
  } else if (storySpec.link_data) {
    if (mainImageHash) storySpec.link_data.image_hash = mainImageHash;
    /* Null/empty link → fallback pra URL da Page (Meta rejeita link vazio) */
    if (!storySpec.link_data.link && pageUrlFallback) {
      storySpec.link_data.link = pageUrlFallback;
    }
  }

  const crResp = await metaCall('creative', {
    name: cr.name || `${c.name} — Criativo`,
    object_story_spec: storySpec,
  }, `/${accountId}/adcreatives`);
  const creativeId = crResp.id;
  createdCreativeId = creativeId;

  // 4. Para cada ad_set: cria AdSet + Ad. Erro em um dos anéis é fatal pra consistência.
  const adSetResults = [];
  for (let i = 0; i < adSetsList.length; i++) {
    const a = adSetsList[i];
    /* Resolve IDs de interesses pelos IDs reais do Meta antes de enviar
       (frontend envia IDs fake tipo 'interest_beleza' que Meta rejeita). */
    const targeting = { ...(a.targeting || {}) };
    if (Array.isArray(targeting.interests) && targeting.interests.length > 0) {
      targeting.interests = await resolveInterestIds(targeting.interests);
      /* Se todos interesses falharam, remove o campo — broader é melhor que inválido */
      if (targeting.interests.length === 0) delete targeting.interests;
    }
    /* Meta v20: campo obrigatório. Se frontend legado não enviou,
       injeta advantage_audience=0 (respeita targeting manual da Cris
       — regra Joinville não tolera expansão automática). */
    if (!targeting.targeting_automation) {
      targeting.targeting_automation = { advantage_audience: 0 };
    }
    const asParams = {
      campaign_id:       campaignId,
      name:              a.name,
      optimization_goal: a.optimization_goal,
      billing_event:     a.billing_event,
      bid_strategy:      a.bid_strategy || 'LOWEST_COST_WITHOUT_CAP',
      status:            'PAUSED',
      targeting,
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
    /* Meta v20: optimization_goal=CONVERSATIONS exige destination_type
       (MESSENGER / INSTAGRAM_DIRECT / WHATSAPP). Default INSTAGRAM_DIRECT
       porque canal único da Cris é IG Direct. */
    if (a.destination_type) {
      asParams.destination_type = a.destination_type;
    } else if (asParams.optimization_goal === 'CONVERSATIONS') {
      asParams.destination_type = 'INSTAGRAM_DIRECT';
    }

    let asResp;
    try {
      asResp = await metaCall('adset', asParams, `/${accountId}/adsets`);
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

  } catch (err) {
    /* Qualquer falha após criar campaign/creative → cleanup automático.
       Preserva o erro original (stage/params/meta) pro frontend exibir
       em Reprovados com diagnóstico completo. */
    await cleanupOrphans();
    err.cleanedUp = true;
    throw err;
  }
}

module.exports = { updateCampaignStatus, updateCampaignMeta, updateAdSetMeta, deleteCampaign, publishCampaign, request, getToken };
