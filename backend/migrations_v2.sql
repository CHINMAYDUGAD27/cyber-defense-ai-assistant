-- Pre-Detection Layer: Schema Migration v2
-- Run this once against the cyberdefense PostgreSQL database.

-- 1. Add 'source' column to incidents table (tracks manual vs watcher-detected)
ALTER TABLE incidents
    ADD COLUMN IF NOT EXISTS source VARCHAR DEFAULT 'manual' NOT NULL;

-- 2. Create watcher_configs table (per-user watcher settings)
CREATE TABLE IF NOT EXISTS watcher_configs (
    id              SERIAL PRIMARY KEY,
    user_email      VARCHAR UNIQUE NOT NULL,
    enabled         BOOLEAN DEFAULT FALSE,
    log_file_path   VARCHAR,
    scan_interval   INTEGER DEFAULT 5,
    use_simulator   BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_watcher_configs_user_email ON watcher_configs (user_email);
