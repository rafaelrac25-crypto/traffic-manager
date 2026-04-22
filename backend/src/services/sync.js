const db = require('../db');
const googleAds = require('./googleAds');
const metaAds = require('./metaAds');

const { CONVERSION_ACTION_TYPES } = metaAds;
const handlers = { google: googleAds, meta: metaAds };

async function syncPlatform(platform) {
  const handler = handlers[platform];
  if (!handler) throw new Error(`Plataforma '${platform}' não suportada`);

  const credResult = await db.query('SELECT * FROM platform_credentials WHERE platform = ?', [platform]);
  const creds = credResult.rows[0];
  if (!creds) throw new Error(`Plataforma '${platform}' não está conectada`);

  /* Renova proativamente o token long-lived do Meta se faltar <15 dias.
     Mantém a conexão permanente — só desconecta no /disconnect explícito. */
  if (platform === 'meta') {
    try {
      const { refreshIfNeeded, markNeedsReconnect } = require('./metaToken');
      const fresh = await refreshIfNeeded(creds);
      if (fresh) creds.access_token = fresh; /* usa o token fresco sem re-query */
      void markNeedsReconnect; /* usado adiante se detecção de 190 for adicionada */
    } catch (e) { console.warn('[sync] refreshIfNeeded:', e.message); }
  }

  const campaigns = await handler.fetchCampaigns(creds);
  let upserted = 0;

  for (const c of campaigns) {
    const payload = {
      objective: c.objective,
      reach: c.reach,
      ctr: c.ctr,
      cpc: c.cpc,
      cpm: c.cpm,
      effective_status: c.effective_status,
      synced_at: new Date().toISOString(),
    };
    await db.query(
      `INSERT INTO campaigns
        (name, platform, platform_campaign_id, status, budget, spent, clicks, impressions, conversions, start_date, end_date, payload, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (platform, platform_campaign_id) DO UPDATE SET
         name = excluded.name,
         status = excluded.status,
         budget = excluded.budget,
         spent = excluded.spent,
         clicks = excluded.clicks,
         impressions = excluded.impressions,
         conversions = excluded.conversions,
         start_date = excluded.start_date,
         end_date = excluded.end_date,
         payload = excluded.payload,
         updated_at = datetime('now')`,
      [c.name, platform, c.id, c.status, c.budget, c.spent, c.clicks, c.impressions,
       c.conversions, c.start_date, c.end_date, JSON.stringify(payload)]
    );
    upserted++;
  }

  if (platform === 'meta' && handler.fetchAccountInsights) {
    try {
      const insights = await handler.fetchAccountInsights(creds, { level: 'campaign' });
      for (const row of insights) {
        const campResult = await db.query(
          'SELECT id FROM campaigns WHERE platform = ? AND platform_campaign_id = ?',
          ['meta', row.campaign_id]
        );
        const campId = campResult.rows[0]?.id;
        if (!campId) continue;
        /* Mesma lista que fetchCampaigns usa — evita divergência entre
           número de conversões mostrado na campanha vs. nos insights. */
        const conversions =
          (Array.isArray(row.actions) ? row.actions : [])
            .filter(a => CONVERSION_ACTION_TYPES.includes(a.action_type))
            .reduce((s, a) => {
              const n = parseInt(a.value || 0, 10);
              return s + (Number.isFinite(n) ? n : 0);
            }, 0);
        /* Protege contra NaN quando Meta retorna '' / null / undefined
           (já vimos em insights de campanhas recém-criadas sem dados ainda). */
        const safeFloat = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
        const safeInt   = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; };
        await db.query(
          `INSERT INTO insights
            (campaign_id, date_start, date_stop, spend, impressions, reach, clicks, ctr, cpc, cpm, conversions, raw)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [campId, row.date_start, row.date_stop,
           safeFloat(row.spend), safeInt(row.impressions),
           safeInt(row.reach), safeInt(row.clicks),
           safeFloat(row.ctr), safeFloat(row.cpc), safeFloat(row.cpm),
           conversions, JSON.stringify(row)]
        );
      }
    } catch (e) {
      console.warn('[sync] insights skip:', e.message);
    }
  }

  return { upserted, total: campaigns.length };
}

module.exports = { syncPlatform };
