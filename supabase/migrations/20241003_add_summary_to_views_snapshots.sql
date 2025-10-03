-- Add summary_message column to views_snapshots table
-- This stores the analysis summary generated on each refresh

ALTER TABLE views_snapshots ADD COLUMN IF NOT EXISTS summary_message TEXT DEFAULT '';

-- Add a comment to track when this migration was applied
COMMENT ON COLUMN views_snapshots.summary_message IS 'Analysis summary generated on each refresh - added 2024-10-03';
