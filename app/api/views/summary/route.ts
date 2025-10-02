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

    // Get latest conversation summary
    const { data: summary, error: summaryErr } = await supa
      .from("conversation_summaries")
      .select("summary, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (summaryErr) {
      if (summaryErr.code === 'PGRST116') {
        // No summary found
        return NextResponse.json({ summary: null })
      }
      throw summaryErr
    }

    return NextResponse.json({ summary })

  } catch (error: any) {
    console.error("Get summary error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to get summary" },
      { status: 500 }
    )
  }
}
