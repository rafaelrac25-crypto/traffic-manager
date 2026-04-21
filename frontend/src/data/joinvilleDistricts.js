/**
 * Inteligência de bairros de Joinville para segmentação de Cris Costa Beauty.
 *
 * Base fixa: Boa Vista (onde fica a clínica). Todas as análises (distância,
 * tier, sugestão de ticket/orçamento) são calculadas contra este ponto.
 *
 * Fontes das estimativas de renda:
 *   - Joinville Cidade em Dados (2018, 2020) - Prefeitura de Joinville
 *   - NSC Total "Bairro mais rico de Joinville" (Glória R$6,5k, Saguaçu R$5,5k)
 *   - IBGE Cidades - Joinville
 *
 * Os valores são estimativas para apoiar decisões de mídia paga; não usar
 * como fonte oficial. Atualizar quando IBGE publicar Censo 2022.
 */

export const HOME_DISTRICT = 'Boa Vista';
export const HOME_COORDS = { lat: -26.2980, lng: -48.8224 };
export const HOME_RADIUS_KM = 8;

/**
 * Bairros de Joinville com coords (centroide aproximado) e estimativas
 * de renda/perfil. Pode ser estendido facilmente.
 */
/* Centroides atualizados 2026-04-20 via OpenStreetMap Nominatim. */
export const DISTRICTS = [
  { name: 'Joinville',       coords: { lat: -26.3044, lng: -48.8487 }, tier: 'mix',       incomeMin: 3000, incomeMax: 7000, note: 'Cidade toda — mix de perfis' },
  { name: 'Centro',          coords: { lat: -26.3016, lng: -48.8462 }, tier: 'alto',      incomeMin: 5000, incomeMax: 7000, note: 'Área comercial consolidada, boa infraestrutura' },
  { name: 'América',         coords: { lat: -26.2904, lng: -48.8536 }, tier: 'alto',      incomeMin: 7000, incomeMax: 9000, note: 'Bairro estruturado, baixa vulnerabilidade social' },
  { name: 'Glória',          coords: { lat: -26.2961, lng: -48.8742 }, tier: 'alto',      incomeMin: 6000, incomeMax: 8000, note: 'Renda média familiar R$ 6,5k (NSC Total)' },
  { name: 'Saguaçu',         coords: { lat: -26.2863, lng: -48.8387 }, tier: 'alto',      incomeMin: 5000, incomeMax: 7000, note: 'Renda média familiar R$ 5,5k (NSC Total)' },
  { name: 'Anita Garibaldi', coords: { lat: -26.3184, lng: -48.8563 }, tier: 'alto',      incomeMin: 6000, incomeMax: 8000, note: 'Bom acesso a serviços, perfil consolidado' },
  { name: 'Costa e Silva',   coords: { lat: -26.2747, lng: -48.8799 }, tier: 'alto',      incomeMin: 5000, incomeMax: 6500, note: 'Boa infraestrutura + atividade econômica' },
  { name: 'Atiradores',      coords: { lat: -26.3102, lng: -48.8638 }, tier: 'alto',      incomeMin: 7000, incomeMax: 9000, note: 'Mais estruturado, classe A/B1 predominante' },
  { name: 'Boa Vista',       coords: { lat: -26.2980, lng: -48.8224 }, tier: 'medio-alto',incomeMin: 4500, incomeMax: 6500, note: 'Sede da Cris Costa Beauty' },
  { name: 'Bom Retiro',      coords: { lat: -26.2609, lng: -48.8419 }, tier: 'medio',     incomeMin: 4000, incomeMax: 5000, note: 'Residencial, perfil médio' },
  { name: 'Floresta',        coords: { lat: -26.3345, lng: -48.8494 }, tier: 'medio',     incomeMin: 4000, incomeMax: 5000, note: 'Residencial, perfil médio' },
  { name: 'Jardim Sofia',    coords: { lat: -26.2385, lng: -48.8410 }, tier: 'medio',     incomeMin: 4000, incomeMax: 5000, note: 'Residencial, perfil médio' },
  { name: 'Bucarein',        coords: { lat: -26.3147, lng: -48.8382 }, tier: 'medio',     incomeMin: 3500, incomeMax: 4500, note: 'Misto residencial/comercial' },
  { name: 'Guanabara',       coords: { lat: -26.3222, lng: -48.8287 }, tier: 'medio',     incomeMin: 3500, incomeMax: 4500, note: 'Residencial perto do centro' },
  { name: 'Iririú',          coords: { lat: -26.2755, lng: -48.8237 }, tier: 'medio',     incomeMin: 3000, incomeMax: 4000, note: 'Bairro popular, boa densidade' },
  { name: 'Santo Antônio',   coords: { lat: -26.2692, lng: -48.8563 }, tier: 'medio-baixo',incomeMin: 2500, incomeMax: 3500, note: 'Zona norte' },
  { name: 'Itaum',           coords: { lat: -26.3330, lng: -48.8294 }, tier: 'medio-baixo',incomeMin: 2500, incomeMax: 3500, note: 'Zona sul' },
  { name: 'Aventureiro',     coords: { lat: -26.2435, lng: -48.8105 }, tier: 'medio-baixo',incomeMin: 2500, incomeMax: 3500, note: 'Zona nordeste, alto volume populacional' },
];

/* ── Haversine — distância em km entre dois pontos lat/lng ── */
export function distanceKm(a, b) {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return Infinity;
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ── Lookup por nome (case-insensitive, aceita variações) ── */
export function getDistrict(name) {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  return DISTRICTS.find((d) => d.name.toLowerCase() === key) || null;
}

/* ── Classificação pelo raio em anéis de valor ── */
export function ringByDistance(km) {
  if (km <= 5) return { ring: 'primário', label: 'Anel interno (0-5 km)', color: '#16A34A' };
  if (km <= 7) return { ring: 'médio',    label: 'Anel médio (5-7 km)',   color: '#F59E0B' };
  if (km <= 8) return { ring: 'externo',  label: 'Anel externo (7-8 km)', color: '#D97706' };
  return { ring: 'fora', label: `Fora do raio (${km.toFixed(1)} km)`, color: '#94A3B8' };
}

/* ── Ticket esperado por tier (estética facial avançada) ── */
export function expectedTicketByTier(tier) {
  const t = {
    'alto':        { min: 500, max: 900, mainProcedures: ['Micropigmentação labial', 'Glow lips', 'Microagulhamento'] },
    'medio-alto':  { min: 300, max: 600, mainProcedures: ['Micropigmentação sobrancelhas', 'Pacotes de limpeza', 'Extensão de cílios'] },
    'medio':       { min: 200, max: 400, mainProcedures: ['Lash lifting', 'Brow lamination', 'Limpeza de pele'] },
    'medio-baixo': { min: 120, max: 250, mainProcedures: ['Lash lifting', 'Limpeza de pele simples', 'Brow lamination'] },
    'mix':         { min: 200, max: 600, mainProcedures: ['Mix — variar por criativo'] },
  };
  return t[tier] || t['medio'];
}

/* ── Faixa etária sugerida para Meta Ads por tier ── */
export function suggestedAgeRange(tier) {
  const a = {
    'alto':        [32, 52], // micropigmentação/glow lips, classes A/B
    'medio-alto':  [28, 48],
    'medio':       [22, 42], // lash/brow entra mais jovem
    'medio-baixo': [20, 38],
    'mix':         [26, 48],
  };
  return a[tier] || a['medio'];
}

/* ── Orçamento diário sugerido para teste inicial (R$) ── */
export function suggestedDailyBudget(tier) {
  const b = {
    'alto':        { min: 60, max: 100 },
    'medio-alto':  { min: 40, max: 70 },
    'medio':       { min: 25, max: 45 },
    'medio-baixo': { min: 20, max: 35 },
    'mix':         { min: 30, max: 60 },
  };
  return b[tier] || b['medio'];
}

/**
 * Análise completa de um bairro — dados prontos para exibir.
 */
export function analyzeDistrict(name) {
  const d = getDistrict(name);
  if (!d) return null;
  const distKm = distanceKm(HOME_COORDS, d.coords);
  const ring = ringByDistance(distKm);
  const ticket = expectedTicketByTier(d.tier);
  const age = suggestedAgeRange(d.tier);
  const budget = suggestedDailyBudget(d.tier);
  return {
    name: d.name,
    coords: d.coords,
    tier: d.tier,
    incomeRange: { min: d.incomeMin, max: d.incomeMax },
    note: d.note,
    distKm,
    ring,
    ticket,
    ageRange: age,
    budget,
  };
}

/**
 * Lista de bairros dentro do raio (ordenada por distância).
 */
export function districtsInRadius(km = HOME_RADIUS_KM) {
  return DISTRICTS
    .map((d) => ({ ...d, distKm: distanceKm(HOME_COORDS, d.coords) }))
    .filter((d) => d.distKm <= km)
    .sort((a, b) => a.distKm - b.distKm);
}

/** Mapa nome → coords (usado por Audiences.jsx e CreateAd.jsx) */
export const DISTRICT_COORDS = Object.fromEntries(
  DISTRICTS.map((d) => [d.name, d.coords])
);

/** Lista ordenada de nomes para dropdowns/sugestões (sem "Joinville" cidade toda no topo) */
export const DISTRICT_NAMES_FOR_SUGGESTION = [
  'Joinville',
  ...DISTRICTS
    .filter((d) => d.name !== 'Joinville')
    .sort((a, b) => distanceKm(HOME_COORDS, a.coords) - distanceKm(HOME_COORDS, b.coords))
    .map((d) => d.name),
];

/**
 * Retorna o bairro mais próximo de uma coordenada (exclui "Joinville" cidade inteira).
 * Usado como fallback quando Nominatim não retorna nome de bairro no reverse geocode.
 */
export function nearestDistrict(lat, lng) {
  let best = null;
  let bestDist = Infinity;
  for (const d of DISTRICTS) {
    if (d.name === 'Joinville') continue; /* cidade inteira, não conta */
    const dist = distanceKm({ lat, lng }, d.coords);
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return best ? { ...best, distKm: bestDist } : null;
}
