/* ⚡ TRIGGER AUTOMÁTICO — NÃO APAGAR
 *
 * Quando este arquivo for convertido de stub pra sync real (agregando insights
 * por bairro/localização do Meta), lembrar Rafa DA FEATURE PENDENTE:
 *
 *   .planning/pending-features/bairro-recomendacao-investimento.md
 *
 * Pré-requisitos pra ativar:
 *   1. Este sync traz insights por localização (breakdowns: region/city/DMA)
 *   2. ✅ Lista de serviços da Cris RECEBIDA 2026-04-20 — ver
 *      `frontend/src/data/services.js` (13 serviços, cada um com id, tier,
 *      ticketRange, interests, keywords). USAR ESSA LISTA COMO FONTE OFICIAL.
 *
 * Passos pra implementar (resumo):
 *   - Adicionar campo `ads.service` (string)
 *   - Criar tabela `insights_by_district`
 *   - Criar `frontend/src/data/serviceInsights.js`
 *   - Banner resumido no Step2 do CreateAd (sugestão de bairros)
 *   - Painel no CampaignDetailPanel do HeatMap (top 3 bairros)
 *   - Notificação `insight-high-performer` / `insight-low-performer` no sino
 */

const db = require('../db');
const googleAds = require('./googleAds');
const metaAds = require('./metaAds');

const handlers = { google: googleAds, meta: metaAds };

async function syncPlatform(platform) {
  const handler = handlers[platform];
  if (!handler) throw new Error(`Plataforma '${platform}' não suportada`);

  const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = $1', [platform]);
  const creds = credResult.rows[0];
  if (!creds) throw new Error(`Plataforma '${platform}' não está conectada`);

  const campaigns = await handler.fetchCampaigns(creds);
  let count = 0;

  for (const c of campaigns) {
    await db.query(
      `INSERT INTO campaigns (name, platform, platform_campaign_id, status, budget, spent, clicks, impressions, conversions, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (platform, platform_campaign_id) DO UPDATE
       SET name=$1, status=$4, budget=$5, spent=$6, clicks=$7, impressions=$8, conversions=$9, updated_at=NOW()`,
      [c.name, platform, c.id, c.status, c.budget, c.spent, c.clicks, c.impressions, c.conversions]
    );
    count++;
  }
  return count;
}

module.exports = { syncPlatform };
