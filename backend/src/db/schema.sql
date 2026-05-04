/* DEPRECATED — auth removida do projeto (sistema é uso interno, sem login).
   Tabela mantida pra evitar erro em DBs já criados, mas NÃO é populada/lida.
   TODO: dropar em migration futura após confirmar que rota auth.js não vai voltar.
   Se reativar auth, REVISAR password_hash (bcrypt cost atual pode estar desatualizado). */
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  platform_campaign_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  effective_status TEXT,
  publish_mode VARCHAR(20) DEFAULT 'immediate',
  budget DECIMAL(10,2),
  spent DECIMAL(10,2) DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  link_clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  start_date DATE,
  end_date DATE,
  scheduled_for TIMESTAMP,
  submitted_at TIMESTAMP,
  review_started_at TIMESTAMP,
  live_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  payload TEXT,
  UNIQUE (platform, platform_campaign_id)
);

CREATE TABLE IF NOT EXISTS platform_credentials (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) UNIQUE NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  account_id VARCHAR(255),
  token_expires_at TIMESTAMP,
  token_type VARCHAR(40),
  scopes TEXT,
  page_id VARCHAR(255),
  ig_business_id VARCHAR(255),
  needs_reconnect INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

/* OAuth state persistido em DB — em serverless multi-instância, Map() em
   memória não sobrevive ao callback. Esta tabela garante que o state
   criado em qualquer function seja validado pela que recebe o callback. */
CREATE TABLE IF NOT EXISTS oauth_states (
  state VARCHAR(64) PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(100) NOT NULL,
  entity_id INTEGER,
  description TEXT,
  meta TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_sets (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  platform_ad_set_id VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  status VARCHAR(50),
  effective_status TEXT,
  daily_budget DECIMAL(10,2),
  lifetime_budget DECIMAL(10,2),
  targeting TEXT,
  optimization_goal VARCHAR(100),
  billing_event VARCHAR(100),
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS creatives (
  id SERIAL PRIMARY KEY,
  platform_creative_id VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  title TEXT,
  body TEXT,
  cta_type VARCHAR(100),
  link_url TEXT,
  image_hash VARCHAR(255),
  video_id VARCHAR(255),
  page_id VARCHAR(255),
  ig_actor_id VARCHAR(255),
  format VARCHAR(40),
  payload TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ads (
  id SERIAL PRIMARY KEY,
  ad_set_id INTEGER REFERENCES ad_sets(id) ON DELETE CASCADE,
  creative_id INTEGER REFERENCES creatives(id) ON DELETE SET NULL,
  platform_ad_id VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  status VARCHAR(50),
  effective_status TEXT,
  review_status VARCHAR(50),
  service VARCHAR(80),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS media (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  kind VARCHAR(20) NOT NULL,
  image_hash VARCHAR(255),
  video_id VARCHAR(255),
  source_url TEXT,
  width INTEGER,
  height INTEGER,
  byte_size INTEGER,
  sha256 VARCHAR(64),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (platform, sha256)
);

CREATE TABLE IF NOT EXISTS insights (
  id SERIAL PRIMARY KEY,
  ad_id INTEGER REFERENCES ads(id) ON DELETE CASCADE,
  ad_set_id INTEGER REFERENCES ad_sets(id) ON DELETE CASCADE,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  date_start DATE NOT NULL,
  date_stop DATE NOT NULL,
  spend DECIMAL(10,2) DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  unique_clicks INTEGER DEFAULT 0,
  ctr DECIMAL(10,4) DEFAULT 0,
  cpc DECIMAL(10,4) DEFAULT 0,
  cpm DECIMAL(10,4) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  cost_per_conversion DECIMAL(10,2) DEFAULT 0,
  raw TEXT,
  fetched_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS insights_by_district (
  id SERIAL PRIMARY KEY,
  ad_id INTEGER REFERENCES ads(id) ON DELETE CASCADE,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  district VARCHAR(120) NOT NULL,
  service VARCHAR(80),
  date_start DATE NOT NULL,
  date_stop DATE NOT NULL,
  spend DECIMAL(10,2) DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  fetched_at TIMESTAMP DEFAULT NOW()
);

/* Migração idempotente — ad_set_id (ID do conjunto Meta) + ring_key
   (primario/medio/externo) pra agregar performance por anel sem
   precisar reler payload. */
ALTER TABLE insights_by_district ADD COLUMN IF NOT EXISTS ad_set_id VARCHAR(64);
ALTER TABLE insights_by_district ADD COLUMN IF NOT EXISTS ring_key VARCHAR(20);
ALTER TABLE insights_by_district ADD COLUMN IF NOT EXISTS region VARCHAR(120);
ALTER TABLE insights_by_district ADD COLUMN IF NOT EXISTS city VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_insights_campaign_date ON insights(campaign_id, date_start);
CREATE INDEX IF NOT EXISTS idx_insights_district ON insights_by_district(district, date_start);
CREATE INDEX IF NOT EXISTS idx_insights_district_service ON insights_by_district(district, service);
CREATE INDEX IF NOT EXISTS idx_insights_ring ON insights_by_district(ring_key, date_start);
CREATE INDEX IF NOT EXISTS idx_insights_adset ON insights_by_district(ad_set_id, date_start);

/* Dedup webhook/ insights — Meta pode reentregar o MESMO evento se
   nossa resposta passar de ~20s (Meta retry policy). Sem UNIQUE,
   cada retry vira uma linha duplicada e os contadores (clicks/spend/
   conversions) ficam inflados.

   Usa CREATE UNIQUE INDEX em vez de ADD CONSTRAINT porque:
   1. SQLite NÃO suporta ALTER TABLE ADD CONSTRAINT
   2. PG não suporta ADD CONSTRAINT IF NOT EXISTS direto
   3. UNIQUE INDEX funciona em ambos drivers e é equivalente pra ON CONFLICT

   Dois índices PARCIAIS: ad_id pode ser NULL (sync de campaign-level
   sem ad específico) e em UNIQUE NULL é tratado como distinto, então
   dedup falha. Solução: índice parcial pra ad_id NULL (campanha) +
   índice parcial pra ad_id NOT NULL (ad-level). Ambos são suportados
   em PG 9.0+ e SQLite 3.8+.

   Idempotente: IF NOT EXISTS + try/catch no migrate.js cobrem o caso
   de já existirem linhas duplicadas em prod (CREATE UNIQUE INDEX falha
   se há duplicatas — o catch mantém o sync rodando). */
CREATE UNIQUE INDEX IF NOT EXISTS uniq_insights_period_camp
  ON insights (campaign_id, date_start, date_stop)
  WHERE ad_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_insights_period_ad
  ON insights (campaign_id, ad_id, date_start, date_stop)
  WHERE ad_id IS NOT NULL;

/* Análises de concorrente — feature "Espionar Concorrente" da CreativeLibrary.
   items, descriptions, insights são JSON serializado em TEXT pra manter
   compatibilidade SQLite (dev) e PG (prod). source_url é o link público
   da Facebook Ads Library do anunciante. */
CREATE TABLE IF NOT EXISTS competitor_analyses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  source_url TEXT,
  items TEXT,
  descriptions TEXT,
  insights TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_competitor_analyses_created ON competitor_analyses(created_at DESC);

/* Dedup de eventos webhook — replay guard contra reentregas do Meta.
   Meta pode reentregar o mesmo evento se nossa resposta demorar >20s.
   O agente 2 usa esta tabela em routes/webhooks.js para checar/registrar
   event_id antes de processar, tornando o handler idempotente. */
CREATE TABLE IF NOT EXISTS processed_webhook_events (
  event_id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'meta',
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pwe_processed_at ON processed_webhook_events(processed_at);
