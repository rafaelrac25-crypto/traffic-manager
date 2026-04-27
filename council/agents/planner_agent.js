/**
 * Planner — pergunta clara? qual a intenção real?
 *
 * Rejeita tarefas vagas demais pra serem executadas com confiança.
 * No traffic-manager, isso pega comandos como "melhora o anúncio" sem
 * critério (qual métrica? qual anúncio? qual horizonte?).
 */
class PlannerAgent {
  constructor() {
    this.name = 'Planner';
    this.criticalVeto = false;
  }

  async evaluate({ task }) {
    const trimmed = (task || '').trim();
    if (trimmed.length < 5) {
      return { verdict: 'REJECT', reason: 'tarefa muito curta — sem intenção legível' };
    }

    const vague = /^(melhor|otim|ajust|arrum|mexe|mud)/i.test(trimmed) && trimmed.length < 30;
    if (vague) {
      return { verdict: 'REJECT', reason: 'verbo vago sem objeto/critério (ex: "melhora o anúncio" sem qual métrica)' };
    }

    return { verdict: 'APPROVE', reason: 'intenção legível' };
  }
}

module.exports = PlannerAgent;
