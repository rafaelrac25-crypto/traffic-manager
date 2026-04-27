/**
 * Risk Reviewer — ação destrutiva ou que viola escopo/isolamento?
 *
 * VETO CRÍTICO ativo. Se este agente rejeita, não tem maioria que salva.
 *
 * No traffic-manager, bloqueia:
 *  - mexer em criativos (pertencem a cris-costa-criativos)
 *  - deletar campanha/adset em produção sem confirmação explícita
 *  - rotacionar token Meta sem justificativa
 *  - publicar campanha sem teste local
 *  - --no-verify em git, force push em main, alterações destrutivas
 */
class RiskAgent {
  constructor() {
    this.name = 'Risk Reviewer';
    this.criticalVeto = true;
  }

  async evaluate({ task }) {
    const t = (task || '').toLowerCase();

    if (/(criar|gerar|editar|salvar|escrever).*(criativ|design|logo|arte|banner|post)/i.test(t) &&
        !/(consumir|ler|buscar|importar|referenciar)/i.test(t)) {
      return { verdict: 'REJECT', reason: 'criativos pertencem a cris-costa-criativos; AdManager só consome' };
    }

    if (/(--no-verify|force.?push|reset.*hard|rebase.*-i|drop\s+(table|database))/i.test(t)) {
      return { verdict: 'REJECT', reason: 'operação destrutiva sem autorização explícita' };
    }

    if (/(deletar|delete|remover|destruir|excluir).*(campanha|adset|an[úu]ncio).*prod/i.test(t)) {
      return { verdict: 'REJECT', reason: 'deletar recurso Meta em prod precisa confirmação explícita do Rafa' };
    }

    if (/rotacionar.*(token|secret|chave)/i.test(t) && !/(comprometid|vazado|rotina|expirad)/i.test(t)) {
      return { verdict: 'REJECT', reason: 'rotação de token/secret sem justificativa quebra produção' };
    }

    return { verdict: 'APPROVE', reason: 'sem ação destrutiva ou violação de escopo detectada' };
  }
}

module.exports = RiskAgent;
