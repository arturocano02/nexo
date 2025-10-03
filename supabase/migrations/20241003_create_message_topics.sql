-- Create message_topics table for tracking conversation topics
CREATE TABLE IF NOT EXISTS public.message_topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0.8,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_message_topics_user_id ON public.message_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_message_topics_topic ON public.message_topics(topic);
CREATE INDEX IF NOT EXISTS idx_message_topics_created_at ON public.message_topics(created_at);
CREATE INDEX IF NOT EXISTS idx_message_topics_message_id ON public.message_topics(message_id);

-- Enable RLS
ALTER TABLE public.message_topics ENABLE ROW LEVEL SECURITY;

-- Create RLS policy - users can only access their own message topics
CREATE POLICY "Users can access their own message topics" ON public.message_topics
  FOR ALL USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE public.message_topics IS 'Tracks conversation topics for analytics and user insights';
COMMENT ON COLUMN public.message_topics.topic IS 'The inferred topic from the conversation';
COMMENT ON COLUMN public.message_topics.confidence IS 'Confidence score (0-1) for the topic inference';
