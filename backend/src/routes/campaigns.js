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
  let out = { ...row };
  if (out.payload && typeof out.payload === 'string') {
    try { out.payload = JSON.parse(out.payload); } catch { /* leave as is */ }
  }
  /* Merge de campos do payload na raiz pra consumo direto no frontend */
  if (out.payload && typeof out.payload === 'object') {
    out = { ...out.payload, ...out, payload: undefined };
  }
  /* Bug B fix: derivar results/costPerResult de conversions/spent vindos do sync.
     Sem isso, esses campos ficam grudados nos defaults do payload (results: 0,
     costPerResult: null) mesmo quando o sync já mapeou conversions corretamente. */
  const conv = Number(out.conversions);
  if (Number.isFinite(conv) && conv > 0) {
    out.results = conv;
    const spent = Number(out.spent);
    if (Number.isFinite(spent) && spent > 0) {
      out.costPerResult = Number((spent / conv).toFixed(2));
    }
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
    console.error('[campaigns.POST] INSERT falhou:', err);
    /* Rollback transacional: se o INSERT local falhou DEPOIS de publishCampaign
       criar a Campaign no Meta, deletamos do Meta pra evitar órfã (Meta tem
       campanha publicada mas o painel não tem registro local — ad fantasma).
       Best-effort: se delete também falhar, salvamos em pending_cleanup pra
       reconciliação posterior. */
    if (metaResult?.platform_campaign_id) {
      try {
        const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
        const creds = credResult.rows[0];
        if (creds) {
          const { deleteCampaign } = require('../services/metaWrite');
          await deleteCampaign(creds, metaResult.platform_campaign_id);
          console.warn('[campaigns.POST] rollback Meta OK — campaign deletada:', metaResult.platform_campaign_id);
        }
      } catch (rollbackErr) {
        console.error('[campaigns.POST] ROLLBACK META FALHOU — órfã pode existir:', metaResult.platform_campaign_id, rollbackErr.message);
        /* Marca pra cleanup posterior — best-effort, não bloqueia resposta */
        try {
          await db.query(
            `INSERT INTO activity_log (action, entity, entity_id, description, meta) VALUES (?, ?, ?, ?, ?)`,
            ['orphan_meta', 'campaign', null, `Campaign Meta ${metaResult.platform_campaign_id} órfã: INSERT local falhou e rollback no Meta também falhou`,
             JSON.stringify({ platform_campaign_id: metaResult.platform_campaign_id, db_error: err.message, rollback_error: rollbackErr.message })]
          );
        } catch {}
      }
    }
    res.status(500).json({ error: 'Erro ao criar campanha — registro local falhou' });
  }
});

router.put('/:id', async (req, res) => {
  const { name, budget, start_date, end_date, spent, clicks, impressions, conversions, status, payload,
          /* Novos campos: edição pós-publicação de targeting + redistribuição entre anéis */
          targeting: targetingPatch, ringSplit } = req.body;
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

      /* Detecta se a campanha usa CBO (budget na Campaign) ou ABO (budget
         nos ad_sets) a partir do payload original — edição muda de endpoint
         conforme a estrutura. Tentar editar ad_set.daily_budget quando é
         CBO causa erro "cannot set adset budget" no Meta. */
      const isCBO = prevPayload?.budgetOptimization === 'campaign'
        || !!prevPayload?.meta?.campaign?.daily_budget
        || !!prevPayload?.meta?.campaign?.lifetime_budget;

      /* 2) Orçamento */
      if (budget != null && Number(budget) !== Number(current.budget)) {
        const totalCents = Math.round(Number(budget) * 100);
        try {
          if (isCBO) {
            /* CBO: edita direto no nível da Campaign */
            const budgetField = prevPayload?.budgetType === 'total'
              ? { lifetime_budget: totalCents }
              : { daily_budget: totalCents };
            await updateCampaignMeta(creds, current.platform_campaign_id, budgetField);
          } else if (adSetIds.length > 0) {
            /* ABO: redistribui pelos ad_sets usando ring_percent original */
            const budgetType = prevPayload?.budgetType === 'total' ? 'lifetime_budget' : 'daily_budget';
            for (const as of (ringSplit.length > 0 ? ringSplit : adSetIds.map(id => ({ id, pct: 100 })))) {
              const ringCents = Math.round(totalCents * (as.pct / 100));
              await updateAdSetMeta(creds, as.id, { [budgetType]: ringCents });
            }
          }
        } catch (e) {
          return res.status(502).json({ error: `Meta recusou a mudança de orçamento: ${e.message}`, meta: e.meta || null });
        }
      }

      /* 3) Datas de início/fim — fuso BR fixo (-03:00) pra não virar o dia
         quando interpretado no fuso UTC do servidor Vercel. */
      const BR_OFFSET = '-03:00';
      const dateFields = {};
      if (start_date != null && start_date !== current.start_date) {
        dateFields.start_time = new Date(`${start_date}T00:00:00${BR_OFFSET}`).toISOString();
      }
      if (end_date != null && end_date !== current.end_date) {
        dateFields.end_time = new Date(`${end_date}T23:59:59${BR_OFFSET}`).toISOString();
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

      /* 4) Targeting (interesses/idade/gênero) — patch parcial.
         Meta v20 substitui o objeto targeting INTEIRO no POST, então
         precisamos reconstruir a partir do existente (no payload salvo)
         + aplicar só os campos que mudaram. geo_locations,
         targeting_automation, targeting_relaxation_types e custom_locations
         dos bairros NÃO são tocados aqui. */
      if (targetingPatch && typeof targetingPatch === 'object' && adSetIds.length > 0) {
        const adSetsList = prevPayload?.meta?.ad_sets || (prevPayload?.meta?.ad_set ? [prevPayload.meta.ad_set] : []);
        try {
          for (let i = 0; i < adSetIds.length; i++) {
            const existingTargeting = adSetsList[i]?.targeting || adSetsList[0]?.targeting || {};
            const merged = { ...existingTargeting };
            if (targetingPatch.age_min != null) merged.age_min = Number(targetingPatch.age_min);
            if (targetingPatch.age_max != null) merged.age_max = Number(targetingPatch.age_max);
            if (Array.isArray(targetingPatch.genders)) merged.genders = targetingPatch.genders;
            if (Array.isArray(targetingPatch.interests)) {
              /* Reusa resolveInterestIds via publishCampaign? Não — é função
                 interna. Aceita IDs reais OU nomes; backend (Meta) rejeita
                 IDs fake `interest_*` então o caller deve mandar IDs reais
                 obtidos via /api/meta/search. Frontend consome /search e
                 envia IDs+name corretos aqui. */
              merged.interests = targetingPatch.interests
                .filter(it => it?.id && !String(it.id).startsWith('interest_'))
                .map(it => ({ id: it.id, name: it.name || '' }));
            }
            await updateAdSetMeta(creds, adSetIds[i], { targeting: merged });
          }
        } catch (e) {
          return res.status(502).json({ error: `Meta recusou a mudança de público: ${e.message}`, meta: e.meta || null });
        }
      }

      /* 5) Redistribuição entre anéis (ringSplit) — recebe novos % por anel
         e reaplica nos ad_sets existentes proporcionalmente ao budget total
         atual (ou novo, se também veio na request). Só faz sentido em ABO. */
      if (ringSplit && typeof ringSplit === 'object' && !isCBO && ringSplit && Object.keys(ringSplit).length > 0) {
        const totalBRL = budget != null ? Number(budget) : Number(current.budget);
        const totalCents = Math.round(totalBRL * 100);
        const budgetType = prevPayload?.budgetType === 'total' ? 'lifetime_budget' : 'daily_budget';
        const adSetsWithKey = prevPayload?.metaPublishResult?.ad_sets || [];
        try {
          for (const as of adSetsWithKey) {
            const newPct = ringSplit[as.ring_key];
            if (newPct == null) continue;
            const ringCents = Math.round(totalCents * (Number(newPct) / 100));
            await updateAdSetMeta(creds, as.ad_set_id, { [budgetType]: ringCents });
          }
        } catch (e) {
          return res.status(502).json({ error: `Meta recusou a redistribuição entre anéis: ${e.message}`, meta: e.meta || null });
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
           effective_status = COALESCE(?, effective_status),
           spent = ?, clicks = ?, impressions = ?, conversions = ?,
           updated_at = datetime('now')
         WHERE id = ?`,
        [r.status || null, r.effective_status || null, nextSpent, nextClicks, nextImpressions, nextConversions, local.id]
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

/* Insights agregados por BAIRRO.
   Estratégia em 2 níveis:
     1) Tenta dado REAL: agregação direta de `insights_by_district` (preenchida
        pelo sync do Meta com breakdown por região/cidade nos últimos 30 dias).
     2) Se não houver linha real, cai no fallback EQUITATIVO antigo: distribui
        métricas da campaign entre seus bairros (estimativa baseada no payload).
   Retorna { districts, avgCPR, totalConv, totalSpend, dataQuality,
             data_source: 'real'|'estimated', _diagnostics }. */
router.get('/analytics/districts', async (req, res) => {
  try {
    /* Janela de 30 dias — comparamos como string ISO (YYYY-MM-DD...) que é
       lexicograficamente comparável e funciona em SQLite e Postgres. */
    const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    /* PARTE 1: tenta dado real do insights_by_district */
    let realRows = [];
    try {
      const realQuery = await db.query(
        `SELECT district,
                SUM(spend) AS spend,
                SUM(clicks) AS clicks,
                SUM(impressions) AS impressions,
                SUM(conversions) AS conversions,
                COUNT(DISTINCT ad_set_id) AS ad_count
           FROM insights_by_district
          WHERE date_start >= ?
          GROUP BY district
         HAVING SUM(spend) > 0 OR SUM(conversions) > 0`,
        [sinceIso]
      );
      realRows = realQuery.rows || [];
    } catch (e) {
      /* Tabela pode não existir em ambientes muito antigos — log mas não quebra */
      console.warn('[analytics/districts] query real falhou, usando fallback:', e.message);
    }

    if (realRows.length >= 1) {
      /* Tem dado real — usa direto */
      const result = realRows.map(r => {
        const spend = Number(r.spend || 0);
        const clicks = Number(r.clicks || 0);
        const impressions = Number(r.impressions || 0);
        const conversions = Number(r.conversions || 0);
        return {
          district: r.district,
          spend: Number(spend.toFixed(2)),
          clicks: Math.round(clicks),
          impressions: Math.round(impressions),
          conversions: Math.round(conversions),
          adCount: Number(r.ad_count || 0),
          cpr: conversions > 0 ? Number((spend / conversions).toFixed(2)) : null,
          cpc: clicks > 0 ? Number((spend / clicks).toFixed(2)) : null,
        };
      }).sort((a, b) => {
        /* Menor CPR primeiro (melhor retorno). Bairros sem conversão ao final. */
        if (a.cpr == null && b.cpr == null) return 0;
        if (a.cpr == null) return 1;
        if (b.cpr == null) return -1;
        return a.cpr - b.cpr;
      });

      const totalConv = result.reduce((s, r) => s + r.conversions, 0);
      const totalSpend = result.reduce((s, r) => s + r.spend, 0);
      const avgCPR = totalConv > 0 ? Number((totalSpend / totalConv).toFixed(2)) : null;

      return res.json({
        districts: result,
        avgCPR,
        totalConv,
        totalSpend: Number(totalSpend.toFixed(2)),
        dataQuality: result.length > 0 && totalConv >= 10 ? 'usable' : 'insufficient',
        data_source: 'real',
        _diagnostics: {
          source: 'insights_by_district',
          window_days: 30,
          since: sinceIso,
          rows_found: realRows.length,
        },
      });
    }

    /* PARTE 2: fallback equitativo (sem dado real) */
    const camps = await db.query(
      `SELECT id, name, platform_campaign_id, spent, clicks, impressions, conversions, payload
         FROM campaigns
        WHERE platform = 'meta' AND platform_campaign_id IS NOT NULL`, []
    );

    /* Bucket de métricas por bairro */
    const byDistrict = {};
    /* Telemetria: antes campanhas sem locations.name eram puladas em silêncio
       e o endpoint devolvia [] sem nenhuma pista. Agora contamos quantas
       foram puladas e por quê — ajuda a debugar HeatMap vazio. */
    const skipped = { no_locations: 0, no_named_locations: 0, ids: [] };
    for (const c of camps.rows) {
      let payload = {};
      try { payload = c.payload ? JSON.parse(c.payload) : {}; } catch {}
      const locations = payload?.locations || [];

      if (!Array.isArray(locations) || locations.length === 0) {
        skipped.no_locations++;
        skipped.ids.push(c.id);
        continue;
      }

      /* Pra versão v1 (sem breakdown real por região), distribui métricas
         equitativamente entre os bairros da campanha — ainda dá ranking útil. */
      const districtNames = locations.map(l => l?.name).filter(Boolean);
      if (districtNames.length === 0) {
        skipped.no_named_locations++;
        skipped.ids.push(c.id);
        console.warn('[analytics/districts] campanha', c.id, 'tem locations sem name — pulando. Sample:', JSON.stringify(locations[0] || null));
        continue;
      }

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

    /* Se houve campanhas com locations sem name, loga consolidado pra
       facilitar diagnóstico de HeatMap vazio (antes era silêncio total). */
    if (skipped.no_locations || skipped.no_named_locations) {
      console.warn('[analytics/districts] resumo:',
        camps.rows.length, 'campanhas total |',
        result.length, 'bairros agregados |',
        skipped.no_locations, 'sem locations |',
        skipped.no_named_locations, 'com locations sem name');
    }

    res.json({
      districts: result,
      avgCPR,
      totalConv,
      totalSpend: Number(totalSpend.toFixed(2)),
      dataQuality: result.length > 0 && totalConv >= 10 ? 'usable' : 'insufficient',
      data_source: 'estimated',
      /* Telemetria visível pro frontend pode mostrar "X campanhas sem bairros"
         em vez de HeatMap vazio sem explicação. */
      _diagnostics: {
        source: 'campaigns.payload (fallback equitativo)',
        campaigns_total: camps.rows.length,
        campaigns_aggregated: camps.rows.length - skipped.no_locations - skipped.no_named_locations,
        skipped_no_locations: skipped.no_locations,
        skipped_no_named_locations: skipped.no_named_locations,
      },
    });
  } catch (err) {
    console.error('[analytics/districts]', err);
    res.status(500).json({ error: err.message });
  }
});

/* Performance agregada por ANEL (primário/médio/externo) — usa dado REAL do
   Meta a partir de `insights_by_district.ring_key`. Sempre retorna 3 entradas
   (preenche zeros se não houver dado pra algum anel) — facilita render do
   card de "Performance por anel" sem branches no frontend. */
router.get('/analytics/rings', async (req, res) => {
  try {
    const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    /* Definição canônica dos anéis — ordem fixa primario → medio → externo */
    const RING_DEFS = [
      { key: 'primario', label: 'Primário (0-5km)' },
      { key: 'medio',    label: 'Médio (5-7km)'    },
      { key: 'externo',  label: 'Externo (7-8km)'  },
    ];

    let rows = [];
    try {
      const q = await db.query(
        `SELECT ring_key,
                SUM(spend) AS spend,
                SUM(clicks) AS clicks,
                SUM(impressions) AS impressions,
                SUM(conversions) AS conversions,
                COUNT(DISTINCT ad_set_id) AS ad_set_count
           FROM insights_by_district
          WHERE date_start >= ? AND ring_key IS NOT NULL
          GROUP BY ring_key`,
        [sinceIso]
      );
      rows = q.rows || [];
    } catch (e) {
      console.warn('[analytics/rings] query falhou:', e.message);
    }

    /* Indexa por ring_key pra preencher os 3 anéis canônicos */
    const byKey = {};
    for (const r of rows) byKey[r.ring_key] = r;

    const rings = RING_DEFS.map(def => {
      const r = byKey[def.key] || {};
      const spend = Number(r.spend || 0);
      const clicks = Number(r.clicks || 0);
      const impressions = Number(r.impressions || 0);
      const conversions = Number(r.conversions || 0);
      const ad_set_count = Number(r.ad_set_count || 0);
      return {
        ring_key: def.key,
        ring_label: def.label,
        spend: Number(spend.toFixed(2)),
        clicks: Math.round(clicks),
        impressions: Math.round(impressions),
        conversions: Math.round(conversions),
        cpr: conversions > 0 ? Number((spend / conversions).toFixed(2)) : null,
        cpc: clicks > 0 ? Number((spend / clicks).toFixed(2)) : null,
        ad_set_count,
      };
    });

    const total = rings.reduce(
      (acc, r) => ({
        spend: acc.spend + r.spend,
        clicks: acc.clicks + r.clicks,
        conversions: acc.conversions + r.conversions,
      }),
      { spend: 0, clicks: 0, conversions: 0 }
    );
    total.spend = Number(total.spend.toFixed(2));

    /* Empty state implícito: total spend == 0 → frontend mostra "aguardando dados" */
    const data_source = total.spend > 0 || total.conversions > 0 ? 'real' : 'empty';

    res.json({
      rings,
      total,
      data_source,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[analytics/rings]', err);
    res.status(500).json({ error: err.message });
  }
});

/* PRE-FLIGHT CHECK: verifica se tudo está pronto antes de publicar uma
   campanha. Não cria nada — só consulta o Meta pra confirmar token, saldo,
   page, ad account. Retorna checklist com status de cada item.
   Body: { budget_daily, days } — opcional pra validar saldo vs. gasto estimado. */
router.post('/preflight', async (req, res) => {
  const { budget_daily, days } = req.body || {};
  const checks = [];
  try {
    /* 1. Meta conectado? */
    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) {
      checks.push({ key: 'connected', label: 'Meta conectado', ok: false, severity: 'error', details: 'Conecte o Meta em Investimento → Conectar Meta.' });
      return res.json({ ok_overall: false, checks });
    }
    checks.push({ key: 'connected', label: 'Meta conectado', ok: true });

    /* 2. needs_reconnect? */
    if (creds.needs_reconnect) {
      checks.push({ key: 'reconnect', label: 'Token válido', ok: false, severity: 'error', details: 'Token expirou — reconecte o Meta.' });
    } else {
      checks.push({ key: 'reconnect', label: 'Token válido', ok: true });
    }

    /* 3. account_id presente? */
    if (!creds.account_id) {
      checks.push({ key: 'account_id', label: 'Ad Account configurada', ok: false, severity: 'error', details: 'FB_AD_ACCOUNT_ID não foi preenchido no OAuth. Desconecte e reconecte.' });
    } else {
      checks.push({ key: 'account_id', label: 'Ad Account configurada', ok: true, details: creds.account_id });
    }

    /* 4. Page + IG Business? */
    if (!creds.page_id) {
      checks.push({ key: 'page', label: 'Página do Facebook', ok: false, severity: 'error', details: 'Nenhuma página vinculada.' });
    } else {
      checks.push({ key: 'page', label: 'Página do Facebook', ok: true, details: creds.page_id });
    }
    if (!creds.ig_business_id) {
      checks.push({ key: 'ig', label: 'Instagram Business', ok: false, severity: 'warn', details: 'IG Business não vinculado à página — anúncios de Mensagens IG Direct não vão rodar.' });
    } else {
      checks.push({ key: 'ig', label: 'Instagram Business', ok: true, details: creds.ig_business_id });
    }

    /* 5. Só segue se token+account estiverem OK (senão billing falha) */
    const canQueryMeta = !creds.needs_reconnect && creds.account_id;
    if (canQueryMeta) {
      try {
        const { decrypt } = require('../services/crypto');
        const token = String(creds.access_token).includes(':')
          ? (() => { try { return decrypt(creds.access_token); } catch { return creds.access_token; } })()
          : creds.access_token;
        const { metaGet } = require('../services/metaHttp');

        /* 5a. Ad account status + saldo */
        const acctInfo = await metaGet(`/${creds.account_id}`, {
          fields: 'balance,amount_spent,spend_cap,currency,account_status,name',
        }, { token });

        /* Meta account_status: 1=ACTIVE, 2=DISABLED, 3=UNSETTLED, 7=PENDING_RISK_REVIEW, 9=IN_GRACE_PERIOD, 101=CLOSED */
        if (acctInfo.account_status !== 1) {
          const statusNames = { 2: 'Desativada', 3: 'Pendência de pagamento', 7: 'Em análise de risco', 9: 'Em período de graça', 101: 'Encerrada' };
          checks.push({
            key: 'account_status',
            label: 'Conta Meta ativa',
            ok: false,
            severity: 'error',
            details: `Conta está em estado: ${statusNames[acctInfo.account_status] || acctInfo.account_status}. Verifique no Ads Manager.`,
          });
        } else {
          checks.push({ key: 'account_status', label: 'Conta Meta ativa', ok: true, details: acctInfo.name || creds.account_id });
        }

        /* 5b. Saldo suficiente pra duração desejada (cobre gasto estimado + folga 20%) */
        const toReal = (cents) => { const n = Number(cents); return Number.isFinite(n) ? n / 100 : 0; };
        const balance = toReal(acctInfo.balance);
        const amount_spent = toReal(acctInfo.amount_spent);
        const spend_cap = acctInfo.spend_cap != null ? toReal(acctInfo.spend_cap) : null;
        const available = spend_cap != null ? Math.max(0, spend_cap - amount_spent) : balance;

        if (budget_daily && days) {
          const estimatedSpend = Number(budget_daily) * Number(days);
          const needed = estimatedSpend * 1.2; /* 20% de folga */
          if (available < needed) {
            checks.push({
              key: 'balance',
              label: 'Saldo suficiente',
              ok: false,
              severity: 'error',
              details: `Disponível R$ ${available.toFixed(2)} — necessário ~R$ ${needed.toFixed(2)} (${days} dias × R$ ${budget_daily} + 20% folga).`,
              data: { available, needed, estimated: estimatedSpend, balance, spend_cap, amount_spent, currency: acctInfo.currency || 'BRL' },
            });
          } else {
            checks.push({
              key: 'balance',
              label: 'Saldo suficiente',
              ok: true,
              details: `Disponível R$ ${available.toFixed(2)} cobre os ${days} dias estimados.`,
              data: { available, needed, estimated: estimatedSpend, balance, spend_cap, amount_spent, currency: acctInfo.currency || 'BRL' },
            });
          }
        } else {
          checks.push({
            key: 'balance',
            label: 'Saldo disponível',
            ok: available > 0,
            severity: available > 0 ? 'info' : 'warn',
            details: `R$ ${available.toFixed(2)} disponível na conta.`,
            data: { available, balance, spend_cap, amount_spent, currency: acctInfo.currency || 'BRL' },
          });
        }
      } catch (e) {
        checks.push({
          key: 'meta_query',
          label: 'Consulta ao Meta',
          ok: false,
          severity: 'error',
          details: `Erro: ${e.message}${e.meta?.code ? ` (code ${e.meta.code})` : ''}`,
        });
      }
    }

    const ok_overall = checks.every(c => c.ok || c.severity === 'warn' || c.severity === 'info');
    return res.json({ ok_overall, checks });
  } catch (err) {
    console.error('[preflight]', err);
    return res.status(500).json({ error: err.message, checks });
  }
});

/* Atalho: diagnostica a ÚLTIMA campanha Meta criada (ordem de created_at).
   Útil pra conferir rapidamente se a publicação recente deu certo. */
router.get('/last/diagnose', async (req, res) => {
  try {
    const last = await db.query(
      `SELECT id FROM campaigns WHERE platform = 'meta' AND platform_campaign_id IS NOT NULL
       ORDER BY created_at DESC LIMIT 1`, []
    );
    const lastId = last.rows[0]?.id;
    if (!lastId) return res.status(404).json({ error: 'Nenhuma campanha Meta publicada encontrada' });
    req.params.id = lastId;
    /* Delega pro handler de diagnose existente */
    return diagnoseCampaign(req, res);
  } catch (err) {
    console.error('[last/diagnose]', err);
    return res.status(500).json({ error: err.message });
  }
});

/* Diagnóstico end-to-end de uma campanha: bate no Meta em tempo real e
   compara com o estado local. Retorna tudo num JSON único pra facilitar
   debug quando user vê algo estranho (campanha sumindo, status divergente,
   orçamento errado, etc). Read-only. */
async function diagnoseCampaign(req, res) {
  try {
    const local = await db.query('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    const camp = local.rows[0];
    if (!camp) return res.status(404).json({ error: 'Campanha não encontrada localmente' });

    const diag = {
      local: {
        id: camp.id,
        name: camp.name,
        platform_campaign_id: camp.platform_campaign_id,
        status: camp.status,
        budget: camp.budget,
        start_date: camp.start_date,
        end_date: camp.end_date,
        created_at: camp.created_at,
      },
      meta: null,
      meta_error: null,
      ads_manager_url: null,
      verdict: null,
    };

    if (!camp.platform_campaign_id) {
      diag.verdict = 'LOCAL_ONLY — campanha nunca chegou ao Meta (publicação falhou ou foi agendada).';
      return res.json(diag);
    }

    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) {
      diag.verdict = 'Meta não está conectado — impossível verificar estado remoto';
      return res.json(diag);
    }

    diag.ads_manager_url = `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${(creds.account_id || '').replace(/^act_/, '')}&selected_campaign_ids=${camp.platform_campaign_id}`;

    try {
      const { decrypt } = require('../services/crypto');
      const token = String(creds.access_token).includes(':')
        ? (() => { try { return decrypt(creds.access_token); } catch { return creds.access_token; } })()
        : creds.access_token;
      const { metaGet } = require('../services/metaHttp');

      const campaignInfo = await metaGet(`/${camp.platform_campaign_id}`, {
        fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time',
      }, { token });

      const adsetsInfo = await metaGet(`/${camp.platform_campaign_id}/adsets`, {
        fields: 'id,name,status,effective_status,optimization_goal,destination_type,daily_budget,targeting',
        limit: 10,
      }, { token });

      const adsInfo = await metaGet(`/${camp.platform_campaign_id}/ads`, {
        fields: 'id,name,status,effective_status,configured_status,issues_info,ad_review_feedback,recommendations,creative{id,status,effective_object_story_id,object_story_spec}',
        limit: 10,
      }, { token });

      diag.meta = {
        campaign: campaignInfo,
        adsets: adsetsInfo?.data || [],
        ads: adsInfo?.data || [],
      };

      /* Veredicto legível */
      const campStatus = campaignInfo?.status;
      const campEff = campaignInfo?.effective_status;
      const adEffs = (adsInfo?.data || []).map(a => a.effective_status);
      if (campStatus === 'PAUSED' && adEffs.every(s => s === 'PAUSED' || s === 'ADSET_PAUSED' || s === 'CAMPAIGN_PAUSED')) {
        diag.verdict = '✅ PRONTO pra dar play — Meta aprovou, campanha e ads em PAUSED aguardando ativação.';
      } else if (adEffs.some(s => String(s).includes('REVIEW'))) {
        diag.verdict = '⏳ EM REVISÃO no Meta — pode dar play, mas só começa a rodar quando Meta aprovar (≤24h).';
      } else if (adEffs.some(s => String(s).includes('DISAPPROVED'))) {
        diag.verdict = '❌ REPROVADO pelo Meta — ver recommendations de cada ad pra motivo.';
      } else {
        diag.verdict = `Status Meta: campaign=${campStatus}/${campEff}, ads=[${adEffs.join(', ')}]`;
      }
    } catch (metaErr) {
      diag.meta_error = {
        message: metaErr.message,
        code: metaErr.meta?.code || null,
        subcode: metaErr.meta?.subcode || null,
      };
      diag.verdict = 'Erro ao consultar Meta — ver meta_error pra detalhe';
    }

    return res.json(diag);
  } catch (err) {
    console.error('[diagnose]', err);
    return res.status(500).json({ error: err.message });
  }
}
router.get('/:id/diagnose', diagnoseCampaign);

/* AUDITORIA local↔Meta — compara campo a campo o que o usuário configurou
   no painel com o que o Meta REALMENTE recebeu. Detecta bugs de mapeamento
   (gênero invertido, bairros descartados, location_types divergente, etc).
   Criada em 2026-04-28 após bug do gênero invertido (campanha 435 rodando
   pra homens). Cada check retorna {field, local, meta, ok, severity}. */
router.get('/:id/audit', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    const c = result.rows[0];
    if (!c) return res.status(404).json({ error: 'Campanha não encontrada' });
    if (!c.platform_campaign_id) {
      return res.status(400).json({ error: 'Campanha não foi publicada no Meta ainda' });
    }
    let payload = {};
    try { payload = c.payload ? JSON.parse(c.payload) : {}; } catch {}

    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });
    const { refreshIfNeeded } = require('../services/metaToken');
    const token = await refreshIfNeeded(creds);

    const { metaGet } = require('../services/metaHttp');
    const adsetId = (payload?.metaPublishResult?.ad_sets?.[0]?.ad_set_id)
      || payload?.metaPublishResult?.ad_set_id
      || payload?.metaAdSetId;
    if (!adsetId) return res.status(400).json({ error: 'Ad set ID não encontrado no payload' });

    const adset = await metaGet(`/${adsetId}`, {
      fields: 'id,name,status,effective_status,targeting,daily_budget,lifetime_budget,end_time,start_time,optimization_goal,billing_event,bid_strategy,destination_type',
    }, { token });

    /* Pega também a campanha (objective, status) e o ad (CTA, destURL) */
    const campaignMeta = await metaGet(`/${c.platform_campaign_id}`, {
      fields: 'id,name,objective,status,effective_status,daily_budget,lifetime_budget,stop_time',
    }, { token });

    const adId = (payload?.metaPublishResult?.ads?.[0]?.ad_id) || payload?.metaPublishResult?.ad_id;
    let adMeta = null;
    if (adId) {
      try {
        adMeta = await metaGet(`/${adId}`, {
          fields: 'id,name,status,effective_status,creative{call_to_action_type,object_story_spec}',
        }, { token });
      } catch {} /* ad pode não existir ainda se publish falhou parcial */
    }

    const t = adset.targeting || {};
    const checks = [];

    /* GÊNERO — bug crítico já corrigido, mas valida sempre */
    const localGender = payload?.gender || c.gender;
    const expectedGenders = localGender === 'female' ? [2] : (localGender === 'male' ? [1] : []);
    const metaGenders = Array.isArray(t.genders) ? t.genders : [];
    checks.push({
      field: 'gender',
      local: localGender,
      meta: metaGenders,
      expected: expectedGenders,
      ok: JSON.stringify(metaGenders.sort()) === JSON.stringify(expectedGenders.sort()),
      severity: 'critical',
    });

    /* IDADE */
    checks.push({
      field: 'age_min',
      local: payload?.ageRange?.[0] || (Array.isArray(payload?.ageRange) ? payload.ageRange[0] : null),
      meta: t.age_min,
      ok: (payload?.ageRange?.[0] || null) === (t.age_min || null),
      severity: 'high',
    });
    checks.push({
      field: 'age_max',
      local: payload?.ageRange?.[1] || (Array.isArray(payload?.ageRange) ? payload.ageRange[1] : null),
      meta: t.age_max,
      ok: (payload?.ageRange?.[1] || null) === (t.age_max || null),
      severity: 'high',
    });

    /* BAIRROS — count + nomes */
    const localBairros = (payload?.locations || []).map(l => l.name).filter(Boolean);
    const metaBairrosCount = (t.geo_locations?.custom_locations || []).length;
    checks.push({
      field: 'bairros_count',
      local: localBairros.length,
      meta: metaBairrosCount,
      missing: localBairros.length - metaBairrosCount,
      ok: localBairros.length === metaBairrosCount,
      severity: 'critical',
    });

    /* INTERESSES — count (Meta pode ter descartado nomes não encontrados) */
    const localInterests = (payload?.interests || []);
    const metaInterestsCount = (t.flexible_spec?.[0]?.interests?.length) || (t.interests?.length) || 0;
    checks.push({
      field: 'interests_count',
      local: localInterests.length,
      meta: metaInterestsCount,
      dropped: localInterests.length - metaInterestsCount,
      ok: localInterests.length === metaInterestsCount,
      severity: 'high',
    });

    /* LOCATION_TYPES — home vs home+recent */
    const metaLocTypes = t.geo_locations?.location_types || [];
    checks.push({
      field: 'location_types',
      local: ['home'], /* sempre é o que enviamos depois do fix */
      meta: metaLocTypes,
      ok: JSON.stringify(metaLocTypes.sort()) === JSON.stringify(['home']),
      severity: 'medium',
      note: metaLocTypes.includes('recent') ? 'Meta aplicou default "recent" — refazer publicação ou editar manual' : null,
    });

    /* ORÇAMENTO DIÁRIO (em centavos no Meta, em reais local) */
    const localBudgetCents = Math.round(Number(c.budget) * 100);
    /* Quando CBO, daily_budget está na campaign; quando ABO, no adset */
    const metaBudgetCents = parseInt(adset.daily_budget || campaignMeta.daily_budget || 0, 10);
    checks.push({
      field: 'daily_budget',
      local: `R$ ${c.budget}`,
      meta: `R$ ${(metaBudgetCents / 100).toFixed(2)}`,
      ok: localBudgetCents === metaBudgetCents,
      severity: 'high',
    });

    /* OBJETIVO da campanha */
    const localObjective = payload?.objective || c.objective;
    const objectiveMap = {
      messages: 'OUTCOME_ENGAGEMENT', traffic: 'OUTCOME_TRAFFIC',
      engagement: 'OUTCOME_ENGAGEMENT', leads: 'OUTCOME_LEADS',
      sales: 'OUTCOME_SALES', awareness: 'OUTCOME_AWARENESS',
      brand_awareness: 'OUTCOME_AWARENESS', reach: 'OUTCOME_AWARENESS',
    };
    /* Para wa.me/ + messages há fallback automático pra OUTCOME_TRAFFIC */
    const isWaMeFallback = localObjective === 'messages' && (payload?.destUrl || '').includes('wa.me/');
    const expectedObjective = isWaMeFallback ? 'OUTCOME_TRAFFIC' : (objectiveMap[localObjective] || 'OUTCOME_TRAFFIC');
    checks.push({
      field: 'objective',
      local: localObjective + (isWaMeFallback ? ' (wa.me fallback)' : ''),
      meta: campaignMeta.objective,
      expected: expectedObjective,
      ok: campaignMeta.objective === expectedObjective,
      severity: 'critical',
    });

    /* OPTIMIZATION GOAL do adset */
    const expectedOptGoal = isWaMeFallback ? 'LINK_CLICKS' : (
      localObjective === 'messages' ? 'CONVERSATIONS' :
      localObjective === 'traffic' ? 'LINK_CLICKS' :
      localObjective === 'leads' ? 'LEAD_GENERATION' : null
    );
    if (expectedOptGoal) {
      checks.push({
        field: 'optimization_goal',
        local: expectedOptGoal,
        meta: adset.optimization_goal,
        ok: adset.optimization_goal === expectedOptGoal,
        severity: 'high',
      });
    }

    /* CTA e destination_type — só se ad foi puxado */
    if (adMeta?.creative) {
      const localCTA = (payload?.ctaButton || '').trim();
      const ctaMap = {
        'WhatsApp': 'WHATSAPP_MESSAGE', 'Saiba mais': 'LEARN_MORE',
        'Enviar mensagem': 'MESSAGE_PAGE', 'Mande uma mensagem': 'MESSAGE_PAGE',
        'Chamar agora': 'CALL_NOW',
      };
      /* Quando wa.me fallback ATIVO, sistema FORÇA LEARN_MORE intencionalmente
         (Meta rejeita WHATSAPP_MESSAGE com link wa.me direto). Esperado e
         documentado — não é bug. */
      const expectedCTA = isWaMeFallback ? 'LEARN_MORE' : (ctaMap[localCTA] || 'LEARN_MORE');
      const metaCTA = adMeta.creative?.call_to_action_type
        || adMeta.creative?.object_story_spec?.link_data?.call_to_action?.type
        || adMeta.creative?.object_story_spec?.video_data?.call_to_action?.type
        || null;
      checks.push({
        field: 'cta',
        local: localCTA + (isWaMeFallback ? ' (forçado LEARN_MORE pelo wa.me)' : ''),
        meta: metaCTA,
        expected: expectedCTA,
        ok: metaCTA === expectedCTA,
        severity: 'high',
        note: isWaMeFallback ? 'Meta exige LEARN_MORE quando link é wa.me/ — não é bug, é fallback intencional' : null,
      });

      const localLink = payload?.destUrl;
      const metaLink = adMeta.creative?.object_story_spec?.link_data?.call_to_action?.value?.link
        || adMeta.creative?.object_story_spec?.video_data?.call_to_action?.value?.link
        || adMeta.creative?.object_story_spec?.link_data?.link
        || null;
      checks.push({
        field: 'destination_url',
        local: localLink,
        meta: metaLink,
        ok: !!metaLink && !!localLink && metaLink === localLink,
        severity: 'critical',
      });
    }

    /* DATA FIM — extrair YYYY-MM-DD em fuso BR (-03:00), não UTC.
       Antes: Meta retorna 2026-05-06T02:59:59-0300 → toISOString → 2026-05-06.
       Mas em horário BR, isso é dia 05/05 23:59 (correto). Conversão UTC
       atrasava 1 dia falsamente. Fix: shift de -3h antes de fatiar. */
    const toBRDate = (s) => {
      if (!s) return null;
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return null;
      const brShifted = new Date(d.getTime() - 3 * 60 * 60 * 1000);
      return brShifted.toISOString().slice(0, 10);
    };
    const localEndDate = toBRDate(c.end_date);
    const metaEndDate = toBRDate(adset.end_time || campaignMeta.stop_time);
    checks.push({
      field: 'end_date',
      local: localEndDate,
      meta: metaEndDate,
      ok: localEndDate === metaEndDate,
      severity: 'high',
    });

    /* ADVANTAGE+ AUDIENCE — Rafa relatou que aparece como ATIVO mesmo
       enviando 0. Meta v22 usa targeting_as_signal (1=opted-in, 3=auto)
       em vez de só targeting_automation.advantage_audience.
       Se vier 1 ou 3, Meta forçou ativação independente do que enviamos. */
    const advAudience = t.targeting_automation?.advantage_audience;
    const targetingAsSignal = t.targeting_automation?.targeting_as_signal;
    checks.push({
      field: 'advantage_audience',
      local: 0, /* sempre enviamos 0 = desativado */
      meta: advAudience ?? 'undefined',
      targeting_as_signal: targetingAsSignal,
      ok: !advAudience && !targetingAsSignal,
      severity: 'medium',
      note: (advAudience || targetingAsSignal) ? 'Meta forçou Advantage+ — política nova v22, não há opt-out total. Avaliar impacto.' : null,
    });

    /* PUBLISHER PLATFORMS — Facebook e Instagram */
    const expectedPubs = ['facebook', 'instagram'];
    const metaPubs = (t.publisher_platforms || []).sort();
    checks.push({
      field: 'publisher_platforms',
      local: expectedPubs,
      meta: metaPubs,
      ok: JSON.stringify(metaPubs) === JSON.stringify(expectedPubs.sort()),
      severity: 'medium',
    });

    /* STATUS — campaign + adset + ad */
    checks.push({
      field: 'status_campaign',
      local: c.status,
      meta: campaignMeta.effective_status,
      ok: (c.status === 'active' && campaignMeta.effective_status === 'ACTIVE')
       || (c.status === 'paused' && /PAUSED/i.test(campaignMeta.effective_status))
       || (c.status === 'review'),
      severity: 'low',
      note: 'Status divergente é OK se campanha está em revisão Meta (PENDING_REVIEW)',
    });

    const failed = checks.filter(c => !c.ok);
    return res.json({
      campaign_id: c.id,
      meta_campaign_id: c.platform_campaign_id,
      ad_set_id: adsetId,
      audited_at: new Date().toISOString(),
      overall_ok: failed.length === 0,
      issues_count: failed.length,
      critical_issues: failed.filter(f => f.severity === 'critical').length,
      checks,
    });
  } catch (err) {
    console.error('[audit]', err);
    return res.status(500).json({ error: err.message, meta: err.meta || null });
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
