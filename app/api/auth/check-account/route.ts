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

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    const supabase = createAdminClient()
    
    // Check if user exists by trying to list users and filtering by email
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers()
    
    if (usersError) {
      console.error('Users list error:', usersError)
      return NextResponse.json({ error: 'Failed to check account' }, { status: 500 })
    }
    
    // Find user by email
    const user = users?.users?.find(u => u.email === email)
    
    if (user) {
      return NextResponse.json({ 
        exists: true,
        message: 'Account exists - please sign in',
        emailConfirmed: user.email_confirmed_at !== null
      })
    }
    
    return NextResponse.json({ 
      exists: false,
      message: 'Account does not exist - you can sign up'
    })
    
  } catch (error: any) {
    console.error('Check account error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check account' },
      { status: 500 }
    )
  }
}
