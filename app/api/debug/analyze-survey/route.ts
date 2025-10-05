import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { analyzeToViews } from "@/src/lib/ai/analyzeToViews"

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
    if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const supa = supabaseFromAuthHeader(req)

    // Who is the user?
    const { data: me, error: meErr } = await supa.auth.getUser()
    if (meErr || !me?.user) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const userId = me.user.id

    console.log("Debug: Analyzing survey for user:", userId)

    // Get the latest survey response
    const { data: surveyData, error: surveyError } = await supa
      .from("survey_responses")
      .select("responses")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (surveyError) {
      console.error("Survey error:", surveyError)
      return NextResponse.json({ error: "Failed to get survey data" }, { status: 500 })
    }

    if (!surveyData) {
      return NextResponse.json({ error: "No survey data found" }, { status: 404 })
    }

    console.log("Survey data found:", surveyData.responses)

    // Analyze the survey
    const snapshot = await analyzeToViews({ answers: surveyData.responses })
    console.log("Analysis completed:", snapshot)

    // Save the snapshot
    const { error: saveError } = await supa.from("views_snapshots").upsert({
      user_id: userId,
      pillars: snapshot.pillars,
      top_issues: snapshot.top_issues,
      summary_message: ""
    })

    if (saveError) {
      console.error("Save error:", saveError)
      return NextResponse.json({ error: "Failed to save snapshot" }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      snapshot,
      surveyData: surveyData.responses
    })

  } catch (error: any) {
    console.error("Debug analysis error:", error)
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 })
  }
}
