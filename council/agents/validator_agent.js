/**
 * Validator — contexto suficiente? consistência com regras anteriores?
 *
 * No traffic-manager, valida contra:
 *  - regra Joinville (toda segmentação geo deve ser Joinville)
 *  - estratégia ABO default (não trocar pra CBO sem decisão explícita)
 *  - sem campo descrição em anúncios
 *  - manter horário comercial em adsets
 */
class ValidatorAgent {
  constructor() {
    this.name = 'Validator';
    /* Veto crítico — regras checadas aqui são duras (Joinville, fase de
       aprendizado Meta, decisão "sem descrição"). Maioria não salva. */
    this.criticalVeto = true;
  }

  async evaluate({ task, context }) {
    const t = (task || '').toLowerCase();

    if (/(florianópolis|florianopolis|curitiba|são paulo|sao paulo|rio de janeiro|outras cidades)/i.test(t)) {
      return { verdict: 'REJECT', reason: 'segmentação geo fora de Joinville viola regra do projeto' };
    }

    if (/cbo|campaign budget optimization/i.test(t) && !/(toggle|opcional|optar|escolher)/i.test(t)) {
      return { verdict: 'REJECT', reason: 'estratégia padrão é ABO; CBO só como toggle opcional' };
    }

    if (/campo descri[çc][ãa]o|description field/i.test(t) && /(adicionar|incluir|criar)/i.test(t)) {
      return { verdict: 'REJECT', reason: 'placements de IG/mobile não exibem descrição — decisão registrada' };
    }

    if (context && context.campaign_age_days != null && context.campaign_age_days < 7) {
      const isBudgetIncrease = /(aumentar|subir|incrementar).*(or[çc]amento|budget)/i.test(t);
      if (isBudgetIncrease) {
        return { verdict: 'REJECT', reason: `campanha tem ${context.campaign_age_days}d (<7d) — aumentar orçamento >20% reseta aprendizado Meta` };
      }
    }

    return { verdict: 'APPROVE', reason: 'consistente com regras do projeto' };
  }
}

module.exports = ValidatorAgent;
