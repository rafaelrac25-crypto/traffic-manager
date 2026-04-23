/**
 * Normaliza dados do wizard local pro schema oficial da Meta Marketing API v20+.
 *
 * ringsMode: 'auto' | '1' | '2' | '3' (default 'auto').
 * Quando o resultado tem ≥2 anéis ativos, emite `ad_sets: [...]` (array) em vez
 * de `ad_set: {...}` único. O backend publishCampaign detecta e cria N AdSets
 * sob a mesma Campaign, cada um com seu budget e targeting geográfico,
 * compartilhando 1 único Creative.
 */

import { HOME_COORDS, distanceKm } from '../data/joinvilleDistricts';

/* Remove bairros duplicados por nome (mantém a 1ª ocorrência após sort por
   distância → mantém o mais próximo do centro). Evita que o mesmo bairro
   apareça em 2 anéis diferentes quando Rafa marca múltiplos pontos nele. */
function dedupeLocationsByName(locations) {
  const seen = new Set();
  const out = [];
  for (const loc of locations || []) {
    const key = String(loc?.name || '').trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!key) { out.push(loc); continue; }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(loc);
  }
  return out;
}

/* Classifica bairros em anéis. ringsMode: 'auto' | '1' | '2' | '3'.
   Mantém compat com a flag booleana legada `ringsEnabled`.
   Dedupe por nome antes de distribuir — regra: bairro único por anel. */
function classifyRings(locations, ringsMode = 'auto') {
  const buckets = { primario: [], medio: [], externo: [] };
  const deduped = dedupeLocationsByName(locations || []);
  const valid = deduped
    .filter(l => l?.lat != null && l?.lng != null)
    .map(l => ({ loc: l, d: distanceKm(HOME_COORDS, { lat: l.lat, lng: l.lng }) }))
    .sort((a, b) => a.d - b.d);
  if (valid.length === 0) return buckets;

  let numRings;
  if (ringsMode === '1' || ringsMode === false) numRings = 1;
  else if (ringsMode === '2') numRings = Math.min(2, valid.length);
  else if (ringsMode === '3') numRings = Math.min(3, valid.length);
  else {
    /* 'auto': decide pelo spread e quantidade. Heurística conservadora
       alinhada com a UI (CreateAd.jsx). Favorece 1 anel nos casos comuns. */
    const spread = valid[valid.length - 1].d - valid[0].d;
    if (valid.length <= 2 || spread <= 3) numRings = 1;
    else if (valid.length >= 8 && spread >= 6) numRings = 3;
    else numRings = 2;
  }

  if (numRings === 1) {
    valid.forEach(({ loc }) => buckets.primario.push(loc));
    return buckets;
  }
  const perGroup = Math.ceil(valid.length / numRings);
  const keys = ['primario', 'medio', 'externo'];
  valid.forEach(({ loc }, idx) => {
    const ringIdx = Math.min(Math.floor(idx / perGroup), numRings - 1);
    buckets[keys[ringIdx]].push(loc);
  });
  return buckets;
}

// Meta targeting.genders: omitido = todos, [1] = feminino, [2] = masculino
export const GENDER_TO_META = {
  all:    [],
  female: [1],
  male:   [2],
};

// Converte valor em reais (float) pra centavos (int) — Meta exige inteiro
export function toMetaBudgetCents(reais) {
  const n = Number(reais);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

// Local objective → Meta Campaign objective (v20 ODAX)
export const OBJECTIVE_TO_META = {
  brand_awareness: 'OUTCOME_AWARENESS',
  reach:           'OUTCOME_AWARENESS',
  traffic:         'OUTCOME_TRAFFIC',
  engagement:      'OUTCOME_ENGAGEMENT',
  leads:           'OUTCOME_LEADS',
  messages:        'OUTCOME_ENGAGEMENT',
  app_installs:    'OUTCOME_APP_PROMOTION',
  sales:           'OUTCOME_SALES',
  store_traffic:   'OUTCOME_AWARENESS',
};

// Local objective → optimization_goal (ad_set level)
export const OPTIMIZATION_GOAL = {
  brand_awareness: 'AD_RECALL_LIFT',
  reach:           'REACH',
  traffic:         'LINK_CLICKS',
  engagement:      'POST_ENGAGEMENT',
  leads:           'LEAD_GENERATION',
  messages:        'CONVERSATIONS',
  app_installs:    'APP_INSTALLS',
  sales:           'OFFSITE_CONVERSIONS',
  store_traffic:   'STORE_VISITS',
};

// Local objective → billing_event
export const BILLING_EVENT = {
  brand_awareness: 'IMPRESSIONS',
  reach:           'IMPRESSIONS',
  traffic:         'LINK_CLICKS',
  engagement:      'IMPRESSIONS',
  leads:           'IMPRESSIONS',
  messages:        'IMPRESSIONS',
  app_installs:    'IMPRESSIONS',
  sales:           'IMPRESSIONS',
  store_traffic:   'IMPRESSIONS',
};

// Label de CTA (PT-BR) → Meta enum
export const CTA_TO_META = {
  'Saiba mais':         'LEARN_MORE',
  'Reservar agora':     'BOOK_TRAVEL',
  'Entrar em contato':  'CONTACT_US',
  'WhatsApp':           'WHATSAPP_MESSAGE',
  'Enviar mensagem':    'MESSAGE_PAGE',
  'Mande uma mensagem': 'MESSAGE_PAGE',
  'Chamar agora':       'CALL_NOW',
  'Inscrever-se':       'SUBSCRIBE',
  'Comprar agora':      'SHOP_NOW',
  'Ver cardápio':       'VIEW_MENU',
  'Ver mais':           'LEARN_MORE',
};

/* Meta v20 pro objetivo Mensagens: cada CTA exige destination_type específico.
   Sem o mapeamento correto, Graph API recusa o adset com erro 100/2490408. */
export const CTA_TO_DESTINATION = {
  'WHATSAPP_MESSAGE': 'WHATSAPP',          /* wa.me/... via WhatsApp Business */
  'MESSAGE_PAGE':     'INSTAGRAM_DIRECT',  /* DM do Instagram */
  'CALL_NOW':         'PHONE_CALL',        /* Ligação direta */
};

// Gera IDs fake no formato do Meta pra o painel já trabalhar com a estrutura real.
// Quando a API real estiver plugada, o ID real substitui o fake no primeiro sync.
export function fakeMetaId(prefix) {
  const rand = Math.floor(Math.random() * 1e9).toString(36);
  return `${prefix}_${Date.now()}${rand}`;
}

// Converte a string livre de interesse → { id, name } como o Meta retorna.
// O id aqui é fake determinístico; no sync real ele vai ser substituído pelo
// id oficial do Meta Interest Library (ex: {id: '6003107', name: 'Beauty'}).
function toInterestObject(name) {
  const slug = String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return { id: `interest_${slug}`, name };
}

/**
 * Converte o estado local do wizard no payload Meta completo (4 níveis).
 * Estrutura final: campaign → ad_set → ad → creative (exatamente como a API espera).
 */
/* Remove sobreposição de localizações (Meta v20 rejeita com erro 1487756).
   Algoritmo: ordena do mais próximo do HOME pro mais distante; pra cada
   ponto, se ele já está DENTRO da área de outro anterior, descarta.
   Senão, reduz o raio pra não encostar no anterior (buffer 0.3km).
   Se raio ficar < 1km, descarta (área muito pequena pro Meta rodar). */
function dedupeOverlappingGeos(locations) {
  const valid = (locations || []).filter(l => l?.lat != null && l?.lng != null && l?.radius > 0);
  if (valid.length <= 1) return valid;
  /* Haversine inline */
  const distKm = (a, b) => {
    const R = 6371, toRad = x => (x * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const la1 = toRad(a.lat), la2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  /* Ordena do mais denso pro menos (menor raio primeiro, depois mais próximo do 1º) */
  const sorted = [...valid].sort((a, b) => a.radius - b.radius);
  const kept = [];
  for (const loc of sorted) {
    let skip = false;
    let newRadius = loc.radius;
    for (const other of kept) {
      const d = distKm(loc, other);
      /* Se center do loc está dentro do círculo de other → redundante */
      if (d <= other.radius) { skip = true; break; }
      /* Se círculos se sobrepõem → reduz raio pra ficar tangente (buffer 0.3km) */
      const maxAllowed = d - other.radius - 0.3;
      if (maxAllowed < newRadius) {
        newRadius = maxAllowed;
      }
    }
    if (skip) continue;
    /* Meta rejeita raios muito pequenos (audiência insuficiente pra rodar).
       Piso: 3km garante público mínimo viável mesmo em bairro pequeno. */
    if (newRadius < 3) newRadius = 3;
    kept.push({ ...loc, radius: Number(newRadius.toFixed(2)) });
  }
  return kept;
}

export function toMetaPayload(ad) {
  const toGeo = (l) => ({
    latitude: l.lat, longitude: l.lng, radius: l.radius,
    distance_unit: 'kilometer', name: l.name,
  });
  /* Deduplica sobreposição ANTES de mapear pro schema Meta */
  const cleanLocations = dedupeOverlappingGeos(ad.locations || []);
  const allGeo = cleanLocations.map(toGeo);

  const genders = GENDER_TO_META[ad.gender] ?? [];
  const budgetCents = toMetaBudgetCents(ad.budgetValue);

  /* CBO = budget no nível da Campaign, Meta redistribui entre ad_sets.
     ABO (padrão) = budget no nível do ad_set, controle manual. */
  const useCBO = ad.budgetOptimization === 'campaign';
  const campaign = {
    id:                     ad.metaCampaignId,
    name:                   ad.name,
    objective:              OBJECTIVE_TO_META[ad.objective] || 'OUTCOME_TRAFFIC',
    status:                 'PAUSED',
    buying_type:            'AUCTION',
    special_ad_categories:  [],
    daily_budget:           useCBO && ad.budgetType === 'daily' ? budgetCents : null,
    lifetime_budget:        useCBO && ad.budgetType === 'total' ? budgetCents : null,
  };

  /* Extrai IDs reais do Meta já uploaded (via /api/upload/media).
     Se há vídeo, cria object_story_spec.video_data; caso contrário, link_data.
     IMPORTANTE: video_data.image_hash é o hash da CAPA (vem do mesmo item
     que tem metaVideoId — atribuído por uploadAllMedia).
     Detector de fake IDs: hash real do Meta tem 32+ chars hex; IDs gerados
     por newMetaIds() têm formato timestamp+random. */
  const isRealMetaHash = (h) => typeof h === 'string' && /^[a-f0-9]{20,}$/i.test(h) && !h.startsWith('17');
  const isRealMetaVideoId = (id) => typeof id === 'string' && /^\d{10,20}$/.test(id);

  const uploadedMedia = ad.mediaFilesData || [];
  const firstVideo = uploadedMedia.find(m => m.type === 'video' && isRealMetaVideoId(m.metaVideoId));
  const firstImage = uploadedMedia.find(m => m.type === 'image' && isRealMetaHash(m.metaHash));
  const imageHashFromUpload = firstImage?.metaHash || (isRealMetaHash(ad.imageHash) ? ad.imageHash : null);
  const videoIdFromUpload = firstVideo?.metaVideoId || null;
  const videoCoverHash = isRealMetaHash(firstVideo?.metaHash) ? firstVideo.metaHash : null;

  /* link_data.link é obrigatório no Meta v20. Se destUrl vier vazio (caso
     comum pros CTAs de mensagem), manda null — backend injeta fallback
     seguro usando a URL da própria Facebook Page em publishCampaign. */
  const safeLink = (ad.destUrl && String(ad.destUrl).startsWith('http')) ? ad.destUrl : null;

  /* CTA compatível com o objetivo — Meta v20 rejeita (erro 1487891) creative
     cujo CTA não combina com o objective da campaign.
     Pra objetivo Mensagens, força um CTA da família messaging se user
     escolheu algo incompatível (ex: "Saiba mais" → LEARN_MORE).
     Default consistente com destination_type escolhido mais acima. */
  const rawCtaMeta = CTA_TO_META[ad.ctaButton] || 'LEARN_MORE';
  const isMessagingCTA = ['WHATSAPP_MESSAGE', 'MESSAGE_PAGE', 'CALL_NOW', 'SEND_MESSAGE'].includes(rawCtaMeta);
  const isMessagesObjective = ad.objective === 'messages';
  const finalCtaType = (isMessagesObjective && !isMessagingCTA) ? 'MESSAGE_PAGE' : rawCtaMeta;

  const storySpec = videoIdFromUpload
    ? {
        page_id: ad.metaAccountId || null,
        video_data: {
          video_id:       videoIdFromUpload,
          image_hash:     videoCoverHash,  /* CAPA obrigatória pro Meta aceitar */
          message:        ad.primaryText || '',
          title:          ad.headline || '',
          call_to_action: {
            type:  finalCtaType,
            value: safeLink ? { link: safeLink } : undefined,
          },
        },
      }
    : {
        page_id: ad.metaAccountId || null,
        link_data: {
          message:          ad.primaryText,
          name:             ad.headline,
          link:             safeLink,
          call_to_action:   { type: finalCtaType },
          image_hash:       imageHashFromUpload,
          attachment_style: 'link',
        },
      };

  const creative = {
    id:   ad.metaCreativeId,
    name: `${ad.name} — Criativo`,
    object_story_spec: storySpec,
  };

  /* Mensagens: destination_type depende do CTA escolhido.
     INSTAGRAM_DIRECT restringe a IG; WHATSAPP e PHONE_CALL rodam em FB+IG. */
  const isMessages = ad.objective === 'messages';
  const ctaMeta = CTA_TO_META[ad.ctaButton] || 'LEARN_MORE';
  const destinationType = isMessages
    ? (CTA_TO_DESTINATION[ctaMeta] || 'INSTAGRAM_DIRECT')
    : undefined;
  const onlyInstagram = destinationType === 'INSTAGRAM_DIRECT';

  /* Meta v20 tornou obrigatório declarar se usa Advantage+ Audience.
     0 = respeita targeting manual (Cris quer só Joinville, não expandir).
     1 = IA expande público além do configurado — contraria regra Joinville.
     Sem esse campo, Graph retorna erro 100/1870227. */
  const targetingAutomation = { advantage_audience: 0 };

  /* Bloqueia TODOS os outros "relaxamentos" automáticos do Meta:
     - lookalike: 0 → não pega pessoas parecidas com quem já clicou
     - custom_audience: 0 → não expande de públicos salvos
     Mantém segmentação 100% manual, essencial pra negócio hiperlocal
     (1 cidade, bairros específicos — qualquer expansão desperdiça
     orçamento em gente fora de Joinville). */
  const targetingRelaxation = { lookalike: 0, custom_audience: 0 };

  const baseTargeting = onlyInstagram
    ? {
        age_min:                   ad.ageRange?.[0] || 18,
        age_max:                   ad.ageRange?.[1] || 65,
        genders,
        interests:                 (ad.interests || []).map(toInterestObject),
        publisher_platforms:       ['instagram'],
        instagram_positions:       ['stream', 'story', 'reels'],
        targeting_automation:      targetingAutomation,
        targeting_relaxation_types: targetingRelaxation,
      }
    : {
        age_min:                   ad.ageRange?.[0] || 18,
        age_max:                   ad.ageRange?.[1] || 65,
        genders,
        interests:                 (ad.interests || []).map(toInterestObject),
        publisher_platforms:       ['facebook', 'instagram'],
        facebook_positions:        ['feed'],
        instagram_positions:       ['stream', 'story', 'reels'],
        targeting_automation:      targetingAutomation,
        targeting_relaxation_types: targetingRelaxation,
      };

  /* Fuso fixo -03:00 (BR) — sem isso, new Date('2026-04-22T00:00:00') é
     interpretado no fuso do navegador; usuários em outros fusos viam
     campanha começando no dia errado. */
  const BR_OFFSET = '-03:00';
  const adSetCommon = {
    optimization_goal:  OPTIMIZATION_GOAL[ad.objective] || 'LINK_CLICKS',
    billing_event:      BILLING_EVENT[ad.objective]     || 'IMPRESSIONS',
    bid_strategy:       'LOWEST_COST_WITHOUT_CAP',
    status:             'PAUSED',
    start_time:         ad.startDate ? new Date(`${ad.startDate}T00:00:00${BR_OFFSET}`).toISOString() : null,
    end_time:           ad.endDate   ? new Date(`${ad.endDate}T23:59:59${BR_OFFSET}`).toISOString()   : null,
    promoted_object:    ad.pixelId ? { pixel_id: ad.pixelId } : undefined,
    /* Meta v20: obrigatório p/ optimization_goal=CONVERSATIONS.
       Sem ele, Graph API retorna erro 100 / sub 2490408. */
    destination_type:   destinationType,
  };

  /* Aceita `ringsMode` (novo) ou `ringsEnabled` (legado) */
  const modeArg = ad.ringsMode !== undefined
    ? ad.ringsMode
    : (ad.ringsEnabled === false ? '1' : 'auto');
  const buckets = classifyRings(ad.locations, modeArg);
  /* Aplica dedupe ANTES de decidir quais anéis criar — se um anel ficou sem
     localizações após o dedupe (raios conflitando), ele não deve virar adset.
     Meta rejeita targeting.geo_locations.custom_locations=[] com erro 100. */
  const dedupedBuckets = {
    primario: dedupeOverlappingGeos(buckets.primario),
    medio:    dedupeOverlappingGeos(buckets.medio),
    externo:  dedupeOverlappingGeos(buckets.externo),
  };
  const activeKeys = ['primario', 'medio', 'externo'].filter(k => dedupedBuckets[k].length > 0);
  const splitInput = ad.budgetRingSplit || {};
  /* Normaliza split pra garantir soma 100% entre ativos; distribui igualmente se ausente */
  const totalPctRaw = activeKeys.reduce((s, k) => s + (Number(splitInput[k]) || 0), 0);
  const splitNorm = {};
  if (totalPctRaw === 0) {
    activeKeys.forEach((k, i) => {
      const even = Math.floor(100 / activeKeys.length);
      splitNorm[k] = i === activeKeys.length - 1 ? 100 - even * (activeKeys.length - 1) : even;
    });
  } else {
    activeKeys.forEach(k => { splitNorm[k] = Math.round((Number(splitInput[k]) || 0) * 100 / totalPctRaw); });
    /* ajusta pra fechar 100 exato */
    const diff = 100 - activeKeys.reduce((s, k) => s + splitNorm[k], 0);
    if (activeKeys.length > 0) splitNorm[activeKeys[activeKeys.length - 1]] += diff;
  }

  const RING_LABEL = { primario: 'Primário', medio: 'Médio', externo: 'Externo' };
  /* activeKeys já reflete ringsMode (classifyRings colapsa pra 1 quando mode='1' ou ringsEnabled=false) */
  const useMultiple = activeKeys.length >= 2;

  if (useMultiple) {
    /* Um ad_set por anel, cada um com fatia do budget + geo filtrado.
       Usa dedupedBuckets pra garantir que custom_locations nunca vai vazio
       (activeKeys já filtrou anéis zerados pelo dedupe). */
    const ad_sets = activeKeys.map(key => {
      const ringBudget = Math.round(budgetCents * (splitNorm[key] / 100));
      return {
        id:   null, /* será preenchido pelo Meta no create */
        name: `${ad.name} — Anel ${RING_LABEL[key]}`,
        ...adSetCommon,
        /* CBO: Meta aloca; ABO: cada anel tem fatia fixa */
        daily_budget:   useCBO ? null : (ad.budgetType === 'daily' ? ringBudget : null),
        lifetime_budget: useCBO ? null : (ad.budgetType === 'total' ? ringBudget : null),
        targeting: {
          ...baseTargeting,
          /* Meta v20 conflita quando countries + custom_locations no mesmo
             geo_locations. Quando tem custom_locations, envia só elas. */
          geo_locations: {
            custom_locations: dedupedBuckets[key].map(toGeo),
          },
        },
        _ring_key:     key,          /* metadata local pra debug */
        _ring_percent: splitNorm[key],
      };
    });
    return {
      campaign,
      ad_sets, /* array — publishCampaign itera */
      ad: { id: ad.metaAdId, name: ad.name, status: 'PAUSED', creative: { creative_id: ad.metaCreativeId } },
      creative,
      _rings_count: ad_sets.length,
    };
  }

  /* Caminho legado: 1 ad_set único com todos os bairros.
     Se allGeo ficou vazio (nenhum bairro passou no dedupe), usa HOME_COORDS
     de Joinville com raio 15km como fallback — respeita a regra de negócio
     "só Joinville" sem violar cobrindo BR inteiro. */
  const fallbackJoinville = [{
    latitude:      HOME_COORDS.lat,
    longitude:     HOME_COORDS.lng,
    radius:        15,
    distance_unit: 'kilometer',
    name:          'Joinville (fallback)',
  }];
  return {
    campaign: { ...campaign, daily_budget: ad.budgetType === 'daily' ? budgetCents : null, lifetime_budget: ad.budgetType === 'total' ? budgetCents : null },
    ad_set: {
      id:   ad.metaAdSetId,
      name: `${ad.name} — Público`,
      ...adSetCommon,
      targeting: {
        ...baseTargeting,
        geo_locations: {
          custom_locations: allGeo.length > 0 ? allGeo : fallbackJoinville,
        },
      },
    },
    ad: { id: ad.metaAdId, name: ad.name, status: 'PAUSED', creative: { creative_id: ad.metaCreativeId } },
    creative,
    _rings_count: 1,
  };
}

// Gera um conjunto de IDs Meta fake pra um novo anúncio.
// Meta real retorna estes IDs na criação; aqui geramos upfront pro mock.
export function newMetaIds() {
  return {
    metaCampaignId: fakeMetaId('camp'),
    metaAdSetId:    fakeMetaId('adset'),
    metaAdId:       fakeMetaId('ad'),
    metaCreativeId: fakeMetaId('creative'),
    imageHash:      fakeMetaId('imghash').replace('imghash_', ''),
  };
}
