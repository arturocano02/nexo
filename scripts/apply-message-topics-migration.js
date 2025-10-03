#!/usr/bin/env node

/**
 * Apply message_topics table migration
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    const envVars = {}
    
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=')
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim()
        if (value.startsWith('"') && value.endsWith('"')) {
          envVars[key.trim()] = value.slice(1, -1)
        } else {
          envVars[key.trim()] = value
        }
      }
    })
    
    return envVars
  }
  return {}
}

// Load environment variables
const envVars = loadEnvFile()
const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('🔧 Applying Message Topics Migration')
console.log('====================================')

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyMigration() {
  try {
    console.log('📋 Checking if message_topics table exists...')
    
    // Try to select from the table
    const { data, error } = await supabase
      .from('message_topics')
      .select('id')
      .limit(1)
    
    if (error) {
      if (error.message.includes('relation "message_topics" does not exist')) {
        console.log('❌ message_topics table does not exist')
        console.log('🔧 Table needs to be created via Supabase dashboard')
        console.log('')
        console.log('📝 SQL to run in Supabase SQL Editor:')
        console.log('------------------------------------')
        console.log(`
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
        `)
        return false
      } else {
        console.error('❌ Database error:', error.message)
        return false
      }
    } else {
      console.log('✅ message_topics table already exists')
      return true
    }
    
  } catch (error) {
    console.error('❌ Migration check failed:', error.message)
    return false
  }
}

async function testTableAccess() {
  console.log('🔍 Testing table access...')
  
  try {
    const { error } = await supabase
      .from('message_topics')
      .select('id, topic, confidence')
      .limit(1)
    
    if (error) {
      console.log(`❌ message_topics access failed: ${error.message}`)
      return false
    } else {
      console.log('✅ message_topics: accessible')
      return true
    }
  } catch (err) {
    console.log(`❌ message_topics error: ${err.message}`)
    return false
  }
}

async function main() {
  console.log('Starting message topics migration check...\n')
  
  const migrationOk = await applyMigration()
  
  if (!migrationOk) {
    console.log('\n❌ Migration required')
    console.log('   Please run the SQL command above in your Supabase dashboard')
    process.exit(1)
  }
  
  const accessOk = await testTableAccess()
  
  if (!accessOk) {
    console.log('\n❌ Table access failed')
    process.exit(1)
  }
  
  console.log('\n✅ Message topics migration is ready')
  console.log('   Chat topic inference will now work properly')
  process.exit(0)
}

main().catch(error => {
  console.error('\n💥 Script error:', error)
  process.exit(1)
})
