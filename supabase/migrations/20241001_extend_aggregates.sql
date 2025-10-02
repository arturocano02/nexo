-- Extend aggregates table with new fields
ALTER TABLE aggregates ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 0;
ALTER TABLE aggregates ADD COLUMN IF NOT EXISTS pillar_means JSONB DEFAULT '{}';
ALTER TABLE aggregates ADD COLUMN IF NOT EXISTS top_issues JSONB DEFAULT '[]';
ALTER TABLE aggregates ADD COLUMN IF NOT EXISTS compass_distribution JSONB DEFAULT '{}';
ALTER TABLE aggregates ADD COLUMN IF NOT EXISTS party_summary TEXT DEFAULT '';
ALTER TABLE aggregates ADD COLUMN IF NOT EXISTS top_contributor JSONB DEFAULT '{}';

-- Update the existing aggregates row to have the new structure
UPDATE aggregates SET 
  member_count = 0,
  pillar_means = '{}',
  top_issues = '[]',
  compass_distribution = '{}',
  party_summary = '',
  top_contributor = '{}'
WHERE id = true;
