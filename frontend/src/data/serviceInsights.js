/**
 * Algoritmo de recomendação de investimento por bairro × serviço.
 *
 * Lógica pura (sem React). Processa insights retornados pela API
 * GET /api/campaigns/insights-by-service?service=<id> e produz
 * recomendações de onde aumentar ou reduzir investimento.
 *
 * Todos os bairros são dos 18 de Joinville/SC — regra de negócio.
 */

/** Limiares usados em todos os cálculos — exportado pra testes e UI. */
export const INSIGHT_THRESHOLDS = {
  /** Bairro com CPR >= 25% ABAIXO da baseline → high performer */
  highPerformerDelta: 0.25,
  /** Bairro com CPR >= 30% ACIMA da baseline → low performer (queimando orçamento) */
  lowPerformerDelta: -0.30,
  /** Mínimo de dias de dados pra considerar confiável */
  minDays: 30,
  /** Mínimo de conversões pra considerar confiável */
  minConversions: 100,
};

/**
 * Verifica se há dados suficientes pra confiar nas recomendações.
 * @param {object|null} insightsResponse — resposta do endpoint (pode ser null)
 * @returns {boolean}
 */
export function hasEnoughData(insightsResponse) {
  if (!insightsResponse) return false;
  if (insightsResponse.enough_data === false) return false;
  /* dataQuality 'usable' já garante ≥10 conversões globalmente.
     Pra recomendação por serviço, exigimos o flag enough_data da API. */
  if (insightsResponse.dataQuality === 'usable' && insightsResponse.enough_data !== false) {
    return true;
  }
  return false;
}

/**
 * Calcula o CPR (Custo por Resultado) de um bairro específico pra um serviço.
 *
 * @param {object|null} insightsResponse — resposta da API
 * @param {string} district — nome do bairro
 * @param {string} service — id do serviço (ex: 'micro-sobrancelha')
 * @returns {{ district, cpr, baseline, delta, sample: { conversions, days } } | null}
 */
export function calcCPRByDistrict(insightsResponse, district, service) {
  if (!insightsResponse || !district || !service) return null;
  const districts = insightsResponse.districts || [];
  const row = districts.find(d => d.district === district);
  if (!row || row.cpr == null) return null;
  const baseline = insightsResponse.avgCPR ?? null;
  const delta = baseline != null && row.cpr != null
    ? (baseline - row.cpr) / baseline  /* positivo = melhor que baseline */
    : null;
  return {
    district: row.district,
    cpr: row.cpr,
    baseline,
    delta,
    sample: {
      conversions: row.conversions ?? 0,
      days: insightsResponse._diagnostics?.window_days ?? 30,
    },
  };
}

/**
 * Calcula a média histórica de CPR para um serviço (baseline).
 * Confiável apenas se ≥30 dias E ≥100 conversões no período.
 *
 * @param {object|null} insightsResponse
 * @param {string} service
 * @returns {{ cpr, reliable, conversions, days } | null}
 */
export function calcBaselineCPR(insightsResponse, service) {
  if (!insightsResponse || !service) return null;
  const totalConv = insightsResponse.totalConv ?? 0;
  const days = insightsResponse._diagnostics?.window_days ?? 0;
  const avgCPR = insightsResponse.avgCPR ?? null;
  if (avgCPR == null) return null;
  const reliable =
    totalConv >= INSIGHT_THRESHOLDS.minConversions &&
    days >= INSIGHT_THRESHOLDS.minDays;
  return {
    cpr: avgCPR,
    reliable,
    conversions: totalConv,
    days,
  };
}

/**
 * Retorna bairros com CPR >= 25% ABAIXO da baseline (high performers).
 *
 * @param {object|null} insightsResponse
 * @param {string} service
 * @returns {Array<{ district, cpr, baseline, delta, sample }>}
 */
export function findHighPerformers(insightsResponse, service) {
  if (!insightsResponse || !service) return [];
  const districts = insightsResponse.districts || [];
  const baseline = insightsResponse.avgCPR;
  if (baseline == null) return [];
  return districts
    .filter(d => d.cpr != null && d.conversions >= 3)
    .map(d => {
      const delta = (baseline - d.cpr) / baseline;
      return { district: d.district, cpr: d.cpr, baseline, delta, sample: { conversions: d.conversions, days: insightsResponse._diagnostics?.window_days ?? 30 } };
    })
    .filter(d => d.delta >= INSIGHT_THRESHOLDS.highPerformerDelta)
    .sort((a, b) => b.delta - a.delta);
}

/**
 * Retorna bairros com CPR >= 30% ACIMA da baseline (low performers — queimando orçamento).
 *
 * @param {object|null} insightsResponse
 * @param {string} service
 * @returns {Array<{ district, cpr, baseline, delta, sample }>}
 */
export function findLowPerformers(insightsResponse, service) {
  if (!insightsResponse || !service) return [];
  const districts = insightsResponse.districts || [];
  const baseline = insightsResponse.avgCPR;
  if (baseline == null) return [];
  return districts
    .filter(d => d.cpr != null && d.conversions >= 3)
    .map(d => {
      const delta = (baseline - d.cpr) / baseline;
      return { district: d.district, cpr: d.cpr, baseline, delta, sample: { conversions: d.conversions, days: insightsResponse._diagnostics?.window_days ?? 30 } };
    })
    .filter(d => d.delta <= INSIGHT_THRESHOLDS.lowPerformerDelta)
    .sort((a, b) => a.delta - b.delta);
}

/**
 * Sugere top 3 bairros para um serviço, considerando bairros ativos e histórico.
 *
 * @param {string} service — id do serviço
 * @param {string[]} currentDistricts — bairros já selecionados no anúncio
 * @param {object|null} allInsights — resposta da API
 * @returns {Array<{ district, cpr, baseline, delta, sample, isNew: boolean }>}
 */
export function recommendDistrictsFor(service, currentDistricts = [], allInsights = null) {
  if (!service || !allInsights) return [];
  const districts = allInsights.districts || [];
  const baseline = allInsights.avgCPR;
  if (baseline == null || districts.length === 0) return [];

  const currentSet = new Set(currentDistricts.map(d => d?.toLowerCase?.() ?? d));

  return districts
    .filter(d => d.cpr != null && d.conversions >= 3)
    .map(d => {
      const delta = (baseline - d.cpr) / baseline;
      return {
        district: d.district,
        cpr: d.cpr,
        baseline,
        delta,
        sample: { conversions: d.conversions, days: allInsights._diagnostics?.window_days ?? 30 },
        isNew: !currentSet.has(d.district.toLowerCase()),
      };
    })
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3);
}

/**
 * Gera a linha de texto para o banner do Step 2.
 * Retorna null se não houver dados suficientes ou insight relevante.
 *
 * @param {string} serviceLabel — nome legível do serviço
 * @param {object|null} insightsResponse
 * @returns {string | null}
 */
export function buildBannerLine(serviceLabel, insightsResponse) {
  if (!hasEnoughData(insightsResponse)) return null;
  const top = findHighPerformers(insightsResponse, null);
  if (top.length === 0) return null;
  const best = top[0];
  const pct = Math.round(best.delta * 100);
  if (pct < 15) return null; /* delta muito pequeno — não vale mencionar */
  return `Para ${serviceLabel}, historicamente ${best.district} teve CPR ${pct}% abaixo da média. Considere priorizar.`;
}

/**
 * Gera o objeto de notificação pra o sino, por (service, district).
 * Respeitando throttle de 24h via localStorage.
 *
 * @param {string} service — id do serviço
 * @param {string} serviceLabel — nome legível
 * @param {{ district, delta, cpr }} performer — high ou low performer
 * @param {'high'|'low'} type
 * @returns {{ kind, title, message } | null}
 */
export function buildInsightNotification(service, serviceLabel, performer, type) {
  if (!service || !performer || !performer.district) return null;

  const key = `ccb_insight_dismissed_${service}_${performer.district}_${type}`;
  const lastAt = Number(localStorage.getItem(key) || 0);
  const COOLDOWN = 24 * 60 * 60 * 1000;
  if (Date.now() - lastAt < COOLDOWN) return null;

  const pct = Math.round(Math.abs(performer.delta) * 100);

  if (type === 'high') {
    return {
      kind: 'insight-high-performer',
      title: 'Oportunidade detectada',
      message: `${performer.district} está convertendo ${pct}% melhor que a média para ${serviceLabel}. Considere aumentar o investimento.`,
      link: '/anuncios',
      _throttleKey: key,
    };
  }
  if (type === 'low') {
    return {
      kind: 'insight-low-performer',
      title: 'Bairro com custo elevado',
      message: `${performer.district} está ${pct}% acima do custo médio para ${serviceLabel}. Considere reduzir o investimento nesse bairro.`,
      link: '/anuncios',
      _throttleKey: key,
    };
  }
  return null;
}

/** Grava o throttle no localStorage quando a notificação for disparada. */
export function markInsightNotified(throttleKey) {
  if (throttleKey) {
    try { localStorage.setItem(throttleKey, String(Date.now())); } catch {}
  }
}
