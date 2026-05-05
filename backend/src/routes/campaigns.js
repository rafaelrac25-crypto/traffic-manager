const router = require('express').Router();
const db = require('../db');
const { isMessagesViaWaLink } = require('../services/sync');

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
  /* Deriva results/costPerResult conforme o OBJETIVO da campanha — Meta usa
     métrica de "resultado" diferente por objective:
     - OUTCOME_TRAFFIC      → link_clicks (cliques no link)
     - OUTCOME_AWARENESS    → reach (alcance)
     - OUTCOME_ENGAGEMENT   → conversions (mensagens iniciadas, se goal=CONVERSATIONS)
     - OUTCOME_LEADS / SALES / APP_PROMOTION → conversions
     - default              → conversions

     Antes só usava conversions — campanhas de Tráfego ficavam com costPerResult=null
     mesmo tendo cliques (caso da 437 "Adeus cravos"). */
  const objective = out.objective || out?.meta?.campaign?.objective || null;
  const spent = Number(out.spent);
  let resultsValue = null;

  if (objective === 'OUTCOME_TRAFFIC') {
    const lc = Number(out.link_clicks);
    if (Number.isFinite(lc) && lc > 0) resultsValue = lc;
  } else if (objective === 'OUTCOME_AWARENESS') {
    const r = Number(out.reach);
    if (Number.isFinite(r) && r > 0) resultsValue = r;
  } else {
    const conv = Number(out.conversions);
    if (Number.isFinite(conv) && conv > 0) resultsValue = conv;
  }

  /* Fallback: se objetivo não bateu mas tem conversions > 0, usa */
  if (resultsValue == null) {
    const conv = Number(out.conversions);
    if (Number.isFinite(conv) && conv > 0) resultsValue = conv;
  }

  if (resultsValue != null && resultsValue > 0) {
    out.results = resultsValue;
    if (Number.isFinite(spent) && spent > 0) {
      out.costPerResult = Number((spent / resultsValue).toFixed(2));
    }
  }

  /* Métrica adicional pra campanhas de Mensagens (link wa.me, IG Direct):
     mostra mensagens iniciadas mesmo quando o objective é OUTCOME_TRAFFIC
     mas a Cris está usando link de WhatsApp/messaging.

     Heurística: se há `conversions > 0` E destUrl aponta pra wa.me/whatsapp,
     considera "mensagens iniciadas". Isso permite ver os 2 lados (cliques
     + mensagens) na mesma campanha de tráfego com link WA. */
  const conv = Number(out.conversions);
  if (Number.isFinite(conv) && conv > 0) {
    const link = String(out.destUrl || out?.creative?.object_story_spec?.link_data?.link || out?.creative?.object_story_spec?.video_data?.call_to_action?.value?.link || '');
    const isMessagingLink = /wa\.me\/|api\.whatsapp\.com|whatsapp\.com\/|m\.me\/|instagram\.com\/direct/i.test(link);
    /* Se link é messaging OU objective é Mensagens, exibe a métrica */
    const isMessagingObjective = objective === 'OUTCOME_LEADS' || objective === 'OUTCOME_ENGAGEMENT';
    if (isMessagingLink || isMessagingObjective) {
      out.messagesStarted = conv;
      if (Number.isFinite(spent) && spent > 0) {
        out.costPerMessage = Number((spent / conv).toFixed(2));
      }
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
  const isDraft = mode === 'draft';
  /* publishCampaign cria os 3 níveis (campaign+adset+ad) PAUSED no Meta por
     segurança. Status local reflete isso: 'paused' até user clicar play (que
     cascata pra ACTIVE nos 3 níveis via updateCampaignStatus).
     mode='draft' = só salva local (zero chamada Meta) pra Rafa publicar depois. */
  let status = statusIn || (isDraft ? 'draft' : isImmediate ? 'paused' : 'scheduled');
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
      /* Recursos criados PAUSED no Meta — local reflete o real até o user
         clicar play (cascata em metaWrite.updateCampaignStatus ativa os 3). */
      status = 'paused';
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

    let cascadeSummary = null;
    if (row.platform === 'meta' && row.platform_campaign_id && (status === 'active' || status === 'paused' || status === 'ended')) {
      const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
      const creds = credResult.rows[0];
      if (!creds) return res.status(400).json({ error: 'Meta não está conectado' });
      try {
        const { updateCampaignStatus, request: metaRequestRaw, getToken } = require('../services/metaWrite');
        const metaStatus = status === 'ended' ? 'paused' : status;
        const metaResult = await updateCampaignStatus(creds, row.platform_campaign_id, metaStatus);
        cascadeSummary = metaResult?.cascade_summary || null;

        /* Se ATIVOU e a campanha tem ads duplicados (history em payload.duplicated_ads),
           re-pausa os old_ad_ids — cascade ativou TODOS os ads do adset, mas só o
           ad_id atual (em metaPublishResult.ad_id) deve rodar. Os antigos ficam
           preservados (pra histórico) mas PAUSED. Sem isso, ads antigos com wa.me
           vazio voltariam a entregar junto com o novo, anulando a melhoria. */
        if (metaStatus === 'active') {
          const fullCamp = await db.query('SELECT payload FROM campaigns WHERE id = ?', [req.params.id]);
          let camPayload = fullCamp.rows[0]?.payload;
          if (typeof camPayload === 'string') {
            try { camPayload = JSON.parse(camPayload); } catch { camPayload = null; }
          }
          const duplicatedAds = camPayload?.duplicated_ads || [];
          const currentAdId = camPayload?.metaPublishResult?.ad_id;
          if (duplicatedAds.length > 0 && currentAdId) {
            const oldAdIds = new Set();
            duplicatedAds.forEach(d => {
              if (d.old_ad_id && d.old_ad_id !== currentAdId) oldAdIds.add(d.old_ad_id);
              if (d.new_ad_id && d.new_ad_id !== currentAdId) oldAdIds.add(d.new_ad_id);
            });
            if (oldAdIds.size > 0) {
              const token = getToken(creds);
              const repaused = [];
              for (const oldId of oldAdIds) {
                try {
                  await metaRequestRaw('POST', `/${oldId}`, { status: 'PAUSED' }, { token });
                  repaused.push(oldId);
                } catch (e) {
                  console.warn('[status] re-pause old_ad', oldId, e.message);
                }
              }
              if (cascadeSummary) cascadeSummary.old_ads_repaused = repaused;
            }
          }
        }
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
    await log('status_change', 'campaign', camp.id, `Campanha "${camp.name}" — ${statusLabels[status] || status}`, { status, cascade_summary: cascadeSummary });
    /* Inclui cascade_summary na resposta — frontend pode mostrar
       "X conjuntos e Y anúncios atualizados" + falhas se houver. */
    res.json({ ...camp, cascade_summary: cascadeSummary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar status' });
  }
});

/* Auto-heal cascata: percorre todas as campanhas Meta e força a cascata
   ACTIVE/PAUSED conforme status local. Útil pra:
   - Diagnosticar/corrigir mismatches em massa (caso 437: campaign ACTIVE
     mas adset/ad PAUSED)
   - Garantir consistência após bug, deploy ou edição manual no Meta UI
   - Botão "verificar tudo" no painel
   Best-effort: 1 falha não bloqueia o resto. Retorna resumo por campanha. */
router.post('/cascade-heal', async (req, res) => {
  try {
    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) return res.status(400).json({ error: 'Meta não está conectado' });

    const camps = await db.query(
      `SELECT id, name, platform_campaign_id, status FROM campaigns
        WHERE platform = 'meta' AND platform_campaign_id IS NOT NULL
          AND status IN ('active','paused')`,
      []
    );
    const { updateCampaignStatus } = require('../services/metaWrite');
    const report = [];
    for (const c of camps.rows) {
      try {
        const r = await updateCampaignStatus(creds, c.platform_campaign_id, c.status);
        report.push({
          id: c.id,
          name: c.name,
          target_status: c.status,
          ok: true,
          summary: r?.cascade_summary || null,
        });
      } catch (e) {
        report.push({
          id: c.id,
          name: c.name,
          target_status: c.status,
          ok: false,
          error: e?.meta?.pt || e.message,
        });
      }
    }
    res.json({ healed: report.length, report });
  } catch (err) {
    console.error('[cascade-heal]', err);
    res.status(500).json({ error: err.message });
  }
});

/* Duplica o anúncio dentro do adset existente, com mensagem WhatsApp pré-preenchida
   no destUrl. Cria novo creative+ad PAUSED, mantém antigo intacto (preserva
   métricas históricas). Caller pausa antigo e ativa novo após Meta aprovar.

   Body: { whatsappMessage: 'Oi Cris, vim pelo Instagram, quero saber sobre X',
           ctaLabel?: 'Saiba mais' | 'WhatsApp' (default: mantém o atual) }

   Retorna: { new_ad_id, new_creative_id, new_destUrl, requires_review }

   Pré-condições verificadas:
   - Campanha tem platform_campaign_id, ad_id, ad_set_id, creative_id no payload
   - destUrl base é wa.me/ (sistema só monta ?text= pra wa.me)
   - Se ctaLabel='WhatsApp' E Page não tem WA Business linkado, força LEARN_MORE
     (sistema protege contra erro 1487891 do Meta) */
router.post('/:id/duplicate-ad', async (req, res) => {
  const { whatsappMessage, ctaLabel } = req.body || {};
  try {
    const result = await db.query('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    const camp = result.rows[0];
    if (!camp) return res.status(404).json({ error: 'Campanha não encontrada' });
    if (camp.platform !== 'meta' || !camp.platform_campaign_id) {
      return res.status(400).json({ error: 'Apenas campanhas Meta publicadas podem ser duplicadas' });
    }

    let payload = camp.payload;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { payload = null; }
    }
    if (!payload) return res.status(400).json({ error: 'Payload da campanha ausente' });

    const adAccountId = payload?.metaAccountId
      || (camp.platform_campaign_id ? null : null);
    const adSetId = payload?.metaPublishResult?.ad_set_id
      || payload?.metaPublishResult?.ad_sets?.[0]?.ad_set_id;
    const adId = payload?.metaPublishResult?.ad_id
      || payload?.metaPublishResult?.ad_sets?.[0]?.ad_id;
    const creativeId = payload?.metaPublishResult?.creative_id;

    /* metaAccountId no payload guarda o ID da Page (legado) — pra Meta API
       o adAccountId real vem das credenciais (act_X). Usar creds. */
    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });
    const realAdAccountId = creds.account_id || creds.ad_account_id || adAccountId;

    if (!realAdAccountId) return res.status(400).json({ error: 'ad_account_id ausente nas credenciais' });
    if (!adSetId)   return res.status(400).json({ error: 'ad_set_id ausente no payload (campanha não foi publicada?)' });
    if (!adId)      return res.status(400).json({ error: 'ad_id ausente no payload' });
    if (!creativeId) return res.status(400).json({ error: 'creative_id ausente no payload' });

    /* Monta novo destUrl com ?text= se for wa.me/ */
    const baseLink = payload?.destUrl || '';
    const isWaMe = /(wa\.me\/|api\.whatsapp\.com|whatsapp\.com\/)/i.test(baseLink);
    let newLink = baseLink;
    if (isWaMe && whatsappMessage) {
      /* Limpa querystring antiga e adiciona text= encoded */
      const u = new URL(baseLink);
      u.searchParams.set('text', String(whatsappMessage));
      newLink = u.toString();
    }

    /* Decide ctaType:
       - Se ctaLabel='WhatsApp', tenta WHATSAPP_MESSAGE; mas Meta REJEITA se Page
         não tem WhatsApp Business linkado. Pra evitar falha em runtime, verifica
         antes via diagnose-page (já existe no projeto) E só envia WHATSAPP_MESSAGE
         se can_run_click_to_whatsapp=true. Caso contrário força LEARN_MORE.
       - Default: mantém LEARN_MORE (universal, aceita link). */
    let ctaType = 'LEARN_MORE';
    if (ctaLabel === 'WhatsApp' || ctaLabel === 'WHATSAPP_MESSAGE') {
      try {
        const { metaGet } = require('../services/metaHttp');
        const { safeDecrypt } = require('../services/crypto');
        const token = safeDecrypt(creds.access_token, 'duplicate-ad');
        const pageId = creds.page_id;
        if (pageId) {
          const pageInfo = await metaGet(`/${pageId}`, { fields: 'whatsapp_number' }, { token });
          if (pageInfo?.whatsapp_number) {
            ctaType = 'WHATSAPP_MESSAGE';
            newLink = null; /* WA Business puxa da Page */
          } else {
            console.warn('[duplicate-ad] Page sem WhatsApp Business — forçando LEARN_MORE em vez de WHATSAPP_MESSAGE');
          }
        }
      } catch (e) {
        console.warn('[duplicate-ad] erro ao verificar WA Business:', e.message);
      }
    }

    const overrides = { ctaType };
    if (newLink !== null) overrides.link = newLink;

    const { duplicateAdInAdSet } = require('../services/metaWrite');
    let dupResult;
    try {
      dupResult = await duplicateAdInAdSet(creds, {
        adAccountId:        realAdAccountId,
        platformAdSetId:    adSetId,
        platformAdId:       adId,
        platformCreativeId: creativeId,
        overrides,
      });
    } catch (e) {
      console.error('[duplicate-ad] Meta erro:', e.message, e.meta);
      return res.status(502).json({
        error: `Meta recusou: ${e.message}`,
        meta_error: e.meta || null,
      });
    }

    /* Atualiza payload local: registra novo ad_id e new destUrl pra UI refletir.
       Mantém o ad antigo no histórico (não sobrescreve metaPublishResult.ad_id;
       acrescenta um campo `duplicated_ads` com cronologia). */
    const updatedPayload = { ...payload };
    updatedPayload.destUrl = newLink || baseLink;
    if (whatsappMessage) updatedPayload.whatsappMessage = whatsappMessage;
    if (ctaLabel) updatedPayload.ctaButton = ctaLabel;
    updatedPayload.duplicated_ads = [
      ...(payload.duplicated_ads || []),
      {
        old_ad_id:        adId,
        old_creative_id:  creativeId,
        new_ad_id:        dupResult.new_ad_id,
        new_creative_id:  dupResult.new_creative_id,
        new_destUrl:      newLink,
        cta_type:         ctaType,
        duplicated_at:    new Date().toISOString(),
      },
    ];
    /* Aponta metaPublishResult pro ad NOVO (será o ativo após review) */
    updatedPayload.metaPublishResult = {
      ...(payload.metaPublishResult || {}),
      ad_id:        dupResult.new_ad_id,
      creative_id:  dupResult.new_creative_id,
      ad_sets: (payload.metaPublishResult?.ad_sets || []).map(as =>
        as.ad_set_id === adSetId
          ? { ...as, ad_id: dupResult.new_ad_id }
          : as
      ),
    };

    await db.query(
      'UPDATE campaigns SET payload = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [JSON.stringify(updatedPayload), req.params.id]
    );

    await log('duplicate_ad', 'campaign', parseInt(req.params.id),
      `Anúncio duplicado com mensagem WhatsApp pré-preenchida`, {
        old_ad_id:       dupResult.old_ad_id,
        new_ad_id:       dupResult.new_ad_id,
        new_creative_id: dupResult.new_creative_id,
        cta_type:        ctaType,
        message:         whatsappMessage || null,
      });

    res.json({
      ok: true,
      new_ad_id:        dupResult.new_ad_id,
      new_creative_id:  dupResult.new_creative_id,
      new_destUrl:      newLink,
      cta_type:         ctaType,
      requires_review:  true,
      note: 'Ad novo criado PAUSED. Após Meta aprovar (effective_status sair de PENDING_REVIEW), pode ativar via PATCH /status. Ad antigo continua intacto pra histórico.',
    });
  } catch (err) {
    console.error('[duplicate-ad]', err);
    res.status(500).json({ error: err.message });
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
      `SELECT id, platform_campaign_id, status, effective_status, spent, clicks, link_clicks,
              impressions, conversions, payload
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
      /* Sempre persiste — campos voláteis (ads[] effective_status, freq, ctr,
         issues_info) precisam estar atualizados mesmo em campanha zerada (caso
         camp 437: zero entrega mas status do ad mudando entre PAUSED→PENDING_REVIEW
         →ACTIVE conforme user mexe no Meta direto). 1 write a cada 90s por
         campanha é trivial — ganho de observabilidade vale o churn. */

      /* Nunca regride métricas — se Meta retorna 0 por delay/erro temporário,
         preservamos o valor anterior bom (compat SQLite+Postgres via JS max). */
      const keepMax = (metaVal, localVal) => {
        const a = Number(metaVal) || 0;
        const b = Number(localVal) || 0;
        return a >= b ? a : b;
      };
      const nextSpent       = keepMax(r.spent,       local.spent);
      const nextClicks      = keepMax(r.clicks,      local.clicks);
      const nextLinkClicks  = keepMax(r.link_clicks, local.link_clicks);
      const nextImpressions = keepMax(r.impressions, local.impressions);

      /* prevPayload precisa estar disponível antes do mapping de conversions
         (isMessagesViaWaLink lê destUrl do payload). Parse aqui em vez de
         no merge volátil mais abaixo. */
      let prevPayload = {};
      try {
        prevPayload = local.payload
          ? (typeof local.payload === 'string' ? JSON.parse(local.payload) : local.payload)
          : {};
      } catch { prevPayload = {}; }

      /* Mesma lógica de mapping do syncPlatform completo — sem isso, o polling
         90s sobrescreve o valor mapeado com 0 (Meta não retorna conversions
         pra OUTCOME_TRAFFIC + wa.me sem WhatsApp Business linkado).
         Proxy correto = link_clicks (inline), não clicks total.

         Importante: pra campanha wa.me/ SEM WA Business, sempre preferimos
         linkClicksProxy mesmo se Meta retornar rConversions > 0. Sem o
         tracking formal, qualquer conversion > 0 vinda do Meta é ruído de
         outro action_type (lead/registration aleatório), não mensagem real.
         Quando Cris cadastrar WA Business, este branch precisa rever — aí
         rConversions vira mensagens reais e deveria ser preferido. */
      const rConversions = Number(r.conversions) || 0;
      const linkClicksProxy = Number(r.link_clicks) || Number(r.clicks) || 0;
      const isWaMeMapping = isMessagesViaWaLink(r.objective, prevPayload);
      let nextConversions;
      if (isWaMeMapping && linkClicksProxy > 0) {
        nextConversions = keepMax(linkClicksProxy, local.conversions);
      } else {
        nextConversions = keepMax(rConversions, local.conversions);
      }
      const wasMappedFromClicks = (isWaMeMapping && linkClicksProxy > 0);
      const nextPayload = {
        ...prevPayload,
        reach: r.reach ?? prevPayload.reach,
        ctr: r.ctr ?? prevPayload.ctr,
        cpc: r.cpc ?? prevPayload.cpc,
        cpm: r.cpm ?? prevPayload.cpm,
        frequency: r.frequency ?? prevPayload.frequency,
        effective_status: r.effective_status ?? prevPayload.effective_status,
        ads: Array.isArray(r.ads) ? r.ads : prevPayload.ads,
        synced_at: new Date().toISOString(),
        conversions_mapped_from_clicks: wasMappedFromClicks || undefined,
      };
      /* Atualiza status reais do adset/ad dentro de payload.meta pra
         frontend exibir sem confiar no snapshot do publish (que mente
         depois que user ativa via Meta Ads Manager direto). */
      if (prevPayload.meta && Array.isArray(r.ads) && r.ads.length > 0) {
        const worstAdStatus = r.ads.find(a => a.effective_status === 'DISAPPROVED')?.effective_status
          || r.ads.find(a => a.effective_status === 'WITH_ISSUES')?.effective_status
          || r.ads.find(a => a.effective_status === 'PENDING_REVIEW')?.effective_status
          || r.ads[0].effective_status;
        nextPayload.meta = {
          ...prevPayload.meta,
          campaign: prevPayload.meta.campaign ? {
            ...prevPayload.meta.campaign,
            status: r.raw?.status || prevPayload.meta.campaign.status,
            effective_status: r.effective_status || prevPayload.meta.campaign.effective_status,
          } : prevPayload.meta.campaign,
          ad: prevPayload.meta.ad ? {
            ...prevPayload.meta.ad,
            status: r.ads[0].status || prevPayload.meta.ad.status,
            effective_status: worstAdStatus,
            issues_info: r.ads[0].issues_info || null,
          } : prevPayload.meta.ad,
        };
      }

      await db.query(
        `UPDATE campaigns SET
           status = COALESCE(?, status),
           effective_status = COALESCE(?, effective_status),
           spent = ?, clicks = ?, link_clicks = ?, impressions = ?, conversions = ?,
           payload = ?,
           updated_at = datetime('now')
         WHERE id = ?`,
        [r.status || null, r.effective_status || null,
         nextSpent, nextClicks, nextLinkClicks, nextImpressions, nextConversions,
         JSON.stringify(nextPayload), local.id]
      );

      /* Detecta transição pra DISAPPROVED/WITH_ISSUES e registra no
         activity_log — frontend lê isso e dispara sino + notificação.
         Evita repetir incidente camp 437 em que ad ficou pausado/com
         erro 8h sem ninguém saber. Best-effort, não bloqueia sync. */
      try {
        const prevAds = Array.isArray(prevPayload.ads) ? prevPayload.ads : [];
        const newBadAds = (r.ads || []).filter(ad => {
          const wasBad = prevAds.find(p => p.id === ad.id)?.effective_status;
          const isBad = ad.effective_status === 'DISAPPROVED' || ad.effective_status === 'WITH_ISSUES';
          const wasNotBad = wasBad !== 'DISAPPROVED' && wasBad !== 'WITH_ISSUES';
          return isBad && wasNotBad;
        });
        for (const ad of newBadAds) {
          const reason = (ad.issues_info && ad.issues_info[0]?.error_message)
            || (ad.ad_review_feedback ? JSON.stringify(ad.ad_review_feedback) : null)
            || `Ad ${ad.effective_status === 'DISAPPROVED' ? 'reprovado' : 'com problemas'} pelo Meta`;
          await db.query(
            `INSERT INTO activity_log (action, entity, entity_id, description, meta, created_at)
             VALUES (?, ?, ?, ?, ?, datetime('now'))`,
            [
              ad.effective_status === 'DISAPPROVED' ? 'ad_disapproved' : 'ad_with_issues',
              'campaign',
              local.id,
              `${r.name}: ${reason}`,
              JSON.stringify({ ad_id: ad.id, status: ad.effective_status, issues: ad.issues_info, feedback: ad.ad_review_feedback }),
            ]
          );
        }
      } catch (logErr) {
        console.warn('[sync-meta-status] activity_log falhou:', logErr.message);
      }

      updated.push({
        id: local.id,
        platform_campaign_id: local.platform_campaign_id,
        status: r.status,
        effective_status: r.effective_status,
        spent: nextSpent, clicks: nextClicks, link_clicks: nextLinkClicks,
        impressions: nextImpressions, conversions: nextConversions,
        reach: r.reach, ctr: r.ctr, cpc: r.cpc, cpm: r.cpm, frequency: r.frequency,
        ads: r.ads || [],
        conversions_mapped_from_clicks: wasMappedFromClicks || undefined,
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

/* Insights agregados por BAIRRO filtrados por SERVIÇO.
   Query param: ?service=<id> (ex: micro-sobrancelha)
   Estratégia: filtra campanhas cujo payload.service === id e agrega métricas
   por bairro entre elas. Se não houver dado suficiente (< 3 conversões por
   bairro ou < 5 campanhas com esse serviço), retorna enough_data: false.

   NOTA: este endpoint é um stub inteligente na fase atual.
   O campo `service` começa a ser gravado no payload a partir desta versão.
   Campanhas antigas não têm — então o fallback devolve dados globais de
   districts quando o filtro por serviço não retornar nada. Assim a UI
   nunca quebra. */
router.get('/analytics/insights-by-service', async (req, res) => {
  try {
    const service = (req.query.service || '').trim();
    if (!service) {
      return res.status(400).json({ error: 'Parâmetro service obrigatório', enough_data: false });
    }

    const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    /* PARTE 1: tenta dado real de insights_by_district filtrado por campanha
       que tenha payload.service === service. */
    let realRows = [];
    try {
      /* Busca IDs de campanhas com o serviço (campo service no payload JSON).
         Funciona tanto em SQLite (json_extract) quanto em PostgreSQL (->>) */
      const campQuery = await db.query(
        `SELECT id FROM campaigns
          WHERE (payload->>'service' = ? OR json_extract(payload, '$.service') = ?)`,
        [service, service]
      );
      const campIds = (campQuery.rows || []).map(r => r.id);

      if (campIds.length > 0) {
        const placeholders = campIds.map(() => '?').join(',');
        const q = await db.query(
          `SELECT district,
                  SUM(spend) AS spend,
                  SUM(clicks) AS clicks,
                  SUM(impressions) AS impressions,
                  SUM(conversions) AS conversions,
                  COUNT(DISTINCT ad_set_id) AS ad_count
             FROM insights_by_district
            WHERE campaign_id IN (${placeholders})
              AND date_start >= ?
            GROUP BY district
           HAVING SUM(spend) > 0 OR SUM(conversions) > 0`,
          [...campIds, sinceIso]
        );
        realRows = q.rows || [];
      }
    } catch (e) {
      /* insights_by_district pode não ter coluna campaign_id em ambientes antigos */
      console.warn('[insights-by-service] query real falhou:', e.message);
    }

    /* PARTE 2: fallback — pega todos os districts (sem filtro de serviço) se
       dados específicos do serviço forem insuficientes. A flag enough_data
       indica ao frontend se pode confiar na recomendação. */
    let usedFallback = false;
    if (realRows.length === 0) {
      try {
        const campQuery = await db.query(
          `SELECT id, spent, clicks, impressions, conversions, payload
             FROM campaigns
            WHERE platform = 'meta' AND platform_campaign_id IS NOT NULL`, []
        );
        /* Tenta filtrar por serviço; se não encontrar nenhuma, usa todas */
        let filtered = (campQuery.rows || []).filter(c => {
          try {
            const p = c.payload ? JSON.parse(c.payload) : {};
            return p.service === service;
          } catch { return false; }
        });
        if (filtered.length === 0) {
          filtered = campQuery.rows || [];
          usedFallback = true;
        }
        const byDistrict = {};
        for (const c of filtered) {
          let payload = {};
          try { payload = c.payload ? JSON.parse(c.payload) : {}; } catch {}
          const locations = payload?.locations || [];
          const districtNames = (Array.isArray(locations) ? locations : [])
            .map(l => l?.name).filter(Boolean);
          if (districtNames.length === 0) continue;
          const share = 1 / districtNames.length;
          districtNames.forEach(name => {
            if (!byDistrict[name]) byDistrict[name] = { district: name, spend: 0, clicks: 0, impressions: 0, conversions: 0, adCount: 0 };
            byDistrict[name].spend       += Number(c.spent || 0) * share;
            byDistrict[name].clicks      += Number(c.clicks || 0) * share;
            byDistrict[name].impressions += Number(c.impressions || 0) * share;
            byDistrict[name].conversions += Number(c.conversions || 0) * share;
            byDistrict[name].adCount++;
          });
        }
        realRows = Object.values(byDistrict).map(b => ({
          district: b.district,
          spend: b.spend, clicks: b.clicks, impressions: b.impressions,
          conversions: b.conversions, ad_count: b.adCount,
        }));
      } catch (e) {
        console.warn('[insights-by-service] fallback falhou:', e.message);
      }
    }

    if (realRows.length === 0) {
      return res.json({ districts: [], avgCPR: null, totalConv: 0, totalSpend: 0, dataQuality: 'insufficient', enough_data: false, service, _diagnostics: { source: 'none', reason: 'sem dados' } });
    }

    const result = realRows.map(r => {
      const spend = Number(r.spend || 0);
      const conversions = Number(r.conversions || 0);
      const clicks = Number(r.clicks || 0);
      return {
        district: r.district,
        spend: Number(spend.toFixed(2)),
        clicks: Math.round(clicks),
        conversions: Math.round(conversions),
        cpr: conversions > 0 ? Number((spend / conversions).toFixed(2)) : null,
        cpc: clicks > 0 ? Number((spend / clicks).toFixed(2)) : null,
      };
    }).sort((a, b) => {
      if (a.cpr == null && b.cpr == null) return 0;
      if (a.cpr == null) return 1;
      if (b.cpr == null) return -1;
      return a.cpr - b.cpr;
    });

    const totalConv = result.reduce((s, r) => s + r.conversions, 0);
    const totalSpend = result.reduce((s, r) => s + r.spend, 0);
    const avgCPR = totalConv > 0 ? Number((totalSpend / totalConv).toFixed(2)) : null;
    /* enough_data: true somente quando não houve fallback E há conversões suficientes */
    const enoughData = !usedFallback && totalConv >= 10 && result.length >= 2;

    return res.json({
      districts: result,
      avgCPR,
      totalConv,
      totalSpend: Number(totalSpend.toFixed(2)),
      dataQuality: enoughData ? 'usable' : 'insufficient',
      enough_data: enoughData,
      service,
      _diagnostics: {
        source: usedFallback ? 'fallback_all_campaigns' : 'service_filtered',
        window_days: 30,
        since: sinceIso,
        rows_found: realRows.length,
      },
    });
  } catch (err) {
    console.error('[analytics/insights-by-service]', err);
    res.status(500).json({ error: err.message, enough_data: false });
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

    /* DATA FIM — comparação correta entre local (date-only) vs Meta (ISO+TZ).
       Local vem como "2026-05-05" do DB → extrair primeiros 10 chars sem shift.
       Meta vem como "2026-05-06T02:59:59-0300" (= 23:59 BR do dia 05/05) →
       precisa converter explicitamente pro fuso BR pra extrair "2026-05-05".
       Bug anterior: aplicava shift -3h em ambos, atrasando local 1 dia falsamente. */
    const toBRDate = (s) => {
      if (!s) return null;
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return null;
      /* GMT-3 fixo. Intl.DateTimeFormat retorna components no fuso especificado. */
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(d); /* "2026-05-05" formato en-CA = YYYY-MM-DD */
      return parts;
    };
    /* c.end_date pode vir como string ISO ("2026-05-05") em SQLite OU como
       Date object no Postgres (DATE column → driver Neon devolve midnight UTC).
       Date objects de campo DATE precisam ser lidos em UTC, NÃO em fuso BR
       (BR atrasa 3h e troca pro dia anterior). */
    const toUTCDateOnly = (d) => {
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };
    const localEndDate = c.end_date instanceof Date
      ? toUTCDateOnly(c.end_date)
      : (c.end_date ? String(c.end_date).slice(0, 10) : null);
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

/* ============================================================
   ENDPOINTS V2 — Hierarquia 3-níveis (Campanha → Conjunto → Anúncio)
   Separados dos endpoints originais por segurança. Tudo somente
   adiciona — endpoints existentes permanecem intactos.
   ============================================================ */

/* Lê adsets + ads de uma campanha direto do Meta (não usa cache local).
   Pra UI hierárquica desenhar a árvore Campanha→Conjunto→Anúncio sem
   depender do payload local (que pode estar desatualizado).

   Retorna {
     campaign: {id, name, status, effective_status, daily_budget, lifetime_budget},
     adsets: [{id, name, status, effective_status, daily_budget, targeting, ads:[...]}],
   } */
router.get('/:id/hierarchy', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    const camp = result.rows[0];
    if (!camp) return res.status(404).json({ error: 'Campanha não encontrada' });
    if (camp.platform !== 'meta' || !camp.platform_campaign_id) {
      return res.status(400).json({ error: 'Apenas campanhas Meta publicadas têm hierarquia' });
    }

    const safeFloat = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
    const safeInt   = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; };

    /* ── 1. Tentar servir do banco (cache) ─────────────────────────── */
    const adsetsDbResult = await db.query(
      `SELECT * FROM ad_sets WHERE campaign_id = ? ORDER BY id ASC`,
      [camp.id]
    );
    const fromCache = adsetsDbResult.rows.length > 0;

    if (fromCache) {
      /* Monta estrutura a partir do banco */
      const adsetRows = adsetsDbResult.rows;

      /* Max updated_at dos ad_sets como proxy de synced_at */
      let syncedAt = null;
      for (const as of adsetRows) {
        const ts = as.updated_at || as.created_at;
        if (ts && (!syncedAt || ts > syncedAt)) syncedAt = ts;
      }

      const adsets = [];
      for (const as of adsetRows) {
        /* ads do adset */
        const adsResult = await db.query(
          `SELECT * FROM ads WHERE ad_set_id = ? ORDER BY id ASC`,
          [as.id]
        );
        const adsWithInsights = [];
        for (const ad of adsResult.rows) {
          /* insight mais recente para o ad */
          const insResult = await db.query(
            `SELECT * FROM insights WHERE ad_id = ? ORDER BY date_stop DESC, fetched_at DESC LIMIT 1`,
            [ad.id]
          );
          const ins = insResult.rows[0] || null;

          /* Extrai link_clicks e messages do campo raw (JSON) */
          let link_clicks = 0;
          let messages    = 0;
          if (ins?.raw) {
            try {
              const raw = typeof ins.raw === 'string' ? JSON.parse(ins.raw) : ins.raw;
              const actions = Array.isArray(raw.actions) ? raw.actions : [];
              link_clicks = safeInt(
                actions.find(a => a.action_type === 'link_click')?.value
              );
              messages = safeInt(
                actions.find(a =>
                  /messaging_conversation_started|onsite_conversion\.messaging_first_reply|onsite_conversion\.total_messaging_connection/.test(a.action_type)
                )?.value
              );
              /* Atualiza syncedAt com fetched_at do insight se mais recente */
              if (ins.fetched_at && (!syncedAt || ins.fetched_at > syncedAt)) {
                syncedAt = ins.fetched_at;
              }
            } catch { /* raw corrompido — ignora */ }
          }

          adsWithInsights.push({
            id:               ad.platform_ad_id,
            local_id:         ad.id,
            name:             ad.name,
            status:           ad.status,
            effective_status: ad.effective_status,
            creative_id:      null,
            creative_name:    null,
            created_time:     ad.created_at,
            insights: ins ? {
              spend:       safeFloat(ins.spend),
              clicks:      safeInt(ins.clicks),
              link_clicks,
              impressions: safeInt(ins.impressions),
              reach:       safeInt(ins.reach),
              ctr:         safeFloat(ins.ctr),
              cpc:         safeFloat(ins.cpc),
              messages,
            } : null,
          });
        }

        /* targeting pode estar como JSON string */
        let targeting = null;
        if (as.targeting) {
          try { targeting = typeof as.targeting === 'string' ? JSON.parse(as.targeting) : as.targeting; }
          catch { targeting = as.targeting; }
        }

        adsets.push({
          id:               as.platform_ad_set_id,
          local_id:         as.id,
          name:             as.name,
          status:           as.status,
          effective_status: as.effective_status,
          daily_budget:     as.daily_budget    ? safeFloat(as.daily_budget)    : null,
          lifetime_budget:  as.lifetime_budget ? safeFloat(as.lifetime_budget) : null,
          optimization_goal: as.optimization_goal,
          billing_event:    as.billing_event,
          destination_type: null,
          start_time:       as.start_time,
          end_time:         as.end_time,
          targeting,
          ads: adsWithInsights,
        });
      }

      /* Dados da campanha do banco local */
      let campPayload = {};
      try {
        campPayload = camp.payload
          ? (typeof camp.payload === 'string' ? JSON.parse(camp.payload) : camp.payload)
          : {};
      } catch { /* corrompido */ }

      return res.json({
        campaign: {
          local_id:         camp.id,
          platform_id:      camp.platform_campaign_id,
          name:             camp.name,
          status:           camp.status,
          effective_status: camp.effective_status,
          daily_budget:     camp.budget || null,
          lifetime_budget:  null,
          objective:        campPayload.objective || null,
          buying_type:      campPayload.meta?.campaign?.buying_type || null,
        },
        adsets,
        fetched_at:  new Date().toISOString(),
        synced_at:   syncedAt || null,
        from_cache:  true,
      });
    }

    /* ── 2. Fallback ao Meta (banco vazio — ainda não sincronizado) ── */
    console.log('[hierarchy] banco vazio para camp', camp.id, '— fazendo fallback ao Meta com timeout 25s');

    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });

    const { metaGet } = require('../services/metaHttp');
    const { safeDecrypt } = require('../services/crypto');
    const token = safeDecrypt(creds.access_token, 'hierarchy');

    /* AbortSignal de 25s pra não deixar serverless pendurado */
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), 25000);

    let campResp, adsetsResp;
    try {
      /* Campaign */
      campResp = await metaGet(`/${camp.platform_campaign_id}`, {
        fields: 'id,name,status,effective_status,daily_budget,lifetime_budget,objective,buying_type',
      }, { token, timeoutMs: 25000 });

      /* AdSets + ads aninhados */
      adsetsResp = await metaGet(`/${camp.platform_campaign_id}/adsets`, {
        fields: 'id,name,status,effective_status,daily_budget,lifetime_budget,targeting,optimization_goal,billing_event,destination_type,start_time,end_time,ads.limit(25){id,name,status,effective_status,creative{id,name},created_time,insights{spend,clicks,impressions,reach,ctr,cpc,actions,unique_clicks}}',
        limit: 50,
      }, { token, timeoutMs: 25000 });
    } catch (metaErr) {
      clearTimeout(abortTimer);
      if (controller.signal.aborted || metaErr.message?.includes('timeout')) {
        return res.status(504).json({
          error: 'Meta API demorou demais (>25s). Tente novamente ou aguarde o próximo sync automático.',
          from_cache: false,
        });
      }
      throw metaErr;
    } finally {
      clearTimeout(abortTimer);
    }

    const adsets = (adsetsResp?.data || []).map(as => ({
      id: as.id,
      name: as.name,
      status: as.status,
      effective_status: as.effective_status,
      daily_budget:    as.daily_budget    ? Number(as.daily_budget)    / 100 : null,
      lifetime_budget: as.lifetime_budget ? Number(as.lifetime_budget) / 100 : null,
      optimization_goal: as.optimization_goal,
      billing_event:   as.billing_event,
      destination_type: as.destination_type,
      start_time:      as.start_time,
      end_time:        as.end_time,
      targeting:       as.targeting || null,
      ads: (as.ads?.data || []).map(ad => {
        const ins = ad.insights?.data?.[0] || null;
        const linkClicks = safeInt(ins?.actions?.find(a => a.action_type === 'link_click')?.value);
        const messages   = safeInt(ins?.actions?.find(a =>
          /messaging_conversation_started|onsite_conversion\.messaging_first_reply|onsite_conversion\.total_messaging_connection/.test(a.action_type)
        )?.value);
        return {
          id:               ad.id,
          name:             ad.name,
          status:           ad.status,
          effective_status: ad.effective_status,
          creative_id:      ad.creative?.id   || null,
          creative_name:    ad.creative?.name || null,
          created_time:     ad.created_time,
          insights: ins ? {
            spend:       safeFloat(ins.spend),
            clicks:      safeInt(ins.clicks),
            link_clicks: linkClicks,
            impressions: safeInt(ins.impressions),
            reach:       safeInt(ins.reach),
            ctr:         safeFloat(ins.ctr),
            cpc:         safeFloat(ins.cpc),
            messages,
          } : null,
        };
      }),
    }));

    res.json({
      campaign: {
        local_id:         camp.id,
        platform_id:      campResp.id,
        name:             campResp.name,
        status:           campResp.status,
        effective_status: campResp.effective_status,
        daily_budget:     campResp.daily_budget    ? Number(campResp.daily_budget)    / 100 : null,
        lifetime_budget:  campResp.lifetime_budget ? Number(campResp.lifetime_budget) / 100 : null,
        objective:        campResp.objective,
        buying_type:      campResp.buying_type,
      },
      adsets,
      fetched_at:  new Date().toISOString(),
      synced_at:   null,
      from_cache:  false,
    });
  } catch (err) {
    /* Defesa: nunca devolver 500. Frontend mostra cards vazios em vez de travar
       em "carregando". Erro fica no log da Vercel pra investigação. */
    console.error('[hierarchy] erro inesperado para camp', req.params.id, '—', err?.message, err?.stack?.split('\n')[1]?.trim());
    return res.json({
      campaign:   null,
      adsets:     [],
      fetched_at: new Date().toISOString(),
      synced_at:  null,
      from_cache: false,
      error:      'Não foi possível carregar a hierarquia agora. Aguarde o próximo sync ou tente novamente.',
      _debug:     process.env.NODE_ENV === 'production' ? undefined : (err?.message || String(err)),
    });
  }
});

/* Duplica um conjunto inteiro (testar outro público mantendo a campanha).
   Conjunto duplicado entra em learning phase do zero — Meta sempre trata
   adset novo como entidade nova. UI deve avisar.

   Body: {
     sourceAdSetId: string (obrigatório),
     overrides?: {
       name?, daily_budget?(BRL), targeting? (objeto Meta v20 inteiro),
       age_min?, age_max?, genders?[], interests?[{id,name}], geo_locations?
     }
   }

   Se overrides.targeting NÃO veio mas vieram campos atômicos (age_min etc),
   reconstrói targeting a partir do payload local + atomic patches. */
router.post('/:id/duplicate-adset', async (req, res) => {
  const { sourceAdSetId, overrides = {} } = req.body || {};
  if (!sourceAdSetId) return res.status(400).json({ error: 'sourceAdSetId obrigatório' });

  try {
    const result = await db.query('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    const camp = result.rows[0];
    if (!camp) return res.status(404).json({ error: 'Campanha não encontrada' });
    if (camp.platform !== 'meta' || !camp.platform_campaign_id) {
      return res.status(400).json({ error: 'Apenas campanhas Meta podem duplicar conjuntos' });
    }

    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });

    let payload = camp.payload;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { payload = null; }
    }

    /* Reconstrói targeting se vier patches atômicos.
       Lê targeting existente do payload (ou direto do Meta se não tiver). */
    const finalOverrides = { ...overrides };
    const atomicTargetingFields = ['age_min', 'age_max', 'genders', 'interests', 'geo_locations'];
    const hasAtomicTargeting = atomicTargetingFields.some(k => overrides[k] !== undefined);

    if (hasAtomicTargeting && !overrides.targeting) {
      const adSetsList = payload?.meta?.ad_sets || (payload?.meta?.ad_set ? [payload.meta.ad_set] : []);
      const sourceAdSetIdx = (payload?.metaPublishResult?.ad_sets || []).findIndex(as => as.ad_set_id === sourceAdSetId);
      const baseTargeting = adSetsList[sourceAdSetIdx >= 0 ? sourceAdSetIdx : 0]?.targeting || {};
      const merged = JSON.parse(JSON.stringify(baseTargeting));
      if (overrides.age_min != null) merged.age_min = Number(overrides.age_min);
      if (overrides.age_max != null) merged.age_max = Number(overrides.age_max);
      if (Array.isArray(overrides.genders)) merged.genders = overrides.genders;
      if (Array.isArray(overrides.interests)) {
        merged.interests = overrides.interests
          .filter(it => it?.id && !String(it.id).startsWith('interest_'))
          .map(it => ({ id: it.id, name: it.name || '' }));
      }
      if (overrides.geo_locations) merged.geo_locations = overrides.geo_locations;
      finalOverrides.targeting = merged;
    }

    /* Converte BRL → centavos (Meta usa cents) */
    if (overrides.daily_budget != null && overrides.daily_budget < 1000) {
      /* < 1000 = veio em BRL, converte. > 1000 = já em centavos. */
      finalOverrides.daily_budget = Math.round(Number(overrides.daily_budget) * 100);
    }

    const { duplicateAdSet } = require('../services/metaWrite');
    let dupResult;
    try {
      dupResult = await duplicateAdSet(creds, {
        sourceAdSetId,
        deepCopy: true,
        statusOption: 'PAUSED',
        renameSuffix: overrides.name ? '' : ' — v2',
        overrides: finalOverrides,
      });
      /* Se overrides.name veio, aplica explicitamente (sem suffix) */
      if (overrides.name) {
        const { updateAdSetMeta } = require('../services/metaWrite');
        await updateAdSetMeta(creds, dupResult.new_adset_id, { name: String(overrides.name) });
      }
    } catch (e) {
      console.error('[duplicate-adset] Meta erro:', e.message, e.meta);
      return res.status(502).json({
        error: `Meta recusou: ${e.message}`,
        partial: e.partial || null,
        meta_error: e.meta || null,
      });
    }

    /* Persiste no payload — registra cronologia em duplicated_adsets */
    const updatedPayload = { ...(payload || {}) };
    updatedPayload.duplicated_adsets = [
      ...(payload?.duplicated_adsets || []),
      {
        source_adset_id: sourceAdSetId,
        new_adset_id: dupResult.new_adset_id,
        copied_ad_ids: dupResult.copied_ad_ids,
        applied_overrides: dupResult.applied_overrides,
        duplicated_at: new Date().toISOString(),
      },
    ];
    await db.query(
      'UPDATE campaigns SET payload = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [JSON.stringify(updatedPayload), req.params.id]
    );

    await log('duplicate_adset', 'campaign', parseInt(req.params.id),
      `Conjunto duplicado pra testar variação`, {
        source_adset_id: sourceAdSetId,
        new_adset_id: dupResult.new_adset_id,
        copied_ad_ids: dupResult.copied_ad_ids,
      });

    res.json({
      ok: true,
      new_adset_id: dupResult.new_adset_id,
      copied_ad_ids: dupResult.copied_ad_ids,
      applied_overrides: dupResult.applied_overrides,
      learning_reset: true,
      note: 'Conjunto duplicado em PAUSED. Aprendizado começa do zero (Meta trata adset novo como entidade nova). Ative quando estiver pronto pra rodar.',
    });
  } catch (err) {
    console.error('[duplicate-adset]', err);
    res.status(500).json({ error: err.message });
  }
});

/* Cria um anúncio NOVO num adset existente. Reusa creative do primeiro ad
   do adset OU constrói creative novo via overrides.

   IMPORTANTE: criar ad novo num adset É significant edit pelo Meta —
   reseta aprendizado do adset. UI deve avisar antes de chamar.

   Body: {
     adsetId: string (obrigatório),
     overrides?: { message?, title?, link?, ctaType? },
     newAdName?: string (default "Anúncio novo"),
     media?: { type: 'image'|'video', metaHash?: string, metaVideoId?: string }
   } */
router.post('/:id/adsets/:adsetId/ads', async (req, res) => {
  const { overrides = null, newAdName, media = null } = req.body || {};
  const { id, adsetId } = req.params;

  /* Validação básica de mídia se vier no body */
  if (media != null) {
    if (!['image', 'video'].includes(media.type)) {
      return res.status(400).json({ error: 'media.type inválido — deve ser "image" ou "video"' });
    }
    if (media.type === 'image' && !media.metaHash) {
      return res.status(400).json({ error: 'media.metaHash obrigatório para imagem' });
    }
    if (media.type === 'video' && (!media.metaVideoId || !media.metaHash)) {
      return res.status(400).json({ error: 'media.metaVideoId e media.metaHash (capa) obrigatórios para vídeo' });
    }
  }

  try {
    const result = await db.query('SELECT * FROM campaigns WHERE id = ?', [id]);
    const camp = result.rows[0];
    if (!camp) return res.status(404).json({ error: 'Campanha não encontrada' });
    if (camp.platform !== 'meta' || !camp.platform_campaign_id) {
      return res.status(400).json({ error: 'Apenas campanhas Meta podem receber anúncios novos' });
    }

    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });
    if (!creds.account_id) return res.status(400).json({ error: 'ad_account_id ausente nas credenciais' });

    /* Busca o creative do primeiro ad do adset pra reusar como base */
    const { metaGet } = require('../services/metaHttp');
    const { safeDecrypt } = require('../services/crypto');
    const token = safeDecrypt(creds.access_token, 'create-ad-in-adset');

    const adsResp = await metaGet(`/${adsetId}/ads`, {
      fields: 'id,creative{id}',
      limit: 1,
    }, { token });
    const baseAd = adsResp?.data?.[0];
    const baseCreativeId = baseAd?.creative?.id;
    if (!baseCreativeId) {
      return res.status(400).json({ error: 'Conjunto não tem ad de referência pra herdar criativo. Crie pelo fluxo normal de campanha primeiro.' });
    }

    const { createAdInExistingAdSet } = require('../services/metaWrite');
    let createResult;
    try {
      createResult = await createAdInExistingAdSet(creds, {
        adAccountId: creds.account_id,
        platformAdSetId: adsetId,
        baseCreativeId,
        overrides,
        newAdName: newAdName || 'Anúncio novo',
        newMedia: media || null,
      });
    } catch (e) {
      console.error('[create-ad-in-adset] Meta erro:', e.message, e.meta);
      return res.status(502).json({
        error: `Meta recusou: ${e.message}`,
        meta_error: e.meta || null,
      });
    }

    await log('create_ad_in_adset', 'campaign', parseInt(id),
      `Anúncio novo no conjunto ${adsetId}`, {
        adset_id: adsetId,
        new_ad_id: createResult.new_ad_id,
        creative_id: createResult.creative_id,
        reused_creative: createResult.reused_creative,
        media_swapped: !!media,
      });

    res.json({
      ok: true,
      new_ad_id: createResult.new_ad_id,
      new_ad_name: createResult.new_ad_name,
      creative_id: createResult.creative_id,
      reused_creative: createResult.reused_creative,
      media_swapped: !!media,
      learning_reset: true,
      note: 'Anúncio novo em PAUSED. Aprendizado do conjunto vai resetar quando o ad ativar (significant edit). Ative quando estiver pronto.',
    });
  } catch (err) {
    console.error('[create-ad-in-adset]', err);
    res.status(500).json({ error: err.message });
  }
});

/* Editor seguro de orçamento — só permite mudança ATÉ ±20% (não reseta
   aprendizado segundo Meta). Acima disso retorna 400 com aviso.

   Body: {
     newBudget: number (BRL),
     level: 'campaign' | 'adset',
     adsetId?: string (obrigatório se level='adset')
   } */
router.patch('/:id/budget-safe', async (req, res) => {
  const { newBudget, level, adsetId } = req.body || {};
  if (!Number.isFinite(Number(newBudget)) || Number(newBudget) <= 0) {
    return res.status(400).json({ error: 'newBudget inválido (em BRL, > 0)' });
  }
  if (level !== 'campaign' && level !== 'adset') {
    return res.status(400).json({ error: 'level deve ser "campaign" ou "adset"' });
  }
  if (level === 'adset' && !adsetId) {
    return res.status(400).json({ error: 'adsetId obrigatório quando level=adset' });
  }

  try {
    const result = await db.query('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    const camp = result.rows[0];
    if (!camp) return res.status(404).json({ error: 'Campanha não encontrada' });

    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });

    const { metaGet } = require('../services/metaHttp');
    const { safeDecrypt } = require('../services/crypto');
    const token = safeDecrypt(creds.access_token, 'budget-safe');

    /* Lê orçamento atual direto do Meta (fonte da verdade) */
    const targetId = level === 'campaign' ? camp.platform_campaign_id : adsetId;
    if (!targetId) return res.status(400).json({ error: 'platform_id alvo ausente' });

    const current = await metaGet(`/${targetId}`, {
      fields: 'daily_budget,lifetime_budget,name'
    }, { token });

    const currentDailyBRL = current?.daily_budget ? Number(current.daily_budget) / 100 : null;
    const currentLifetimeBRL = current?.lifetime_budget ? Number(current.lifetime_budget) / 100 : null;
    const currentBRL = currentDailyBRL ?? currentLifetimeBRL;
    if (currentBRL == null) {
      return res.status(400).json({
        error: `Não foi possível ler o orçamento atual do ${level} ${targetId}. Pode ser CBO/ABO incompatível com a edição.`,
      });
    }

    const newBRL = Number(newBudget);
    const diffPct = Math.abs((newBRL - currentBRL) / currentBRL) * 100;
    const isLifetime = currentLifetimeBRL != null && currentDailyBRL == null;
    const budgetField = isLifetime ? 'lifetime_budget' : 'daily_budget';

    if (diffPct > 20) {
      return res.status(400).json({
        error: 'Mudança maior que 20% — vai resetar a fase de aprendizado',
        current_budget: currentBRL,
        new_budget: newBRL,
        diff_pct: Number(diffPct.toFixed(2)),
        max_safe_increase: Number((currentBRL * 1.2).toFixed(2)),
        max_safe_decrease: Number((currentBRL * 0.8).toFixed(2)),
        will_reset_learning: true,
      });
    }

    /* OK — aplica via metaWrite */
    const { updateCampaignMeta, updateAdSetMeta } = require('../services/metaWrite');
    const newCents = Math.round(newBRL * 100);
    try {
      if (level === 'campaign') {
        await updateCampaignMeta(creds, targetId, { [budgetField]: newCents });
      } else {
        await updateAdSetMeta(creds, targetId, { [budgetField]: newCents });
      }
    } catch (e) {
      return res.status(502).json({ error: `Meta recusou: ${e.message}`, meta_error: e.meta || null });
    }

    /* Atualiza budget local na tabela campaigns se for campaign-level */
    if (level === 'campaign') {
      try {
        await db.query('UPDATE campaigns SET budget = ?, updated_at = datetime(\'now\') WHERE id = ?',
          [newBRL, req.params.id]);
      } catch {}
    }

    await log('budget_safe', 'campaign', parseInt(req.params.id),
      `Orçamento ${level} alterado de R$${currentBRL.toFixed(2)} pra R$${newBRL.toFixed(2)} (${diffPct.toFixed(1)}%)`, {
        level, target_id: targetId, current: currentBRL, new: newBRL, diff_pct: diffPct,
      });

    res.json({
      ok: true,
      level,
      target_id: targetId,
      previous_budget: currentBRL,
      new_budget: newBRL,
      diff_pct: Number(diffPct.toFixed(2)),
      will_reset_learning: false,
      note: 'Orçamento alterado dentro da margem segura (≤20%). Aprendizado preservado.',
    });
  } catch (err) {
    console.error('[budget-safe]', err);
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================
   ENDPOINTS V2 ADIÇÕES — Status individual + Advantage+ + A/B test
   ============================================================ */

/* Status individual de AdSet — ativa/pausa SOMENTE este conjunto.
   Não cascateia (Meta lida sozinho — adset isolado).
   Se ancestral (campaign) está PAUSED, o ad ativo do adset NÃO entrega
   (effective_status fica CAMPAIGN_PAUSED). Backend valida e avisa. */
router.patch('/adsets/:adsetId/status', async (req, res) => {
  const { status } = req.body || {};
  const { adsetId } = req.params;
  if (!['active', 'paused'].includes(status)) {
    return res.status(400).json({ error: 'status deve ser "active" ou "paused"' });
  }
  try {
    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });

    const { metaGet } = require('../services/metaHttp');
    const { safeDecrypt } = require('../services/crypto');
    const token = safeDecrypt(creds.access_token, 'adset-status');

    /* Lê estado atual do adset + campanha pra validar */
    const adset = await metaGet(`/${adsetId}`, {
      fields: 'id,name,status,effective_status,campaign{id,status,effective_status}'
    }, { token });

    /* Aviso quando ativando ad mas campanha está pausada */
    let warning = null;
    if (status === 'active' && adset.campaign?.status === 'PAUSED') {
      warning = 'Conjunto ativado, mas a campanha está pausada — anúncios não vão entregar até a campanha ser ativada.';
    }

    const { updateAdSetStatus } = require('../services/metaWrite');
    try {
      await updateAdSetStatus(creds, adsetId, status);
    } catch (e) {
      console.error('[adset-status] Meta erro:', e.message, e.meta);
      return res.status(502).json({ error: `Meta recusou: ${e.message}`, meta_error: e.meta || null });
    }

    await log('adset_status', 'adset', null,
      `Conjunto ${adsetId} → ${status === 'active' ? 'Ativado' : 'Pausado'}`,
      { adset_id: adsetId, status, warning });

    res.json({ ok: true, adset_id: adsetId, status, warning });
  } catch (err) {
    console.error('[adset-status]', err);
    res.status(500).json({ error: err.message });
  }
});

/* Status individual de Ad. */
router.patch('/ads/:adId/status', async (req, res) => {
  const { status } = req.body || {};
  const { adId } = req.params;
  if (!['active', 'paused'].includes(status)) {
    return res.status(400).json({ error: 'status deve ser "active" ou "paused"' });
  }
  try {
    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });

    const { metaGet } = require('../services/metaHttp');
    const { safeDecrypt } = require('../services/crypto');
    const token = safeDecrypt(creds.access_token, 'ad-status');

    /* Lê estado do ad + adset + campanha pra validar entrega */
    const ad = await metaGet(`/${adId}`, {
      fields: 'id,name,status,effective_status,adset{id,status},campaign{id,status}'
    }, { token });

    let warning = null;
    if (status === 'active') {
      if (ad.campaign?.status === 'PAUSED') {
        warning = 'Anúncio ativado, mas a campanha está pausada — não vai entregar até a campanha ser ativada.';
      } else if (ad.adset?.status === 'PAUSED') {
        warning = 'Anúncio ativado, mas o conjunto está pausado — não vai entregar até o conjunto ser ativado.';
      }
    }

    const { updateAdStatus } = require('../services/metaWrite');
    try {
      await updateAdStatus(creds, adId, status);
    } catch (e) {
      console.error('[ad-status] Meta erro:', e.message, e.meta);
      return res.status(502).json({ error: `Meta recusou: ${e.message}`, meta_error: e.meta || null });
    }

    await log('ad_status', 'ad', null,
      `Anúncio ${adId} → ${status === 'active' ? 'Ativado' : 'Pausado'}`,
      { ad_id: adId, status, warning });

    res.json({ ok: true, ad_id: adId, status, warning });
  } catch (err) {
    console.error('[ad-status]', err);
    res.status(500).json({ error: err.message });
  }
});

/* Toggle Advantage+ Público num adset.
   ATENÇÃO: muda targeting → reseta aprendizado. UI deve avisar antes. */
router.patch('/:id/adsets/:adsetId/advantage-audience', async (req, res) => {
  const { enabled } = req.body || {};
  const { adsetId } = req.params;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled (boolean) obrigatório' });
  }
  try {
    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });

    const { setAdvantageAudience } = require('../services/metaWrite');
    try {
      await setAdvantageAudience(creds, adsetId, enabled);
    } catch (e) {
      console.error('[advantage-audience] Meta erro:', e.message, e.meta);
      return res.status(502).json({ error: `Meta recusou: ${e.message}`, meta_error: e.meta || null });
    }

    await log('advantage_audience', 'adset', null,
      `Advantage+ Público ${enabled ? 'ATIVADO' : 'DESATIVADO'} no conjunto ${adsetId}`,
      { adset_id: adsetId, enabled });

    res.json({
      ok: true,
      adset_id: adsetId,
      enabled,
      learning_reset: true,
      note: enabled
        ? 'Advantage+ Público ligado. Meta vai expandir o público pra encontrar conversões — pode entregar fora dos bairros configurados. Aprendizado resetou.'
        : 'Advantage+ Público desligado. Targeting voltou pros bairros configurados estritamente. Aprendizado resetou.',
    });
  } catch (err) {
    console.error('[advantage-audience]', err);
    res.status(500).json({ error: err.message });
  }
});

/* Cria A/B test (split test) numa campanha existente.
   Body: {
     variable: 'creative' | 'audience' | 'placement',
     sourceAdSetId: string,    // adset que vira a "Cell A" (controle)
     durationDays: number,     // 4-30 (default 7)
     variantOverrides?: object,// override pra cell B (depende da variable)
     splitPercent?: number,    // default 50 (cell A %, B = 100 - splitPercent)
     name?: string,            // default "Teste A/B — {camp.name} — {variable}"
   } */
router.post('/:id/ab-test', async (req, res) => {
  const {
    variable, sourceAdSetId, durationDays = 7,
    variantOverrides = {}, splitPercent = 50, name: customName,
    autoPauseLoser = true,
    variantMedia = null,   /* { type, metaHash?, metaVideoId? } — só quando variable==='creative' */
  } = req.body || {};

  if (!['creative', 'audience', 'placement'].includes(variable)) {
    return res.status(400).json({ error: 'variable deve ser "creative", "audience" ou "placement"' });
  }
  if (!sourceAdSetId) return res.status(400).json({ error: 'sourceAdSetId obrigatório' });
  const dur = Number(durationDays);
  if (!Number.isFinite(dur) || dur < 4 || dur > 30) {
    return res.status(400).json({ error: 'durationDays entre 4 e 30 (Meta exige mínimo 4)' });
  }
  const splitA = Number(splitPercent);
  if (!Number.isFinite(splitA) || splitA < 10 || splitA > 90) {
    return res.status(400).json({ error: 'splitPercent entre 10 e 90' });
  }

  try {
    const result = await db.query('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    const camp = result.rows[0];
    if (!camp) return res.status(404).json({ error: 'Campanha não encontrada' });
    if (camp.platform !== 'meta' || !camp.platform_campaign_id) {
      return res.status(400).json({ error: 'Apenas campanhas Meta podem rodar teste A/B' });
    }

    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });
    if (!creds.account_id) return res.status(400).json({ error: 'account_id ausente nas credenciais' });

    const { metaGet } = require('../services/metaHttp');
    const { safeDecrypt } = require('../services/crypto');
    const token = safeDecrypt(creds.access_token, 'ab-test');

    /* Pré-condição: campaign tem que estar ACTIVE pra rodar teste */
    const campaignMeta = await metaGet(`/${camp.platform_campaign_id}`, {
      fields: 'id,name,status,effective_status'
    }, { token });
    if (campaignMeta.status !== 'ACTIVE') {
      return res.status(400).json({
        error: `Campanha precisa estar ATIVA pra rodar teste A/B (atual: ${campaignMeta.status})`,
      });
    }

    /* Cell B: cria duplicação do adset com override conforme variable */
    const { duplicateAdSet, updateAdSetMeta } = require('../services/metaWrite');
    const overrides = {};

    if (variable === 'audience') {
      /* Variant pública: aplicar overrides de targeting (age/genders/interests) */
      Object.assign(overrides, variantOverrides);
    } else if (variable === 'placement') {
      /* Variant placement: substitui publisher_platforms no targeting.
         Cell A mantém placements automáticos (todos), Cell B força específico
         (ex: só Reels) ou vice-versa. */
      const sourceAdSet = await metaGet(`/${sourceAdSetId}`, { fields: 'targeting' }, { token });
      const baseTargeting = sourceAdSet?.targeting ? JSON.parse(JSON.stringify(sourceAdSet.targeting)) : {};
      if (Array.isArray(variantOverrides.publisher_platforms)) {
        baseTargeting.publisher_platforms = variantOverrides.publisher_platforms;
      }
      if (variantOverrides.facebook_positions) baseTargeting.facebook_positions = variantOverrides.facebook_positions;
      if (variantOverrides.instagram_positions) baseTargeting.instagram_positions = variantOverrides.instagram_positions;
      overrides.targeting = baseTargeting;
    }
    /* Pra variable=creative, NÃO mexemos no targeting do duplicado.
       Se variantMedia vier preenchido, após duplicar o adset, trocamos o
       creative do ad copiado pela nova mídia usando createAdInExistingAdSet. */

    let dupResult;
    try {
      dupResult = await duplicateAdSet(creds, {
        sourceAdSetId,
        deepCopy: true,           /* copia ad pro novo adset */
        statusOption: 'ACTIVE',   /* A/B test exige adsets ativos */
        renameSuffix: ` — A/B ${variable}`,
        overrides,
      });
    } catch (e) {
      return res.status(502).json({ error: `Falha ao duplicar conjunto pra cell B: ${e.message}`, meta_error: e.meta || null });
    }

    const variantAdSetId = dupResult.new_adset_id;

    /* ── Troca de creative quando variable==='creative' e variantMedia veio ── */
    if (variable === 'creative' && variantMedia && (variantMedia.metaHash || variantMedia.metaVideoId)) {
      const { metaGet } = require('../services/metaHttp');
      const { createAdInExistingAdSet } = require('../services/metaWrite');

      /* Pega o primeiro ad copiado no adset variante pra descobrir o creative base */
      const copiedAdId = dupResult.copied_ad_ids?.[0] || null;
      if (!copiedAdId) {
        /* deepCopy não retornou IDs — busca ao vivo */
        const adsResp = await metaGet(`/${variantAdSetId}/ads`, {
          fields: 'id,creative{id}',
          limit: 1,
        }, { token }).catch(() => null);
        const firstAd = adsResp?.data?.[0];
        if (!firstAd) {
          console.warn('[ab-test] creative swap: não encontrou ad no adset variante — pulando troca de creative');
        } else {
          const baseCreativeId = firstAd.creative?.id || firstAd.creative_id;
          if (baseCreativeId) {
            await createAdInExistingAdSet(creds, {
              adAccountId: creds.account_id,
              platformAdSetId: variantAdSetId,
              baseCreativeId,
              newMedia: variantMedia,
              newAdName: `Anúncio A/B variante — ${variable}`,
            });
            /* Pausa o ad original copiado — o novo ad (com creative novo) fica ativo */
            try {
              const { metaPost } = require('../services/metaHttp');
              await metaPost(`/${firstAd.id}`, { status: 'PAUSED' }, { token });
            } catch (e) {
              console.warn('[ab-test] não conseguiu pausar ad original copiado:', e.message);
            }
          }
        }
      } else {
        /* ID do ad copiado disponível diretamente */
        const adResp = await metaGet(`/${copiedAdId}`, {
          fields: 'id,creative{id}',
        }, { token }).catch(() => null);
        const baseCreativeId = adResp?.creative?.id || adResp?.creative_id;
        if (baseCreativeId) {
          await createAdInExistingAdSet(creds, {
            adAccountId: creds.account_id,
            platformAdSetId: variantAdSetId,
            baseCreativeId,
            newMedia: variantMedia,
            newAdName: `Anúncio A/B variante — ${variable}`,
          });
          /* Pausa o ad copiado original — o novo (creative novo) fica ativo */
          try {
            const { metaPost } = require('../services/metaHttp');
            await metaPost(`/${copiedAdId}`, { status: 'PAUSED' }, { token });
          } catch (e) {
            console.warn('[ab-test] não conseguiu pausar ad original copiado:', e.message);
          }
        } else {
          console.warn('[ab-test] creative swap: ad copiado não tem creative_id — pulando troca');
        }
      }
    }

    /* Garante que adset original (cell A) também está ACTIVE */
    try {
      await updateAdSetMeta(creds, sourceAdSetId, { status: 'ACTIVE' });
    } catch (e) {
      console.warn('[ab-test] não conseguiu ativar adset cell A:', e.message);
    }

    /* Cria estudo A/B */
    const startTime = Math.floor(Date.now() / 1000) + 60;        /* +1min buffer */
    const endTime = startTime + Math.round(dur * 86400);
    const studyName = customName || `Teste A/B — ${camp.name} — ${variable}`;

    const { createABTest } = require('../services/metaWrite');
    let study;
    try {
      study = await createABTest(creds, {
        accountId: creds.account_id,
        name: studyName,
        description: `Teste A/B em "${camp.name}" — variável: ${variable} — duração: ${dur} dias`,
        startTime, endTime,
        cells: [
          { name: 'Controle (A)', treatment_percentage: splitA, adsets: [sourceAdSetId] },
          { name: 'Variante (B)', treatment_percentage: 100 - splitA, adsets: [variantAdSetId] },
        ],
      });
    } catch (e) {
      console.error('[ab-test] Meta erro ao criar estudo:', e.message, e.meta);
      /* Cleanup: pausa o adset variant pra não rodar fora do estudo */
      try { await updateAdSetMeta(creds, variantAdSetId, { status: 'PAUSED' }); } catch {}
      return res.status(502).json({
        error: `Meta recusou estudo A/B: ${e.message}`,
        meta_error: e.meta || null,
        partial: { variant_adset_id: variantAdSetId },
        note: 'Conjunto da variante foi pausado pra não rodar isolado. Você pode deletar manualmente se não quiser.',
      });
    }

    /* Persiste no payload local */
    let payload = camp.payload;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { payload = null; }
    }
    const updatedPayload = { ...(payload || {}) };
    updatedPayload.ab_tests = [
      ...(payload?.ab_tests || []),
      {
        study_id: study.study_id,
        name: studyName,
        variable,
        source_adset_id: sourceAdSetId,
        variant_adset_id: variantAdSetId,
        start_time: startTime,
        end_time: endTime,
        split_percent_a: splitA,
        auto_pause_loser: !!autoPauseLoser,
        created_at: new Date().toISOString(),
      },
    ];
    await db.query('UPDATE campaigns SET payload = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [JSON.stringify(updatedPayload), req.params.id]);

    await log('ab_test_created', 'campaign', parseInt(req.params.id),
      `Teste A/B criado em "${camp.name}" — ${variable}`, {
        study_id: study.study_id, variable, source_adset_id: sourceAdSetId,
        variant_adset_id: variantAdSetId, duration_days: dur,
      });

    res.json({
      ok: true,
      study_id: study.study_id,
      study_name: studyName,
      variable,
      source_adset_id: sourceAdSetId,
      variant_adset_id: variantAdSetId,
      start_time: startTime,
      end_time: endTime,
      duration_days: dur,
      split: { A: splitA, B: 100 - splitA },
      note: 'Teste A/B criado. Meta vai dividir o público entre os 2 conjuntos sem sobreposição. Resultado fica disponível conforme o teste roda.',
    });
  } catch (err) {
    console.error('[ab-test]', err);
    res.status(500).json({ error: err.message });
  }
});

/* Lista A/B tests de uma campanha (lê payload local + valida ao vivo no Meta). */
router.get('/:id/ab-tests', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    const camp = result.rows[0];
    if (!camp) return res.status(404).json({ error: 'Campanha não encontrada' });

    let payload = camp.payload;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { payload = null; }
    }
    const localTests = payload?.ab_tests || [];

    /* Enriquece cada teste com status ao vivo do Meta */
    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) return res.json({ tests: localTests });

    const { getABTestResults } = require('../services/metaWrite');
    const enriched = await Promise.all(localTests.map(async (t) => {
      try {
        const study = await getABTestResults(creds, t.study_id);
        return { ...t, live: study };
      } catch (e) {
        return { ...t, live_error: e.message };
      }
    }));

    res.json({ tests: enriched });
  } catch (err) {
    console.error('[ab-tests-list]', err);
    res.status(500).json({ error: err.message });
  }
});

/* Lê resultado de um A/B test específico (status, métricas, vencedor). */
router.get('/ab-tests/:studyId', async (req, res) => {
  try {
    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });

    const { getABTestResults } = require('../services/metaWrite');
    const study = await getABTestResults(creds, req.params.studyId);
    res.json(study);
  } catch (err) {
    console.error('[ab-test-results]', err);
    res.status(err.statusCode || 500).json({ error: err.message, meta: err.meta || null });
  }
});

/* DELETE conjunto isolado — Meta cascateia ads filhos junto. */
router.delete('/adsets/:adsetId', async (req, res) => {
  const { adsetId } = req.params;
  try {
    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });

    const { deleteAdSet } = require('../services/metaWrite');
    try {
      await deleteAdSet(creds, adsetId);
    } catch (e) {
      console.error('[delete-adset] Meta erro:', e.message, e.meta);
      return res.status(502).json({ error: `Meta recusou: ${e.message}`, meta_error: e.meta || null });
    }

    await log('delete_adset', 'adset', null, `Conjunto ${adsetId} excluído (cascata em ads filhos)`, { adset_id: adsetId });
    res.json({ ok: true, adset_id: adsetId, note: 'Conjunto e seus anúncios filhos foram excluídos do Meta sem deixar lixo.' });
  } catch (err) {
    console.error('[delete-adset]', err);
    res.status(500).json({ error: err.message });
  }
});

/* DELETE anúncio isolado — não cascateia (creative pode ser reusado). */
router.delete('/ads/:adId', async (req, res) => {
  const { adId } = req.params;
  try {
    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });

    const { deleteAd } = require('../services/metaWrite');
    try {
      await deleteAd(creds, adId);
    } catch (e) {
      console.error('[delete-ad] Meta erro:', e.message, e.meta);
      return res.status(502).json({ error: `Meta recusou: ${e.message}`, meta_error: e.meta || null });
    }

    await log('delete_ad', 'ad', null, `Anúncio ${adId} excluído`, { ad_id: adId });
    res.json({ ok: true, ad_id: adId, note: 'Anúncio excluído do Meta.' });
  } catch (err) {
    console.error('[delete-ad]', err);
    res.status(500).json({ error: err.message });
  }
});

/* Finaliza A/B test: decide vencedor + auto-pausa perdedor (se autoPauseLoser).
   Idempotente: se já foi finalizado uma vez (payload.ab_tests[i].finalized=true),
   retorna o resultado salvo sem rodar de novo. */
router.post('/:id/ab-tests/:studyId/finalize', async (req, res) => {
  const { id, studyId } = req.params;
  const { autoPauseLoser = true } = req.body || {};

  try {
    const result = await db.query('SELECT * FROM campaigns WHERE id = ?', [id]);
    const camp = result.rows[0];
    if (!camp) return res.status(404).json({ error: 'Campanha não encontrada' });

    let payload = camp.payload;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { payload = null; }
    }
    const tests = payload?.ab_tests || [];
    const idx = tests.findIndex(t => t.study_id === studyId);
    if (idx < 0) return res.status(404).json({ error: 'Teste não encontrado nesta campanha' });
    const test = tests[idx];

    /* Idempotente */
    if (test.finalized) {
      return res.json({ ok: true, already_finalized: true, result: test.finalize_result || null });
    }

    /* Só finaliza se end_time já passou */
    const nowSec = Math.floor(Date.now() / 1000);
    if (test.end_time > nowSec) {
      return res.status(400).json({
        error: 'Teste ainda em andamento — finalize só roda depois do end_time',
        end_time: test.end_time,
        now: nowSec,
      });
    }

    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });

    const { finalizeABTest } = require('../services/metaWrite');
    let finalizeResult;
    try {
      finalizeResult = await finalizeABTest(creds, { studyId, autoPauseLoser });
    } catch (e) {
      console.error('[ab-test-finalize] erro:', e.message, e.meta);
      return res.status(502).json({ error: `Falha: ${e.message}`, meta_error: e.meta || null });
    }

    /* Persiste resultado + finalized=true */
    const updatedTests = [...tests];
    updatedTests[idx] = {
      ...test,
      finalized: true,
      finalized_at: new Date().toISOString(),
      finalize_result: finalizeResult,
    };
    const updatedPayload = { ...(payload || {}), ab_tests: updatedTests };
    await db.query('UPDATE campaigns SET payload = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [JSON.stringify(updatedPayload), id]);

    /* Cria notificação no banco pra próximo sync do frontend exibir no sino */
    let notifTitle, notifMsg;
    if (finalizeResult.draw) {
      notifTitle = `Teste A/B "${test.name}" terminou em empate`;
      notifMsg = `Diferença entre os 2 conjuntos foi menor que 5%. Nenhum foi pausado.`;
    } else if (finalizeResult.paused_loser) {
      notifTitle = `Teste A/B "${test.name}" terminou — vencedor escolhido`;
      notifMsg = `Vencedor: "${finalizeResult.winner_cell}". Perdedor pausado automaticamente (${finalizeResult.diff_pct}% melhor).`;
    } else {
      notifTitle = `Teste A/B "${test.name}" terminou`;
      notifMsg = `Vencedor: "${finalizeResult.winner_cell}". Diferença: ${finalizeResult.diff_pct}%.`;
    }

    await log('ab_test_finalized', 'campaign', parseInt(id), notifTitle, {
      study_id: studyId, finalize_result: finalizeResult,
    });

    res.json({
      ok: true,
      already_finalized: false,
      result: finalizeResult,
      notification: { title: notifTitle, message: notifMsg },
    });
  } catch (err) {
    console.error('[ab-test-finalize]', err);
    res.status(500).json({ error: err.message });
  }
});

/* Encerra A/B test antes do tempo. */
router.post('/ab-tests/:studyId/stop', async (req, res) => {
  try {
    const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
    const creds = credResult.rows[0];
    if (!creds) return res.status(400).json({ error: 'Meta não conectado' });

    const { stopABTest } = require('../services/metaWrite');
    await stopABTest(creds, req.params.studyId);
    await log('ab_test_stopped', 'study', null, `Teste A/B ${req.params.studyId} encerrado manualmente`, {});
    res.json({ ok: true, study_id: req.params.studyId, note: 'Teste encerrado. Resultados parciais ficam disponíveis no Meta.' });
  } catch (err) {
    console.error('[ab-test-stop]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
