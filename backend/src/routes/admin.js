/**
 * Rotas administrativas — limpeza de campanhas zumbi no Meta.
 *
 * "Zumbi" = campanha existente no Meta Ads que NÃO tem registro
 * correspondente em platform_campaign_id da tabela campaigns local,
 * E que tem 0 ad_sets (confirma que está mesmo órfã).
 *
 * Auth: sem middleware (sistema de uso interno — mesma política do resto
 * das rotas do projeto; ver middleware/auth.js desativado).
 */

const router = require('express').Router();
const db = require('../db');
const { safeDecrypt } = require('../services/crypto');
const { metaGet, metaDelete } = require('../services/metaHttp');
const { parseMetaError } = require('../services/metaErrors');

/* Busca credenciais Meta + decripta token */
async function getMetaCreds() {
  const result = await db.query(
    `SELECT access_token, account_id FROM platform_credentials WHERE platform = $1 LIMIT 1`,
    ['meta']
  );
  const creds = result.rows?.[0];
  if (!creds?.access_token) throw new Error('Plataforma Meta não conectada');
  const token = safeDecrypt(creds.access_token, 'admin/zombie');
  if (!token) throw new Error('Token Meta inválido ou não configurado');
  return { token, accountId: creds.account_id };
}

/**
 * GET /api/admin/zombie-campaigns
 * Lista campanhas do Meta que não estão no DB local e têm 0 ad_sets.
 */
router.get('/zombie-campaigns', async (req, res) => {
  try {
    const { token, accountId } = await getMetaCreds();
    if (!accountId) return res.status(400).json({ error: 'account_id não configurado nas credenciais' });

    /* 1. Campanhas do Meta (até 100 — suficiente para escala atual) */
    const metaResp = await metaGet(
      `/act_${accountId}/campaigns`,
      { fields: 'id,name,status,objective,created_time', limit: 100 },
      { token }
    );
    const metaCampaigns = metaResp?.data ?? [];

    if (metaCampaigns.length === 0) {
      return res.json({ zombies: [] });
    }

    /* 2. IDs presentes no DB local */
    const localResult = await db.query(
      `SELECT platform_campaign_id FROM campaigns WHERE platform_campaign_id IS NOT NULL AND platform = $1`,
      ['meta']
    );
    const localIds = new Set((localResult.rows ?? []).map(r => String(r.platform_campaign_id)));

    /* 3. Filtra candidatos a zumbi (não presentes no DB) */
    const candidates = metaCampaigns.filter(c => !localIds.has(String(c.id)));

    if (candidates.length === 0) {
      return res.json({ zombies: [] });
    }

    /* 4. Confirma cada candidato: conta ad_sets (zumbi = 0) */
    const zombies = [];
    for (const campaign of candidates) {
      try {
        const adsetsResp = await metaGet(
          `/${campaign.id}/adsets`,
          { fields: 'id', limit: 1 },
          { token }
        );
        const adsetsCount = adsetsResp?.data?.length ?? 0;
        if (adsetsCount === 0) {
          zombies.push({
            meta_id: String(campaign.id),
            name: campaign.name ?? '(sem nome)',
            status: campaign.status ?? 'UNKNOWN',
            objective: campaign.objective ?? 'UNKNOWN',
            created_time: campaign.created_time ?? null,
            adsets_count: 0,
            has_local_record: false,
          });
        }
      } catch (err) {
        /* Se falhar ao checar ad_sets, inclui na lista de qualquer forma
           com adsets_count=-1 (indica erro) pra Rafa decidir */
        console.warn(`[admin] erro ao checar ad_sets de campanha ${campaign.id}:`, err.message);
        zombies.push({
          meta_id: String(campaign.id),
          name: campaign.name ?? '(sem nome)',
          status: campaign.status ?? 'UNKNOWN',
          objective: campaign.objective ?? 'UNKNOWN',
          created_time: campaign.created_time ?? null,
          adsets_count: -1,
          has_local_record: false,
        });
      }
    }

    return res.json({ zombies });

  } catch (err) {
    console.error('[admin] zombie-campaigns GET:', err.message);
    const parsed = err.meta ? err.meta : parseMetaError(err);
    return res.status(500).json({ error: parsed.pt || err.message });
  }
});

/**
 * DELETE /api/admin/zombie-campaigns/:meta_id
 * Deleta uma campanha zumbi diretamente no Meta.
 */
router.delete('/zombie-campaigns/:meta_id', async (req, res) => {
  const { meta_id } = req.params;
  if (!meta_id || !/^\d+$/.test(meta_id)) {
    return res.status(400).json({ success: false, error_pt: 'ID de campanha inválido' });
  }

  try {
    const { token } = await getMetaCreds();

    await metaDelete(`/${meta_id}`, {}, { token });

    return res.json({ success: true, deleted_id: meta_id });

  } catch (err) {
    console.error(`[admin] zombie-campaigns DELETE ${meta_id}:`, err.message);
    const parsed = err.meta ? err.meta : parseMetaError(err);
    return res.status(500).json({ success: false, error_pt: parsed.pt || err.message });
  }
});

module.exports = router;
