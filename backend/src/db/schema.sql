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
  payload TEXT, -- JSON completo do anúncio (locations, criativo, IDs Meta, splits)
  UNIQUE (platform, platform_campaign_id)
);

CREATE TABLE IF NOT EXISTS platform_credentials (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) UNIQUE NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  account_id VARCHAR(255),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(100) NOT NULL,
  entity_id INTEGER,
  description TEXT,
  meta TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
