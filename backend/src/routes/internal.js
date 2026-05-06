/**
 * Rotas internas — chamadas apenas pelo próprio backend (fire-and-forget).
 * Protegidas por X-Internal-Secret pra evitar acionamento externo não-autorizado.
 *
 * Rota principal:
 *   POST /api/internal/publish-worker/:job_id
 *     Executa o fluxo completo de publicação Meta de um publish_job enfileirado.
 *     Atualiza publish_jobs a cada fase; em sucesso atualiza campaigns.
 */

const router = require('express').Router();
const db = require('../db');

/* Verifica segredo do header — protege contra chamadas externas.
   Se a env não existir (dev), loga aviso mas permite (modo permissivo). */
function checkSecret(req, res) {
  const envSecret = process.env.INTERNAL_WORKER_SECRET;
  if (!envSecret) {
    console.warn('[internal] INTERNAL_WORKER_SECRET não definido — modo dev permissivo');
    return true;
  }
  const header = req.headers['x-internal-secret'];
  if (header !== envSecret) {
    res.status(401).json({ error: 'Não autorizado' });
    return false;
  }
  return true;
}

/* Atualiza status + progresso do job no banco de forma segura (best-effort) */
async function updateJob(jobId, fields) {
  const setParts = [];
  const params = [];

  if (fields.status !== undefined)       { setParts.push('status = ?');       params.push(fields.status); }
  if (fields.current_step !== undefined) { setParts.push('current_step = ?'); params.push(fields.current_step); }
  if (fields.total_steps !== undefined)  { setParts.push('total_steps = ?');  params.push(fields.total_steps); }
  if (fields.message !== undefined)      { setParts.push('message = ?');      params.push(fields.message); }
  if (fields.error !== undefined)        { setParts.push('error = ?');        params.push(fields.error); }
  if (fields.campaign_id_local !== undefined) { setParts.push('campaign_id_local = ?'); params.push(fields.campaign_id_local); }

  /* updated_at: Postgres usa NOW(), SQLite usa datetime('now').
     db/index.js auto-detecta o driver — usamos string literal compatível
     com ambos via db.query (que faz replace de ? pra $N no PG). */
  setParts.push("updated_at = datetime('now')");

  if (setParts.length === 1) return; /* só updated_at, nada mudou */
  params.push(jobId);
  try {
    await db.query(
      `UPDATE publish_jobs SET ${setParts.join(', ')} WHERE id = ?`,
      params
    );
  } catch (e) {
    console.warn('[internal] updateJob falhou (ignorado):', e.message);
  }
}

/**
 * POST /api/internal/publish-worker/:job_id
 *
 * Worker assíncrono: executa o fluxo Meta completo pra um job enfileirado.
 * Chamado via fire-and-forget por POST /api/campaigns quando mode=immediate + Meta.
 * Retorna 200 rapidamente (Vercel 504 não afeta — o próprio fetch não-awaited já retornou 202 pro cliente).
 */
router.post('/publish-worker/:job_id', async (req, res) => {
  if (!checkSecret(req, res)) return;

  const { job_id } = req.params;

  /* Lê o job — se não existir ou já terminal, noop */
  let job;
  try {
    const result = await db.query('SELECT * FROM publish_jobs WHERE id = ?', [job_id]);
    job = result.rows[0];
  } catch (e) {
    console.error('[publish-worker] erro ao ler job:', e.message);
    return res.status(500).json({ error: 'Erro ao ler job' });
  }

  if (!job) {
    console.warn('[publish-worker] job não encontrado:', job_id);
    return res.status(404).json({ error: 'Job não encontrado' });
  }

  const TERMINAL = ['completed', 'failed'];
  if (TERMINAL.includes(job.status)) {
    console.log('[publish-worker] job já em estado terminal:', job.status, job_id);
    return res.status(200).json({ noop: true, status: job.status });
  }

  /* Responde imediatamente pra Vercel não segurar a conexão —
     o trabalho real acontece após esta linha via setImmediate */
  res.status(200).json({ accepted: true, job_id });

  /* Executa o fluxo em background (fora do ciclo de request/response) */
  setImmediate(async () => {
    let body;
    try {
      body = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
    } catch (e) {
      await updateJob(job_id, { status: 'failed', error: 'Payload do job inválido (JSON parse error)' });
      return;
    }

    const { name, platform, budget, _campaign_id_local } = body;
    /* O frontend envia meta no top-level (sem wrapper payload) — fallback
       igual ao do POST /api/campaigns pra aceitar ambos formatos. */
    const payload = body.payload ?? body;
    const campaignIdLocal = _campaign_id_local || job.campaign_id_local;

    /* Busca credenciais Meta */
    let creds;
    try {
      const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', ['meta']);
      creds = credResult.rows[0];
      if (!creds) throw new Error('Plataforma Meta não conectada — reconecte em Configurações');
    } catch (e) {
      await updateJob(job_id, { status: 'failed', error: e.message });
      await markCampaignFailed(campaignIdLocal, e.message);
      return;
    }

    /* Callback de progresso: atualiza o job a cada fase */
    async function onProgress(stepKey, current, total, message) {
      /* Mapeia stepKey para status do job */
      const statusMap = {
        uploading_media:    'uploading_media',
        creating_campaign:  'creating_campaign',
        creating_adsets:    'creating_adsets',
        creating_creatives: 'creating_creatives',
        creating_ads:       'creating_ads',
      };
      const newStatus = statusMap[stepKey] || job.status;
      await updateJob(job_id, {
        status:        newStatus,
        current_step:  current,
        total_steps:   total,
        message:       message || stepKey,
      });
    }

    /* Executa publishCampaign com onProgress */
    let metaResult;
    try {
      const { publishCampaign } = require('../services/metaWrite');
      const mediaItems = Array.isArray(payload?.mediaFilesData) ? payload.mediaFilesData : [];
      metaResult = await publishCampaign(creds, payload.meta, mediaItems, onProgress);
    } catch (e) {
      /* Erro Meta — serializa via metaErrors se disponível */
      let errorMsg = e.message || 'Erro desconhecido ao publicar no Meta';
      try {
        const { parseMetaError } = require('../services/metaErrors');
        const parsed = parseMetaError(e);
        if (parsed?.pt) errorMsg = parsed.pt;
      } catch {}
      const stageLabel = { campaign: 'Campanha', creative: 'Criativo', adset: 'Conjunto de anúncios', ad: 'Anúncio' }[e.stage] || null;
      if (stageLabel) errorMsg = `[${stageLabel}] ${errorMsg}`;

      console.error('[publish-worker] FALHA job', job_id, '— stage:', e.stage || 'unknown', '— erro:', e.message);
      await updateJob(job_id, {
        status:  'failed',
        message: errorMsg,
        error:   JSON.stringify({
          message:   e.message,
          stage:     e.stage || null,
          meta:      e.meta || null,
          params:    e.params || null,
          endpoint:  e.endpoint || null,
        }),
      });
      await markCampaignFailed(campaignIdLocal, errorMsg);
      return;
    }

    /* Sucesso — atualiza a row de campaigns com os IDs Meta */
    const platform_campaign_id = metaResult.platform_campaign_id;
    try {
      const enrichedPayload = {
        ...(payload || {}),
        mediaFilesData:   undefined,
        metaPublishResult: metaResult,
      };
      await db.query(
        `UPDATE campaigns SET
           platform_campaign_id = ?,
           status = ?,
           payload = ?,
           updated_at = datetime('now')
         WHERE id = ?`,
        [platform_campaign_id, 'paused', JSON.stringify(enrichedPayload), campaignIdLocal]
      );
    } catch (e) {
      console.error('[publish-worker] UPDATE campaigns falhou após sucesso Meta:', e.message);
      /* Não falha o job — Meta criou tudo; é problema de DB local */
    }

    await updateJob(job_id, {
      status:        'completed',
      current_step:  1,
      total_steps:   1,
      message:       `Campanha publicada no Meta (ID ${platform_campaign_id})`,
    });

    /* Registra no activity_log */
    try {
      await db.query(
        `INSERT INTO activity_log (action, entity, entity_id, description, meta) VALUES (?, ?, ?, ?, ?)`,
        ['publish_complete', 'campaign', campaignIdLocal,
         `Campanha publicada no Meta via job assíncrono (ID ${platform_campaign_id})`,
         JSON.stringify({ job_id, platform_campaign_id, ad_sets: metaResult.ad_sets?.length || 0 })]
      );
    } catch {}

    console.log('[publish-worker] job concluído:', job_id, '— campaign Meta:', platform_campaign_id);
  });
});

/* Marca a row da campanha local como falha de publicação (best-effort) */
async function markCampaignFailed(campaignIdLocal, reason) {
  if (!campaignIdLocal) return;
  try {
    await db.query(
      `UPDATE campaigns SET status = ?, updated_at = datetime('now') WHERE id = ?`,
      ['publish_failed', campaignIdLocal]
    );
  } catch (e) {
    console.warn('[publish-worker] markCampaignFailed falhou:', e.message);
  }
}

module.exports = router;
