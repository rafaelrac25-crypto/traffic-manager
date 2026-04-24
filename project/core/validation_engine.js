/**
 * Validador standalone do payload Meta Ads contra `project/config/meta_rules.json`.
 *
 * Não está plugado no runtime — é um utilitário CommonJS que pode ser usado em
 * testes ou em pre-flight do backend. Pra ativar no fluxo real, basta importar
 * em `backend/src/services/metaWrite.js` antes da 1ª chamada Graph.
 *
 * Source of truth das regras: `frontend/src/config/metaRules.js`. O JSON
 * consumido aqui é um snapshot — manter os dois alinhados.
 */

const rules = require('../config/meta_rules.json');

const VALID_OBJECTIVES = Object.keys(rules.objectives_meta_v20_odax);
const MIN_DAILY_BUDGET_CENTS = rules.budget_brl.min_daily_per_ring * 100;

/**
 * Valida payload no nível da Campaign Meta v20.
 *
 * @param {object} payload — objeto campaign (saída de toMetaPayload(ad).campaign)
 * @returns {string[]} lista de mensagens de erro em PT-BR; vazia se válido
 */
function validateCampaignPayload(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    return ['Payload da campanha ausente ou inválido.'];
  }

  /* Campos obrigatórios — `daily_budget` pode ser null se a campanha usa
     lifetime_budget; tratamos isso depois, então só barramos undefined aqui. */
  rules.required_campaign_fields.forEach((field) => {
    if (payload[field] === undefined) {
      errors.push(`Campo obrigatório ausente: ${field}.`);
    }
  });

  if (payload.objective && !VALID_OBJECTIVES.includes(payload.objective)) {
    errors.push(
      `Objetivo inválido: "${payload.objective}". Aceitos: ${VALID_OBJECTIVES.join(', ')}.`,
    );
  }

  if (payload.status && !rules.status.includes(payload.status)) {
    errors.push(`Status inválido: "${payload.status}". Aceitos: ${rules.status.join(', ')}.`);
  }

  /* Meta v20: special_ad_categories sempre é array (em geral []). Cada item
     precisa estar na lista permitida. */
  if (payload.special_ad_categories !== undefined) {
    if (!Array.isArray(payload.special_ad_categories)) {
      errors.push('special_ad_categories deve ser array (use [] quando não houver categoria).');
    } else {
      const invalid = payload.special_ad_categories.filter(
        (c) => !rules.special_ad_categories.includes(c),
      );
      if (invalid.length > 0) {
        errors.push(`Categorias especiais inválidas: ${invalid.join(', ')}.`);
      }
    }
  }

  /* Budget Meta vem em centavos; min vem em reais → multiplica por 100.
     Aceita daily OU lifetime — pelo menos um precisa estar acima do mínimo. */
  const dailyOk = payload.daily_budget == null || payload.daily_budget >= MIN_DAILY_BUDGET_CENTS;
  if (!dailyOk) {
    errors.push(
      `daily_budget abaixo do mínimo: ${payload.daily_budget} centavos. ` +
        `Mínimo é R$ ${rules.budget_brl.min_daily_per_ring}/dia (${MIN_DAILY_BUDGET_CENTS} centavos).`,
    );
  }

  return errors;
}

module.exports = {
  validateCampaignPayload,
  VALID_OBJECTIVES,
  MIN_DAILY_BUDGET_CENTS,
};
