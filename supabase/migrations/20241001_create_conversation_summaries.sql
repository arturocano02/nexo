-- Create conversation_summaries table
CREATE TABLE IF NOT EXISTS conversation_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient user lookups
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_user_id ON conversation_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_created_at ON conversation_summaries(created_at);

-- Enable RLS
ALTER TABLE conversation_summaries ENABLE ROW LEVEL SECURITY;

-- Create RLS policy - users can only access their own summaries
CREATE POLICY "Users can access their own conversation summaries" ON conversation_summaries
  FOR ALL USING (auth.uid() = user_id);
