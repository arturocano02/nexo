-- Complete Nexo Database Schema
-- This migration ensures all required tables exist with proper structure and RLS

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  bio TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for profiles
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

-- ============================================================================
-- SURVEY_RESPONSES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_user_id ON public.survey_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_created_at ON public.survey_responses(created_at);

-- RLS for survey_responses
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own surveys" ON public.survey_responses;
CREATE POLICY "Users can view their own surveys" ON public.survey_responses
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own surveys" ON public.survey_responses;
CREATE POLICY "Users can insert their own surveys" ON public.survey_responses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- VIEWS_SNAPSHOTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.views_snapshots (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pillars JSONB NOT NULL DEFAULT '{}'::jsonb,
  top_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary_message TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_views_snapshots_updated_at ON public.views_snapshots(updated_at);

-- RLS for views_snapshots
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

-- ============================================================================
-- CONVERSATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'Political Discussion',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON public.conversations(created_at);

-- RLS for conversations
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

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- RLS for messages
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

-- ============================================================================
-- VIEW_UPDATES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.view_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('survey', 'refresh_since', 'chat', 'recompute')),
  delta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_view_updates_user_id ON public.view_updates(user_id);
CREATE INDEX IF NOT EXISTS idx_view_updates_created_at ON public.view_updates(created_at);
CREATE INDEX IF NOT EXISTS idx_view_updates_source ON public.view_updates(source);

-- RLS for view_updates
ALTER TABLE public.view_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own updates" ON public.view_updates;
CREATE POLICY "Users can view their own updates" ON public.view_updates
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own updates" ON public.view_updates;
CREATE POLICY "Users can insert their own updates" ON public.view_updates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- AGGREGATES TABLE (Public readable)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.aggregates (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE), -- Single row
  member_count INTEGER NOT NULL DEFAULT 0,
  pillar_means JSONB NOT NULL DEFAULT '{}'::jsonb,
  top_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  compass_distribution JSONB DEFAULT '{}'::jsonb,
  top_contributor JSONB DEFAULT '{}'::jsonb,
  party_summary TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for aggregates (public readable, authenticated can write)
ALTER TABLE public.aggregates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view aggregates" ON public.aggregates;
CREATE POLICY "Anyone can view aggregates" ON public.aggregates
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can update aggregates" ON public.aggregates;
CREATE POLICY "Authenticated users can update aggregates" ON public.aggregates
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- ANALYSIS_STATE TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.analysis_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_processed_message_id UUID NULL,
  last_processed_at TIMESTAMPTZ NULL,
  last_refresh_result JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analysis_state_updated_at ON public.analysis_state(updated_at);

-- RLS for analysis_state
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

-- ============================================================================
-- MESSAGE_TOPICS TABLE (Optional - for topic tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.message_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0.8,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_topics_user_id ON public.message_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_message_topics_topic ON public.message_topics(topic);
CREATE INDEX IF NOT EXISTS idx_message_topics_message_id ON public.message_topics(message_id);

-- RLS for message_topics
ALTER TABLE public.message_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own message topics" ON public.message_topics;
CREATE POLICY "Users can view their own message topics" ON public.message_topics
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
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
-- INITIALIZE AGGREGATES ROW
-- ============================================================================
INSERT INTO public.aggregates (id, member_count, pillar_means, top_issues, compass_distribution, top_contributor, party_summary)
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
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE public.profiles IS 'User profiles with display names';
COMMENT ON TABLE public.survey_responses IS 'User survey responses (5 questions with MCQ + free text)';
COMMENT ON TABLE public.views_snapshots IS 'Current political profile snapshot for each user';
COMMENT ON TABLE public.conversations IS 'User conversation threads';
COMMENT ON TABLE public.messages IS 'Messages within conversations';
COMMENT ON TABLE public.view_updates IS 'Audit trail of political profile updates';
COMMENT ON TABLE public.aggregates IS 'Anonymous aggregate statistics (single row, publicly readable)';
COMMENT ON TABLE public.analysis_state IS 'Tracks last processed message for incremental analysis';
COMMENT ON TABLE public.message_topics IS 'Topic classification for messages';

