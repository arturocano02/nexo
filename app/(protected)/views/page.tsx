"use client"
import { useEffect, useState } from "react"
import RequireAuth from "@/components/RequireAuth"
import { supabaseBrowser } from "@/src/lib/supabase/client"
import PillarChart from "@/src/components/PillarChart"
import RadarPillars from "@/src/components/charts/RadarPillars"
import PoliticalCompass from "@/src/components/charts/PoliticalCompass"
import { deriveCompass } from "@/src/lib/derive/compass"

type Snapshot = {
  pillars: Record<string, { score:number; rationale:string }>
  top_issues: { title:string; summary:string }[]
}
type Aggregate = {
  member_count: number
  pillar_means: Record<string, number>
  top_issues: { title:string; count:number }[]
}

export default function ViewsPage() {
  return (
    <RequireAuth>
      <ViewsInner />
    </RequireAuth>
  )
}

function ViewsInner() {
  const [tab, setTab] = useState<"mine"|"party">("mine")
  const [mine, setMine] = useState<Snapshot | null>(null)
  const [party, setParty] = useState<Aggregate | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const supa = supabaseBrowser()
      // who am I?
      const { data: session } = await supa.auth.getSession()
      const userId = session.session?.user.id
      if (!userId) return

      // my snapshot
      const { data: snap, error: snapErr } = await supa
        .from("views_snapshots")
        .select("pillars, top_issues")
        .eq("user_id", userId)
        .maybeSingle()
      if (!snapErr) setMine(snap as any)

      // party aggregate (public)
      const { data: agg } = await supa.from("aggregates").select("*").maybeSingle()
      setParty(agg as any)

      setLoading(false)
    }
    run()
  }, [])

  return (
    <div className="min-h-screen bg-white">
      {/* Sticky Header */}
      <div 
        className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-neutral-200"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="px-4 py-3">
          <h1 className="mb-3 text-xl font-semibold">Views</h1>
          
          {/* Tab Navigation */}
          <div className="flex gap-2">
            <button 
              className={`min-h-[44px] flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                tab === "mine" 
                  ? "bg-black text-white" 
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
              onClick={() => setTab("mine")}
            >
              Mine
            </button>
            <button 
              className={`min-h-[44px] flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                tab === "party" 
                  ? "bg-black text-white" 
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
              onClick={() => setTab("party")}
            >
              Party
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main 
        className="px-4 py-6"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4rem)' }}
      >
        {loading && <p className="text-sm text-neutral-600">Loading…</p>}

        {!loading && tab === "mine" && (
          <>
            {!mine ? (
              <div className="text-sm text-neutral-600">No snapshot yet. Complete the survey to generate your starter profile.</div>
            ) : (
              <div className="space-y-6">
                {/* Top Issues */}
                <section className="rounded-2xl border border-neutral-200 p-4">
                  <h2 className="mb-3 text-sm font-semibold">Top issues</h2>
                  <ul className="space-y-2">
                    {mine.top_issues.slice(0,3).map((it, i) => (
                      <li key={i} className="text-sm">
                        <span className="font-medium">{it.title}</span>
                        <span className="text-neutral-600"> — {it.summary}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                {/* Radar Chart */}
                <section className="rounded-2xl border border-neutral-200 p-4">
                  <h2 className="mb-3 text-sm font-semibold">Pillars (Radar)</h2>
                  <RadarPillars pillars={mine.pillars} />
                </section>

                {/* Bar Chart */}
                <section className="rounded-2xl border border-neutral-200 p-4">
                  <h2 className="mb-3 text-sm font-semibold">Pillars (Bars)</h2>
                  <PillarChart pillars={mine.pillars} />
                </section>

                {/* Political Compass */}
                <section className="rounded-2xl border border-neutral-200 p-4">
                  <h2 className="mb-3 text-sm font-semibold">Political axis</h2>
                  <PoliticalCompass point={deriveCompass(mine.pillars)} />
                </section>
              </div>
            )}
          </>
        )}

        {!loading && tab === "party" && (
          <>
            {!party ? (
              <div className="text-sm text-neutral-600">
                No aggregate yet. Ask an admin to refresh aggregates.
              </div>
            ) : (
              <div className="space-y-6">
                <section className="rounded-2xl border border-neutral-200 p-4">
                  <div className="mb-1 text-sm text-neutral-600">Members</div>
                  <div className="text-lg font-semibold">{party.member_count}</div>
                </section>

                <section className="rounded-2xl border border-neutral-200 p-4">
                  <h2 className="mb-2 text-sm font-semibold">Top party issues</h2>
                  <ul className="space-y-2">
                    {party.top_issues.slice(0,3).map((it, i) => (
                      <li key={i} className="text-sm">
                        <span className="font-medium">{it.title}</span>
                        <span className="text-neutral-600"> — {it.count}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                {party.pillar_means && (
                  <section className="rounded-2xl border border-neutral-200 p-4">
                    <h2 className="mb-2 text-sm font-semibold">Pillar means</h2>
                    <div className="space-y-3">
                      {Object.entries(party.pillar_means).map(([k, v]) => (
                        <div key={k}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="text-neutral-700 capitalize">{k}</span>
                            <span className="font-medium">{Math.round(v)}</span>
                          </div>
                          <div className="h-2 w-full rounded bg-neutral-200">
                            <div className="h-2 rounded bg-black" style={{ width: `${Math.max(0, Math.min(100, v))}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
