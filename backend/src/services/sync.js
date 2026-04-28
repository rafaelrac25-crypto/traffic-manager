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

  /* ─── Detector "campanha de mensagens via wa.me/" ───────────────────
     Decisão registrada no CRITICAL_STATE.md: quando objetivo do usuário
     é "messages" E destURL é wa.me/, a campanha é montada como TRÁFEGO
     (OUTCOME_TRAFFIC + LINK_CLICKS), não Click-to-WhatsApp formal.
     Nesses casos, "click no anúncio" = "mensagem iniciada no WhatsApp",
     mas Meta só contabiliza como link_click — conversions fica em 0 e
     o card "Custo por resultado" do Dashboard mostra "—" passando
     impressão de campanha falhando ao usuário leigo.

     Quando detectamos esse padrão, mapeamos conversions = clicks
     (mantendo clicks/impressions originais — só preenchemos o que
     está zerado quando faz sentido). */
  function isMessagesViaWaLink(platformObjective, payload) {
    const obj = String(platformObjective || '').toUpperCase();
    /* OUTCOME_ENGAGEMENT / MESSAGES = objetivo formal "Mensagens" do Meta */
    if (obj === 'MESSAGES' || obj === 'OUTCOME_ENGAGEMENT') return true;
    /* OUTCOME_TRAFFIC + destUrl wa.me/ = fallback wa.me/ (caso da Cris) */
    if (obj.includes('TRAFFIC')) {
      const destUrl = payload?.destUrl || payload?.meta?.ad?.destUrl || null;
      if (typeof destUrl === 'string' && /wa\.me\//i.test(destUrl)) return true;
    }
    return false;
  }

  /* Mapa de transições de effective_status que merecem log em activity_log.
     "DE→PARA" tem prioridade sobre "*→PARA" (wildcard).
     Esses eventos são lidos pelo frontend via polling (AppStateContext) e
     disparam sino + push notification ao usuário. */
  const STATUS_TRANSITIONS = {
    'PENDING_REVIEW→ACTIVE':      { action: 'ad_approved',          description: 'Anuncio aprovado pelo Meta e entrou em veiculacao.' },
    'IN_PROCESS→ACTIVE':          { action: 'ad_approved',          description: 'Anuncio aprovado pelo Meta e entrou em veiculacao.' },
    'PREAPPROVED→ACTIVE':         { action: 'ad_approved',          description: 'Anuncio aprovado pelo Meta e entrou em veiculacao.' },
    'PENDING_BILLING_INFO→ACTIVE':{ action: 'ad_approved',          description: 'Anuncio aprovado pelo Meta e entrou em veiculacao.' },
    'PENDING_REVIEW→DISAPPROVED': { action: 'ad_disapproved',       description: 'Anuncio reprovado apos revisao do Meta.' },
    'IN_PROCESS→DISAPPROVED':     { action: 'ad_disapproved',       description: 'Anuncio reprovado apos revisao do Meta.' },
    'ACTIVE→DISAPPROVED':         { action: 'ad_disapproved_live',  description: 'Anuncio reprovado enquanto estava no ar.' },
    'PAUSED→DISAPPROVED':         { action: 'ad_disapproved',       description: 'Anuncio reprovado pelo Meta.' },
    '*→WITH_ISSUES':              { action: 'ad_with_issues',       description: 'Anuncio com problema detectado pelo Meta.' },
  };

  for (const c of campaigns) {
    /* Busca o effective_status anterior ANTES de sobrescrever — detecta transições.
       Também lê payload local pra recuperar destUrl (necessário pra detectar
       fallback wa.me/ — Meta só retorna OUTCOME_TRAFFIC sem destino). */
    let prevEffectiveStatus = null;
    let prevPayload = {};
    try {
      const prevResult = await db.query(
        `SELECT effective_status, payload FROM campaigns WHERE platform = ? AND platform_campaign_id = ?`,
        [platform, c.id]
      );
      prevEffectiveStatus = prevResult.rows[0]?.effective_status || null;
      try {
        prevPayload = prevResult.rows[0]?.payload
          ? (typeof prevResult.rows[0].payload === 'string'
              ? JSON.parse(prevResult.rows[0].payload)
              : prevResult.rows[0].payload)
          : {};
      } catch { /* payload corrompido — segue com {} */ }
    } catch { /* best-effort — não bloqueia sync se falhar */ }

    /* Override conversions = clicks pra campanhas de mensagens via wa.me/.
       Sem isso, conversions fica em 0 e o Dashboard mostra "—" no card
       "Custo por resultado", passando impressão de campanha falhando.
       Mantém clicks/impressions/spent originais — só preenche conversions
       quando ele está em 0 e o padrão wa.me/ está presente. */
    let mappedConversions = c.conversions;
    const wasMappedFromClicks = (
      (!c.conversions || c.conversions === 0)
      && c.clicks > 0
      && isMessagesViaWaLink(c.objective, prevPayload)
    );
    if (wasMappedFromClicks) {
      mappedConversions = c.clicks;
    }

    const payload = {
      ...prevPayload, /* preserva destUrl, locations, metaPublishResult, etc */
      objective: c.objective,
      reach: c.reach,
      ctr: c.ctr,
      cpc: c.cpc,
      cpm: c.cpm,
      effective_status: c.effective_status,
      synced_at: new Date().toISOString(),
      conversions_mapped_from_clicks: wasMappedFromClicks || undefined,
    };
    /* Bug A fix: snapshot de payload.campaign / payload.ad_set salvo no publish
       fica desatualizado pra sempre se não atualizarmos no sync. Sobrescreve
       status com valor fresco do Meta (raw vem do fetchCampaigns). Adset status
       normalmente segue campaign (best-effort sync). */
    const rawStatus = c.raw?.status || null;
    if (prevPayload?.campaign && rawStatus) {
      payload.campaign = {
        ...prevPayload.campaign,
        status: rawStatus,
        effective_status: c.effective_status || prevPayload.campaign.effective_status,
      };
    }
    if (prevPayload?.ad_set && rawStatus) {
      payload.ad_set = {
        ...prevPayload.ad_set,
        status: rawStatus,
      };
    }
    /* Preserva effective_status existente se Meta não retornar (failsafe) */
    const effectiveStatus = c.effective_status || null;
    await db.query(
      `INSERT INTO campaigns
        (name, platform, platform_campaign_id, status, effective_status, budget, spent, clicks, impressions, conversions, start_date, end_date, payload, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (platform, platform_campaign_id) DO UPDATE SET
         name = excluded.name,
         status = excluded.status,
         effective_status = COALESCE(excluded.effective_status, campaigns.effective_status),
         budget = excluded.budget,
         spent = excluded.spent,
         clicks = excluded.clicks,
         impressions = excluded.impressions,
         conversions = excluded.conversions,
         start_date = excluded.start_date,
         end_date = excluded.end_date,
         payload = excluded.payload,
         updated_at = datetime('now')`,
      [c.name, platform, c.id, c.status, effectiveStatus, c.budget, c.spent, c.clicks, c.impressions,
       mappedConversions, c.start_date, c.end_date, JSON.stringify(payload)]
    );
    upserted++;

    /* Registra transição em activity_log se o effective_status mudou */
    const newES = c.effective_status;
    if (newES && prevEffectiveStatus !== newES) {
      const transitionKey = `${prevEffectiveStatus || 'null'}→${newES}`;
      const wildcardKey   = `*→${newES}`;
      const event = STATUS_TRANSITIONS[transitionKey] || STATUS_TRANSITIONS[wildcardKey];
      if (event) {
        try {
          await db.query(
            `INSERT INTO activity_log (action, entity, entity_id, description, meta, created_at)
             VALUES (?, ?, ?, ?, ?, datetime('now'))`,
            [
              event.action,
              'campaign',
              null,
              `${event.description} (${c.name})`,
              JSON.stringify({ campaign_name: c.name, platform_campaign_id: c.id, from: prevEffectiveStatus, to: newES }),
            ]
          );
          console.log(`[sync] transicao de status: "${c.name}" ${prevEffectiveStatus} → ${newES} (${event.action})`);
        } catch (logErr) {
          /* Falha no log nunca bloqueia o sync */
          console.warn('[sync] activity_log insert falhou:', logErr.message);
        }
      }
    }
  }

  /* Insights por ad_set + região/cidade — popula insights_by_district com
     dado REAL do Meta (não mais distribuição equitativa). Roda só pra Meta
     porque é o único que expõe ad_set_id por campanha publicada via wizard.
     Best-effort: falha em um ad_set não bloqueia o sync inteiro. */
  if (platform === 'meta' && handler.fetchAdSetInsights) {
    try {
      /* Pega só campanhas publicadas via wizard (têm metaPublishResult.ad_sets) */
      const campsResult = await db.query(
        `SELECT id, payload FROM campaigns
          WHERE platform = 'meta' AND platform_campaign_id IS NOT NULL`,
        []
      );
      let totalAdSetsScanned = 0;
      let totalRowsInserted = 0;
      for (const c of campsResult.rows) {
        let payload = {};
        try { payload = c.payload ? JSON.parse(c.payload) : {}; } catch {}
        const adSets = payload?.metaPublishResult?.ad_sets || [];
        const locations = Array.isArray(payload?.locations) ? payload.locations : [];
        if (adSets.length === 0) continue;

        for (const as of adSets) {
          if (!as?.ad_set_id) continue;
          totalAdSetsScanned++;
          let rows = [];
          try {
            rows = await handler.fetchAdSetInsights(creds, as.ad_set_id, { breakdowns: 'region,city' });
          } catch (e) {
            console.warn('[sync] fetchAdSetInsights falhou pra ad_set', as.ad_set_id, '—', e.message);
            continue;
          }
          for (const row of rows) {
            /* Mapeia city/region pro bairro do payload por matching de nome.
               Meta retorna nomes oficiais ("Boa Vista, Joinville") — nem sempre
               1:1 com nossos bairros. Estratégia:
               1. Match exato case-insensitive em locations[].name
               2. Se falhar, usa o próprio city retornado como district label
                  (mantém o dado, só não casa com o catálogo). */
            const cityName = row.city || row.region || null;
            if (!cityName) continue;
            const norm = String(cityName).toLowerCase().trim();
            const matched = locations.find(l =>
              l?.name && String(l.name).toLowerCase().trim() === norm
            );
            const districtLabel = matched?.name || cityName;
            const safeFloat = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
            const safeInt = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; };
            const conversions = (Array.isArray(row.actions) ? row.actions : [])
              .filter(a => CONVERSION_ACTION_TYPES.includes(a.action_type))
              .reduce((s, a) => s + safeInt(a.value), 0);
            try {
              await db.query(
                `INSERT INTO insights_by_district
                  (campaign_id, ad_set_id, ring_key, district, region, city,
                   date_start, date_stop, spend, impressions, clicks, conversions)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [c.id, as.ad_set_id, as.ring_key || null, districtLabel,
                 row.region || null, row.city || null,
                 row.date_start, row.date_stop,
                 safeFloat(row.spend), safeInt(row.impressions),
                 safeInt(row.clicks), conversions]
              );
              totalRowsInserted++;
            } catch (insertErr) {
              console.warn('[sync] INSERT insights_by_district falhou:', insertErr.message);
            }
          }
        }
      }
      if (totalAdSetsScanned > 0) {
        console.warn('[sync] insights_by_district: scanned', totalAdSetsScanned, 'ad_sets, inseridas', totalRowsInserted, 'linhas');
      }
    } catch (e) {
      console.warn('[sync] insights_by_district skip:', e.message);
    }
  }

  if (platform === 'meta' && handler.fetchAccountInsights) {
    try {
      const insights = await handler.fetchAccountInsights(creds, { level: 'campaign' });
      for (const row of insights) {
        const campResult = await db.query(
          'SELECT id, payload, conversions FROM campaigns WHERE platform = ? AND platform_campaign_id = ?',
          ['meta', row.campaign_id]
        );
        const campRow = campResult.rows[0];
        const campId = campRow?.id;
        if (!campId) continue;
        let campPayload = {};
        try {
          campPayload = campRow?.payload
            ? (typeof campRow.payload === 'string' ? JSON.parse(campRow.payload) : campRow.payload)
            : {};
        } catch { /* payload corrompido — segue com {} */ }
        /* Mesma lista que fetchCampaigns usa — evita divergência entre
           número de conversões mostrado na campanha vs. nos insights. */
        let conversions =
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

        /* Mesma regra do loop de campaigns acima: para campanhas messages
           via wa.me/, conversions = clicks (link click no Meta = mensagem
           iniciada na prática). Mantém raw original — só sobrescreve o
           valor agregado que o Dashboard consome. */
        const rowClicks = safeInt(row.clicks);
        const objectiveForInsight = campPayload?.objective || row.objective;
        if (
          conversions === 0
          && rowClicks > 0
          && isMessagesViaWaLink(objectiveForInsight, campPayload)
        ) {
          conversions = rowClicks;
        }

        /* ON CONFLICT casa com o índice parcial uniq_insights_period_camp
           (WHERE ad_id IS NULL). Esse INSERT só passa campaign_id, sem
           ad_id — campanha-level. PG exige WHERE no ON CONFLICT pra
           bater com índice parcial; SQLite aceita também.
           Em SQLite, datetime('now') (substituído por NOW() no driver PG)
           atualiza fetched_at no UPDATE. */
        await db.query(
          `INSERT INTO insights
            (campaign_id, date_start, date_stop, spend, impressions, reach, clicks, ctr, cpc, cpm, conversions, raw)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (campaign_id, date_start, date_stop) WHERE ad_id IS NULL DO UPDATE SET
             spend = excluded.spend,
             impressions = excluded.impressions,
             reach = excluded.reach,
             clicks = excluded.clicks,
             ctr = excluded.ctr,
             cpc = excluded.cpc,
             cpm = excluded.cpm,
             conversions = excluded.conversions,
             raw = excluded.raw,
             fetched_at = datetime('now')`,
          [campId, row.date_start, row.date_stop,
           safeFloat(row.spend), safeInt(row.impressions),
           safeInt(row.reach), rowClicks,
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
