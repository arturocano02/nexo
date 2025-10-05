-- ============================================================================
-- NEXO COMPLETE DATABASE SCHEMA
-- ============================================================================
-- This schema supports:
-- ✅ Survey analysis and summarizing political views
-- ✅ Individual user political profiles (pillars + top issues)
-- ✅ Party aggregation (member count, top issues with mentions, pillar means)
-- ✅ Top contributor tracking (last 14 days)
-- ✅ Incremental message analysis (only process new messages)
-- ✅ Full RLS security (users isolated, aggregates public)
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. PROFILES TABLE
-- Stores user display names and bio
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  bio TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON public.profiles(display_name);

-- ============================================================================
-- 2. SURVEY_RESPONSES TABLE
-- Stores raw survey answers in JSONB format (5 questions)
-- Used for initial political profile analysis
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own surveys" ON public.survey_responses;
CREATE POLICY "Users can view their own surveys" ON public.survey_responses
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own surveys" ON public.survey_responses;
CREATE POLICY "Users can insert their own surveys" ON public.survey_responses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_survey_responses_user_id ON public.survey_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_created_at ON public.survey_responses(created_at);

-- ============================================================================
-- 3. VIEWS_SNAPSHOTS TABLE
-- Current political profile for each user
-- Structure:
-- - pillars: {economy: {score: 0-100, rationale: "..."}, social: {...}, ...}
-- - top_issues: [{title: "...", summary: "...", mentions: 5}, ...]
-- - summary_message: "Plain English summary of recent changes"
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.views_snapshots (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pillars JSONB NOT NULL DEFAULT '{}'::jsonb,
  top_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary_message TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.views_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own snapshot" ON public.views_snapshots;
CREATE POLICY "Users can view their own snapshot" ON public.views_snapshots
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own snapshot" ON public.views_snapshots;
CREATE POLICY "Users can insert their own snapshot" ON public.views_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own snapshot" ON public.views_snapshots;
CREATE POLICY "Users can update their own snapshot" ON public.views_snapshots
  FOR UPDATE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_views_snapshots_updated_at ON public.views_snapshots(updated_at);
CREATE INDEX IF NOT EXISTS idx_views_snapshots_created_at ON public.views_snapshots(created_at);

-- ============================================================================
-- 4. CONVERSATIONS TABLE
-- User chat threads (one per user)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'Political Discussion',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
CREATE POLICY "Users can view their own conversations" ON public.conversations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own conversations" ON public.conversations;
CREATE POLICY "Users can insert their own conversations" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own conversations" ON public.conversations;
CREATE POLICY "Users can update their own conversations" ON public.conversations
  FOR UPDATE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON public.conversations(created_at);

-- ============================================================================
-- 5. MESSAGES TABLE
-- All chat messages (user + assistant)
-- Used for analyzing conversation and updating political views
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
CREATE POLICY "Users can view messages in their conversations" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON public.messages;
CREATE POLICY "Users can insert messages in their conversations" ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_role ON public.messages(role);

-- ============================================================================
-- 6. VIEW_UPDATES TABLE
-- Audit trail of all political profile updates
-- Tracks source (survey, refresh_since, chat, recompute) and delta applied
-- Used for debugging and tracking how views evolved
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.view_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('survey', 'refresh_since', 'chat', 'recompute')),
  delta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.view_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own updates" ON public.view_updates;
CREATE POLICY "Users can view their own updates" ON public.view_updates
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own updates" ON public.view_updates;
CREATE POLICY "Users can insert their own updates" ON public.view_updates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_view_updates_user_id ON public.view_updates(user_id);
CREATE INDEX IF NOT EXISTS idx_view_updates_created_at ON public.view_updates(created_at);
CREATE INDEX IF NOT EXISTS idx_view_updates_source ON public.view_updates(source);

-- ============================================================================
-- 7. AGGREGATES TABLE (PUBLIC READABLE)
-- Single-row table with party-wide statistics
-- Structure:
-- - member_count: Total number of users with political profiles
-- - pillar_means: Average scores across all users {economy: 52.3, social: 48.7, ...}
-- - top_issues: Most mentioned issues [{title: "NHS", count: 45}, ...]
-- - compass_distribution: Political compass data for visualization
-- - top_contributor: User with most activity {display_name: "...", metric: 127}
-- - party_summary: AI-generated neutral summary of party trends
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.aggregates (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE), -- Single row constraint
  member_count INTEGER NOT NULL DEFAULT 0,
  pillar_means JSONB NOT NULL DEFAULT '{}'::jsonb,
  top_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  compass_distribution JSONB DEFAULT '{}'::jsonb,
  top_contributor JSONB DEFAULT '{}'::jsonb,
  party_summary TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies (PUBLIC READABLE, authenticated can write)
ALTER TABLE public.aggregates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view aggregates" ON public.aggregates;
CREATE POLICY "Anyone can view aggregates" ON public.aggregates
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can update aggregates" ON public.aggregates;
CREATE POLICY "Authenticated users can update aggregates" ON public.aggregates
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- 8. ANALYSIS_STATE TABLE
-- Tracks which messages have been analyzed for each user
-- Enables incremental analysis (only process new messages)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.analysis_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_processed_message_id UUID NULL,
  last_processed_at TIMESTAMPTZ NULL,
  last_refresh_result JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.analysis_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own analysis state" ON public.analysis_state;
CREATE POLICY "Users can view their own analysis state" ON public.analysis_state
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own analysis state" ON public.analysis_state;
CREATE POLICY "Users can insert their own analysis state" ON public.analysis_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own analysis state" ON public.analysis_state;
CREATE POLICY "Users can update their own analysis state" ON public.analysis_state
  FOR UPDATE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_analysis_state_updated_at ON public.analysis_state(updated_at);
CREATE INDEX IF NOT EXISTS idx_analysis_state_last_processed_at ON public.analysis_state(last_processed_at);

-- ============================================================================
-- 9. MESSAGE_TOPICS TABLE (OPTIONAL)
-- Tracks conversation topics for analytics
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.message_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0.8,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.message_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own message topics" ON public.message_topics;
CREATE POLICY "Users can view their own message topics" ON public.message_topics
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_message_topics_user_id ON public.message_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_message_topics_topic ON public.message_topics(topic);
CREATE INDEX IF NOT EXISTS idx_message_topics_message_id ON public.message_topics(message_id);
CREATE INDEX IF NOT EXISTS idx_message_topics_created_at ON public.message_topics(created_at);

-- ============================================================================
-- TRIGGERS FOR AUTO-UPDATING TIMESTAMPS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_views_snapshots_updated_at ON public.views_snapshots;
CREATE TRIGGER update_views_snapshots_updated_at
  BEFORE UPDATE ON public.views_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_aggregates_updated_at ON public.aggregates;
CREATE TRIGGER update_aggregates_updated_at
  BEFORE UPDATE ON public.aggregates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_analysis_state_updated_at ON public.analysis_state;
CREATE TRIGGER update_analysis_state_updated_at
  BEFORE UPDATE ON public.analysis_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INITIALIZE AGGREGATES ROW (REQUIRED)
-- Creates the single row that holds party-wide statistics
-- ============================================================================
INSERT INTO public.aggregates (
  id, 
  member_count, 
  pillar_means, 
  top_issues, 
  compass_distribution, 
  top_contributor, 
  party_summary
)
VALUES (
  TRUE,
  0,
  '{}'::jsonb,
  '[]'::jsonb,
  '{"bins": {"x": [], "y": [], "counts": []}}'::jsonb,
  '{}'::jsonb,
  'No data available yet. Complete the survey and refresh party data to see insights.'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- HELPER VIEWS FOR ANALYTICS
-- ============================================================================

-- View: User activity in last 14 days (for top contributor calculation)
CREATE OR REPLACE VIEW public.user_activity_14d AS
SELECT 
  u.id as user_id,
  p.display_name,
  COUNT(DISTINCT m.id) as message_count,
  COUNT(DISTINCT vu.id) * 0.5 as view_update_count,
  COUNT(DISTINCT m.id) + (COUNT(DISTINCT vu.id) * 0.5) as total_score
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.messages m ON m.user_id = u.id 
  AND m.created_at > NOW() - INTERVAL '14 days'
  AND m.role = 'user'
LEFT JOIN public.view_updates vu ON vu.user_id = u.id 
  AND vu.created_at > NOW() - INTERVAL '14 days'
WHERE p.display_name IS NOT NULL
GROUP BY u.id, p.display_name
HAVING COUNT(DISTINCT m.id) + (COUNT(DISTINCT vu.id) * 0.5) > 0
ORDER BY total_score DESC;

-- ============================================================================
-- DOCUMENTATION COMMENTS
-- ============================================================================
COMMENT ON TABLE public.profiles IS 'User profiles with display names - one per user';
COMMENT ON TABLE public.survey_responses IS '5-question survey responses stored as JSONB - initial political profile data';
COMMENT ON TABLE public.views_snapshots IS 'Current political profile snapshot per user - pillars (0-100 scores) + top issues with mention counts';
COMMENT ON TABLE public.conversations IS 'Chat conversation threads - typically one per user';
COMMENT ON TABLE public.messages IS 'All chat messages (user + AI assistant) - analyzed to update political views';
COMMENT ON TABLE public.view_updates IS 'Audit trail of profile updates - tracks source and delta for each change';
COMMENT ON TABLE public.aggregates IS 'Party-wide statistics (SINGLE ROW) - member count, issue mentions, pillar averages, top contributor';
COMMENT ON TABLE public.analysis_state IS 'Incremental analysis tracking - stores last processed message to avoid re-analyzing';
COMMENT ON TABLE public.message_topics IS 'Conversation topic classification - tracks what users discuss';

COMMENT ON COLUMN public.views_snapshots.pillars IS 'JSONB: {economy: {score: 0-100, rationale: "..."}, social: {...}, environment: {...}, governance: {...}, foreign: {...}}';
COMMENT ON COLUMN public.views_snapshots.top_issues IS 'JSONB: [{title: "NHS Funding", summary: "...", mentions: 5}, ...]';
COMMENT ON COLUMN public.views_snapshots.summary_message IS 'Plain English summary of recent changes from last refresh';

COMMENT ON COLUMN public.aggregates.member_count IS 'Total users with political profiles (COUNT of views_snapshots rows)';
COMMENT ON COLUMN public.aggregates.pillar_means IS 'JSONB: {economy: 52.3, social: 48.7, ...} - averages across all users';
COMMENT ON COLUMN public.aggregates.top_issues IS 'JSONB: [{title: "NHS", count: 45}, ...] - most mentioned issues across all users';
COMMENT ON COLUMN public.aggregates.top_contributor IS 'JSONB: {user_id: "...", display_name: "...", metric: 127} - most active user (last 14d)';
COMMENT ON COLUMN public.aggregates.party_summary IS 'AI-generated neutral summary of party trends and priorities';

-- ============================================================================
-- VERIFICATION QUERIES
-- Run these to confirm everything is set up correctly
-- ============================================================================

-- Check all tables exist
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'profiles', 
    'survey_responses', 
    'views_snapshots', 
    'conversations', 
    'messages', 
    'view_updates', 
    'aggregates', 
    'analysis_state', 
    'message_topics'
  )
ORDER BY tablename;

-- Check aggregates row initialized
SELECT * FROM public.aggregates;

-- Check RLS is enabled on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'profiles', 
    'survey_responses', 
    'views_snapshots', 
    'conversations', 
    'messages', 
    'view_updates', 
    'aggregates', 
    'analysis_state', 
    'message_topics'
  )
ORDER BY tablename;

-- ============================================================================
-- SETUP COMPLETE! 
-- ============================================================================
-- Next steps:
-- 1. Verify all tables created successfully (run verification queries above)
-- 2. Test your app's survey flow
-- 3. Check that political profiles are created correctly
-- 4. Test the refresh views functionality
-- 5. Test party aggregation refresh
-- ============================================================================

