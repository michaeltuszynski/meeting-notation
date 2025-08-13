-- Create settings table for persisting application settings
CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_app_settings_updated_at 
    BEFORE UPDATE ON app_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default settings
INSERT INTO app_settings (key, value) VALUES 
    ('llmProvider', 'openai'),
    ('llmModel', 'gpt-4o-mini'),
    ('transcriptionProvider', 'deepgram'),
    ('knowledgeProvider', 'tavily'),
    ('maxContextLength', '8000'),
    ('enableNotifications', 'true'),
    ('autoSaveInterval', '30'),
    ('transcriptionConfidenceThreshold', '0.8'),
    ('enableContextualIntelligence', 'true'),
    ('enableKnowledgeRetrieval', 'true'),
    ('cacheExpiryHours', '24'),
    ('talkingPointsPrompt', 'Based on this meeting context, generate 3-5 intelligent talking points or questions about "{topic}".

CONTEXT:
{context}

MEETING GLOSSARY:
{glossary}

Generate talking points that show understanding and move the conversation forward.')
ON CONFLICT (key) DO NOTHING;