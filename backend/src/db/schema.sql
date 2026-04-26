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
