/**
 * Normaliza dados do wizard local pro schema oficial da Meta Marketing API v20+.
 *
 * Enquanto o sync real com Meta ainda não está ativo, o painel já guarda
 * o payload formatado corretamente (gender int, budget em centavos, objective
 * enum, CTA enum, geo_locations, interests como {id, name}, IDs fake).
 * Quando a integração for plugada, o `meta` sub-object vai direto pra API.
 */

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
export function toMetaPayload(ad) {
  const geoLocations = (ad.locations || []).map(l => ({
    latitude:      l.lat,
    longitude:     l.lng,
    radius:        l.radius,
    distance_unit: 'kilometer',
    name:          l.name,
  }));

  const genders = GENDER_TO_META[ad.gender] ?? [];
  const budgetCents = toMetaBudgetCents(ad.budgetValue);

  return {
    campaign: {
      id:                     ad.metaCampaignId,
      name:                   ad.name,
      objective:              OBJECTIVE_TO_META[ad.objective] || 'OUTCOME_TRAFFIC',
      status:                 'PAUSED',
      buying_type:            'AUCTION',
      special_ad_categories:  [],
      daily_budget:           ad.budgetType === 'daily' ? budgetCents : null,
      lifetime_budget:        ad.budgetType === 'total' ? budgetCents : null,
    },

    ad_set: {
      id:                 ad.metaAdSetId,
      name:               `${ad.name} — Público`,
      optimization_goal:  OPTIMIZATION_GOAL[ad.objective] || 'LINK_CLICKS',
      billing_event:      BILLING_EVENT[ad.objective]     || 'IMPRESSIONS',
      bid_strategy:       'LOWEST_COST_WITHOUT_CAP',
      status:             'PAUSED',
      start_time:         ad.startDate ? new Date(ad.startDate + 'T00:00:00').toISOString() : null,
      end_time:           ad.endDate   ? new Date(ad.endDate   + 'T23:59:59').toISOString() : null,
      targeting: {
        age_min:              ad.ageRange?.[0] || 18,
        age_max:              ad.ageRange?.[1] || 65,
        genders,
        geo_locations: {
          countries:         ['BR'],
          custom_locations:  geoLocations,
        },
        interests:            (ad.interests || []).map(toInterestObject),
        publisher_platforms:  ['facebook', 'instagram'],
        facebook_positions:   ['feed'],
        instagram_positions:  ['stream', 'story', 'reels'],
      },
      promoted_object: ad.pixelId ? {
        pixel_id: ad.pixelId,
      } : undefined,
    },

    ad: {
      id:        ad.metaAdId,
      name:      ad.name,
      status:    'PAUSED',
      creative:  { creative_id: ad.metaCreativeId },
    },

    creative: {
      id:   ad.metaCreativeId,
      name: `${ad.name} — Criativo`,
      object_story_spec: {
        page_id: ad.metaAccountId || null,
        link_data: {
          message:          ad.primaryText,
          name:             ad.headline,
          link:             ad.destUrl,
          call_to_action:   { type: CTA_TO_META[ad.ctaButton] || 'LEARN_MORE' },
          image_hash:       ad.imageHash || null,
          attachment_style: 'link',
        },
      },
    },
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
