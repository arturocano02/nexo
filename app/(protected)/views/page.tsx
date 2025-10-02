"use client"
import { useEffect, useState } from "react"
import RequireAuth from "@/components/RequireAuth"
import Navigation from "@/components/Navigation"
import { supabaseBrowser } from "@/src/lib/supabase/client"
import PillarChart from "@/src/components/PillarChart"
import RadarPillars from "@/src/components/charts/RadarPillars"
import PoliticalCompass from "@/src/components/charts/PoliticalCompass"
import CompassDistribution from "@/src/components/charts/CompassDistribution"
import { deriveCompass } from "@/src/lib/derive/compass"
import toast from "react-hot-toast"

type Snapshot = {
  pillars: Record<string, { score:number; rationale:string }>
  top_issues: { title:string; summary:string }[]
}
type Aggregate = {
  member_count: number
  pillar_means: Record<string, number>
  top_issues: { title:string; count:number }[]
  compass_distribution: {
    bins: {
      x: number[]
      y: number[]
      counts: number[][]
    }
  }
  party_summary: string
  top_contributor: {
    user_id: string
    display_name: string
    metric: number
  }
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
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<{ changes: any; timestamp: number } | null>(null)
  const [summary, setSummary] = useState<any>(null)
  const [refreshingParty, setRefreshingParty] = useState(false)

  const loadData = async () => {
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
    if (!snapErr) {
      console.log("Loaded snapshot:", snap)
      if (snap) {
        setMine(snap as any)
      } else {
        // No snapshot exists, create a default one
        console.log("No snapshot found, creating default")
        const defaultSnapshot = {
          pillars: {
            economy: { score: 50, rationale: "Default starting point" },
            social: { score: 50, rationale: "Default starting point" },
            environment: { score: 50, rationale: "Default starting point" },
            governance: { score: 50, rationale: "Default starting point" },
            foreign: { score: 50, rationale: "Default starting point" }
          },
          top_issues: []
        }
        setMine(defaultSnapshot)
      }
    } else {
      console.error("Error loading snapshot:", snapErr)
    }

    // party aggregate (public)
    const { data: agg } = await supa.from("aggregates").select("*").maybeSingle()
    setParty(agg as any)

    // load summary
    try {
      const summaryResponse = await fetch("/api/views/summary", {
        headers: {
          "Authorization": `Bearer ${session.session?.access_token}`
        }
      })
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json()
        setSummary(summaryData.summary)
      }
    } catch (error) {
      console.error("Failed to load summary:", error)
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleRefreshViews = async () => {
    if (refreshing) return

    setRefreshing(true)
    try {
      const supa = supabaseBrowser()
      const { data: { session } } = await supa.auth.getSession()
      
      if (!session) {
        toast.error("Please sign in to refresh views")
        return
      }

      const response = await fetch("/api/views/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          lookbackDays: 7,
          maxMessages: 30
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to refresh views")
      }

      const result = await response.json()
      console.log("Refresh result:", result)
      
      // Check if there was an error (like no new messages)
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      // Update local state with new snapshot
      if (result.snapshot) {
        console.log("Setting new snapshot:", result.snapshot)
        setMine(result.snapshot)
      }
      if (result.summary) {
        console.log("Setting new summary:", result.summary)
        setSummary(result.summary)
      }
      
      // Reload all data to ensure UI is in sync
      await loadData()
      
      // Show success toast
      toast.success("Views refreshed")
      
      // Show changes for 5 seconds
      if (result.changes) {
        setLastRefresh({
          changes: result.changes,
          timestamp: Date.now()
        })
        
        setTimeout(() => {
          setLastRefresh(null)
        }, 5000)
      }

    } catch (error: any) {
      console.error("Refresh error:", error)
      toast.error(error.message || "Failed to refresh views")
    } finally {
      setRefreshing(false)
    }
  }

  const handleRefreshParty = async () => {
    if (refreshingParty) return

    setRefreshingParty(true)
    try {
      const supa = supabaseBrowser()
      const { data: { session } } = await supa.auth.getSession()
      
      if (!session) {
        toast.error("Please sign in to refresh party data")
        return
      }

      const response = await fetch("/api/party/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to refresh party data")
      }

      const result = await response.json()
      
      // Update local state with new aggregates
      setParty(result.aggregates)
      
      // Show success toast
      toast.success("Party updated")
      
      // Reload data to ensure consistency
      await loadData()

    } catch (error: any) {
      console.error("Party refresh error:", error)
      toast.error(error.message || "Failed to refresh party data")
    } finally {
      setRefreshingParty(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Sticky Header */}
      <div 
        className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-neutral-200"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-semibold">Views</h1>
            {tab === "mine" && (
              <button
                onClick={handleRefreshViews}
                disabled={refreshing}
                className="h-10 px-4 rounded-lg bg-black text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-800 transition-colors"
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            )}
            {tab === "party" && (
              <button
                onClick={handleRefreshParty}
                disabled={refreshingParty}
                className="h-10 px-4 rounded-lg bg-black text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-800 transition-colors"
              >
                {refreshingParty ? "Refreshing..." : "Refresh party"}
              </button>
            )}
          </div>
          
          {/* Changes indicator */}
          {lastRefresh && tab === "mine" && (
            <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-xs text-green-700">
                {Object.entries(lastRefresh.changes.pillarsDelta).map(([pillar, delta]) => {
                  const deltaNum = delta as number
                  if (deltaNum === 0) return null
                  const sign = deltaNum > 0 ? "+" : ""
                  return (
                    <span key={pillar} className="mr-2">
                      {pillar}: {sign}{deltaNum}
                    </span>
                  )
                }).filter(Boolean).join(", ")}
              </div>
            </div>
          )}
          
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
                  {mine.pillars && Object.keys(mine.pillars).length > 0 ? (
                    <RadarPillars pillars={mine.pillars} />
                  ) : (
                    <div className="text-sm text-neutral-500 text-center py-8">
                      No pillar data available. Complete the survey or refresh your views.
                    </div>
                  )}
                </section>

                {/* Bar Chart */}
                <section className="rounded-2xl border border-neutral-200 p-4">
                  <h2 className="mb-3 text-sm font-semibold">Pillars (Bars)</h2>
                  {mine.pillars && Object.keys(mine.pillars).length > 0 ? (
                    <PillarChart pillars={mine.pillars} />
                  ) : (
                    <div className="text-sm text-neutral-500 text-center py-8">
                      No pillar data available. Complete the survey or refresh your views.
                    </div>
                  )}
                </section>

                {/* Political Compass */}
                <section className="rounded-2xl border border-neutral-200 p-4">
                  <h2 className="mb-3 text-sm font-semibold">Political axis</h2>
                  <PoliticalCompass point={deriveCompass(mine.pillars)} />
                </section>

                {/* Summary Card */}
                {summary && (
                  <section className="rounded-2xl border border-neutral-200 p-4 bg-neutral-50">
                    <h2 className="mb-3 text-sm font-semibold">Recent Conversation Summary</h2>
                    <div className="space-y-3 text-xs text-neutral-700">
                      {summary.perPillar && Object.entries(summary.perPillar).map(([pillar, text]) => (
                        <div key={pillar}>
                          <span className="font-medium capitalize">{pillar}:</span> {text as string}
                        </div>
                      ))}
                      {summary.issues && summary.issues.length > 0 && (
                        <div>
                          <span className="font-medium">Key Issues:</span>
                          <ul className="mt-1 space-y-1">
                            {summary.issues.map((issue: any, index: number) => (
                              <li key={index} className="flex items-start gap-2">
                                <span className="text-neutral-400">•</span>
                                <div>
                                  <div className="font-medium">{issue.title}</div>
                                  <div className="text-neutral-600">{issue.summary}</div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </div>
            )}
          </>
        )}

        {!loading && tab === "party" && (
          <>
            {!party ? (
              <div className="text-center py-8">
                <p className="text-sm text-neutral-600 mb-4">No aggregate yet. Tap 'Refresh party' to build the first snapshot.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Members Count */}
                <section className="rounded-2xl border border-neutral-200 p-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-black mb-1">{party.member_count}</div>
                    <div className="text-sm text-neutral-600">Members</div>
                  </div>
                </section>

                {/* Top Issues */}
                <section className="rounded-2xl border border-neutral-200 p-4">
                  <h2 className="mb-3 text-sm font-semibold">Top issues (party)</h2>
                  <div className="space-y-3">
                    {party.top_issues.slice(0, 3).map((issue, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center">
                            {i + 1}
                          </div>
                          <span className="text-sm font-medium">{issue.title}</span>
                        </div>
                        <span className="text-xs text-neutral-600">{issue.count} mentions</span>
                      </div>
                    ))}
                    {party.top_issues.length === 0 && (
                      <p className="text-sm text-neutral-500">No issues tracked yet</p>
                    )}
                  </div>
                </section>

                {/* Compass Distribution */}
                {party.compass_distribution && (
                  <section className="rounded-2xl border border-neutral-200 p-4">
                    <h2 className="mb-3 text-sm font-semibold">Where people are</h2>
                    <CompassDistribution distribution={party.compass_distribution} />
                  </section>
                )}

                {/* Top Contributor */}
                {party.top_contributor && (
                  <section className="rounded-2xl border border-neutral-200 p-4">
                    <h2 className="mb-3 text-sm font-semibold">Top contributor</h2>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-black mb-1">
                        {party.top_contributor.display_name}
                      </div>
                      <div className="text-xs text-neutral-600">
                        Most active in the last 14 days
                      </div>
                    </div>
                  </section>
                )}

                {/* Party Summary */}
                {party.party_summary && (
                  <section className="rounded-2xl border border-neutral-200 p-4 bg-neutral-50">
                    <h2 className="mb-3 text-sm font-semibold">Party summary</h2>
                    <p className="text-sm text-neutral-700 leading-relaxed">
                      {party.party_summary}
                    </p>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <Navigation />
    </div>
  )
}
