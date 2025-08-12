-- Add speaker diarization tables for tracking speaker segments and timeline

-- Speaker segments table for tracking individual speaker contributions
CREATE TABLE IF NOT EXISTS speaker_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    speaker_id VARCHAR(50) NOT NULL,
    start_time DECIMAL(10,3) NOT NULL,
    end_time DECIMAL(10,3) NOT NULL,
    text TEXT,
    word_count INTEGER DEFAULT 0,
    confidence DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Speaker words table for word-level speaker attribution
CREATE TABLE IF NOT EXISTS speaker_words (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    transcript_id UUID REFERENCES transcripts(id) ON DELETE CASCADE,
    speaker_id VARCHAR(50) NOT NULL,
    word VARCHAR(255) NOT NULL,
    start_time DECIMAL(10,3) NOT NULL,
    end_time DECIMAL(10,3) NOT NULL,
    confidence DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Speaker transitions table for tracking speaker changes
CREATE TABLE IF NOT EXISTS speaker_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    from_speaker VARCHAR(50),
    to_speaker VARCHAR(50) NOT NULL,
    transition_time DECIMAL(10,3) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Speaker analytics table for aggregated statistics
CREATE TABLE IF NOT EXISTS speaker_analytics (
    meeting_id UUID PRIMARY KEY REFERENCES meetings(id) ON DELETE CASCADE,
    total_speakers INTEGER DEFAULT 0,
    speaker_stats JSONB DEFAULT '{}',
    transitions_count INTEGER DEFAULT 0,
    overlap_duration DECIMAL(10,3) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Speaker stats table for per-speaker statistics
CREATE TABLE IF NOT EXISTS speaker_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    speaker_id VARCHAR(50) NOT NULL,
    total_speaking_time DECIMAL(10,3) DEFAULT 0,
    word_count INTEGER DEFAULT 0,
    segment_count INTEGER DEFAULT 0,
    first_speech_time DECIMAL(10,3),
    last_speech_time DECIMAL(10,3),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(meeting_id, speaker_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_speaker_segments_meeting_id ON speaker_segments(meeting_id);
CREATE INDEX IF NOT EXISTS idx_speaker_segments_speaker_id ON speaker_segments(speaker_id);
CREATE INDEX IF NOT EXISTS idx_speaker_segments_time ON speaker_segments(start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_speaker_words_meeting_id ON speaker_words(meeting_id);
CREATE INDEX IF NOT EXISTS idx_speaker_words_transcript_id ON speaker_words(transcript_id);
CREATE INDEX IF NOT EXISTS idx_speaker_words_speaker_id ON speaker_words(speaker_id);

CREATE INDEX IF NOT EXISTS idx_speaker_transitions_meeting_id ON speaker_transitions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_speaker_transitions_time ON speaker_transitions(transition_time);

CREATE INDEX IF NOT EXISTS idx_speaker_stats_meeting_id ON speaker_stats(meeting_id);
CREATE INDEX IF NOT EXISTS idx_speaker_stats_speaker_id ON speaker_stats(speaker_id);