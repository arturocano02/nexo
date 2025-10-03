#!/usr/bin/env node

/**
 * Apply database migration to add summary_message column
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

console.log('🔧 Applying Database Migration')
console.log('==============================')

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyMigration() {
  try {
    console.log('📋 Checking if summary_message column exists...')
    
    // Try to select the summary_message column
    const { data, error } = await supabase
      .from('views_snapshots')
      .select('summary_message')
      .limit(1)
    
    if (error) {
      if (error.message.includes('column "summary_message" does not exist')) {
        console.log('❌ summary_message column does not exist')
        console.log('🔧 Column needs to be added via Supabase dashboard')
        console.log('')
        console.log('📝 SQL to run in Supabase SQL Editor:')
        console.log('------------------------------------')
        console.log('ALTER TABLE views_snapshots ADD COLUMN IF NOT EXISTS summary_message TEXT DEFAULT \'\';')
        console.log('COMMENT ON COLUMN views_snapshots.summary_message IS \'Analysis summary generated on each refresh - added 2024-10-03\';')
        console.log('')
        console.log('⚠️  Please run this SQL in your Supabase dashboard SQL Editor')
        return false
      } else {
        console.error('❌ Database error:', error.message)
        return false
      }
    } else {
      console.log('✅ summary_message column already exists')
      return true
    }
    
  } catch (error) {
    console.error('❌ Migration check failed:', error.message)
    return false
  }
}

async function checkTableAccess() {
  console.log('🔍 Checking table access...')
  
  const tables = [
    'views_snapshots',
    'messages', 
    'survey_responses',
    'aggregates',
    'conversations',
    'view_updates',
    'profiles'
  ]
  
  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1)
      
      if (error) {
        console.log(`❌ ${table}: ${error.message}`)
      } else {
        console.log(`✅ ${table}: accessible`)
      }
    } catch (err) {
      console.log(`❌ ${table}: ${err.message}`)
    }
  }
}

async function main() {
  console.log('Starting database migration check...\n')
  
  const migrationOk = await applyMigration()
  console.log('')
  await checkTableAccess()
  
  if (!migrationOk) {
    console.log('\n❌ Migration required')
    console.log('   Please run the SQL command above in your Supabase dashboard')
    process.exit(1)
  } else {
    console.log('\n✅ Database is ready')
    process.exit(0)
  }
}

main().catch(error => {
  console.error('\n💥 Script error:', error)
  process.exit(1)
})
