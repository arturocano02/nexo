import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Create a client for admin operations
function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient()
    
    // Get total user count from auth.users
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers()
    
    if (usersError) {
      console.error('Users fetch error:', usersError)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }
    
    const totalUsers = users?.users?.length || 0
    const confirmedUsers = users?.users?.filter(user => user.email_confirmed_at !== null).length || 0
    
    // Get users with profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, display_name, created_at')
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (profilesError) {
      console.error('Profiles fetch error:', profilesError)
    }
    
    return NextResponse.json({
      totalUsers,
      confirmedUsers,
      unconfirmedUsers: totalUsers - confirmedUsers,
      recentUsers: profiles || []
    })
    
  } catch (error: any) {
    console.error('User count error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get user count' },
      { status: 500 }
    )
  }
}
