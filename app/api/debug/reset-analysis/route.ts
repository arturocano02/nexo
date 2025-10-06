import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Create a client bound to the user's JWT so RLS auth.uid() works
function supabaseFromAuthHeader(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const auth = req.headers.get("authorization") || ""
  return createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const supa = supabaseFromAuthHeader(req)
    
    // Get user
    const { data: me, error: meErr } = await supa.auth.getUser()
    if (meErr || !me?.user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }
    const userId = me.user.id

    // Delete existing analysis_state
    const { error: deleteErr } = await supa
      .from("analysis_state")
      .delete()
      .eq("user_id", userId)
    
    if (deleteErr) {
      console.error("Error deleting analysis_state:", deleteErr)
      return NextResponse.json({ error: "Failed to reset analysis state" }, { status: 500 })
    }
    
    // Create a new analysis_state with null values
    const { error: insertErr } = await supa
      .from("analysis_state")
      .insert({
        user_id: userId,
        last_processed_message_id: null,
        last_processed_at: null,
        last_refresh_result: {}
      })
    
    if (insertErr) {
      console.error("Error creating new analysis_state:", insertErr)
      return NextResponse.json({ error: "Failed to create new analysis state" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Analysis state reset successfully"
    })

  } catch (error: any) {
    console.error("Debug reset analysis error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to reset analysis state" },
      { status: 500 }
    )
  }
}
