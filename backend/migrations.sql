-- PHASE 2: Add recommended_action column to incidents
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS recommended_action TEXT;

-- PHASE 3: Add trigger_phrases column to incidents
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS trigger_phrases TEXT;

-- XSIAM: Add MITRE ATT&CK technique/tactic metadata to incidents
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS mitre_tactic VARCHAR;

-- Account isolation: incidents created after this migration belong to one user.
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS user_email VARCHAR;
CREATE INDEX IF NOT EXISTS ix_incidents_user_email ON incidents(user_email);

-- PHASE 5: Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR NOT NULL,
    incident_id INTEGER REFERENCES incidents(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    risk VARCHAR NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PHASE 6: Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_email VARCHAR UNIQUE NOT NULL,
    notify_low BOOLEAN DEFAULT FALSE,
    notify_medium BOOLEAN DEFAULT TRUE,
    notify_high BOOLEAN DEFAULT TRUE,
    notify_critical BOOLEAN DEFAULT TRUE,
    theme VARCHAR DEFAULT 'dark',
    groq_api_key VARCHAR, -- PHASE 4
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
