-- Create analysis_state table
CREATE TABLE IF NOT EXISTS analysis_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_processed_message_id UUID NULL,
  last_processed_at TIMESTAMPTZ NULL,
  last_refresh_result JSONB NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_analysis_state_user_id ON analysis_state(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_state_last_processed_at ON analysis_state(last_processed_at);

-- Enable RLS
ALTER TABLE analysis_state ENABLE ROW LEVEL SECURITY;

-- Create RLS policy - users can only access their own analysis state
CREATE POLICY "Users can access their own analysis state" ON analysis_state
  FOR ALL USING (auth.uid() = user_id);
