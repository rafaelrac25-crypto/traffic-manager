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
  const status = statusIn || (isImmediate ? 'review' : 'scheduled');
  const submitted_at = isImmediate ? new Date().toISOString() : null;
  const sched = (!isImmediate && scheduled_for) ? scheduled_for : null;
  const payloadStr = payload ? JSON.stringify(payload) : null;

  try {
    const result = await db.query(
      `INSERT INTO campaigns
        (name, platform, budget, start_date, end_date, publish_mode, status, scheduled_for, submitted_at, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      [name, platform, budget || null, start_date || null, end_date || null,
       mode, status, sched, submitted_at, payloadStr]
    );
    const camp = rowToAd(result.rows[0]);
    const desc = mode === 'scheduled'
      ? `Campanha "${name}" agendada para ${sched}`
      : `Campanha "${name}" criada na plataforma ${platform}`;
    await log('create', 'campaign', camp?.id, desc, { platform, budget, mode });
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
