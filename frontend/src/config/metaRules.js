/**
 * Source of truth pra regras Meta Ads (API Marketing v20+ ODAX) e regras de
 * negócio da Cris Costa Beauty.
 *
 * Importado tanto pelo wizard (CreateAd.jsx) quanto pelo normalizador de
 * payload (utils/metaNormalize.js). Mudou aqui → muda em todo lugar.
 * Não duplicar essas constantes/heurísticas em arquivos consumidores.
 */

import { HOME_COORDS, distanceKm } from '../data/joinvilleDistricts';

/* ── Limites Meta + folga aplicada pela Cris ──────────────────────────── */
export const MIN_DAILY_PER_RING_BRL = 7;       /* Meta exige ~R$6/adset; +15% folga */
export const MIN_LIFETIME_BRL = 35;            /* 5 dias × MIN_DAILY_PER_RING_BRL */
export const MIN_CAMPAIGN_DAYS = 5;
export const META_BUDGET_RESERVE_PCT = 20;     /* folga exibida no resumo (Step 4) */

/* ── Geofence (regra Joinville) ───────────────────────────────────────── */
export const JOINVILLE_MAX_RADIUS_KM = 60;     /* aceita região metropolitana */
export const GEO_MIN_RADIUS_KM = 3;            /* Meta nega audiência abaixo */
export const GEO_DEDUPE_BUFFER_KM = 0.3;       /* folga entre círculos vizinhos */
export const GEO_FALLBACK_RADIUS_KM = 15;      /* fallback Joinville se vazio */

/* ── Mídia ────────────────────────────────────────────────────────────── */
export const IMAGE_MIN_WIDTH = 500;
export const IMAGE_MIN_HEIGHT = 500;

/* ── Tempo (BR-fixed; evita drift por fuso do navegador) ──────────────── */
export const BR_OFFSET = '-03:00';

/* ── Listas / enums Meta v20 ──────────────────────────────────────────── */
export const REQUIRED_CAMPAIGN_FIELDS = [
  'name',
  'objective',
  'status',
  'buying_type',
  'special_ad_categories',
  'daily_budget',
];

export const META_STATUS = ['PAUSED', 'ACTIVE'];

export const SPECIAL_AD_CATEGORIES = ['NONE', 'HOUSING', 'EMPLOYMENT', 'CREDIT'];

/* ── Mapas: objetivo local → Meta v20 ODAX ────────────────────────────── */
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

/* ── CTA: rótulo PT-BR (display) ⇄ Meta enum ──────────────────────────── */
export const CTA_TO_META = {
  'Saiba mais':         'LEARN_MORE',
  'Entrar em contato':  'CONTACT_US',
  'Fale conosco':       'CONTACT_US',
  'Reservar':           'BOOK_TRAVEL',
  'Agendar':            'BOOK_NOW',
  'WhatsApp':           'WHATSAPP_MESSAGE',
  'Enviar mensagem':    'MESSAGE_PAGE',
  'Mande uma mensagem': 'MESSAGE_PAGE',
  'Chamar agora':       'CALL_NOW',
  'Inscrever-se':       'SUBSCRIBE',
  'Comprar agora':      'SHOP_NOW',
  'Ver mais':           'LEARN_MORE',
};

/* Cada CTA de mensagem exige destination_type específico — sem isso
   Graph API recusa o adset (erro 100/2490408). */
export const CTA_TO_DESTINATION = {
  'WHATSAPP_MESSAGE': 'WHATSAPP',
  'MESSAGE_PAGE':     'INSTAGRAM_DIRECT',
  'CALL_NOW':         'PHONE_CALL',
};

export const MESSAGING_CTAS = [
  'WHATSAPP_MESSAGE',
  'MESSAGE_PAGE',
  'CALL_NOW',
  'SEND_MESSAGE',
];

/* ── Gênero local ⇄ Meta targeting.genders ────────────────────────────── */
/* Meta Marketing API targeting.genders: 1 = men, 2 = women, [] = all
   Ref: https://developers.facebook.com/docs/marketing-api/audiences/reference/targeting-search/
   ATENÇÃO: estava invertido até 2026-04-28 — todas as campanhas com
   "feminino" no painel rodaram pra HOMENS. Bug crítico, perda de verba. */
export const GENDER_TO_META = {
  all:    [],
  female: [2],
  male:   [1],
};

/* ── Conversor: reais (float) → centavos (int) Meta ───────────────────── */
export function toMetaBudgetCents(reais) {
  const n = Number(reais);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

/* ── Heurística "Automático": quantos anéis usar ──────────────────────── */
/* Conservadora pra geografia de Joinville (bairros próximos, spread baixo
   na maioria das campanhas). Só cai em 3 anéis com muitos bairros bem
   espalhados — caso raro pra raio de 60 km. */
export function autoRingsCount(count, spreadKm) {
  if (count <= 2 || spreadKm <= 3) return 1;
  if (count >= 8 && spreadKm >= 6) return 3;
  return 2;
}

function dedupeLocationsByName(locations) {
  const seen = new Set();
  const out = [];
  for (const loc of locations || []) {
    const key = String(loc?.name || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
    if (!key) { out.push(loc); continue; }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(loc);
  }
  return out;
}

/**
 * Classifica bairros em anéis (primário/médio/externo) com base na distância
 * ao HOME_COORDS. ringsMode: 'auto' | '1' | '2' | '3' (default 'auto').
 *
 * Retorna `{ primario, medio, externo }` — sempre estes três campos como
 * arrays. Quando o modo gera <3 anéis, os anéis não usados ficam vazios.
 */
export function classifyRings(locations, ringsMode = 'auto') {
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
    const spread = valid[valid.length - 1].d - valid[0].d;
    numRings = Math.min(autoRingsCount(valid.length, spread), valid.length);
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
