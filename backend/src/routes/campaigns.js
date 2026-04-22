const router = require('express').Router();
const db = require('../db');

async function log(action, entity, entity_id, description, meta) {
  try {
    await db.query(
      `INSERT INTO activity_log (action, entity, entity_id, description, meta) VALUES (?, ?, ?, ?, ?)`,
      [action, entity, entity_id || null, description || null, meta ? JSON.stringify(meta) : null]
    );
  } catch {}
}

/* Transforma row do banco em objeto com payload deserializado */
function rowToAd(row) {
  if (!row) return null;
  const out = { ...row };
  if (out.payload && typeof out.payload === 'string') {
    try { out.payload = JSON.parse(out.payload); } catch { /* leave as is */ }
  }
  /* Merge de campos do payload na raiz pra consumo direto no frontend */
  if (out.payload && typeof out.payload === 'object') {
    return { ...out.payload, ...out, payload: undefined };
  }
  return out;
}

router.get('/', async (req, res) => {
  const { platform, status } = req.query;
  let query = 'SELECT * FROM campaigns WHERE 1=1';
  const params = [];
  if (platform) { query += ' AND platform = ?'; params.push(platform); }
  if (status)   { query += ' AND status = ?';   params.push(status); }
  query += ' ORDER BY created_at DESC';
  try {
    const result = await db.query(query, params);
    res.json(result.rows.map(rowToAd));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar campanhas' });
  }
});

router.post('/', async (req, res) => {
  const { name, platform, budget, start_date, end_date, publish_mode, scheduled_for, status: statusIn, payload } = req.body;
  if (!name || !platform) return res.status(400).json({ error: 'Nome e plataforma obrigatórios' });

  const mode = publish_mode || 'immediate';
  const isImmediate = mode === 'immediate';
  let status = statusIn || (isImmediate ? 'review' : 'scheduled');
  const submitted_at = isImmediate ? new Date().toISOString() : null;
  const sched = (!isImmediate && scheduled_for) ? scheduled_for : null;

  let metaResult = null;
  let platform_campaign_id = null;
  let metaError = null;

  const shouldPublishMeta = (platform === 'meta' || platform === 'instagram') && isImmediate && payload?.meta?.campaign;
  if (shouldPublishMeta) {
    try {
      const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
      const creds = credResult.rows[0];
      if (!creds) throw new Error('Conecte o Facebook antes de publicar');
      const { publishCampaign } = require('../services/metaWrite');
      const mediaItems = Array.isArray(payload.mediaFilesData) ? payload.mediaFilesData : [];
      metaResult = await publishCampaign(creds, payload.meta, mediaItems);
      platform_campaign_id = metaResult.platform_campaign_id;
      status = 'review';
    } catch (e) {
      /* Log detalhado pros logs do Vercel — payload completo + erro Meta */
      console.error('[meta.publish] FALHA — stage:', e.stage || 'unknown');
      console.error('[meta.publish] FALHA — params enviados:', JSON.stringify(e.params, null, 2));
      console.error('[meta.publish] FALHA — erro:', e.message, 'meta:', JSON.stringify(e.meta, null, 2));
      metaError = e.meta?.pt || e.message || 'Erro ao publicar no Meta';
      const stageLabel = { campaign: 'Campanha', creative: 'Criativo', adset: 'Conjunto de anúncios', ad: 'Anúncio' }[e.stage] || null;
      const reasonWithStage = stageLabel ? `[${stageLabel}] ${metaError}` : metaError;
      /* Retorna TODOS os detalhes do erro pro frontend — inclusive campos enviados
         pra facilitar diagnóstico quando Meta não devolve error_user_msg. */
      return res.status(200).json({
        rejected: true,
        reason: reasonWithStage,
        details: e.meta?.user_msg || e.meta?.raw || null,
        user_title: e.meta?.user_title || null,
        code: e.meta?.code || null,
        subcode: e.meta?.subcode || null,
        stage: e.stage || null,
        sentParams: e.params || null,
        endpoint: e.endpoint || null,
        meta: e.meta || null,
      });
    }
  }

  const enrichedPayload = metaResult
    ? { ...payload, mediaFilesData: undefined, metaPublishResult: metaResult }
    : payload
      ? { ...payload, mediaFilesData: undefined }
      : null;
  const payloadStr = enrichedPayload ? JSON.stringify(enrichedPayload) : null;

  try {
    const savedPlatform = metaResult ? 'meta' : platform;
    const result = await db.query(
      `INSERT INTO campaigns
        (name, platform, platform_campaign_id, budget, start_date, end_date, publish_mode, status, scheduled_for, submitted_at, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      [name, savedPlatform, platform_campaign_id, budget || null, start_date || null, end_date || null,
       mode, status, sched, submitted_at, payloadStr]
    );
    const camp = rowToAd(result.rows[0]);
    const desc = metaResult
      ? `Campanha "${name}" publicada no Meta (ID ${platform_campaign_id})`
      : mode === 'scheduled'
      ? `Campanha "${name}" agendada para ${sched}`
      : `Campanha "${name}" criada na plataforma ${platform}`;
    await log('create', 'campaign', camp?.id, desc, { platform, budget, mode, platform_campaign_id });
    res.status(201).json(camp);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar campanha' });
  }
});

router.put('/:id', async (req, res) => {
  const { name, budget, start_date, end_date, spent, clicks, impressions, conversions, status, payload } = req.body;
  const payloadStr = payload !== undefined ? (payload ? JSON.stringify(payload) : null) : undefined;
  try {
    /* Propaga mudanças pro Meta antes de gravar local (name/budget/datas).
       Se o Meta recusar, retorna 502 — frontend reverte a edição local. */
    const before = await db.query('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    const current = before.rows[0];
    if (!current) return res.status(404).json({ error: 'Campanha não encontrada' });

    const isMeta = (current.platform === 'meta' || current.platform === 'instagram') && current.platform_campaign_id;
    if (isMeta) {
      const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
      const creds = credResult.rows[0];
      if (!creds) return res.status(400).json({ error: 'Meta não está conectado' });

      /* Acha ad_sets reais (criados no publish) pra editar */
      let prevPayload = {};
      try { prevPayload = current.payload ? JSON.parse(current.payload) : {}; } catch {}
      const adSetIds = (prevPayload?.metaPublishResult?.ad_sets || [])
        .map(x => x.ad_set_id).filter(Boolean);
      /* Fallback pro legado (1 ad_set só) */
      if (adSetIds.length === 0 && prevPayload?.metaPublishResult?.ad_set_id) {
        adSetIds.push(prevPayload.metaPublishResult.ad_set_id);
      }
      const ringSplit = (prevPayload?.metaPublishResult?.ad_sets || []).map(x => ({
        id: x.ad_set_id,
        pct: x.ring_percent ?? (100 / Math.max(1, (prevPayload?.metaPublishResult?.ad_sets || []).length)),
      }));

      const { updateCampaignMeta, updateAdSetMeta } = require('../services/metaWrite');

      /* 1) Nome da Campaign */
      if (name != null && name !== current.name) {
        try {
          await updateCampaignMeta(creds, current.platform_campaign_id, { name });
        } catch (e) {
          return res.status(502).json({ error: `Meta recusou a mudança de nome: ${e.message}`, meta: e.meta || null });
        }
      }

      /* 2) Orçamento — redistribui pelos ad_sets usando ring_percent original */
      if (budget != null && Number(budget) !== Number(current.budget) && adSetIds.length > 0) {
        const totalCents = Math.round(Number(budget) * 100);
        try {
          for (const as of (ringSplit.length > 0 ? ringSplit : adSetIds.map(id => ({ id, pct: 100 })))) {
            const ringCents = Math.round(totalCents * (as.pct / 100));
            await updateAdSetMeta(creds, as.id, { daily_budget: ringCents });
          }
        } catch (e) {
          return res.status(502).json({ error: `Meta recusou a mudança de orçamento: ${e.message}`, meta: e.meta || null });
        }
      }

      /* 3) Datas de início/fim — aplica em TODOS os ad_sets */
      const dateFields = {};
      if (start_date != null && start_date !== current.start_date) {
        dateFields.start_time = new Date(start_date + 'T00:00:00').toISOString();
      }
      if (end_date != null && end_date !== current.end_date) {
        dateFields.end_time = new Date(end_date + 'T23:59:59').toISOString();
      }
      if (Object.keys(dateFields).length > 0 && adSetIds.length > 0) {
        try {
          for (const id of adSetIds) {
            await updateAdSetMeta(creds, id, dateFields);
          }
        } catch (e) {
          return res.status(502).json({ error: `Meta recusou a mudança de datas: ${e.message}`, meta: e.meta || null });
        }
      }
    }

    /* Tudo OK no Meta → persiste local */
    const result = await db.query(
      `UPDATE campaigns SET
        name = COALESCE(?, name),
        budget = COALESCE(?, budget),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        spent = COALESCE(?, spent),
        clicks = COALESCE(?, clicks),
        impressions = COALESCE(?, impressions),
        conversions = COALESCE(?, conversions),
        status = COALESCE(?, status),
        payload = COALESCE(?, payload),
        updated_at = datetime('now')
       WHERE id = ? RETURNING *`,
      [name, budget, start_date, end_date, spent, clicks, impressions, conversions, status, payloadStr, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Campanha não encontrada' });
    res.json(rowToAd(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar campanha' });
  }
});

router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['active', 'paused', 'ended', 'review', 'scheduled'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Status inválido' });

  try {
    const pre = await db.query('SELECT id, name, platform, platform_campaign_id FROM campaigns WHERE id = ?', [req.params.id]);
    const row = pre.rows[0];
    if (!row) return res.status(404).json({ error: 'Campanha não encontrada' });

    if (row.platform === 'meta' && row.platform_campaign_id && (status === 'active' || status === 'paused' || status === 'ended')) {
      const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
      const creds = credResult.rows[0];
      if (!creds) return res.status(400).json({ error: 'Meta não está conectado' });
      try {
        const { updateCampaignStatus } = require('../services/metaWrite');
        const metaStatus = status === 'ended' ? 'paused' : status;
        await updateCampaignStatus(creds, row.platform_campaign_id, metaStatus);
      } catch (mErr) {
        console.error('[meta.updateStatus]', mErr);
        return res.status(502).json({ error: `Meta recusou: ${mErr.message}`, meta: mErr.meta || null });
      }
    }

    const extraFields = status === 'active'
      ? `, live_at = COALESCE(live_at, datetime('now'))`
      : status === 'review'
      ? `, submitted_at = COALESCE(submitted_at, datetime('now')), review_started_at = datetime('now')`
      : '';

    const result = await db.query(
      `UPDATE campaigns SET status = ?, updated_at = datetime('now')${extraFields} WHERE id = ? RETURNING *`,
      [status, req.params.id]
    );
    const camp = result.rows[0];
    const statusLabels = { active: 'Ativada', paused: 'Pausada', ended: 'Encerrada', review: 'Enviada para revisão', scheduled: 'Agendada' };
    await log('status_change', 'campaign', camp.id, `Campanha "${camp.name}" — ${statusLabels[status] || status}`, { status });
    res.json(camp);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar status' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const before = await db.query('SELECT name, platform, platform_campaign_id FROM campaigns WHERE id = ?', [req.params.id]);
    const camp = before.rows[0];

    if (camp && camp.platform === 'meta' && camp.platform_campaign_id) {
      const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
      const creds = credResult.rows[0];
      if (creds) {
        try {
          const { deleteCampaign } = require('../services/metaWrite');
          await deleteCampaign(creds, camp.platform_campaign_id);
        } catch (mErr) {
          console.error('[meta.delete]', mErr);
          return res.status(502).json({ error: `Meta recusou remoção: ${mErr.message}`, meta: mErr.meta || null });
        }
      }
    }

    await db.query('DELETE FROM campaigns WHERE id = ?', [req.params.id]);
    if (camp) await log('delete', 'campaign', parseInt(req.params.id), `Campanha "${camp.name}" removida`, { platform: camp.platform });
    res.json({ message: 'Campanha removida' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover campanha' });
  }
});

/* Sync cirúrgico: só atualiza status/métricas das ads que JÁ existem no nosso DB
   e têm platform_campaign_id. Preserva o `payload` (wizard completo). Seguro pra
   rodar em polling curto (60s) sem perder dados.
   Retorna apenas os diffs — frontend aplica sem precisar refetch completo. */
router.post('/sync-meta-status', async (req, res) => {
  try {
    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) return res.json({ updated: [], skipped: 'meta-not-connected' });

    const localAds = await db.query(
      `SELECT id, platform_campaign_id, status, spent, clicks, impressions, conversions
         FROM campaigns
        WHERE platform = 'meta' AND platform_campaign_id IS NOT NULL`,
      []
    );
    if (!localAds.rows.length) return res.json({ updated: [] });

    const metaAds = require('../services/metaAds');
    let remote;
    try {
      remote = await metaAds.fetchCampaigns(creds);
    } catch (e) {
      console.warn('[sync-meta-status] fetchCampaigns falhou:', e.message);
      return res.json({ updated: [], error: e.message });
    }
    const byMetaId = new Map(remote.map(r => [r.id, r]));

    const updated = [];
    for (const local of localAds.rows) {
      const r = byMetaId.get(local.platform_campaign_id);
      if (!r) continue;
      /* Só grava se mudou algo relevante — reduz churn de updated_at */
      const statusChanged = r.status && r.status !== local.status;
      const metricsChanged = (r.spent ?? 0) > 0 || (r.clicks ?? 0) > 0 || (r.impressions ?? 0) > 0;
      if (!statusChanged && !metricsChanged) continue;

      /* Nunca regride métricas — se Meta retorna 0 por delay/erro temporário,
         preservamos o valor anterior bom (compat SQLite+Postgres via JS max). */
      const keepMax = (metaVal, localVal) => {
        const a = Number(metaVal) || 0;
        const b = Number(localVal) || 0;
        return a >= b ? a : b;
      };
      const nextSpent       = keepMax(r.spent,       local.spent);
      const nextClicks      = keepMax(r.clicks,      local.clicks);
      const nextImpressions = keepMax(r.impressions, local.impressions);
      const nextConversions = keepMax(r.conversions, local.conversions);
      await db.query(
        `UPDATE campaigns SET
           status = COALESCE(?, status),
           spent = ?, clicks = ?, impressions = ?, conversions = ?,
           updated_at = datetime('now')
         WHERE id = ?`,
        [r.status || null, nextSpent, nextClicks, nextImpressions, nextConversions, local.id]
      );
      updated.push({
        id: local.id,
        platform_campaign_id: local.platform_campaign_id,
        status: r.status,
        effective_status: r.effective_status,
        spent: r.spent, clicks: r.clicks, impressions: r.impressions, conversions: r.conversions,
      });
    }
    res.json({ updated });
  } catch (err) {
    console.error('[sync-meta-status]', err);
    res.status(500).json({ error: err.message || 'Erro no sync' });
  }
});

/* Insights agregados por BAIRRO: somamos métricas por ad_set e expandimos pra
   os bairros de cada ad_set (guardados no payload). Se houver múltiplas
   campanhas histórico, agrega por bairro independente da campanha.
   Retorna [{district, spend, clicks, impressions, conversions, cpr, adCount}]. */
router.get('/analytics/districts', async (req, res) => {
  try {
    const camps = await db.query(
      `SELECT id, name, platform_campaign_id, spent, clicks, impressions, conversions, payload
         FROM campaigns
        WHERE platform = 'meta' AND platform_campaign_id IS NOT NULL`, []
    );

    /* Bucket de métricas por bairro */
    const byDistrict = {};
    for (const c of camps.rows) {
      let payload = {};
      try { payload = c.payload ? JSON.parse(c.payload) : {}; } catch {}
      const adSets = payload?.metaPublishResult?.ad_sets || [];
      const locations = payload?.locations || [];

      /* Mapeia bairros por anel a partir do payload original */
      const byRing = { primario: [], medio: [], externo: [] };
      (locations || []).forEach(l => {
        /* Aproximação: cada anel recebe porção equitativa se sem metadata */
      });

      /* Pra versão v1 (sem breakdown real por região), distribui métricas
         equitativamente entre os bairros da campanha — ainda dá ranking útil. */
      const districtNames = locations.map(l => l?.name).filter(Boolean);
      if (districtNames.length === 0) continue;

      const share = 1 / districtNames.length;
      const campConv = Number(c.conversions || 0);
      const campClicks = Number(c.clicks || 0);
      const campImps = Number(c.impressions || 0);
      const campSpent = Number(c.spent || 0);

      districtNames.forEach(name => {
        if (!byDistrict[name]) {
          byDistrict[name] = { district: name, spend: 0, clicks: 0, impressions: 0, conversions: 0, adCount: 0 };
        }
        const b = byDistrict[name];
        b.spend += campSpent * share;
        b.clicks += campClicks * share;
        b.impressions += campImps * share;
        b.conversions += campConv * share;
        b.adCount++;
      });
    }

    /* Calcula CPR (Custo por Resultado) e ordena */
    const result = Object.values(byDistrict).map(b => ({
      ...b,
      spend: Number(b.spend.toFixed(2)),
      clicks: Math.round(b.clicks),
      impressions: Math.round(b.impressions),
      conversions: Math.round(b.conversions),
      cpr: b.conversions > 0 ? Number((b.spend / b.conversions).toFixed(2)) : null,
      cpc: b.clicks > 0 ? Number((b.spend / b.clicks).toFixed(2)) : null,
    })).sort((a, b) => {
      /* Menor CPR primeiro (melhor retorno). Bairros sem conversão ao final. */
      if (a.cpr == null && b.cpr == null) return 0;
      if (a.cpr == null) return 1;
      if (b.cpr == null) return -1;
      return a.cpr - b.cpr;
    });

    /* Baseline global pra recomendação (média de CPR ponderada por conversões) */
    const totalConv = result.reduce((s, r) => s + r.conversions, 0);
    const totalSpend = result.reduce((s, r) => s + r.spend, 0);
    const avgCPR = totalConv > 0 ? Number((totalSpend / totalConv).toFixed(2)) : null;

    res.json({
      districts: result,
      avgCPR,
      totalConv,
      totalSpend: Number(totalSpend.toFixed(2)),
      dataQuality: result.length > 0 && totalConv >= 10 ? 'usable' : 'insufficient',
    });
  } catch (err) {
    console.error('[analytics/districts]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync/:platform', async (req, res) => {
  const { platform } = req.params;
  try {
    const { syncPlatform } = require('../services/sync');
    const result = await syncPlatform(platform);
    await log('sync', 'platform', null,
      `Sincronização ${platform}: ${result.upserted} campanha(s) atualizada(s)`,
      { platform, ...result });
    res.json({ message: `${result.upserted} campanha(s) sincronizada(s)`, ...result });
  } catch (err) {
    console.error('[sync]', err);
    res.status(500).json({ error: err.message || 'Erro na sincronização', meta: err.meta || null });
  }
});

module.exports = router;
