import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET() {
  return NextResponse.json({ message: "Use POST to refresh aggregates" }, { status: 405 })
}

export async function POST(_req: NextRequest) {
  const supa = createClient(URL, ANON, { auth: { persistSession: false } })

  // count members
  const { data: snaps } = await supa.from("views_snapshots").select("pillars, top_issues, user_id")
  const member_count = snaps?.length || 0

  // pillar means
  const keys = ["economy","social","environment","governance","foreign"] as const
  const sums: Record<string, number> = { economy:0, social:0, environment:0, governance:0, foreign:0 }
  for (const row of snaps || []) {
    const p = row.pillars as Record<string, { score:number }>
    for (const k of keys) sums[k] += p?.[k]?.score ?? 0
  }
  const pillar_means: Record<string, number> = {}
  for (const k of keys) pillar_means[k] = member_count ? sums[k] / member_count : 0

  // top issues (by title frequency)
  const counts = new Map<string, number>()
  for (const row of snaps || []) {
    const issues = (row.top_issues as any[]) || []
    for (const it of issues) {
      const t = (it?.title || "").trim()
      if (!t) continue
      counts.set(t, (counts.get(t) || 0) + 1)
    }
  }
  const top_issues = Array.from(counts.entries())
    .sort((a,b)=>b[1]-a[1])
    .slice(0,10)
    .map(([title, count]) => ({ title, count }))

  // upsert single aggregates row (id = true)
  const { error } = await supa.from("aggregates").upsert({
    id: true,
    member_count,
    pillar_means,
    top_issues,
    compass_distribution: { bins: { x: [], y: [], counts: [] } },
    party_summary: "No data available yet. Complete the survey and refresh party data to see insights.",
    top_contributor: {},
    updated_at: new Date().toISOString()
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, member_count, pillar_means, top_issues })
}
