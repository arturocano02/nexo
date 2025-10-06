import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Create a client for admin operations
function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // Use anon key since we don't have service role key in production
  
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
    
    // Check if user exists by trying to sign in with a dummy password
    // This will return "Invalid login credentials" if the user exists
    // and "User not found" if the user doesn't exist
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: "dummy_password_for_check_only"
    })
    
    // User exists if we get "Invalid login credentials"
    // User doesn't exist if we get "User not found" or similar
    const userExists = signInError?.message?.includes("Invalid login credentials")
    
    console.log(`Check account for ${email}: ${userExists ? 'exists' : 'does not exist'}`)
    
    // Simulate user object
    const user = userExists ? { email, email_confirmed_at: new Date().toISOString() } : null
    
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
