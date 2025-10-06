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

    console.log(`[ForceRefresh] Resetting analysis state for user ${userId}`)
    
    // Delete existing analysis_state
    const { error: deleteError } = await supa
      .from("analysis_state")
      .delete()
      .eq("user_id", userId)
      
    if (deleteError) {
      console.error(`[ForceRefresh] Error deleting analysis state:`, deleteError)
      // Continue anyway - we'll create a new one
    }
    
    // Create a new analysis_state with null values to force full analysis
    const { error: insertError } = await supa
      .from("analysis_state")
      .insert({
        user_id: userId,
        last_processed_message_id: null,
        last_processed_at: null,
        last_refresh_result: {}
      })
    
    if (insertError) {
      console.error(`[ForceRefresh] Error creating new analysis state:`, insertError)
      return NextResponse.json({ error: "Failed to reset analysis state" }, { status: 500 })
    }
    
    // Now call the refresh-since endpoint to perform a full analysis
    const refreshResponse = await fetch(`${req.nextUrl.origin}/api/views/refresh-since`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": auth
      },
      body: JSON.stringify({
        maxMessages: 200,
        lookbackDays: 30
      })
    })
    
    if (!refreshResponse.ok) {
      const error = await refreshResponse.json()
      throw new Error(error.error || "Failed to refresh views")
    }
    
    const refreshResult = await refreshResponse.json()
    
    return NextResponse.json({
      ok: true,
      message: "Analysis state reset and full refresh performed",
      processedCount: refreshResult.processedCount,
      snapshot: refreshResult.snapshot,
      changes: refreshResult.changes
    })

  } catch (error: any) {
    console.error("[ForceRefresh] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to force refresh" },
      { status: 500 }
    )
  }
}
