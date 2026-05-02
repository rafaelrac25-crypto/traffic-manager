const { safeDecrypt } = require('./crypto');
const { uploadImage } = require('./metaMedia');
const { metaRequest } = require('./metaHttp');

function getToken(creds) {
  if (!creds?.access_token) throw new Error('Plataforma não conectada');
  return safeDecrypt(creds.access_token, 'metaWrite');
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

  /* Cascata em ambos sentidos: PAUSE e ACTIVATE propagam pra ad_sets e ads.
     Sem isso, ativar a campanha deixa ad_sets/ads em PAUSED (que era o status
     default quando foram criados) — campanha "ativa" mas anúncio sem rodar.
     Cris/Rafa não precisam mexer no Meta Ads Manager: 1 clique no painel
     basta pra estado consistente.

     Retorna summary com contagem de níveis afetados + falhas. Falha de
     cascade NÃO bloqueia a chamada (campaign já mudou) mas eleva summary
     pro chamador decidir avisar usuário. */
  const summary = {
    campaign: { id: platformCampaignId, status: metaStatus, ok: true },
    adsets: { total: 0, changed: 0, failures: [] },
    ads:    { total: 0, changed: 0, failures: [] },
  };

  if (metaStatus === 'PAUSED' || metaStatus === 'ACTIVE') {
    try {
      const { metaGet } = require('./metaHttp');
      /* Ad_sets descendentes */
      const adsetsResp = await metaGet(`/${platformCampaignId}/adsets`, { fields: 'id,status,effective_status', limit: 100 }, { token });
      const adsets = adsetsResp?.data || [];
      summary.adsets.total = adsets.length;
      for (const as of adsets) {
        if (as?.id && as?.status !== metaStatus) {
          try {
            await request('POST', `/${as.id}`, { status: metaStatus }, { token });
            summary.adsets.changed++;
          } catch (e) {
            const msg = e?.meta?.pt || e?.meta?.message || e.message;
            console.warn('[metaWrite] cascade adset', as.id, msg);
            summary.adsets.failures.push({ id: as.id, error: msg });
          }
        }
      }
      /* Ads descendentes — ad criado fica PAUSED por default (publishCampaign
         seta assim por segurança). Sem ativar aqui, anúncio nunca roda mesmo
         com campanha+adset ativos. */
      const adsResp = await metaGet(`/${platformCampaignId}/ads`, { fields: 'id,status,effective_status', limit: 100 }, { token });
      const ads = adsResp?.data || [];
      summary.ads.total = ads.length;
      for (const ad of ads) {
        if (ad?.id && ad?.status !== metaStatus) {
          try {
            await request('POST', `/${ad.id}`, { status: metaStatus }, { token });
            summary.ads.changed++;
          } catch (e) {
            const msg = e?.meta?.pt || e?.meta?.message || e.message;
            console.warn('[metaWrite] cascade ad', ad.id, msg);
            summary.ads.failures.push({ id: ad.id, error: msg });
          }
        }
      }
    } catch (e) {
      console.warn('[metaWrite] cascade falhou:', e.message);
      summary.cascade_error = e.message;
    }
  }

  /* Anexar summary ao result pro caller (PATCH /status) usar */
  if (result && typeof result === 'object') {
    result.cascade_summary = summary;
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

/* Atualiza campos mutáveis de um AdSet (budget, datas, nome, targeting).
   Targeting é um objeto Meta v20 — passar parcial substitui o targeting
   completo no Meta, então o caller deve mandar o targeting INTEIRO já
   reconciliado com o que existe (não só os campos que mudaram). */
async function updateAdSetMeta(creds, platformAdSetId, fields) {
  const token = getToken(creds);
  const clean = {};
  if (fields.name != null) clean.name = fields.name;
  if (fields.daily_budget != null) clean.daily_budget = Math.round(fields.daily_budget);
  if (fields.lifetime_budget != null) clean.lifetime_budget = Math.round(fields.lifetime_budget);
  if (fields.start_time != null) clean.start_time = fields.start_time;
  if (fields.end_time != null) clean.end_time = fields.end_time;
  if (fields.targeting != null) clean.targeting = fields.targeting;
  if (fields.status != null) clean.status = fields.status;
  /* Edição pós-pub do horário de exibição / frequency / bid cap / atribuição */
  if (Array.isArray(fields.adset_schedule)) clean.adset_schedule = fields.adset_schedule;
  if (Array.isArray(fields.frequency_control_specs)) clean.frequency_control_specs = fields.frequency_control_specs;
  if (fields.bid_amount != null) clean.bid_amount = Math.round(Number(fields.bid_amount));
  if (fields.bid_strategy != null) clean.bid_strategy = fields.bid_strategy;
  if (Object.keys(clean).length === 0) return null;
  return request('POST', `/${platformAdSetId}`, clean, { token });
}

/* Delete cascateia AUTOMATICAMENTE no Meta — DELETE /{campaign_id}
   remove todos os adsets, ads e creatives filhos. Comportamento documentado
   da Graph API (não precisamos iterar e deletar cada nível). Confirmado em
   testes ao vivo: camp 433 deletada removeu 3 adsets + 3 ads + 1 creative
   numa única chamada. */
async function deleteCampaign(creds, platformCampaignId) {
  const token = getToken(creds);
  return request('DELETE', `/${platformCampaignId}`, {}, { token });
}

/* Substitui o creative de um Ad existente — cirúrgico:
   - Lê creative atual no Meta (story spec completo: video_id, image_hash, message, title, cta)
   - Constrói novo story spec aplicando overrides (link novo, message nova, title novo)
   - Cria NOVO creative no Meta (POST /act_X/adcreatives) reusando video_id+image_hash
   - Atualiza Ad pra apontar pro novo creative (POST /<ad_id>)
   - Ad volta pra revisão Meta (PENDING_REVIEW) por causa do creative novo
   - Preserva: campaign_id, adset_id, ad_id, métricas históricas, targeting, budget

   Retorna { new_creative_id, old_creative_id, ad_id }.

   Por que NÃO PATCH no creative existente: Meta v20 trata creative como
   imutável após primeiro uso (erro 100/2655). Único caminho oficial é
   criar novo + atualizar ad pra apontar.

   overrides: { link?, message?, title?, ctaType? }
     - link: novo destUrl (ex: wa.me/...?text=...) — vai pro call_to_action.value.link e link_data.link
     - message: novo primary text (legenda) — vai pro video_data.message ou link_data.message
     - title: novo headline — vai pro video_data.title ou link_data.name
     - ctaType: força call_to_action.type (ex: 'LEARN_MORE'); default mantém o atual
*/
async function replaceCreative(creds, { adAccountId, platformAdId, platformCreativeId, overrides = {} }) {
  const token = getToken(creds);
  if (!adAccountId) throw new Error('replaceCreative: adAccountId obrigatório');
  if (!platformAdId) throw new Error('replaceCreative: platformAdId obrigatório');
  if (!platformCreativeId) throw new Error('replaceCreative: platformCreativeId obrigatório');

  /* 1) Lê creative atual pra pegar story spec completo (video_id, image_hash, etc).
     Sem isso teríamos que receber tudo do caller — frágil. Meta retorna a estrutura
     completa em GET /<creative_id>?fields=object_story_spec,name. */
  const { metaGet } = require('./metaHttp');
  const current = await metaGet(`/${platformCreativeId}`, {
    fields: 'name,object_story_spec,effective_object_story_id,thumbnail_url'
  }, { token });

  if (!current?.object_story_spec) {
    throw new Error(`Creative ${platformCreativeId} não tem object_story_spec — não dá pra clonar`);
  }

  /* 2) Clona profundo (não muta o original) e aplica overrides.
     Meta v20 aceita video_data OU link_data — preserva qual veio.

     Sanitização: GET /<creative_id> retorna campos resolvidos pelo Meta
     (image_url, picture, page_welcome_message, branded_content_sponsor_page_id,
     etc.) que NÃO podem voltar num POST. Meta erro 1443051
     "ObjectStorySpecRedundant" quando image_url+image_hash coexistem no
     video_data. Limpa antes de criar novo. */
  const newSpec = JSON.parse(JSON.stringify(current.object_story_spec));

  if (newSpec.video_data) {
    delete newSpec.video_data.image_url;
    delete newSpec.video_data.thumbnail_url;
    delete newSpec.video_data.id;
  }
  if (newSpec.link_data) {
    delete newSpec.link_data.image_url;
    delete newSpec.link_data.picture;
    delete newSpec.link_data.id;
  }
  delete newSpec.id;
  delete newSpec.effective_object_story_id;
  delete newSpec.branded_content_sponsor_page_id;

  if (newSpec.video_data) {
    if (overrides.message != null) newSpec.video_data.message = String(overrides.message);
    if (overrides.title != null) newSpec.video_data.title = String(overrides.title);
    if (!newSpec.video_data.call_to_action) newSpec.video_data.call_to_action = { type: 'LEARN_MORE' };
    if (overrides.ctaType) newSpec.video_data.call_to_action.type = overrides.ctaType;
    if (overrides.link != null) {
      const t = newSpec.video_data.call_to_action.type || 'LEARN_MORE';
      /* WHATSAPP_MESSAGE não aceita link no value (puxa da Page) */
      if (t === 'WHATSAPP_MESSAGE') {
        newSpec.video_data.call_to_action.value = { app_destination: 'WHATSAPP' };
      } else if (t === 'MESSAGE_PAGE' || t === 'SEND_MESSAGE') {
        newSpec.video_data.call_to_action.value = { app_destination: 'MESSENGER' };
      } else {
        newSpec.video_data.call_to_action.value = { link: String(overrides.link) };
      }
    }
  } else if (newSpec.link_data) {
    if (overrides.message != null) newSpec.link_data.message = String(overrides.message);
    if (overrides.title != null) newSpec.link_data.name = String(overrides.title);
    if (overrides.link != null) newSpec.link_data.link = String(overrides.link);
    if (!newSpec.link_data.call_to_action) newSpec.link_data.call_to_action = { type: 'LEARN_MORE' };
    if (overrides.ctaType) newSpec.link_data.call_to_action.type = overrides.ctaType;
  } else {
    throw new Error(`Creative ${platformCreativeId} não tem video_data nem link_data — formato desconhecido`);
  }

  /* 3) Cria novo creative reusando os assets já uploadados (video_id+image_hash).
     Não há reupload — bytes ficam no servidor Meta atrelados à conta. */
  const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
  const newCreativeResp = await request('POST', `/${accountId}/adcreatives`, {
    name: (current.name || 'Creative') + ' — v2',
    object_story_spec: newSpec,
  }, { token });

  const newCreativeId = newCreativeResp?.id;
  if (!newCreativeId) throw new Error('Meta não retornou ID do novo creative');

  /* 4) Reaponta o Ad existente pro novo creative.
     POST /<ad_id> com creative={creative_id: ...} — Meta aceita troca em ad
     que está PAUSED. Status do ad fica PAUSED, effective_status volta pra
     PENDING_REVIEW por causa do creative novo. Caller decide quando ativar. */
  await request('POST', `/${platformAdId}`, {
    creative: { creative_id: newCreativeId },
  }, { token });

  return {
    new_creative_id: newCreativeId,
    old_creative_id: platformCreativeId,
    ad_id: platformAdId,
    new_object_story_spec: newSpec,
  };
}

/* Duplica um Ad DENTRO do mesmo AdSet com creative atualizado.
   Diferença pra replaceCreative: aqui o ad ANTIGO permanece (preservando
   métricas históricas raw no Meta Ads Manager) e um NOVO ad é criado irmão
   dele no mesmo adset. Caller pausa o antigo e ativa o novo quando aprovar.

   - Lê creative atual (story spec) + nome do ad atual
   - Constrói novo story spec com overrides (link wa.me?text=, message, title, ctaType)
   - Cria NOVO creative reusando video_id+image_hash (sem reupload)
   - Cria NOVO ad no MESMO adset apontando pro novo creative (PAUSED por segurança)
   - Preserva: campaign+adset+ad antigo (histórico) e adiciona ad novo

   Por que NÃO mexer no ad antigo: regra de marketing — quando um anúncio
   tem aprendizado, não destruir; criar variante e A/B mental (ad antigo
   pausa, ad novo entra). Métricas históricas ficam visíveis no Meta.

   Retorna { new_ad_id, new_creative_id, old_ad_id, old_creative_id }. */
async function duplicateAdInAdSet(creds, {
  adAccountId, platformAdSetId, platformAdId, platformCreativeId,
  overrides = {}, newAdName = null
}) {
  const token = getToken(creds);
  if (!adAccountId) throw new Error('duplicateAdInAdSet: adAccountId obrigatório');
  if (!platformAdSetId) throw new Error('duplicateAdInAdSet: platformAdSetId obrigatório');
  if (!platformAdId) throw new Error('duplicateAdInAdSet: platformAdId obrigatório (ad de origem pra herdar nome)');
  if (!platformCreativeId) throw new Error('duplicateAdInAdSet: platformCreativeId obrigatório');

  const { metaGet } = require('./metaHttp');

  /* 1) Lê creative + ad atuais em paralelo */
  const [currentCreative, currentAd] = await Promise.all([
    metaGet(`/${platformCreativeId}`, { fields: 'name,object_story_spec' }, { token }),
    metaGet(`/${platformAdId}`, { fields: 'name' }, { token }),
  ]);

  if (!currentCreative?.object_story_spec) {
    throw new Error(`Creative ${platformCreativeId} não tem object_story_spec — não dá pra clonar`);
  }

  /* 2) Clona story spec + aplica overrides (mesma lógica de replaceCreative) */
  const newSpec = JSON.parse(JSON.stringify(currentCreative.object_story_spec));
  /* Sanitiza campos que GET retorna mas POST rejeita (erro 1443051
     ObjectStorySpecRedundant quando image_url+image_hash coexistem) */
  if (newSpec.video_data) {
    delete newSpec.video_data.image_url;
    delete newSpec.video_data.thumbnail_url;
    delete newSpec.video_data.id;
  }
  if (newSpec.link_data) {
    delete newSpec.link_data.image_url;
    delete newSpec.link_data.picture;
    delete newSpec.link_data.id;
  }
  delete newSpec.id;
  delete newSpec.effective_object_story_id;
  delete newSpec.branded_content_sponsor_page_id;

  if (newSpec.video_data) {
    if (overrides.message != null) newSpec.video_data.message = String(overrides.message);
    if (overrides.title != null) newSpec.video_data.title = String(overrides.title);
    if (!newSpec.video_data.call_to_action) newSpec.video_data.call_to_action = { type: 'LEARN_MORE' };
    if (overrides.ctaType) newSpec.video_data.call_to_action.type = overrides.ctaType;
    if (overrides.link != null) {
      const t = newSpec.video_data.call_to_action.type || 'LEARN_MORE';
      if (t === 'WHATSAPP_MESSAGE') {
        newSpec.video_data.call_to_action.value = { app_destination: 'WHATSAPP' };
      } else if (t === 'MESSAGE_PAGE' || t === 'SEND_MESSAGE') {
        newSpec.video_data.call_to_action.value = { app_destination: 'MESSENGER' };
      } else {
        newSpec.video_data.call_to_action.value = { link: String(overrides.link) };
      }
    }
  } else if (newSpec.link_data) {
    if (overrides.message != null) newSpec.link_data.message = String(overrides.message);
    if (overrides.title != null) newSpec.link_data.name = String(overrides.title);
    if (overrides.link != null) newSpec.link_data.link = String(overrides.link);
    if (!newSpec.link_data.call_to_action) newSpec.link_data.call_to_action = { type: 'LEARN_MORE' };
    if (overrides.ctaType) newSpec.link_data.call_to_action.type = overrides.ctaType;
  } else {
    throw new Error(`Creative ${platformCreativeId} não tem video_data nem link_data — formato desconhecido`);
  }

  /* 3) Cria novo creative reusando assets uploadados */
  const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
  const newCreativeResp = await request('POST', `/${accountId}/adcreatives`, {
    name: (currentCreative.name || 'Creative') + ' — v2',
    object_story_spec: newSpec,
  }, { token });
  const newCreativeId = newCreativeResp?.id;
  if (!newCreativeId) throw new Error('Meta não retornou ID do novo creative');

  /* 4) Cria NOVO ad no MESMO adset (sufixo " — v2" no nome).
     PAUSED por segurança: caller decide quando ativar (cascade dispara revisão). */
  const baseName = currentAd?.name || 'Anúncio';
  const finalName = newAdName || (baseName.includes('— v2') ? baseName : `${baseName} — v2`);
  const newAdResp = await request('POST', `/${accountId}/ads`, {
    name: finalName,
    adset_id: platformAdSetId,
    creative: { creative_id: newCreativeId },
    status: 'PAUSED',
  }, { token });
  const newAdId = newAdResp?.id;
  if (!newAdId) throw new Error('Meta não retornou ID do novo ad');

  return {
    new_ad_id: newAdId,
    new_ad_name: finalName,
    new_creative_id: newCreativeId,
    old_ad_id: platformAdId,
    old_creative_id: platformCreativeId,
    new_object_story_spec: newSpec,
  };
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
  /* Lista de interesses descartados (Meta não achou match) — propagada pro
     resultado final pra que o frontend possa avisar a Cris ("interesse X
     não foi encontrado, anúncio segue mais broader"). Antes era descarte
     silencioso, agora fica visível. */
  const droppedInterests = [];
  async function resolveInterestIds(interests) {
    if (!Array.isArray(interests) || interests.length === 0) return [];
    const resolved = [];
    for (const it of interests) {
      const name = it?.name || (typeof it === 'string' ? it : null);
      const hasValidId = it?.id && !String(it.id).startsWith('interest_');
      if (hasValidId) { resolved.push({ id: it.id, name: it.name || name }); continue; }
      if (!name) { droppedInterests.push({ name: null, reason: 'sem_nome' }); continue; }
      try {
        const result = await metaGet('/search', {
          type: 'adinterest',
          q: name,
          limit: 1,
        }, { token });
        const first = result?.data?.[0];
        if (first?.id) {
          resolved.push({ id: first.id, name: first.name || name });
        } else {
          console.warn('[metaWrite] interesse descartado (sem match no Meta):', name);
          droppedInterests.push({ name, reason: 'sem_match' });
        }
      } catch (e) {
        console.warn('[metaWrite] interesse descartado (erro search):', name, e.message);
        droppedInterests.push({ name, reason: 'erro_search', error: e.message });
      }
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
     do processamento terminar, dá erro 1492013. Aguarda até 120s e ABORTA
     a publicação se não ficar pronto (antes a função retornava ready:false
     em timeout e publishCampaign seguia mesmo assim, criando creative com
     vídeo "processing" — Meta rejeitava com erro genérico, mais difícil de
     diagnosticar pro usuário). */
  if (isVideo && mainVideoId && uploadedVideos.length > 0) {
    try {
      /* maxWaitMs 50s deixa 10s de margem antes do Vercel maxDuration (60s)
         matar o lambda. Se vídeo grande não fica pronto em 50s, abortamos
         publicação com mensagem clara — Vercel não chega a matar o request,
         cleanup propaga normalmente. */
      const result = await waitForVideoReady(creds, mainVideoId, { maxWaitMs: 50000 });
      if (!result?.ready) {
        throw new Error('Vídeo ainda em processamento no Meta após 50s. Aguarde 1-2 minutos e tente novamente, ou use uma versão menor (≤30s, <10MB).');
      }
    } catch (e) {
      throw new Error(`Vídeo não ficou pronto no Meta: ${e.message}`);
    }
  }

  /* Cleanup transacional: se qualquer etapa depois da criação da campaign
     falhar, deleta os recursos já criados no Meta antes de propagar o erro.
     Evita acumular campanhas/creatives órfãos no Ads Manager quando
     publicação falha no meio. Best-effort — se o delete também falhar,
     loga e continua (não ofusca o erro original). */
  let createdCampaignId = null;
  let createdCreativeId = null;
  /* Rastreia ad_sets/ads criados antes da falha pra logging detalhado.
     Cleanup da Campaign cascateia no Meta, mas pro debug é útil saber
     QUAIS ad_sets chegaram a ser criados antes do erro. */
  const createdAdSets = [];
  const createdAds = [];
  async function cleanupOrphans() {
    console.warn('[cleanup] iniciando — campaign:', createdCampaignId, 'creative:', createdCreativeId, 'ad_sets:', createdAdSets.length, 'ads:', createdAds.length);
    if (createdAdSets.length > 0) console.warn('[cleanup] ad_sets criados antes da falha:', createdAdSets.join(', '));
    if (createdAds.length > 0) console.warn('[cleanup] ads criados antes da falha:', createdAds.join(', '));
    if (createdCreativeId) {
      try {
        await request('DELETE', `/${createdCreativeId}`, {}, { token });
        console.warn('[cleanup] creative deletado:', createdCreativeId);
      }
      catch (e) { console.warn('[cleanup] creative DELETE falhou:', createdCreativeId, e.message); }
    }
    if (createdCampaignId) {
      /* Deletar a Campaign cascateia pra AdSets e Ads filhos no Meta */
      try {
        await request('DELETE', `/${createdCampaignId}`, {}, { token });
        console.warn('[cleanup] campaign deletada (cascade pra ad_sets/ads):', createdCampaignId);
      }
      catch (e) { console.warn('[cleanup] campaign DELETE falhou:', createdCampaignId, e.message); }
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
  /* Meta v20 + CBO (orçamento na campanha) + objetivos como CONVERSATIONS/WHATSAPP
     às vezes assume default que exige bid_amount (erro 100/1815857). Forçando
     LOWEST_COST_WITHOUT_CAP explicitamente no nível da campanha garante que
     o adset herde a estratégia correta sem exigir lance manual. Só vale pra CBO
     — em ABO (budget no adset), Meta rejeita bid_strategy na campanha. */
  if (c.daily_budget || c.lifetime_budget) {
    campParams.bid_strategy = c.bid_strategy || 'LOWEST_COST_WITHOUT_CAP';
  }
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

  /* CTA compatível com objective — Meta v20 rejeita (erro 1487891) creative
     cujo call_to_action.type não combina com o objetivo da campanha.
     Pro objetivo Mensagens (OUTCOME_ENGAGEMENT + optimization_goal=CONVERSATIONS),
     força CTA de família messaging.

     IMPORTANTE: distinguir Mensagens (CONVERSATIONS) de Engajamento de Posts
     (POST_ENGAGEMENT) — ambos mapeiam pra OUTCOME_ENGAGEMENT no Meta v20 ODAX,
     mas só o primeiro precisa de CTA messaging. Antes detectávamos só pelo
     objective; isso fazia engagement (curtidas/comentários) ser tratado
     como messaging e LEARN_MORE virava MESSAGE_PAGE silenciosamente. Agora
     olhamos o optimization_goal real dos ad_sets pra decidir. */
  const MESSAGING_CTAS = ['WHATSAPP_MESSAGE', 'MESSAGE_PAGE', 'CALL_NOW', 'SEND_MESSAGE'];
  const hasConversationsGoal = adSetsList.some(a => a?.optimization_goal === 'CONVERSATIONS');
  const isMessagesCampaign = hasConversationsGoal || c.objective === 'OUTCOME_LEADS';

  /* Saneia o `value` do CTA conforme o `type` exige.
     Meta v20 rejeita params extras: WHATSAPP_MESSAGE não aceita `link`,
     MESSAGE_PAGE/SEND_MESSAGE precisam app_destination: MESSENGER, etc.
     Erro reportado: 105 / 1815630 ("muitos parâmetros na chamada para ação"). */
  function sanitizeCtaValue(ctaObj) {
    if (!ctaObj || !ctaObj.type) return ctaObj;
    const value = ctaObj.value || {};
    switch (ctaObj.type) {
      case 'WHATSAPP_MESSAGE':
        /* WhatsApp puxa da Page (precisa ter WhatsApp Business linkado nas
           settings da Page no Facebook). NÃO aceita link no value. */
        return { type: 'WHATSAPP_MESSAGE', value: { app_destination: 'WHATSAPP' } };
      case 'MESSAGE_PAGE':
      case 'SEND_MESSAGE':
        return { type: ctaObj.type, value: { app_destination: 'MESSENGER' } };
      case 'CALL_NOW':
        /* Aceita tel: link; sem isso, puxa da Page */
        if (typeof value.link === 'string' && value.link.startsWith('tel:')) return ctaObj;
        return { type: 'CALL_NOW', value: {} };
      default:
        /* LEARN_MORE, BOOK_TRAVEL, SHOP_NOW, etc — mantém link */
        return ctaObj;
    }
  }

  function enforceMessagingCTA(ctaObj) {
    let normalized = ctaObj;
    if (isMessagesCampaign) {
      const current = ctaObj?.type;
      if (!current || !MESSAGING_CTAS.includes(current)) {
        console.warn('[metaWrite] CTA', current || '(vazio)', '→ MESSAGE_PAGE (campanha de mensagens exige CTA messaging)');
        normalized = { ...ctaObj, type: 'MESSAGE_PAGE' };
      }
    }
    /* Sempre sanitiza o value conforme o type final, independente do objetivo */
    return sanitizeCtaValue(normalized);
  }

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
      call_to_action: enforceMessagingCTA(existingVideo.call_to_action || linkData.call_to_action || { type: 'LEARN_MORE' }),
    };
    delete storySpec.link_data;
  } else if (storySpec.link_data) {
    if (mainImageHash) storySpec.link_data.image_hash = mainImageHash;
    /* Null/empty link → fallback pra URL da Page (Meta rejeita link vazio) */
    if (!storySpec.link_data.link && pageUrlFallback) {
      storySpec.link_data.link = pageUrlFallback;
    }
    /* Força CTA compatível com objective (Meta v20 erro 1487891) */
    if (storySpec.link_data.call_to_action) {
      storySpec.link_data.call_to_action = enforceMessagingCTA(storySpec.link_data.call_to_action);
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
    /* Bloqueia relaxamentos adicionais (lookalike/custom_audience auto). */
    if (!targeting.targeting_relaxation_types) {
      targeting.targeting_relaxation_types = { lookalike: 0, custom_audience: 0 };
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
    /* Horário de exibição — Meta v20 aceita array de janelas ativas.
       Se Cris escolher "rodar só em horário comercial", front envia
       adset_schedule: [{start_minute, end_minute, days: [1..6]}].
       start_minute/end_minute são minutos desde 00:00 (ex: 8h = 480, 22h = 1320).
       days: 0=domingo .. 6=sábado. */
    if (Array.isArray(a.adset_schedule) && a.adset_schedule.length > 0) {
      asParams.adset_schedule = a.adset_schedule;
    }
    /* Frequency capping — limita exibições por pessoa numa janela.
       Ex: max 3 impressões por usuário em 7 dias.
       Usado se Cris ativar anti-fadiga pro anel primário (público pequeno). */
    if (Array.isArray(a.frequency_control_specs) && a.frequency_control_specs.length > 0) {
      asParams.frequency_control_specs = a.frequency_control_specs;
    }
    /* Bid cap (COST_CAP / BID_CAP / LOWEST_COST_WITH_BID_CAP) precisa de bid_amount em centavos */
    if (a.bid_amount != null) asParams.bid_amount = Math.round(Number(a.bid_amount));
    /* Janela de atribuição customizada por ad_set (default Meta v20 são valores fixos) */
    if (Array.isArray(a.attribution_spec) && a.attribution_spec.length > 0) {
      asParams.attribution_spec = a.attribution_spec;
    }
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
    createdAdSets.push(adSetId);

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
    createdAds.push(adResp.id);

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
    /* Interesses descartados durante resolveInterestIds — frontend exibe
       um aviso ("Avise a Cris: 2 interesses não foram aplicados") em vez
       do descarte silencioso anterior. */
    dropped_interests:    droppedInterests,
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

/* Duplica um AdSet INTEIRO dentro da MESMA campanha via Meta /copies.
   Usado pra testar OUTRO público sem destruir o adset original (que pode
   ter aprendizado acumulado). O adset NOVO entra em learning phase do zero
   — Meta sempre trata adset novo como entidade nova.

   Etapas:
   1) POST /{source_adset_id}/copies com deep_copy=true (copia ads filhos)
      e status_option=PAUSED (segurança — caller decide quando ativar)
   2) Se overrides foram passados (targeting/budget/name), aplica via
      POST /{new_adset_id} usando updateAdSetMeta

   Por que NÃO criar adset do zero: copies herda automaticamente todos os
   campos válidos (campaign_id, optimization_goal, billing_event,
   destination_type, promoted_object, etc.). Recriar manualmente é frágil
   — qualquer campo esquecido vira erro 100/Invalid parameter.

   Retorna { new_adset_id, copied_ad_ids, applied_overrides }. */
async function duplicateAdSet(creds, {
  sourceAdSetId,
  deepCopy = true,
  statusOption = 'PAUSED',
  renameSuffix = ' — v2',
  overrides = {},
}) {
  const token = getToken(creds);
  if (!sourceAdSetId) throw new Error('duplicateAdSet: sourceAdSetId obrigatório');

  /* 1) Chama /copies — Meta retorna { copied_adset_id, ad_object_ids } */
  const copyResp = await request('POST', `/${sourceAdSetId}/copies`, {
    deep_copy: deepCopy,
    status_option: statusOption,
    rename_strategy: 'DEEP_RENAME',
    rename_suffix: renameSuffix,
  }, { token });

  const newAdSetId = copyResp?.copied_adset_id || copyResp?.ad_object_ids?.[0]?.copied_id || null;
  const copiedAdIds = Array.isArray(copyResp?.ad_object_ids)
    ? copyResp.ad_object_ids
        .filter(o => o?.ad_object_type === 'ad' || o?.copied_id)
        .map(o => o.copied_id || o.id)
        .filter(Boolean)
    : [];

  if (!newAdSetId) {
    throw new Error('Meta não retornou ID do conjunto duplicado (verifique permissions ads_management)');
  }

  /* 2) Aplica overrides (se houver) — só campos que updateAdSetMeta aceita.
     Targeting precisa vir reconciliado pelo caller (Meta substitui o objeto
     inteiro, não faz merge). */
  const appliedOverrides = {};
  const hasOverrides = overrides && Object.keys(overrides).length > 0;
  if (hasOverrides) {
    const patch = {};
    if (overrides.name != null) patch.name = String(overrides.name);
    if (overrides.daily_budget != null) patch.daily_budget = Math.round(Number(overrides.daily_budget));
    if (overrides.lifetime_budget != null) patch.lifetime_budget = Math.round(Number(overrides.lifetime_budget));
    if (overrides.targeting != null) patch.targeting = overrides.targeting;
    if (overrides.start_time != null) patch.start_time = overrides.start_time;
    if (overrides.end_time != null) patch.end_time = overrides.end_time;
    if (overrides.bid_amount != null) patch.bid_amount = Math.round(Number(overrides.bid_amount));
    if (Object.keys(patch).length > 0) {
      try {
        await updateAdSetMeta(creds, newAdSetId, patch);
        Object.assign(appliedOverrides, patch);
      } catch (e) {
        /* Override falhou mas adset duplicado JÁ existe — não dá pra rollback
           (Meta cobraria o cleanup). Propaga erro com contexto pro caller
           decidir (pode tentar de novo via PATCH separado, ou aceitar adset
           duplicado com config original). */
        const err = new Error(`Conjunto duplicado mas overrides falharam: ${e.message}`);
        err.partial = { new_adset_id: newAdSetId, copied_ad_ids: copiedAdIds };
        err.meta = e.meta;
        throw err;
      }
    }
  }

  return {
    new_adset_id: newAdSetId,
    copied_ad_ids: copiedAdIds,
    applied_overrides: appliedOverrides,
  };
}

/* Cria um Ad NOVO num adset EXISTENTE, reusando o creative do ad atual ou
   construindo creative novo a partir de overrides. Diferente de
   duplicateAdInAdSet (que sempre clona o creative do ad de origem), aqui
   o caller pode escolher:
   - Reusar creative_id existente direto (mais barato, sem clonar)
   - Construir creative novo via overrides (igual replaceCreative)

   IMPORTANTE: criar ad novo no adset É considerado significant edit pelo
   Meta — reseta o aprendizado do adset. Caller deve avisar usuário.

   Retorna { new_ad_id, creative_id, reused_creative }. */
async function createAdInExistingAdSet(creds, {
  adAccountId,
  platformAdSetId,
  baseCreativeId,
  overrides = null,
  newAdName = 'Anúncio novo',
}) {
  const token = getToken(creds);
  if (!adAccountId) throw new Error('createAdInExistingAdSet: adAccountId obrigatório');
  if (!platformAdSetId) throw new Error('createAdInExistingAdSet: platformAdSetId obrigatório');
  if (!baseCreativeId) throw new Error('createAdInExistingAdSet: baseCreativeId obrigatório (ad atual ou novo)');

  const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
  let creativeIdToUse = baseCreativeId;
  let reusedCreative = true;

  /* Se overrides existem e não estão vazios, clona creative aplicando overrides
     (mesmo padrão de replaceCreative). Senão reusa creative_id existente direto. */
  const hasOverrides = overrides && (overrides.message != null || overrides.title != null || overrides.link != null || overrides.ctaType != null);
  if (hasOverrides) {
    const { metaGet } = require('./metaHttp');
    const current = await metaGet(`/${baseCreativeId}`, {
      fields: 'name,object_story_spec'
    }, { token });
    if (!current?.object_story_spec) {
      throw new Error(`Creative ${baseCreativeId} não tem object_story_spec — não dá pra clonar`);
    }
    const newSpec = JSON.parse(JSON.stringify(current.object_story_spec));
    if (newSpec.video_data) {
      delete newSpec.video_data.image_url;
      delete newSpec.video_data.thumbnail_url;
      delete newSpec.video_data.id;
    }
    if (newSpec.link_data) {
      delete newSpec.link_data.image_url;
      delete newSpec.link_data.picture;
      delete newSpec.link_data.id;
    }
    delete newSpec.id;
    delete newSpec.effective_object_story_id;
    delete newSpec.branded_content_sponsor_page_id;

    if (newSpec.video_data) {
      if (overrides.message != null) newSpec.video_data.message = String(overrides.message);
      if (overrides.title != null) newSpec.video_data.title = String(overrides.title);
      if (!newSpec.video_data.call_to_action) newSpec.video_data.call_to_action = { type: 'LEARN_MORE' };
      if (overrides.ctaType) newSpec.video_data.call_to_action.type = overrides.ctaType;
      if (overrides.link != null) {
        const t = newSpec.video_data.call_to_action.type || 'LEARN_MORE';
        if (t === 'WHATSAPP_MESSAGE') {
          newSpec.video_data.call_to_action.value = { app_destination: 'WHATSAPP' };
        } else if (t === 'MESSAGE_PAGE' || t === 'SEND_MESSAGE') {
          newSpec.video_data.call_to_action.value = { app_destination: 'MESSENGER' };
        } else {
          newSpec.video_data.call_to_action.value = { link: String(overrides.link) };
        }
      }
    } else if (newSpec.link_data) {
      if (overrides.message != null) newSpec.link_data.message = String(overrides.message);
      if (overrides.title != null) newSpec.link_data.name = String(overrides.title);
      if (overrides.link != null) newSpec.link_data.link = String(overrides.link);
      if (!newSpec.link_data.call_to_action) newSpec.link_data.call_to_action = { type: 'LEARN_MORE' };
      if (overrides.ctaType) newSpec.link_data.call_to_action.type = overrides.ctaType;
    } else {
      throw new Error(`Creative ${baseCreativeId} não tem video_data nem link_data`);
    }

    const newCreativeResp = await request('POST', `/${accountId}/adcreatives`, {
      name: (current.name || 'Creative') + ' — novo',
      object_story_spec: newSpec,
    }, { token });
    if (!newCreativeResp?.id) throw new Error('Meta não retornou ID do creative novo');
    creativeIdToUse = newCreativeResp.id;
    reusedCreative = false;
  }

  /* Cria ad novo no adset existente — sempre PAUSED */
  const newAdResp = await request('POST', `/${accountId}/ads`, {
    name: newAdName,
    adset_id: platformAdSetId,
    creative: { creative_id: creativeIdToUse },
    status: 'PAUSED',
  }, { token });
  if (!newAdResp?.id) throw new Error('Meta não retornou ID do ad novo');

  return {
    new_ad_id: newAdResp.id,
    new_ad_name: newAdName,
    creative_id: creativeIdToUse,
    reused_creative: reusedCreative,
  };
}

/* Atualiza status (ACTIVE/PAUSED) de um AdSet ISOLADO no Meta.
   Usado pra ligar/desligar conjuntos individualmente sem mexer
   na campanha-mãe nem nos outros conjuntos. */
async function updateAdSetStatus(creds, platformAdSetId, status) {
  const token = getToken(creds);
  if (!platformAdSetId) throw new Error('updateAdSetStatus: platformAdSetId obrigatório');
  const metaStatus = String(status).toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'PAUSED';
  return request('POST', `/${platformAdSetId}`, { status: metaStatus }, { token });
}

/* Atualiza status (ACTIVE/PAUSED) de um Ad ISOLADO no Meta.
   Importante: ativar ad enquanto campaign ou adset estão PAUSED não
   faz o ad entregar (effective_status fica CAMPAIGN_PAUSED ou ADSET_PAUSED).
   Caller deve avisar usuário se ancestrais estão pausados. */
async function updateAdStatus(creds, platformAdId, status) {
  const token = getToken(creds);
  if (!platformAdId) throw new Error('updateAdStatus: platformAdId obrigatório');
  const metaStatus = String(status).toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'PAUSED';
  return request('POST', `/${platformAdId}`, { status: metaStatus }, { token });
}

/* Liga/desliga Advantage+ Público num AdSet.
   Lê targeting atual no Meta (não confia em payload local) + merge +
   POST atualizando targeting INTEIRO (Meta v20 substitui o objeto).

   IMPORTANTE: ligar Advantage+ permite Meta expandir o público além
   do targeting manual. PODE entregar fora dos bairros configurados —
   conflita com regra Joinville. UI deve avisar antes do toggle.

   Mudança em targeting RESETA o aprendizado do adset. */
async function setAdvantageAudience(creds, platformAdSetId, enabled) {
  const token = getToken(creds);
  if (!platformAdSetId) throw new Error('setAdvantageAudience: platformAdSetId obrigatório');

  const { metaGet } = require('./metaHttp');
  const current = await metaGet(`/${platformAdSetId}`, { fields: 'targeting' }, { token });
  const targeting = current?.targeting ? JSON.parse(JSON.stringify(current.targeting)) : {};
  targeting.targeting_automation = {
    ...(targeting.targeting_automation || {}),
    advantage_audience: enabled ? 1 : 0,
  };
  /* Se ligando Advantage+, também relaxa custom_audience e lookalike pra
     Meta poder expandir. Se desligando, força os 2 pra 0 (regra Joinville). */
  if (enabled) {
    targeting.targeting_relaxation_types = {
      ...(targeting.targeting_relaxation_types || {}),
    };
  } else {
    targeting.targeting_relaxation_types = { lookalike: 0, custom_audience: 0 };
  }

  return request('POST', `/${platformAdSetId}`, { targeting }, { token });
}

/* Cria um teste A/B (split test) em campanha existente via /ad_studies.
   Meta divide o público entre as cells SEM SOBREPOSIÇÃO — cada usuário
   só é exposto a UMA cell.

   params: {
     accountId,
     name,                  // "Teste A/B — Cravos — Criativo"
     description,           // texto opcional
     startTime,             // ISO string ou epoch ms (Meta aceita ambos como timestamp)
     endTime,               // idem
     cells: [               // mínimo 2, soma de treatment_percentage = 100
       { name: 'Controle',  treatment_percentage: 50, adsets: ['<adset_id>'] },
       { name: 'Variante',  treatment_percentage: 50, adsets: ['<adset_id_2>'] },
     ],
     viewers: [user_id]?,    // opcional, default user atual
   }

   Pré-condições verificadas:
   - Campaign(s) das cells está(ão) ACTIVE
   - Mínimo 4 dias de duração (Meta exige)
   - cells.length >= 2 e soma de treatment_percentage = 100
   - cada cell tem pelo menos 1 adset_id

   Retorna { study_id, status, raw }. */
async function createABTest(creds, {
  accountId, name, description, startTime, endTime, cells, viewers,
}) {
  const token = getToken(creds);
  if (!accountId) throw new Error('createABTest: accountId obrigatório');
  if (!name) throw new Error('createABTest: name obrigatório');
  if (!Array.isArray(cells) || cells.length < 2) {
    throw new Error('createABTest: precisa de pelo menos 2 cells');
  }
  const sumPct = cells.reduce((s, c) => s + Number(c.treatment_percentage || 0), 0);
  if (Math.abs(sumPct - 100) > 0.01) {
    throw new Error(`createABTest: soma de treatment_percentage deve ser 100 (atual: ${sumPct})`);
  }
  for (const c of cells) {
    if (!Array.isArray(c.adsets) || c.adsets.length === 0) {
      throw new Error(`createABTest: cell "${c.name}" sem adsets`);
    }
  }

  /* Convert ISO/Date pra epoch seconds (Meta aceita timestamp Unix em segundos
     mais consistentemente que ISO em ad_studies). */
  function toEpochSec(t) {
    if (typeof t === 'number') return t > 1e12 ? Math.floor(t / 1000) : Math.floor(t);
    return Math.floor(new Date(t).getTime() / 1000);
  }
  const start = toEpochSec(startTime);
  const end = toEpochSec(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error('createABTest: startTime/endTime inválidos');
  }
  const durationDays = (end - start) / 86400;
  if (durationDays < 4) {
    throw new Error(`createABTest: duração mínima Meta é 4 dias (você passou ${durationDays.toFixed(1)})`);
  }
  if (durationDays > 30) {
    throw new Error(`createABTest: duração máxima recomendada é 30 dias (você passou ${durationDays.toFixed(1)})`);
  }

  const acct = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const payload = {
    name,
    description: description || `Teste A/B criado em ${new Date().toISOString().slice(0, 10)}`,
    start_time: start,
    end_time: end,
    type: 'SPLIT_TEST',
    cells: JSON.stringify(cells.map(c => ({
      name: c.name,
      treatment_percentage: c.treatment_percentage,
      adsets: c.adsets,
    }))),
  };
  if (Array.isArray(viewers) && viewers.length > 0) payload.viewers = JSON.stringify(viewers);

  const resp = await request('POST', `/${acct}/ad_studies`, payload, { token });
  if (!resp?.id) throw new Error('Meta não retornou ID do estudo A/B');
  return {
    study_id: resp.id,
    status: 'CREATED',
    raw: resp,
  };
}

/* Lê dados/resultado de um A/B test. Status, células, métricas comparativas. */
async function getABTestResults(creds, studyId) {
  const token = getToken(creds);
  if (!studyId) throw new Error('getABTestResults: studyId obrigatório');
  const { metaGet } = require('./metaHttp');
  const study = await metaGet(`/${studyId}`, {
    fields: 'id,name,description,status,start_time,end_time,type,cells,results,objectives,confidence_lift_window_days,p_value,observation_end_time'
  }, { token });
  return study;
}

/* Lista A/B tests de uma conta de anúncios. Filtra por campaign_id se informado. */
async function listABTests(creds, accountId, { campaignId } = {}) {
  const token = getToken(creds);
  if (!accountId) throw new Error('listABTests: accountId obrigatório');
  const acct = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const { metaGet } = require('./metaHttp');
  const params = {
    fields: 'id,name,status,start_time,end_time,type,cells,results',
    limit: 50,
  };
  const resp = await metaGet(`/${acct}/ad_studies`, params, { token });
  let data = resp?.data || [];
  if (campaignId) {
    /* Meta API não tem filtro server-side por campaign — filtramos client-side
       checando os adsets das cells. Performance: studies por conta normalmente
       são poucos (<50), filtro local OK. */
    data = data.filter(s => {
      const cells = Array.isArray(s.cells) ? s.cells : (s.cells?.data || []);
      return cells.some(c => Array.isArray(c.adsets) && c.adsets.length > 0);
    });
  }
  return data;
}

/* Encerra A/B test antes do tempo. Meta aceita PATCH no end_time pra
   "agora" — não há DELETE oficial pra estudos em andamento. */
async function stopABTest(creds, studyId) {
  const token = getToken(creds);
  if (!studyId) throw new Error('stopABTest: studyId obrigatório');
  const nowSec = Math.floor(Date.now() / 1000);
  return request('POST', `/${studyId}`, { end_time: nowSec }, { token });
}

module.exports = {
  updateCampaignStatus, updateCampaignMeta, updateAdSetMeta,
  updateAdSetStatus, updateAdStatus, setAdvantageAudience,
  deleteCampaign, replaceCreative, duplicateAdInAdSet, duplicateAdSet,
  createAdInExistingAdSet, publishCampaign,
  createABTest, getABTestResults, listABTests, stopABTest,
  request, getToken,
};
