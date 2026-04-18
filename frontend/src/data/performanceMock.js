/**
 * Mock de performance por anúncio + anel.
 *
 * Gera métricas realistas a partir do ID do anúncio (seeded PRNG), para
 * que os números sejam consistentes entre renders. Será substituído pela
 * integração real da Meta Ads API.
 *
 * Cada anúncio com split retorna métricas por anel:
 *   { impressions, clicks, ctr, cpc, conversions, convRate, cpr, spend }
 *
 * Também retorna qual anel "venceu" (melhor CPR), usado em recomendações.
 */

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/* PRNG determinístico (mulberry32-like) */
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

function rand(rng, min, max) { return min + rng() * (max - min); }

const RING_META = {
  primario: { label: 'Anel interno (0-5 km)', color: '#16A34A', shortLabel: 'Interno' },
  medio:    { label: 'Anel médio (5-7 km)',    color: '#F59E0B', shortLabel: 'Médio' },
  externo:  { label: 'Anel externo (7-8 km)',  color: '#D97706', shortLabel: 'Externo' },
};

/**
 * Gera métricas simuladas para um anúncio + anel.
 * Cada anel tem características típicas:
 *  - Primário: CTR bom, CPC alto, conversão alta (ticket alto)
 *  - Médio: CTR médio, CPC médio, conversão boa (sweet spot)
 *  - Externo: CTR baixo, CPC baixo, conversão menor (mas volume)
 */
function ringMetrics(rng, ring, dailySpend, daysActive = 7) {
  const totalSpend = dailySpend * daysActive;

  const profiles = {
    primario: { ctrMin: 1.8, ctrMax: 3.2, cpcMin: 0.95, cpcMax: 1.80, crMin: 5.5, crMax: 9.0 },
    medio:    { ctrMin: 2.2, ctrMax: 3.8, cpcMin: 0.70, cpcMax: 1.30, crMin: 6.0, crMax: 11.0 },
    externo:  { ctrMin: 1.2, ctrMax: 2.4, cpcMin: 0.55, cpcMax: 1.00, crMin: 2.8, crMax: 6.5 },
  };
  const p = profiles[ring] || profiles.medio;

  const cpc = rand(rng, p.cpcMin, p.cpcMax);
  const ctr = rand(rng, p.ctrMin, p.ctrMax);
  const convRate = rand(rng, p.crMin, p.crMax);

  const clicks = Math.max(1, Math.floor(totalSpend / cpc));
  const impressions = Math.floor(clicks / (ctr / 100));
  const conversions = Math.max(1, Math.floor(clicks * (convRate / 100)));
  const cpr = totalSpend / conversions;

  return {
    impressions,
    clicks,
    ctr: Number(ctr.toFixed(2)),
    cpc: Number(cpc.toFixed(2)),
    conversions,
    convRate: Number(convRate.toFixed(2)),
    cpr: Number(cpr.toFixed(2)),
    spend: Number(totalSpend.toFixed(2)),
  };
}

/**
 * Analisa um anúncio e retorna performance por anel (se houver split).
 * Se o anúncio não tem split, retorna performance consolidada (1 bucket).
 */
export function analyzeAdPerformance(ad, opts = {}) {
  if (!ad) return null;
  const daysActive = opts.daysActive || 7;
  const seed = hashString(String(ad.id || ad.name || Math.random()));
  const rng = makePrng(seed);

  const budget = Number(ad.budgetValue) || 0;
  if (budget <= 0) return null;

  const split = ad.budgetRingSplit;
  const hasSplit = !!(split && ['primario', 'medio', 'externo'].some(k => (Number(split[k]) || 0) > 0));

  if (!hasSplit) {
    const metrics = ringMetrics(rng, 'medio', budget, daysActive);
    return {
      ad,
      daysActive,
      totalSpend: metrics.spend,
      totalClicks: metrics.clicks,
      totalConversions: metrics.conversions,
      hasSplit: false,
      rings: [],
      bestRing: null,
      worstRing: null,
    };
  }

  const activeKeys = ['primario', 'medio', 'externo'].filter(k => (Number(split[k]) || 0) > 0);
  const rings = activeKeys.map(k => {
    const pct = Number(split[k]) || 0;
    const dailySpend = budget * pct / 100;
    const m = ringMetrics(rng, k, dailySpend, daysActive);
    return {
      key: k,
      ...RING_META[k],
      pct,
      dailySpend: Number(dailySpend.toFixed(2)),
      ...m,
    };
  });

  const bestRing = [...rings].sort((a, b) => a.cpr - b.cpr)[0] || null;
  const worstRing = [...rings].sort((a, b) => b.cpr - a.cpr)[0] || null;

  const totalSpend = rings.reduce((s, r) => s + r.spend, 0);
  const totalClicks = rings.reduce((s, r) => s + r.clicks, 0);
  const totalConversions = rings.reduce((s, r) => s + r.conversions, 0);

  return {
    ad,
    daysActive,
    totalSpend: Number(totalSpend.toFixed(2)),
    totalClicks,
    totalConversions,
    hasSplit: true,
    rings,
    bestRing,
    worstRing,
  };
}

/**
 * Dado um analysis, sugere um novo split otimizado (priorizando o anel vencedor).
 * Retorna { primario, medio, externo } com soma = 100.
 */
export function suggestOptimizedSplit(analysis) {
  if (!analysis || !analysis.hasSplit || !analysis.bestRing) return null;
  const base = { primario: 0, medio: 0, externo: 0 };
  const rings = analysis.rings;

  /* Peso inversamente proporcional ao CPR (menor CPR = maior peso). */
  const scores = rings.map(r => ({ key: r.key, score: 1 / Math.max(r.cpr, 1) }));
  const sum = scores.reduce((s, x) => s + x.score, 0);
  const raw = {};
  scores.forEach(s => { raw[s.key] = s.score / sum; });

  /* Converter em inteiros que somem 100 */
  const entries = Object.entries(raw).map(([k, v]) => [k, Math.round(v * 100)]);
  let total = entries.reduce((s, [, v]) => s + v, 0);
  /* Ajustar arredondamento para fechar em 100 no maior bucket */
  if (total !== 100 && entries.length > 0) {
    entries.sort((a, b) => b[1] - a[1]);
    entries[0][1] += 100 - total;
  }
  const out = { ...base };
  entries.forEach(([k, v]) => { out[k] = v; });
  return out;
}

/**
 * Analisa todos os anúncios de uma vez — usado pelo Dashboard e Reports.
 */
export function analyzeAllAds(ads, opts) {
  return (ads || []).map(ad => analyzeAdPerformance(ad, opts)).filter(Boolean);
}

/**
 * Consolida métricas globais por anel (soma entre todos os anúncios com split).
 * Usado no Dashboard para mostrar "qual anel tá ganhando no geral".
 */
export function globalRingPerformance(ads, opts) {
  const analyses = analyzeAllAds(ads, opts).filter(a => a.hasSplit);
  const agg = {};
  analyses.forEach(a => {
    a.rings.forEach(r => {
      if (!agg[r.key]) agg[r.key] = { ...RING_META[r.key], key: r.key, spend: 0, clicks: 0, conversions: 0 };
      agg[r.key].spend += r.spend;
      agg[r.key].clicks += r.clicks;
      agg[r.key].conversions += r.conversions;
    });
  });
  const rings = Object.values(agg).map(r => ({
    ...r,
    cpr: r.conversions > 0 ? Number((r.spend / r.conversions).toFixed(2)) : Infinity,
    cpc: r.clicks > 0 ? Number((r.spend / r.clicks).toFixed(2)) : 0,
  }));
  const best = rings.length > 0 ? [...rings].sort((a, b) => a.cpr - b.cpr)[0] : null;
  return { rings, best, adCount: analyses.length };
}

export { RING_META };
