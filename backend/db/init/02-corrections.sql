-- Global corrections system for transcript accuracy
-- This allows users to correct transcription errors once and apply them globally

-- Global corrections table - stores organization-wide corrections
CREATE TABLE IF NOT EXISTS global_corrections (
    id SERIAL PRIMARY KEY,
    original_term VARCHAR(255) NOT NULL,
    corrected_term VARCHAR(255) NOT NULL,
    category VARCHAR(50) DEFAULT 'general', -- 'technical', 'proper_noun', 'acronym', 'company', etc.
    confidence_threshold FLOAT DEFAULT 0.8,
    auto_apply BOOLEAN DEFAULT true,
    case_sensitive BOOLEAN DEFAULT false,
    whole_word_only BOOLEAN DEFAULT true,
    created_by_user_id VARCHAR(255), -- For future user tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

-- Track which corrections were applied to which meetings (for analytics)
CREATE TABLE IF NOT EXISTS correction_applications (
    id SERIAL PRIMARY KEY,
    correction_id INTEGER REFERENCES global_corrections(id) ON DELETE CASCADE,
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    applied_count INTEGER DEFAULT 0, -- How many instances were corrected
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes and constraints for performance
CREATE INDEX IF NOT EXISTS idx_global_corrections_original ON global_corrections(original_term);
CREATE INDEX IF NOT EXISTS idx_global_corrections_active ON global_corrections(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_global_corrections_usage ON global_corrections(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_correction_applications_meeting ON correction_applications(meeting_id);
CREATE INDEX IF NOT EXISTS idx_correction_applications_correction ON correction_applications(correction_id);

-- Add unique constraint for correction applications  
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'uk_correction_applications_correction_meeting'
    ) THEN
        ALTER TABLE correction_applications 
        ADD CONSTRAINT uk_correction_applications_correction_meeting 
        UNIQUE (correction_id, meeting_id);
    END IF;
END $$;

-- Insert some common tech term corrections as examples
INSERT INTO global_corrections (original_term, corrected_term, category, auto_apply) VALUES
('Sirena', 'Serena', 'technical', true),
('Antrhopic', 'Anthropic', 'company', true),
('Clawd', 'Claude', 'product', true),
('GPT', 'GPT', 'acronym', true),
('API', 'API', 'acronym', true),
('Kubernetes', 'Kubernetes', 'technical', true),
('PostgreSQL', 'PostgreSQL', 'technical', true),
('JavaScript', 'JavaScript', 'technical', true),
('TypeScript', 'TypeScript', 'technical', true),
('React', 'React', 'technical', true)
ON CONFLICT DO NOTHING;