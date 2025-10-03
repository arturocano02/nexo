-- Fix view_updates source check constraint to allow all valid source values
-- First, drop the existing constraint if it exists
ALTER TABLE view_updates DROP CONSTRAINT IF EXISTS view_updates_source_check;

-- Add the updated constraint that allows all the source values used in the codebase
ALTER TABLE view_updates ADD CONSTRAINT view_updates_source_check 
  CHECK (source IN ('survey', 'refresh_since', 'recompute', 'chat'));

-- Ensure the view_updates table exists with the correct structure if it doesn't already
CREATE TABLE IF NOT EXISTS view_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  delta JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_view_updates_user_id ON view_updates(user_id);
CREATE INDEX IF NOT EXISTS idx_view_updates_source ON view_updates(source);
CREATE INDEX IF NOT EXISTS idx_view_updates_created_at ON view_updates(created_at);

-- Enable RLS
ALTER TABLE view_updates ENABLE ROW LEVEL SECURITY;

-- Create RLS policy - users can only access their own view updates
CREATE POLICY "Users can access their own view updates" ON view_updates
  FOR ALL USING (auth.uid() = user_id);
