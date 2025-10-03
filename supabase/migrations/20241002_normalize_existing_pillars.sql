-- Normalize existing pillar scores in views_snapshots to ensure they are numbers
-- This fixes any existing data where pillar scores might be nested objects

UPDATE views_snapshots
SET
  pillars = jsonb_build_object(
    'economy', jsonb_build_object(
      'score', COALESCE(
        (pillars->'economy'->>'score')::numeric,
        (pillars->'economy'->'score'->>'score')::numeric,
        50
      ),
      'rationale', COALESCE(pillars->'economy'->>'rationale', '')
    ),
    'social', jsonb_build_object(
      'score', COALESCE(
        (pillars->'social'->>'score')::numeric,
        (pillars->'social'->'score'->>'score')::numeric,
        50
      ),
      'rationale', COALESCE(pillars->'social'->>'rationale', '')
    ),
    'environment', jsonb_build_object(
      'score', COALESCE(
        (pillars->'environment'->>'score')::numeric,
        (pillars->'environment'->'score'->>'score')::numeric,
        50
      ),
      'rationale', COALESCE(pillars->'environment'->>'rationale', '')
    ),
    'governance', jsonb_build_object(
      'score', COALESCE(
        (pillars->'governance'->>'score')::numeric,
        (pillars->'governance'->'score'->>'score')::numeric,
        50
      ),
      'rationale', COALESCE(pillars->'governance'->>'rationale', '')
    ),
    'foreign', jsonb_build_object(
      'score', COALESCE(
        (pillars->'foreign'->>'score')::numeric,
        (pillars->'foreign'->'score'->>'score')::numeric,
        50
      ),
      'rationale', COALESCE(pillars->'foreign'->>'rationale', '')
    )
  )
WHERE
  -- Only update records where at least one pillar has a nested score object
  jsonb_typeof(pillars->'economy'->'score') = 'object' OR
  jsonb_typeof(pillars->'social'->'score') = 'object' OR
  jsonb_typeof(pillars->'environment'->'score') = 'object' OR
  jsonb_typeof(pillars->'governance'->'score') = 'object' OR
  jsonb_typeof(pillars->'foreign'->'score') = 'object';

-- Add a comment to track when this migration was applied
COMMENT ON TABLE views_snapshots IS 'Pillar scores normalized on 2024-10-02 to ensure numeric values';
