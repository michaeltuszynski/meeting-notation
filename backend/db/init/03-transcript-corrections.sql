-- Add correction support to transcripts table
ALTER TABLE transcripts 
ADD COLUMN IF NOT EXISTS original_text TEXT,
ADD COLUMN IF NOT EXISTS corrections JSONB;