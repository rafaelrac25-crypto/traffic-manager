/**
 * Lógica cliente de recomendação de bairros baseada em métricas reais.
 *
 * Consome GET /api/campaigns/analytics/districts (agregação do backend) e
 * produz 3 tipos de saída:
 *
 * 1. Top N bairros por CPR (melhor custo-benefício)
 * 2. Bairros "queimando orçamento" (CPR muito acima da média)
 * 3. Mensagem curta p/ banner (1 linha)
 *
 * Chamado pelo Step2 do CreateAd e pelo watcher do AppStateContext.
 */

import api from '../services/api';

export async function fetchDistrictInsights() {
  try {
    const { data } = await api.get('/api/campaigns/analytics/districts');
    return data;
  } catch (err) {
    console.warn('[districtInsights] falhou:', err?.message);
    return null;
  }
}

/* Retorna top N bairros com CPR mais baixo (melhores conversores).
   Só considera bairros com ≥3 conversões — descarta ruído. */
export function topPerformers(districts, n = 3, minConv = 3) {
  if (!Array.isArray(districts)) return [];
  return districts
    .filter(d => d.cpr != null && d.conversions >= minConv)
    .slice(0, n);
}

/* Retorna bairros com CPR >= 40% acima da média — candidatos a cortar. */
export function underperformers(districts, avgCPR, threshold = 1.4, minConv = 3) {
  if (!Array.isArray(districts) || avgCPR == null) return [];
  return districts
    .filter(d => d.cpr != null && d.conversions >= minConv && d.cpr >= avgCPR * threshold)
    .sort((a, b) => b.cpr - a.cpr);
}

/* Gera frase curta pra banner. Retorna null se dados insuficientes. */
export function recommendationLine(insights) {
  if (!insights || insights.dataQuality !== 'usable') return null;
  const top = topPerformers(insights.districts, 3);
  if (top.length === 0) return null;
  const names = top.map(t => t.district).join(', ');
  const avg = insights.avgCPR;
  const bestCPR = top[0].cpr;
  const pct = avg ? Math.round(((avg - bestCPR) / avg) * 100) : null;
  if (pct != null && pct >= 15) {
    return `💡 ${names} tiveram CPR ~${pct}% abaixo da média. Considere priorizar.`;
  }
  return `💡 Top bairros: ${names} (CPR mais baixo histórico).`;
}

/* Gera alerta pro sino quando identifica oportunidade significativa.
   Retorna { kind, title, body } ou null se nenhum insight forte. */
export function strongInsightAlert(insights) {
  if (!insights || insights.dataQuality !== 'usable') return null;
  const top = topPerformers(insights.districts, 1);
  if (top.length === 0) return null;
  const best = top[0];
  const avg = insights.avgCPR;
  if (!avg || !best.cpr) return null;
  const delta = (avg - best.cpr) / avg;
  if (delta < 0.30) return null; /* só alerta 30%+ melhor */
  return {
    kind: 'insight-high-performer',
    title: 'Oportunidade detectada',
    body: `${best.district} está convertendo ${Math.round(delta * 100)}% melhor que a média. Considere aumentar investimento.`,
  };
}
