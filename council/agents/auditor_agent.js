/**
 * Auditor de Verdade — afirmando algo VISTO/MEDIDO ou extrapolando?
 *
 * No traffic-manager, marca claims sem evidência:
 *  - "campanha está performando bem" sem dados frescos do health/insights
 *  - "público feminino converte mais" sem A/B real
 *  - "criativo X está saturado" sem dado de freq
 *  - "Meta vai aprovar" sem ter mandado pra revisão
 */
class AuditorAgent {
  constructor() {
    this.name = 'Auditor de Verdade';
    this.criticalVeto = false;
  }

  async evaluate({ task, context }) {
    const t = (task || '').toLowerCase();
    const c = context || {};

    const claimsPerformance = /(performando|indo bem|ruim|fraco|saturad|convertend|funcionand)/i.test(t);
    const hasFreshData = c.metrics_fresh === true ||
                         c.checked_at != null ||
                         c.spend != null ||
                         c.frequency != null;
    if (claimsPerformance && !hasFreshData) {
      return { verdict: 'REJECT', reason: 'afirmação sobre performance sem dados frescos — rodar curl /api/health/full ou /api/insights antes' };
    }

    const claimsApproval = /(meta vai aprovar|ser[áa] aprovad|n[ãa]o vai reprovar)/i.test(t);
    if (claimsApproval) {
      return { verdict: 'REJECT', reason: 'aprovação Meta é decisão deles — nunca afirmar antes de mandar pra revisão' };
    }

    return { verdict: 'APPROVE', reason: 'claim verificável ou ausente' };
  }
}

module.exports = AuditorAgent;
