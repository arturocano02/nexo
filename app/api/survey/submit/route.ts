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
  const startTime = Date.now()
  console.log("[Survey Submit] ==================== NEW SURVEY SUBMISSION ====================")
  
  try {
    // Check authentication
    const auth = req.headers.get("authorization")
    if (!auth) {
      console.error("[Survey Submit] ❌ No authorization header")
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body = await req.json()
    const answers = body?.answers
    if (!answers) {
      console.error("[Survey Submit] ❌ No answers in request body")
      return NextResponse.json({ error: "Missing answers" }, { status: 400 })
    }

    console.log("[Survey Submit] ✓ Received survey answers:", Object.keys(answers).length, "questions")

    const supa = supabaseFromAuthHeader(req)

    // Authenticate user
    const { data: me, error: meErr } = await supa.auth.getUser()
    if (meErr || !me?.user) {
      console.error("[Survey Submit] ❌ Invalid session:", meErr)
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }
    const userId = me.user.id
    console.log("[Survey Submit] ✓ Authenticated user:", userId)

    // 1) Store raw survey in JSONB format
    console.log("[Survey Submit] Storing raw survey responses...")
    const { error: sErr } = await supa.from("survey_responses").insert({
      user_id: userId,
      responses: answers
    })
    if (sErr) {
      console.error("[Survey Submit] ❌ Failed to store survey:", sErr)
      throw sErr
    }
    console.log("[Survey Submit] ✓ Survey responses stored")

    // 2) Analyze survey to generate political views
    console.log("[Survey Submit] Starting AI analysis...")
    const analysisStart = Date.now()
    
    const snapshot = await analyzeToViews({ answers })
    
    const analysisTime = Date.now() - analysisStart
    console.log(`[Survey Submit] ✓ Analysis completed in ${analysisTime}ms`)
    console.log("[Survey Submit] Pillar scores:", Object.entries(snapshot.pillars).map(([k, v]) => `${k}=${v.score}`).join(', '))
    console.log("[Survey Submit] Top issues:", snapshot.top_issues.map(i => i.title).join(', '))

    // 3) Save snapshot to database
    console.log("[Survey Submit] Saving snapshot to database...")
    const { error: vErr } = await supa.from("views_snapshots").upsert({
      user_id: userId,
      pillars: snapshot.pillars,
      top_issues: snapshot.top_issues,
      summary_message: ""
    })
    if (vErr) {
      console.error("[Survey Submit] ❌ Failed to save snapshot:", vErr)
      throw vErr
    }
    console.log("[Survey Submit] ✓ Snapshot saved to views_snapshots")

    // 4) Create audit trail
    console.log("[Survey Submit] Creating audit trail...")
    const { error: uErr } = await supa.from("view_updates").insert({
      user_id: userId,
      source: "survey",
      delta: { pillarsDelta: snapshot.pillars, topIssuesDelta: snapshot.top_issues }
    })
    if (uErr) {
      console.error("[Survey Submit] ⚠️  Failed to create audit trail (non-critical):", uErr)
      // Don't throw - audit is not critical
    } else {
      console.log("[Survey Submit] ✓ Audit trail created")
    }

    const totalTime = Date.now() - startTime
    console.log(`[Survey Submit] ✅ SUCCESS - Total time: ${totalTime}ms`)
    console.log("[Survey Submit] ================================================================")

    return NextResponse.json({ ok: true, snapshot })
    
  } catch (e: any) {
    const totalTime = Date.now() - startTime
    console.error(`[Survey Submit] ❌ FAILED after ${totalTime}ms:`, e)
    console.error("[Survey Submit] Error stack:", e.stack)
    console.log("[Survey Submit] ================================================================")
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 })
  }
}
