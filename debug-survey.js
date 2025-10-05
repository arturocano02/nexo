// Debug script to check survey data and analysis
require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function debugSurvey() {
  try {
    console.log('🔍 Checking survey responses...')
    
    // Get all survey responses
    const { data: surveys, error: surveyError } = await supabase
      .from('survey_responses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (surveyError) {
      console.error('❌ Survey error:', surveyError)
      return
    }
    
    console.log('📊 Survey responses found:', surveys.length)
    surveys.forEach((survey, i) => {
      console.log(`\nSurvey ${i + 1}:`)
      console.log('User ID:', survey.user_id)
      console.log('Created:', survey.created_at)
      console.log('Responses:', JSON.stringify(survey.responses, null, 2))
    })
    
    console.log('\n🔍 Checking views snapshots...')
    
    // Get all views snapshots
    const { data: snapshots, error: snapshotError } = await supabase
      .from('views_snapshots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (snapshotError) {
      console.error('❌ Snapshot error:', snapshotError)
      return
    }
    
    console.log('📈 Views snapshots found:', snapshots.length)
    snapshots.forEach((snapshot, i) => {
      console.log(`\nSnapshot ${i + 1}:`)
      console.log('User ID:', snapshot.user_id)
      console.log('Created:', snapshot.created_at)
      console.log('Pillars:', JSON.stringify(snapshot.pillars, null, 2))
      console.log('Top Issues:', JSON.stringify(snapshot.top_issues, null, 2))
    })
    
  } catch (error) {
    console.error('❌ Debug error:', error)
  }
}

debugSurvey()
