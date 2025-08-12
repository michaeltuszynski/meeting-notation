-- Add meeting costs table for tracking API usage and costs

CREATE TABLE IF NOT EXISTS meeting_costs (
    meeting_id UUID PRIMARY KEY REFERENCES meetings(id) ON DELETE CASCADE,
    llm_cost DECIMAL(10,6) DEFAULT 0.0,
    transcription_cost DECIMAL(10,6) DEFAULT 0.0,
    knowledge_cost DECIMAL(10,6) DEFAULT 0.0,
    total_cost DECIMAL(10,6) DEFAULT 0.0,
    usage_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_meeting_costs_total_cost ON meeting_costs(total_cost);
CREATE INDEX IF NOT EXISTS idx_meeting_costs_created_at ON meeting_costs(created_at);

-- Add cost data to meeting_metadata table for quick access
ALTER TABLE meeting_metadata 
ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(10,6) DEFAULT 0.0;