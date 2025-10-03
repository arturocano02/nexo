#!/usr/bin/env node

/**
 * Test production database schema
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load production environment variables
function loadProductionEnv() {
  const envPath = path.join(__dirname, '..', '.env.production')
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
const envVars = loadProductionEnv()
const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('🔍 Testing Production Database Schema')
console.log('=====================================')

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testViewsSnapshotsSchema() {
  console.log('📋 Testing views_snapshots table schema...')
  
  try {
    // Test 1: Try to select all columns
    console.log('   Test 1: Select all columns...')
    const { data: allData, error: allError } = await supabase
      .from('views_snapshots')
      .select('*')
      .limit(1)
    
    if (allError) {
      console.log(`   ❌ Select all failed: ${allError.message}`)
    } else {
      console.log('   ✅ Select all works')
      if (allData && allData.length > 0) {
        console.log('   📊 Sample data columns:', Object.keys(allData[0]))
      }
    }
    
    // Test 2: Try to select specific columns (what the app uses)
    console.log('   Test 2: Select specific columns...')
    const { data: specificData, error: specificError } = await supabase
      .from('views_snapshots')
      .select('pillars, top_issues')
      .limit(1)
    
    if (specificError) {
      console.log(`   ❌ Select specific failed: ${specificError.message}`)
    } else {
      console.log('   ✅ Select specific works')
    }
    
    // Test 3: Try to select with summary_message
    console.log('   Test 3: Select with summary_message...')
    const { data: summaryData, error: summaryError } = await supabase
      .from('views_snapshots')
      .select('pillars, top_issues, summary_message')
      .limit(1)
    
    if (summaryError) {
      console.log(`   ❌ Select with summary_message failed: ${summaryError.message}`)
      if (summaryError.message.includes('column "summary_message" does not exist')) {
        console.log('   🔧 summary_message column is missing in production!')
        return false
      }
    } else {
      console.log('   ✅ Select with summary_message works')
    }
    
    return true
    
  } catch (error) {
    console.error('   ❌ Schema test failed:', error.message)
    return false
  }
}

async function testOtherTables() {
  console.log('\n📋 Testing other tables...')
  
  const tables = [
    { name: 'messages', columns: 'id, role, content' },
    { name: 'survey_responses', columns: 'id, responses' },
    { name: 'aggregates', columns: 'id, member_count' },
    { name: 'conversations', columns: 'id, title' },
    { name: 'view_updates', columns: 'id, source' },
    { name: 'profiles', columns: 'id, display_name' }
  ]
  
  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table.name)
        .select(table.columns)
        .limit(1)
      
      if (error) {
        console.log(`   ❌ ${table.name}: ${error.message}`)
      } else {
        console.log(`   ✅ ${table.name}: accessible`)
      }
    } catch (err) {
      console.log(`   ❌ ${table.name}: ${err.message}`)
    }
  }
}

async function main() {
  console.log('Starting production database schema test...\n')
  
  const schemaOk = await testViewsSnapshotsSchema()
  await testOtherTables()
  
  if (!schemaOk) {
    console.log('\n❌ Schema issues found')
    console.log('   The summary_message column is missing in production')
    console.log('   This is likely causing the 400 errors in the browser')
    console.log('')
    console.log('🔧 Solution:')
    console.log('   1. Go to your Supabase dashboard')
    console.log('   2. Open the SQL Editor')
    console.log('   3. Run this command:')
    console.log('      ALTER TABLE views_snapshots ADD COLUMN IF NOT EXISTS summary_message TEXT DEFAULT \'\';')
    process.exit(1)
  } else {
    console.log('\n✅ Production database schema is correct')
    console.log('   The 400 error might be coming from a different source')
    process.exit(0)
  }
}

main().catch(error => {
  console.error('\n💥 Script error:', error)
  process.exit(1)
})
