-- Add missing columns to existing tables

-- Add missing columns to transcripts table if they don't exist
ALTER TABLE transcripts 
ADD COLUMN IF NOT EXISTS start_time DECIMAL(10,3);

ALTER TABLE transcripts 
ADD COLUMN IF NOT EXISTS end_time DECIMAL(10,3);

ALTER TABLE transcripts 
ADD COLUMN IF NOT EXISTS word_index INTEGER;

ALTER TABLE transcripts 
ADD COLUMN IF NOT EXISTS speaker_id VARCHAR(50);

ALTER TABLE transcripts 
ADD COLUMN IF NOT EXISTS speaker_confidence DECIMAL(3,2);

-- Ensure speaker_segments has word_count column
ALTER TABLE speaker_segments 
ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0;