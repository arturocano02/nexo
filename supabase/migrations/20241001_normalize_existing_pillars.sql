-- Normalize existing views_snapshots pillars to fix nested score objects
-- Run this in Supabase SQL editor to clean up existing corrupted data

UPDATE views_snapshots
SET pillars = jsonb_build_object(
  'economy', jsonb_build_object(
    'score', COALESCE(
      (pillars->'economy'->>'score')::int, 
      (pillars->'economy'->'score'->>'score')::int, 
      50
    ), 
    'rationale', COALESCE(pillars->'economy'->>'rationale', '')
  ),
  'social', jsonb_build_object(
    'score', COALESCE(
      (pillars->'social'->>'score')::int, 
      (pillars->'social'->'score'->>'score')::int, 
      50
    ), 
    'rationale', COALESCE(pillars->'social'->>'rationale', '')
  ),
  'environment', jsonb_build_object(
    'score', COALESCE(
      (pillars->'environment'->>'score')::int, 
      (pillars->'environment'->'score'->>'score')::int, 
      50
    ), 
    'rationale', COALESCE(pillars->'environment'->>'rationale', '')
  ),
  'governance', jsonb_build_object(
    'score', COALESCE(
      (pillars->'governance'->>'score')::int, 
      (pillars->'governance'->'score'->>'score')::int, 
      50
    ), 
    'rationale', COALESCE(pillars->'governance'->>'rationale', '')
  ),
  'foreign', jsonb_build_object(
    'score', COALESCE(
      (pillars->'foreign'->>'score')::int, 
      (pillars->'foreign'->'score'->>'score')::int, 
      50
    ), 
    'rationale', COALESCE(pillars->'foreign'->>'rationale', '')
  )
)
WHERE pillars IS NOT NULL;

