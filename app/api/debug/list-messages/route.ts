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

export async function GET(req: NextRequest) {
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

    // Get user's conversation
    const { data: conversation, error: convErr } = await supa
      .from("conversations")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle()
    
    if (convErr) {
      return NextResponse.json({ error: "Failed to get conversation" }, { status: 500 })
    }
    
    if (!conversation) {
      return NextResponse.json({ error: "No conversation found" }, { status: 404 })
    }

    // Get messages
    const { data: messages, error: msgsErr } = await supa
      .from("messages")
      .select("id, content, role, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
    
    if (msgsErr) {
      return NextResponse.json({ error: "Failed to get messages" }, { status: 500 })
    }

    // Get analysis_state
    const { data: analysisState, error: stateErr } = await supa
      .from("analysis_state")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
    
    return NextResponse.json({
      userId,
      conversation,
      messageCount: messages?.length || 0,
      messages: messages?.map(m => ({
        id: m.id,
        role: m.role,
        created_at: m.created_at,
        content_preview: m.content.substring(0, 100) + (m.content.length > 100 ? '...' : '')
      })),
      analysisState
    })

  } catch (error: any) {
    console.error("Debug list messages error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to list messages" },
      { status: 500 }
    )
  }
}
