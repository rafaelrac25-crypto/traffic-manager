/**
 * Dry-run de criação de campanha — valida o payload antes de qualquer chamada
 * real à Meta. Wraps `validateCampaignPayload` com marcadores de log e formato
 * de retorno consistente.
 *
 * Hoje só roda validação local (regras em `project/config/meta_rules.json`).
 * `async` é proposital pra quando integrar com `execution_options:
 * ['validate_only']` da Meta Marketing API — que faz dry-run autoritativo
 * no Graph sem criar a campanha.
 *
 * Não está plugado no runtime — utilitário CommonJS pra testes/CLI.
 */

const { validateCampaignPayload } = require('./validation_engine');

async function dryRunCreateCampaign(payload) {
  console.log('DRY RUN STARTED');

  const errors = validateCampaignPayload(payload);

  if (errors.length > 0) {
    console.log('DRY RUN FAILED');
    return {
      success: false,
      errors,
    };
  }

  console.log('DRY RUN PASSED');
  return {
    success: true,
    message: 'Payload valid',
  };
}

module.exports = {
  dryRunCreateCampaign,
};
