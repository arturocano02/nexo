import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { analyzeToViews } from "@/src/lib/ai/analyzeToViews"

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

    const body = await req.json()
    const answers = body?.answers
    if (!answers) return NextResponse.json({ error: "Missing answers" }, { status: 400 })

    const supa = supabaseFromAuthHeader(req)

    // Who is the user?
    const { data: me, error: meErr } = await supa.auth.getUser()
    if (meErr || !me?.user) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const userId = me.user.id

    // 1) Store raw survey
    const insertPayload: any = { user_id: userId }
    for (const [k, v] of Object.entries(answers as Record<string, {choice?:string; text?:string}>)) {
      insertPayload[`${k}`] = v.text ?? null
      insertPayload[`${k}_choice`] = v.choice ?? null
    }
    const { error: sErr } = await supa.from("survey_responses").insert(insertPayload)
    if (sErr) throw sErr

    // 2) Analyze to views
    const snapshot = await analyzeToViews({ answers })

    // 3) Upsert snapshot (RLS protects per-user)
    const { error: vErr } = await supa.from("views_snapshots").upsert({
      user_id: userId,
      pillars: snapshot.pillars,
      top_issues: snapshot.top_issues
    })
    if (vErr) throw vErr

    // 4) Audit
    const { error: uErr } = await supa.from("view_updates").insert({
      user_id: userId,
      source: "survey",
      delta: { pillarsDelta: snapshot.pillars, topIssuesDelta: snapshot.top_issues }
    })
    if (uErr) throw uErr

    return NextResponse.json({ ok: true, snapshot })
  } catch (e:any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 })
  }
}
