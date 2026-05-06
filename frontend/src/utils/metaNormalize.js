/**
 * Normaliza dados do wizard local pro schema oficial da Meta Marketing API v20+.
 *
 * ringsMode: 'auto' | '1' | '2' | '3' (default 'auto').
 * Quando o resultado tem ≥2 anéis ativos, emite `ad_sets: [...]` (array) em vez
 * de `ad_set: {...}` único. O backend publishCampaign detecta e cria N AdSets
 * sob a mesma Campaign, cada um com seu budget e targeting geográfico,
 * compartilhando 1 único Creative.
 *
 * Constantes / mapas / heurísticas vivem em `config/metaRules.js` — esse
 * arquivo só faz a montagem do payload Meta a partir delas.
 */

import { HOME_COORDS } from '../data/joinvilleDistricts';
import {
  classifyRings,
  toMetaBudgetCents,
  GENDER_TO_META,
  OBJECTIVE_TO_META,
  OPTIMIZATION_GOAL,
  BILLING_EVENT,
  CTA_TO_META,
  CTA_TO_DESTINATION,
  MESSAGING_CTAS,
  GEO_MIN_RADIUS_KM,
  GEO_FALLBACK_RADIUS_KM,
  BR_OFFSET,
} from '../config/metaRules';

/* Re-exporta os mapas pra manter compat retroativa caso outro módulo importe
   diretamente de metaNormalize. Source of truth segue sendo config/metaRules. */
export {
  GENDER_TO_META,
  OBJECTIVE_TO_META,
  OPTIMIZATION_GOAL,
  BILLING_EVENT,
  CTA_TO_META,
  CTA_TO_DESTINATION,
  toMetaBudgetCents,
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
/* Normaliza localizações pro Meta:
   1) dedup por nome+coord (bairros idênticos viram 1)
   2) força raio mínimo GEO_MIN_RADIUS_KM (Meta nega audiência abaixo)

   NÃO descarta mais por sobreposição. Versões antigas da Marketing API
   (v17/v18) rejeitavam custom_locations sobrepostas com erro 1487756 —
   v20+ aceita sem problema (Meta deduplica usuários internamente, ninguém
   é contado 2x). Em Joinville bairros ficam ~1-3km uns dos outros: o filtro
   antigo combinado com o piso de 3km descartava silenciosamente metade dos
   bairros configurados pelo usuário. Removido em 2026-04-28. */
function dedupeOverlappingGeos(locations) {
  const valid = (locations || []).filter(l => l?.lat != null && l?.lng != null && l?.radius > 0);
  if (valid.length === 0) return valid;
  const seen = new Set();
  const kept = [];
  for (const loc of valid) {
    const nameKey = String(loc.name || '').trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
    const coordKey = `${Number(loc.lat).toFixed(4)},${Number(loc.lng).toFixed(4)}`;
    const key = nameKey ? `n:${nameKey}` : `c:${coordKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const radius = Math.max(Number(loc.radius), GEO_MIN_RADIUS_KM);
    kept.push({ ...loc, radius: Number(radius.toFixed(2)) });
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

  /* ─── Fallback "link wa.me/" automático ─────────────────────────────
     Quando o objetivo é "messages" E o destURL é wa.me/, NÃO usa
     Click-to-WhatsApp formal (que exige WhatsApp linkado oficialmente
     na Page e dá erro 100/2446885 quando ausente). Em vez disso, cria
     campanha de TRÁFEGO apontando direto pro link wa.me/. Funciona em
     qualquer Page/conta — mesmo método de outras agências.
     Pessoa clica no anúncio → app abre conversa no WhatsApp da Cris. */
  /* Detecta WhatsApp via QUALQUER variante de URL — sem isso, se Cris
     colar URL de wa.me OU api.whatsapp.com OU whatsapp.com/, sistema cai
     no fluxo CTWA formal (destination_type WHATSAPP) e Meta rejeita com
     erro 100/2446885 quando Page não tem WhatsApp Business linkado. */
  const usingWaLink = ad.objective === 'messages'
    && typeof ad.destUrl === 'string'
    && /(wa\.me\/|api\.whatsapp\.com|whatsapp\.com\/)/i.test(ad.destUrl);

  /* CBO = budget no nível da Campaign, Meta redistribui entre ad_sets.
     ABO (padrão) = budget no nível do ad_set, controle manual. */
  const useCBO = ad.budgetOptimization === 'campaign';
  const campaign = {
    id:                     ad.metaCampaignId,
    name:                   ad.name,
    /* Fallback wa.me/ força OUTCOME_TRAFFIC mesmo se objective for "messages" */
    objective:              usingWaLink
                              ? 'OUTCOME_TRAFFIC'
                              : (OBJECTIVE_TO_META[ad.objective] || 'OUTCOME_TRAFFIC'),
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
  const isMessagingCTA = MESSAGING_CTAS.includes(rawCtaMeta);
  const isMessagesObjective = ad.objective === 'messages';
  /* Fallback wa.me/: aceita CTAs universais que aceitam link externo arbitrário.
     BOOK_NOW adicionado em 2026-05-06 pra Nano v2 (rótulo "Agendar" em PT-BR
     pra serviços de beleza). Risco: Meta historicamente associa BOOK_NOW a
     plataformas de booking (Booking/OpenTable) — se rejeitar com link wa.me,
     remover daqui e voltar pra BOOK_TRAVEL ("Reservar"). Outros CTAs fora da
     lista viram LEARN_MORE como default seguro. */
  const WAME_SAFE_CTAS = ['LEARN_MORE', 'CONTACT_US', 'BOOK_TRAVEL', 'BOOK_NOW'];
  const finalCtaType = usingWaLink
    ? (WAME_SAFE_CTAS.includes(rawCtaMeta) ? rawCtaMeta : 'LEARN_MORE')
    : ((isMessagesObjective && !isMessagingCTA) ? 'SEND_MESSAGE' : rawCtaMeta);

  /* Trunca strings nos limites Meta v22+ pra evitar rejeição em IG Reels/
     Stories (que cortam silenciosamente acima do limite). Se Meta corta,
     anúncio é exibido com texto incompleto OU rejeitado por low quality.
     Limites oficiais: link_data.message 125, link_data.name 40, video_data.title 40. */
  const truncate = (s, max) => (typeof s === 'string' && s.length > max) ? s.slice(0, max).trimEnd() : (s || '');
  const safeMessage  = truncate(ad.primaryText, 125);
  const safeHeadline = truncate(ad.headline, 40);

  const storySpec = videoIdFromUpload
    ? {
        page_id: ad.metaPageId || ad.metaAccountId || null,
        video_data: {
          video_id:       videoIdFromUpload,
          image_hash:     videoCoverHash,  /* CAPA obrigatória pro Meta aceitar */
          message:        safeMessage,
          title:          safeHeadline,
          call_to_action: {
            type:  finalCtaType,
            value: safeLink ? { link: safeLink } : undefined,
          },
        },
      }
    : {
        page_id: ad.metaPageId || ad.metaAccountId || null,
        link_data: {
          message:          safeMessage,
          name:             safeHeadline,
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
     INSTAGRAM_DIRECT restringe a IG; WHATSAPP e PHONE_CALL rodam em FB+IG.
     Fallback wa.me/: NÃO envia destination_type (campanha de tráfego comum). */
  const isMessages = ad.objective === 'messages';
  const ctaMeta = CTA_TO_META[ad.ctaButton] || 'LEARN_MORE';
  const destinationType = (isMessages && !usingWaLink)
    ? (CTA_TO_DESTINATION[ctaMeta] || 'INSTAGRAM_DIRECT')
    : undefined;
  const onlyInstagram = destinationType === 'INSTAGRAM_DIRECT';

  /* Meta v20 tornou obrigatório declarar se usa Advantage+ Audience.
     0 = respeita targeting manual (Cris quer só Joinville, não expandir).
     1 = IA expande público além do configurado — contraria regra Joinville.
     Sem esse campo, Graph retorna erro 100/1870227.
     Default 0 (off). Usuário pode forçar 1 via ad.advantageAudience=true,
     mas Meta v23+ pode ignorar e forçar 1 mesmo com 0 dependendo do
     objetivo — verificar pós-publish via /audit. */
  const targetingAutomation = { advantage_audience: ad.advantageAudience ? 1 : 0 };

  /* Bloqueia TODOS os outros "relaxamentos" automáticos do Meta:
     - lookalike: 0 → não pega pessoas parecidas com quem já clicou
     - custom_audience: 0 → não expande de públicos salvos
     Mantém segmentação 100% manual, essencial pra negócio hiperlocal
     (1 cidade, bairros específicos — qualquer expansão desperdiça
     orçamento em gente fora de Joinville). */
  const targetingRelaxation = { lookalike: 0, custom_audience: 0 };

  const baseTargeting = onlyInstagram
    ? {
        /* Clamp 18-65: 18 é mínimo legal pra estética em BR (CONAR/Anvisa),
           65 é máximo aceito pelo Meta (65+ vira 65). */
        age_min:                   Math.max(18, Math.min(65, Number(ad.ageRange?.[0]) || 18)),
        age_max:                   Math.max(18, Math.min(65, Number(ad.ageRange?.[1]) || 65)),
        genders,
        interests:                 (ad.interests || []).map(toInterestObject),
        publisher_platforms:       ['instagram'],
        instagram_positions:       ['stream', 'story', 'reels'],
        targeting_automation:      targetingAutomation,
        targeting_relaxation_types: targetingRelaxation,
      }
    : {
        /* Clamp 18-65: 18 é mínimo legal pra estética em BR (CONAR/Anvisa),
           65 é máximo aceito pelo Meta (65+ vira 65). */
        age_min:                   Math.max(18, Math.min(65, Number(ad.ageRange?.[0]) || 18)),
        age_max:                   Math.max(18, Math.min(65, Number(ad.ageRange?.[1]) || 65)),
        genders,
        interests:                 (ad.interests || []).map(toInterestObject),
        publisher_platforms:       ['facebook', 'instagram'],
        facebook_positions:        ['feed'],
        instagram_positions:       ['stream', 'story', 'reels'],
        targeting_automation:      targetingAutomation,
        targeting_relaxation_types: targetingRelaxation,
      };

  /* Horário comercial (adset_schedule) — Cris atende no WhatsApp/IG Direct
     em horário comercial. Sem isso, anúncios podem rodar 3h da manhã e
     mensagens entram fora de hora (cliente espera resposta imediata).
     Meta v20 exige: lifetime_budget (não funciona com daily) + lista de
     janelas {start_minute, end_minute, days[]} (minutos desde meia-noite,
     days = 0..6 onde 0=domingo, 1=segunda, ..., 6=sábado). */
  const bh = ad.businessHours;
  let adsetSchedule;
  if (bh?.enabled && Array.isArray(bh.days) && bh.days.length > 0) {
    const parseHM = (s, fallback) => {
      if (typeof s !== 'string' || !/^\d{1,2}:\d{2}$/.test(s)) return fallback;
      const [h, m] = s.split(':').map(Number);
      return h * 60 + m;
    };
    const startMin = parseHM(bh.startTime, 8 * 60);   /* default 08:00 */
    const endMin   = parseHM(bh.endTime,   22 * 60);  /* default 22:00 */
    if (endMin > startMin) {
      adsetSchedule = [{
        start_minute: startMin,
        end_minute:   endMin,
        days:         [...bh.days].sort((a, b) => a - b),
      }];
    }
  }

  /* Fuso BR_OFFSET (-03:00) vem do config — sem ele, new Date('2026-04-22T00:00:00')
     é interpretado no fuso do navegador; usuários em outros fusos viam campanha
     começando no dia errado. */
  const adSetCommon = {
    /* Fallback wa.me/: força LINK_CLICKS (Meta otimiza por clique no link).
       Sem isso, com objective forçado a OUTCOME_TRAFFIC mas optimization_goal
       herdado de "messages" (CONVERSATIONS), Meta rejeita inconsistência. */
    optimization_goal:  usingWaLink
                          ? 'LINK_CLICKS'
                          : (OPTIMIZATION_GOAL[ad.objective] || 'LINK_CLICKS'),
    billing_event:      usingWaLink
                          ? 'IMPRESSIONS'
                          : (BILLING_EVENT[ad.objective] || 'IMPRESSIONS'),
    bid_strategy:       'LOWEST_COST_WITHOUT_CAP',
    status:             'PAUSED',
    start_time:         ad.startDate ? new Date(`${ad.startDate}T00:00:00${BR_OFFSET}`).toISOString() : null,
    end_time:           ad.endDate   ? new Date(`${ad.endDate}T23:59:59${BR_OFFSET}`).toISOString()   : null,
    promoted_object:    ad.pixelId ? { pixel_id: ad.pixelId } : undefined,
    /* Meta v20: obrigatório p/ optimization_goal=CONVERSATIONS.
       Sem ele, Graph API retorna erro 100 / sub 2490408. */
    destination_type:   destinationType,
    /* adset_schedule só faz sentido com lifetime_budget (Meta v20). Quando
       budget é daily, o campo é ignorado; o validador do wizard impede
       essa combinação, então aqui é seguro injetar sempre que houver. */
    adset_schedule:     adsetSchedule,
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
            location_types: ['home'],
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
     de Joinville com raio GEO_FALLBACK_RADIUS_KM como fallback — respeita
     "só Joinville" sem violar cobrindo BR inteiro. */
  const fallbackJoinville = [{
    latitude:      HOME_COORDS.lat,
    longitude:     HOME_COORDS.lng,
    radius:        GEO_FALLBACK_RADIUS_KM,
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
          location_types: ['home'],
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
