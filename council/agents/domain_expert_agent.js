/**
 * Domain Expert — gestor de tráfego pago (Cris Costa Beauty / Joinville).
 *
 * Avalia decisões com a lente de quem opera campanhas reais:
 *  - aumentar orçamento >20% reseta aprendizado Meta (esperar 7d)
 *  - frequência > 3 = público saturado, hora de novo criativo
 *  - CTR < 0,8% e CPC > média do nicho = criativo fraco
 *  - segmentação muito estreita estrangula delivery
 *  - ABO default, CBO só pra escala
 */
class DomainExpertAgent {
  constructor() {
    this.name = 'Domain Expert (Gestor de Tráfego)';
    this.criticalVeto = false;
  }

  async evaluate({ task, context }) {
    const t = (task || '').toLowerCase();
    const c = context || {};

    if (/(diminuir|reduzir|cortar).*(or[çc]amento|budget)/i.test(t) &&
        c.campaign_age_days != null && c.campaign_age_days < 7) {
      return { verdict: 'REJECT', reason: 'reduzir orçamento em fase de aprendizado também atrapalha algoritmo (Meta precisa de sinal estável 7d)' };
    }

    if (/(p[úu]blico|audi[êe]ncia).*(amplo|amplia|expand|alarg)/i.test(t) &&
        c.frequency != null && c.frequency < 1.8) {
      return { verdict: 'REJECT', reason: 'expandir público com freq baixa desperdiça verba — esperar saturação primeiro' };
    }

    if (/(novo criativo|substitu|trocar.*(an[úu]ncio|criativo))/i.test(t)) {
      if (c.frequency != null && c.frequency < 2.5) {
        return { verdict: 'REJECT', reason: `freq ${c.frequency} ainda baixa — público não saturou; trocar criativo agora reseta aprendizado por nada` };
      }
    }

    return { verdict: 'APPROVE', reason: 'decisão alinhada com prática de gestor de tráfego' };
  }
}

module.exports = DomainExpertAgent;
