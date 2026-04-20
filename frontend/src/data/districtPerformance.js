/**
 * Performance por bairro de Joinville — derivada das métricas por anel.
 *
 * Cada bairro herda o perfil do anel em que se encontra (interno/médio/externo)
 * com uma variação determinística seeded pelo nome do bairro, pra que o mapa
 * de calor tenha gradiente visual em vez de 3 faixas discretas.
 *
 * Será substituído por dados reais da Meta Ads API (agregação geográfica por
 * CEP/bairro) quando a integração for implementada.
 */

import { DISTRICTS, HOME_COORDS, distanceKm } from './joinvilleDistricts';

/**
 * Verifica se as coordenadas de um bairro caem dentro de QUALQUER uma das
 * localizações delimitadas nos anúncios (lat/lng + radius em km).
 * Se `ads` não tem `locations` definidas, retorna true (sem filtro espacial).
 */
function isDistrictInAdLocations(districtCoords, ads) {
  const allLocations = (ads || []).flatMap((a) => Array.isArray(a.locations) ? a.locations : []);
  if (allLocations.length === 0) return true;
  return allLocations.some((loc) => {
    if (loc.lat == null || loc.lng == null) return false;
    const km = distanceKm(districtCoords, { lat: loc.lat, lng: loc.lng });
    const radius = Number(loc.radius) || 5;
    return km <= radius;
  });
}
import { analyzeAdPerformance, analyzeAllAds } from './performanceMock';

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function makePrng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ringKeyForDistance(km) {
  if (km <= 5) return 'primario';
  if (km <= 7) return 'medio';
  return 'externo';
}

/**
 * Deriva métricas por bairro a partir da análise por anel de UM anúncio.
 * Retorna [{ name, coords, distKm, ringKey, spend, clicks, conversions, cpc, cpr }]
 */
export function districtMetricsForAd(ad, opts = {}) {
  const analysis = analyzeAdPerformance(ad, opts);
  if (!analysis) return [];

  const ringsByKey = {};
  if (analysis.hasSplit) {
    analysis.rings.forEach((r) => { ringsByKey[r.key] = r; });
  } else {
    /* Sem split: tudo vai pro "medio" conceitualmente */
    ringsByKey.medio = {
      spend: analysis.totalSpend,
      clicks: analysis.totalClicks,
      conversions: analysis.totalConversions,
      cpc: analysis.totalClicks > 0 ? analysis.totalSpend / analysis.totalClicks : 0,
      cpr: analysis.totalConversions > 0 ? analysis.totalSpend / analysis.totalConversions : Infinity,
    };
  }

  /* Para cada bairro, identifica o anel e distribui proporcionalmente entre
     os bairros do MESMO anel — mas com jitter determinístico por nome, pra
     gerar gradiente visual em vez de 3 platôs planos. */

  /* Contagem de bairros por anel (pra distribuir a soma) */
  const districtsByRing = { primario: [], medio: [], externo: [] };
  DISTRICTS.forEach((d) => {
    if (d.name === 'Joinville') return; /* ignora o "cidade toda" */
    const km = distanceKm(HOME_COORDS, d.coords);
    if (km > 8) return; /* fora do raio */
    const key = ringKeyForDistance(km);
    districtsByRing[key].push({ ...d, distKm: km });
  });

  /* Jitter seeded por (nomeAd + nomeBairro) */
  const adSeed = hashString(String(ad.id || ad.name || 'x'));

  const out = [];
  Object.entries(districtsByRing).forEach(([ringKey, districts]) => {
    const ring = ringsByKey[ringKey];
    if (!ring || districts.length === 0) return;

    /* Pesos relativos por jitter (0.55 a 1.45), pra criar contraste visual */
    const weights = districts.map((d) => {
      const rng = makePrng(adSeed ^ hashString(d.name));
      return 0.55 + rng() * 0.90;
    });
    const weightSum = weights.reduce((s, w) => s + w, 0);

    districts.forEach((d, i) => {
      const share = weights[i] / weightSum;
      const spend = ring.spend * share;
      const clicks = Math.round((ring.clicks || 0) * share);
      const conversions = Math.round((ring.conversions || 0) * share);
      const cpc = clicks > 0 ? spend / clicks : 0;
      const cpr = conversions > 0 ? spend / conversions : Infinity;

      out.push({
        name: d.name,
        coords: d.coords,
        distKm: d.distKm,
        ringKey,
        spend: Number(spend.toFixed(2)),
        clicks,
        conversions,
        cpc: Number(cpc.toFixed(2)),
        cpr: Number.isFinite(cpr) ? Number(cpr.toFixed(2)) : null,
      });
    });
  });

  return out;
}

/**
 * Agrega métricas por bairro somando todos os anúncios (ou apenas os filtrados).
 * Se `ads` vier com 1 anúncio só, retorna métricas dele. Se vier todos, soma geral.
 */
export function aggregateDistrictMetrics(ads, opts = {}) {
  const perDistrict = new Map();

  (ads || []).forEach((ad) => {
    const list = districtMetricsForAd(ad, opts);
    list.forEach((d) => {
      const curr = perDistrict.get(d.name);
      if (!curr) {
        perDistrict.set(d.name, {
          name: d.name,
          coords: d.coords,
          distKm: d.distKm,
          ringKey: d.ringKey,
          spend: d.spend,
          clicks: d.clicks,
          conversions: d.conversions,
        });
      } else {
        curr.spend += d.spend;
        curr.clicks += d.clicks;
        curr.conversions += d.conversions;
      }
    });
  });

  return Array.from(perDistrict.values()).map((d) => ({
    ...d,
    spend: Number(d.spend.toFixed(2)),
    cpc: d.clicks > 0 ? Number((d.spend / d.clicks).toFixed(2)) : 0,
    cpr: d.conversions > 0 ? Number((d.spend / d.conversions).toFixed(2)) : null,
  }));
}

/**
 * Normaliza um array de valores numéricos para a faixa 0..1.
 * Para métricas "lower is better" (CPR, CPC), passa `invert: true` — assim
 * valores baixos viram intensidade alta (quente = bom).
 */
export function normalizeValues(values, { invert = false } = {}) {
  const nums = values.filter((v) => v != null && Number.isFinite(v));
  if (nums.length === 0) return values.map(() => 0);

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min;

  return values.map((v) => {
    if (v == null || !Number.isFinite(v)) return 0;
    if (range === 0) return 0.5;
    const n = (v - min) / range;
    return invert ? 1 - n : n;
  });
}

export const METRIC_CONFIG = {
  conversions: { label: 'Conversões', icon: '🎯', invert: false, format: (v) => Number(v || 0).toLocaleString('pt-BR') },
  cpr:         { label: 'CPR',        icon: '🔥', invert: true,  format: (v) => v == null ? '—' : `R$\u00A0${Number(v).toFixed(2).replace('.', ',')}` },
  cpc:         { label: 'CPC',        icon: '💰', invert: true,  format: (v) => v == null ? '—' : `R$\u00A0${Number(v).toFixed(2).replace('.', ',')}` },
};

/**
 * Atalho: retorna o conjunto pronto pra renderizar o heatmap.
 * Se `campaignId` for null/undefined, agrega todos os anúncios (resumo geral).
 */
export function buildHeatMapData(ads, { campaignId, metric = 'conversions', daysActive = 7 } = {}) {
  const filtered = campaignId ? (ads || []).filter((a) => String(a.id) === String(campaignId)) : (ads || []);
  const allDistricts = aggregateDistrictMetrics(filtered, { daysActive });

  /* Respeita a área delimitada nos anúncios: só inclui bairros cujo centroide
     cai dentro do raio de ao menos uma location da(s) campanha(s) selecionada(s). */
  const districts = allDistricts.filter((d) => isDistrictInAdLocations(d.coords, filtered));

  const config = METRIC_CONFIG[metric] || METRIC_CONFIG.conversions;

  const values = districts.map((d) => d[metric]);
  const intensities = normalizeValues(values, { invert: config.invert });

  return districts.map((d, i) => ({
    ...d,
    intensity: intensities[i],
    metricValue: d[metric],
    metricLabel: config.label,
    metricFormat: config.format,
  }));
}

export { analyzeAllAds };
