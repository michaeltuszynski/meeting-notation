-- Meeting Intelligence Database Schema
-- Created for the Meeting Intelligence Assistant

-- Enable UUID extension for unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Meetings table - stores meeting sessions
CREATE TABLE meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'ended', 'archived')),
    participant_count INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Transcripts table - stores transcript segments
CREATE TABLE transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    is_final BOOLEAN DEFAULT false,
    confidence DECIMAL(3,2),
    speaker VARCHAR(100),
    speaker_id VARCHAR(50),
    speaker_confidence DECIMAL(3,2),
    start_time DECIMAL(10,3),
    end_time DECIMAL(10,3),
    word_index INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sequence_number INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Extracted terms table - stores terms extracted from meetings
CREATE TABLE extracted_terms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    term VARCHAR(255) NOT NULL,
    frequency INTEGER DEFAULT 1,
    first_occurrence TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_occurrence TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    extracted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Term definitions table - stores definitions (can be shared across meetings)
CREATE TABLE term_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    term VARCHAR(255) UNIQUE NOT NULL,
    definition TEXT,
    sources JSONB,
    language VARCHAR(10) DEFAULT 'en',
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

-- Meeting metadata table - stores additional meeting info
CREATE TABLE meeting_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID UNIQUE NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    duration_seconds INTEGER,
    word_count INTEGER,
    term_count INTEGER,
    key_topics TEXT[],
    summary TEXT,
    sentiment_score DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Meeting participants table (for future multi-user support)
CREATE TABLE meeting_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    name VARCHAR(100),
    email VARCHAR(255),
    role VARCHAR(50),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better query performance
CREATE INDEX idx_meetings_status ON meetings(status);
CREATE INDEX idx_meetings_created_at ON meetings(created_at DESC);
CREATE INDEX idx_transcripts_meeting_id ON transcripts(meeting_id);
CREATE INDEX idx_transcripts_timestamp ON transcripts(meeting_id, timestamp);
CREATE INDEX idx_extracted_terms_meeting_id ON extracted_terms(meeting_id);
CREATE INDEX idx_extracted_terms_term ON extracted_terms(term);
CREATE INDEX idx_term_definitions_term ON term_definitions(term);
CREATE INDEX idx_term_definitions_expires ON term_definitions(expires_at);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for meetings table
CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON meetings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create a view for meeting summaries
CREATE VIEW meeting_summaries AS
SELECT 
    m.id,
    m.title,
    m.description,
    m.start_time,
    m.end_time,
    m.status,
    mm.duration_seconds,
    mm.word_count,
    mm.term_count,
    mm.summary,
    COUNT(DISTINCT t.id) as transcript_count,
    COUNT(DISTINCT et.term) as unique_terms_count
FROM meetings m
LEFT JOIN meeting_metadata mm ON m.id = mm.meeting_id
LEFT JOIN transcripts t ON m.id = t.meeting_id
LEFT JOIN extracted_terms et ON m.id = et.meeting_id
GROUP BY m.id, m.title, m.description, m.start_time, m.end_time, 
         m.status, mm.duration_seconds, mm.word_count, mm.term_count, mm.summary;

-- Grant permissions to the application user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO transcriptiq_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO transcriptiq_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO transcriptiq_user;