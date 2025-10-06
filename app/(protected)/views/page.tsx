"use client"
import { useEffect, useState } from "react"
import RequireAuth from "@/components/RequireAuth"
import Navigation from "@/components/Navigation"
import { supabaseBrowser } from "@/src/lib/supabase/client"
import PillarChart from "@/src/components/PillarChart"
import RadarPillars from "@/src/components/charts/RadarPillars"
import PoliticalCompass from "@/src/components/charts/PoliticalCompass"
import CompassDistribution from "@/src/components/charts/CompassDistribution"
import AdvancedPoliticalProfile from "@/src/components/AdvancedPoliticalProfile"
import DevBanner from "@/src/components/DevBanner"
import RefreshAnimation from "@/src/components/RefreshAnimation"
import ViewQuotes from "@/src/components/ViewQuotes"
import PageTransition, { FadeIn, SlideIn } from "@/src/components/PageTransition"
import { ChartSkeleton, CardSkeleton, PillarSkeleton } from "@/src/components/LoadingSkeleton"
import { deriveCompass } from "@/src/lib/derive/compass"
import toast from "react-hot-toast"
import { trackPageView, trackViewsEvent, trackError } from "@/src/lib/analytics"

type Snapshot = {
  pillars: Record<string, { score:number; rationale:string }>
  top_issues: { 
    title: string; 
    summary: string;
    mentions?: number;
    user_quote?: string;
  }[]
  summary_message?: string;
  advanced?: any
}
type Aggregate = {
  member_count: number
  pillar_means: Record<string, number>
  top_issues: { 
    title: string; 
    count: number;
    mentions?: number;
    quotes?: string[];
  }[]
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
    statement_count?: number
    topic_count?: number
    examples?: string[]
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
  const [forceRefreshing, setForceRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<{ changes: any; timestamp: number } | null>(null)
  const [summary, setSummary] = useState<any>(null)
  const [refreshingParty, setRefreshingParty] = useState(false)
  const [showRefreshAnimation, setShowRefreshAnimation] = useState(false)
  const [debugAnalyzing, setDebugAnalyzing] = useState(false)
  const [debugLoading, setDebugLoading] = useState(false)
  const [debugMessages, setDebugMessages] = useState<any>(null)
  const [openaiStatus, setOpenaiStatus] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [conversation, setConversation] = useState<any>(null)

  const loadData = async () => {
    setLoading(true)
    const supa = supabaseBrowser()
    // who am I?
    const { data: sessionData } = await supa.auth.getSession()
    const userId = sessionData.session?.user.id
    if (!userId) return
    
    // Store session for later use
    setSession(sessionData.session)
    
    // Get user's conversation
    const { data: convData, error: convErr } = await supa
      .from("conversations")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle()
      
    if (convErr) {
      console.error("Error loading conversation:", convErr)
    } else {
      setConversation(convData)
      console.log("Loaded conversation:", convData)
    }

    // my snapshot
    const { data: snap, error: snapErr } = await supa
      .from("views_snapshots")
      .select("pillars, top_issues, summary_message")
      .eq("user_id", userId)
      .maybeSingle()
    if (!snapErr) {
      console.log("Loaded snapshot:", snap)
      if (snap) {
        console.log("Snapshot data:", JSON.stringify(snap, null, 2))
        setMine(snap as any)
      } else {
        // No snapshot exists, check if user has completed survey
        console.log("No snapshot found, checking for survey data")
        const { data: surveyData } = await supa
          .from("survey_responses")
          .select("responses")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        
        if (surveyData) {
          console.log("Found survey data, analyzing...")
          // Import analyzeToViews dynamically to avoid circular imports
          const { analyzeToViews } = await import("@/src/lib/ai/analyzeToViews")
          try {
            const analyzedSnapshot = await analyzeToViews({ answers: surveyData.responses })
            console.log("Survey analysis completed:", analyzedSnapshot)
            setMine(analyzedSnapshot)
            
            // Save the analyzed snapshot to the database
            const { error: saveError } = await supa
              .from("views_snapshots")
              .upsert({
                user_id: userId,
                pillars: analyzedSnapshot.pillars,
                top_issues: analyzedSnapshot.top_issues,
                summary_message: ""
              })
            if (saveError) {
              console.error("Error saving analyzed snapshot:", saveError)
            }
          } catch (error) {
            console.error("Error analyzing survey:", error)
            // Fall back to default if analysis fails
            const defaultSnapshot = {
              pillars: {
                economy: { score: 50, rationale: "Survey analysis failed - using default" },
                social: { score: 50, rationale: "Survey analysis failed - using default" },
                environment: { score: 50, rationale: "Survey analysis failed - using default" },
                governance: { score: 50, rationale: "Survey analysis failed - using default" },
                foreign: { score: 50, rationale: "Survey analysis failed - using default" }
              },
              top_issues: []
            }
            setMine(defaultSnapshot)
          }
        } else {
          // No survey data, show message to complete survey
          console.log("No survey data found")
          setMine(null)
        }
      }
    } else {
      console.error("Error loading snapshot:", snapErr)
    }

    // party aggregate (public)
    const { data: agg } = await supa.from("aggregates").select("*").maybeSingle()
    setParty(agg as any)

    // load summary
    try {
      // Only attempt to load summary if we have a valid session
      if (session?.session?.access_token) {
        const summaryResponse = await fetch("/api/views/summary", {
          headers: {
            "Authorization": `Bearer ${session.session.access_token}`
          }
        })
        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json()
          setSummary(summaryData.summary)
        }
      }
    } catch (error) {
      console.error("Failed to load summary:", error)
      // Don't show error to user - this is non-critical
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
    trackPageView('views')
    
    // Auto-refresh data after a short delay to ensure latest data is loaded
    // This helps when coming from survey completion
    const refreshTimer = setTimeout(() => {
      loadData()
    }, 2000)
    
    return () => clearTimeout(refreshTimer)
  }, [])

  const handleRefreshViews = async () => {
    if (refreshing) return

    setRefreshing(true)
    setShowRefreshAnimation(true)
    
    try {
      const supa = supabaseBrowser()
      const { data: { session } } = await supa.auth.getSession()
      
      if (!session) {
        toast.error("Please sign in to refresh views")
        return
      }

      const response = await fetch("/api/views/refresh-since", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          maxMessages: 200,
          lookbackDays: 30
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to refresh views")
      }

      const result = await response.json()
      console.log("Refresh result:", result)
      
      // Check if there was an error
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      // Update local state with new snapshot
      if (result.snapshot) {
        console.log("Setting new snapshot:", result.snapshot)
        setMine(result.snapshot)
      }
      
      // Reload all data to ensure UI is in sync
      await loadData()
      
      // Track successful refresh
      trackViewsEvent('VIEWS_REFRESHED', 'success')
      
      // Show appropriate toast message
      if (result.processedCount === 0) {
        // If we have a note from the server, use it
        if (result.note && result.note.includes("No new messages")) {
          // Check when the last chat message was sent
          const { data: lastMessage } = await supa
            .from("messages")
            .select("created_at")
            .eq("conversation_id", conversation?.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
            
          if (!lastMessage) {
            toast.success("No chat messages found. Try chatting with Nexo first!")
          } else {
            const lastMessageDate = new Date(lastMessage.created_at)
            const now = new Date()
            const hoursSinceLastMessage = Math.round((now.getTime() - lastMessageDate.getTime()) / (1000 * 60 * 60))
            
            if (hoursSinceLastMessage < 1) {
              toast.success("Your views are up to date! Chat more with Nexo to develop your profile.")
            } else {
              toast.success(`No new messages in the last ${hoursSinceLastMessage} hour${hoursSinceLastMessage !== 1 ? 's' : ''}. Chat more with Nexo!`)
            }
          }
        } else {
          toast.success("Your views are up to date")
        }
      } else {
        toast.success(`Views refreshed (${result.processedCount} messages processed)`)
      }
      
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
      trackError('views_refresh_failed', error.message)
      toast.error(error.message || "Failed to refresh views")
    } finally {
      setRefreshing(false)
      setShowRefreshAnimation(false)
    }
  }
  
  const handleForceRefresh = async () => {
    if (forceRefreshing) return

    setForceRefreshing(true)
    setShowRefreshAnimation(true)
    
    try {
      const supa = supabaseBrowser()
      const { data: { session } } = await supa.auth.getSession()
      
      if (!session) {
        toast.error("Please sign in to force refresh views")
        return
      }

      const response = await fetch("/api/views/force-refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to force refresh views")
      }

      const result = await response.json()
      console.log("Force refresh result:", result)
      
      // Check if there was an error
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      // Update local state with new snapshot
      if (result.snapshot) {
        console.log("Setting new snapshot from force refresh:", result.snapshot)
        setMine(result.snapshot)
      }
      
      // Reload all data to ensure UI is in sync
      await loadData()
      
      // Track successful refresh
      trackViewsEvent('VIEWS_FORCE_REFRESHED', 'success')
      
      // Show success toast
      toast.success(`Views fully reanalyzed! (${result.processedCount} messages processed)`)
      
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
      console.error("Force refresh error:", error)
      trackError('views_force_refresh_failed', error.message)
      toast.error(error.message || "Failed to force refresh views")
    } finally {
      setForceRefreshing(false)
      setShowRefreshAnimation(false)
    }
  }

  const handleRefreshAnimationComplete = () => {
    setShowRefreshAnimation(false)
  }

  const handleDebugAnalyze = async () => {
    if (debugAnalyzing) return

    setDebugAnalyzing(true)
    try {
      const supa = supabaseBrowser()
      const { data: { session } } = await supa.auth.getSession()
      
      if (!session) {
        toast.error("Please sign in to analyze survey")
        return
      }

      const response = await fetch("/api/debug/analyze-survey", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to analyze survey")
      }

      const result = await response.json()
      console.log("Debug analysis result:", result)
      
      // Reload data to show the new analysis
      await loadData()
      
      toast.success("Survey analysis completed!")
      
    } catch (error: any) {
      console.error("Debug analysis error:", error)
      toast.error(error.message || "Failed to analyze survey")
    } finally {
      setDebugAnalyzing(false)
    }
  }
  
  const handleListMessages = async () => {
    if (debugLoading) return
    
    setDebugLoading(true)
    setDebugMessages(null)
    
    try {
      const supa = supabaseBrowser()
      const { data: { session } } = await supa.auth.getSession()
      
      if (!session) {
        toast.error("Please sign in to list messages")
        return
      }
      
      const response = await fetch("/api/debug/list-messages", {
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to list messages")
      }
      
      const result = await response.json()
      console.log("Debug messages result:", result)
      setDebugMessages(result)
      
      if (result.messageCount === 0) {
        toast.success("No messages found in your conversation")
      } else {
        toast.success(`Found ${result.messageCount} messages`)
      }
      
    } catch (error: any) {
      console.error("Debug list messages error:", error)
      toast.error(error.message || "Failed to list messages")
    } finally {
      setDebugLoading(false)
    }
  }
  
  const handleResetAnalysis = async () => {
    if (debugLoading) return
    
    setDebugLoading(true)
    
    try {
      const supa = supabaseBrowser()
      const { data: { session } } = await supa.auth.getSession()
      
      if (!session) {
        toast.error("Please sign in to reset analysis")
        return
      }
      
      const response = await fetch("/api/debug/reset-analysis", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to reset analysis")
      }
      
      toast.success("Analysis state reset successfully")
      
    } catch (error: any) {
      console.error("Debug reset analysis error:", error)
      toast.error(error.message || "Failed to reset analysis")
    } finally {
      setDebugLoading(false)
    }
  }
  
  const handleCheckOpenAI = async () => {
    if (debugLoading) return
    
    setDebugLoading(true)
    setOpenaiStatus(null)
    
    try {
      const response = await fetch("/api/debug/check-openai")
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to check OpenAI")
      }
      
      const result = await response.json()
      console.log("OpenAI status:", result)
      setOpenaiStatus(result)
      
      if (result.isConfigured && result.isValid) {
        toast.success("OpenAI API key is configured and valid")
      } else if (result.isConfigured) {
        toast.error("OpenAI API key is configured but invalid")
      } else {
        toast.error("OpenAI API key is not configured")
      }
      
    } catch (error: any) {
      console.error("Debug check OpenAI error:", error)
      toast.error(error.message || "Failed to check OpenAI")
    } finally {
      setDebugLoading(false)
    }
  }

  const handleRefreshParty = async () => {
    if (refreshingParty) return

    setRefreshingParty(true)
    setShowRefreshAnimation(true)
    
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
      
      // Track successful party refresh
      trackViewsEvent('PARTY_REFRESHED', 'success')
      
      // Show success toast
      toast.success("Party updated")
      
      // Reload data to ensure consistency
      await loadData()

    } catch (error: any) {
      console.error("Party refresh error:", error)
      trackError('party_refresh_failed', error.message)
      toast.error(error.message || "Failed to refresh party data")
    } finally {
      setRefreshingParty(false)
      setShowRefreshAnimation(false)
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
              <div className="flex gap-2">
                <button
                  onClick={handleRefreshViews}
                  disabled={refreshing || forceRefreshing}
                  className="h-10 px-4 rounded-lg bg-black text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-800 transition-colors"
                >
                  {refreshing ? "Refreshing..." : "Refresh"}
                </button>
                <button
                  onClick={handleForceRefresh}
                  disabled={refreshing || forceRefreshing}
                  className="h-10 px-4 rounded-lg bg-red-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700 transition-colors"
                >
                  {forceRefreshing ? "Analyzing All..." : "Force Refresh All"}
                </button>
                <button
                  onClick={handleDebugAnalyze}
                  disabled={debugAnalyzing}
                  className="h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                >
                  {debugAnalyzing ? "Analyzing..." : "Debug Analyze"}
                </button>
                <div className="relative group">
                  <button
                    className="h-10 px-4 rounded-lg bg-purple-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-700 transition-colors"
                  >
                    Debug Tools
                  </button>
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg overflow-hidden z-20 hidden group-hover:block">
                    <div className="py-1">
                      <button
                        onClick={handleListMessages}
                        disabled={debugLoading}
                        className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100"
                      >
                        {debugLoading ? "Loading..." : "List Messages"}
                      </button>
                      <button
                        onClick={handleResetAnalysis}
                        disabled={debugLoading}
                        className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100"
                      >
                        {debugLoading ? "Loading..." : "Reset Analysis State"}
                      </button>
                      <button
                        onClick={handleCheckOpenAI}
                        disabled={debugLoading}
                        className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100"
                      >
                        {debugLoading ? "Loading..." : "Check OpenAI API"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
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
              onClick={() => {
                setTab("mine")
                trackViewsEvent('VIEWS_TAB_SWITCHED', 'mine')
              }}
            >
              Mine
            </button>
            <button 
              className={`min-h-[44px] flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                tab === "party" 
                  ? "bg-black text-white" 
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
              onClick={() => {
                setTab("party")
                trackViewsEvent('VIEWS_TAB_SWITCHED', 'party')
              }}
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
        {/* Debug Info Display */}
        {(debugMessages || openaiStatus) && (
          <div className="mb-6 p-4 border border-purple-200 rounded-lg bg-purple-50">
            <h3 className="text-lg font-semibold mb-2">Debug Info</h3>
            
            {/* OpenAI Status */}
            {openaiStatus && (
              <div className="mb-4 text-sm">
                <h4 className="font-medium mb-1">OpenAI API Status:</h4>
                <div className="p-3 bg-white rounded border border-purple-100">
                  <p>
                    <span className="font-medium">Configured:</span> 
                    <span className={openaiStatus.isConfigured ? "text-green-600 ml-1" : "text-red-600 ml-1"}>
                      {openaiStatus.isConfigured ? "Yes" : "No"}
                    </span>
                  </p>
                  
                  {openaiStatus.isConfigured && (
                    <>
                      <p>
                        <span className="font-medium">Valid:</span> 
                        <span className={openaiStatus.isValid ? "text-green-600 ml-1" : "text-red-600 ml-1"}>
                          {openaiStatus.isValid ? "Yes" : "No"}
                        </span>
                      </p>
                      <p><span className="font-medium">Key Prefix:</span> {openaiStatus.keyPrefix}</p>
                      <p><span className="font-medium">Key Length:</span> {openaiStatus.keyLength} characters</p>
                      
                      {openaiStatus.isValid && openaiStatus.models && (
                        <div className="mt-2">
                          <p className="font-medium">Available Models:</p>
                          <ul className="list-disc list-inside">
                            {openaiStatus.models.map((model: string, i: number) => (
                              <li key={i} className="text-xs">{model}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {openaiStatus.error && (
                        <p className="text-red-600 mt-1">{openaiStatus.error}</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
            
            {/* Messages Debug */}
            {debugMessages && (
              <div className="text-sm">
                <p><strong>User ID:</strong> {debugMessages.userId}</p>
                <p><strong>Conversation ID:</strong> {debugMessages.conversation?.id || 'None'}</p>
                <p><strong>Message Count:</strong> {debugMessages.messageCount}</p>
                
                {debugMessages.analysisState && (
                  <div className="mt-2">
                    <p><strong>Analysis State:</strong></p>
                    <p>Last Processed At: {debugMessages.analysisState.last_processed_at || 'Never'}</p>
                    <p>Last Processed Message ID: {debugMessages.analysisState.last_processed_message_id || 'None'}</p>
                  </div>
                )}
                
                {debugMessages.messages && debugMessages.messages.length > 0 && (
                  <div className="mt-2">
                    <p><strong>Messages:</strong></p>
                    <div className="max-h-60 overflow-y-auto border border-purple-100 rounded p-2 bg-white">
                      {debugMessages.messages.map((msg: any, i: number) => (
                        <div key={i} className="mb-2 pb-2 border-b border-purple-100 last:border-b-0">
                          <div className="flex justify-between">
                            <span className={`font-medium ${msg.role === 'user' ? 'text-blue-600' : 'text-green-600'}`}>
                              {msg.role}
                            </span>
                            <span className="text-xs text-gray-500">{new Date(msg.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-gray-700">{msg.content_preview}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {loading && (
          <div className="space-y-6">
            <FadeIn delay={100}>
              <CardSkeleton />
            </FadeIn>
            <FadeIn delay={200}>
              <ChartSkeleton />
            </FadeIn>
            <FadeIn delay={300}>
              <PillarSkeleton />
            </FadeIn>
          </div>
        )}

        {!loading && tab === "mine" && (
          <PageTransition>
            {!mine ? (
              <FadeIn>
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">📊</span>
                  </div>
                  <h2 className="text-lg font-semibold mb-2">Complete Your Political Profile</h2>
                  <p className="text-sm text-neutral-600 mb-4">
                    Take our 5-question survey to discover your political positioning across key pillars and get personalized insights.
                  </p>
                  <button 
                    onClick={() => window.location.href = '/survey'}
                    className="h-11 px-6 rounded-lg bg-black text-white text-sm font-medium hover:bg-neutral-800 transition-colors"
                  >
                    Start Survey
                  </button>
                </div>
              </FadeIn>
            ) : (
              <div className="space-y-6">
                {/* Top Issues */}
                <FadeIn delay={100}>
                  <section className="rounded-2xl border border-neutral-200 p-4 hover:shadow-md transition-shadow duration-300">
                    <h2 className="mb-3 text-sm font-semibold">Top issues</h2>
                    <ul className="space-y-4">
                      {mine.top_issues.slice(0,3).map((it, i) => (
                        <li key={i}>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-5 h-5 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center">
                              {i + 1}
                            </div>
                            <span className="font-medium">{it.title}</span>
                            {it.mentions && (
                              <span className="text-xs bg-neutral-100 px-2 py-0.5 rounded-full text-neutral-600">
                                {it.mentions} mention{it.mentions !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <div className="ml-7">
                            {it.summary.startsWith('"') ? (
                              <blockquote className="text-sm italic text-neutral-700 border-l-2 border-neutral-300 pl-2">
                                {it.summary}
                              </blockquote>
                            ) : (
                              <p className="text-sm text-neutral-600">{it.summary}</p>
                            )}
                          </div>
                        </li>
                      ))}
                      {mine.top_issues.length === 0 && (
                        <li className="text-sm text-neutral-500">
                          No issues identified yet. Chat with Nexo to build your profile.
                        </li>
                      )}
                    </ul>
                  </section>
                </FadeIn>

                {/* Radar Chart */}
                <FadeIn delay={200}>
                  <section className="rounded-2xl border border-neutral-200 p-4 hover:shadow-md transition-shadow duration-300">
                    <h2 className="mb-3 text-sm font-semibold">Pillars (Radar)</h2>
                    {mine.pillars && Object.keys(mine.pillars).length > 0 ? (
                      <RadarPillars pillars={mine.pillars} />
                    ) : (
                      <div className="text-sm text-neutral-500 text-center py-8">
                        No pillar data available. Complete the survey or refresh your views.
                      </div>
                    )}
                  </section>
                </FadeIn>

                {/* Bar Chart */}
                <FadeIn delay={300}>
                  <section className="rounded-2xl border border-neutral-200 p-4 hover:shadow-md transition-shadow duration-300">
                    <h2 className="mb-3 text-sm font-semibold">Pillars (Bars)</h2>
                    {mine.pillars && Object.keys(mine.pillars).length > 0 ? (
                      <PillarChart pillars={mine.pillars} />
                    ) : (
                      <div className="text-sm text-neutral-500 text-center py-8">
                        No pillar data available. Complete the survey or refresh your views.
                      </div>
                    )}
                  </section>
                </FadeIn>

                {/* Political Compass */}
                <FadeIn delay={400}>
                  <section className="rounded-2xl border border-neutral-200 p-4 hover:shadow-md transition-shadow duration-300">
                    <h2 className="mb-3 text-sm font-semibold">Political axis</h2>
                    <PoliticalCompass point={deriveCompass(mine.pillars)} />
                  </section>
                </FadeIn>

                {/* User Quotes - Supporting Evidence */}
                {session?.user?.id && (
                  <FadeIn delay={450}>
                    <ViewQuotes userId={session.user.id} />
                  </FadeIn>
                )}

                {/* Advanced Political Profile */}
                {mine.advanced && (
                  <FadeIn delay={500}>
                    <section className="rounded-2xl border border-neutral-200 p-4 bg-gradient-to-br from-blue-50 to-purple-50 hover:shadow-md transition-shadow duration-300">
                      <h2 className="mb-3 text-sm font-semibold">Advanced Political Analysis</h2>
                      <AdvancedPoliticalProfile profile={mine.advanced} />
                    </section>
                  </FadeIn>
                )}

                {/* Summary Card */}
                {summary && (
                  <FadeIn delay={600}>
                    <section className="rounded-2xl border border-neutral-200 p-4 bg-neutral-50 hover:shadow-md transition-shadow duration-300">
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
                  </FadeIn>
                )}
              </div>
            )}
          </PageTransition>
        )}

        {!loading && tab === "party" && (
          <PageTransition>
            {!party ? (
              <FadeIn>
                <div className="text-center py-8">
                  <p className="text-sm text-neutral-600 mb-4">No aggregate yet. Tap 'Refresh party' to build the first snapshot.</p>
                </div>
              </FadeIn>
            ) : (
              <div className="space-y-6">
                {/* Members Count */}
                <FadeIn delay={100}>
                  <section className="rounded-2xl border border-neutral-200 p-4 hover:shadow-md transition-shadow duration-300">
                    <h2 className="mb-3 text-sm font-semibold">Party members</h2>
                    <div className="flex justify-center items-center gap-4">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-black mb-1">{party.member_count}</div>
                        <div className="text-sm text-neutral-600">Active members</div>
                      </div>
                      <div className="h-12 w-px bg-neutral-200"></div>
                      <div className="text-center">
                        <div className="text-xl font-semibold text-black mb-1">
                          {Object.values(party.pillar_means || {}).some(v => v !== 0) ? 
                            "Active" : 
                            "New"}
                        </div>
                        <div className="text-sm text-neutral-600">Party status</div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-neutral-100">
                      <div className="text-xs text-center text-neutral-500">
                        {party.member_count > 1 ? 
                          `Members are contributing to the party's political profile` : 
                          `Waiting for more members to join`}
                      </div>
                    </div>
                  </section>
                </FadeIn>

                {/* Top Issues */}
                <section className="rounded-2xl border border-neutral-200 p-4">
                  <h2 className="mb-3 text-sm font-semibold">Top issues (party)</h2>
                  <div className="space-y-4">
                    {party.top_issues.slice(0, 3).map((issue, i) => (
                      <div key={i} className="border-b border-neutral-100 pb-3 last:border-b-0 last:pb-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center">
                              {i + 1}
                            </div>
                            <span className="text-sm font-medium">{issue.title}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-xs text-neutral-600">
                              {issue.mentions !== undefined ? `${issue.mentions} mentions` : `${issue.count} members`}
                            </span>
                            <span className="text-xs text-neutral-500">
                              {issue.mentions !== undefined && issue.count ? `across ${issue.count} members` : ''}
                            </span>
                          </div>
                        </div>
                        {issue.quotes && issue.quotes.length > 0 && (
                          <div className="mt-1 pl-9">
                            <blockquote className="text-xs italic text-neutral-600 border-l-2 border-neutral-200 pl-2">
                              "{issue.quotes[0]}"
                            </blockquote>
                          </div>
                        )}
                      </div>
                    ))}
                    {party.top_issues.length === 0 && (
                      <p className="text-sm text-neutral-500">No issues tracked yet</p>
                    )}
                  </div>
                </section>

                {/* Compass Distribution */}
                {party.compass_distribution && party.compass_distribution.bins && party.compass_distribution.bins.counts && (
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
                      <div className="flex justify-center items-center gap-2 mb-2">
                        <div className="px-2 py-0.5 bg-black text-white text-xs rounded-full">
                          {party.top_contributor.metric} points
                        </div>
                        {party.top_contributor.statement_count !== undefined && (
                          <div className="px-2 py-0.5 bg-neutral-100 text-neutral-700 text-xs rounded-full">
                            {party.top_contributor.statement_count} statements
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-neutral-600 mb-3">
                        Most active in the last 14 days
                      </div>
                      
                      {/* Statement examples */}
                      {party.top_contributor.examples && party.top_contributor.examples.length > 0 && (
                        <div className="mt-3 border-t border-neutral-100 pt-3">
                          <div className="text-xs text-neutral-500 mb-2">Recent statements:</div>
                          <div className="space-y-2">
                            {party.top_contributor.examples.map((example, i) => (
                              <div key={i} className="text-xs text-neutral-600 text-left bg-neutral-50 p-2 rounded">
                                "{example.length > 80 ? example.substring(0, 80) + '...' : example}"
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* Party Summary */}
                {party.party_summary && (
                  <section className="rounded-2xl border border-neutral-200 p-4 bg-gradient-to-br from-neutral-50 to-neutral-100">
                    <h2 className="mb-3 text-sm font-semibold">Party summary</h2>
                    <div className="relative">
                      <div className="absolute -left-2 top-0 text-3xl text-neutral-200">"</div>
                      <p className="text-sm text-neutral-700 leading-relaxed pl-4 pr-4">
                        {party.party_summary}
                      </p>
                      <div className="absolute -right-2 bottom-0 text-3xl text-neutral-200">"</div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-neutral-200 flex justify-between items-center">
                      <div className="text-xs text-neutral-500">
                        Based on data from {party.member_count} members
                      </div>
                      <div className="text-xs text-neutral-500">
                        Updated {new Date().toLocaleDateString()}
                      </div>
                    </div>
                  </section>
                )}
              </div>
            )}
          </PageTransition>
        )}
      </main>

      <Navigation />
      
      {/* Refresh Animation */}
      <RefreshAnimation 
        isVisible={showRefreshAnimation} 
        onComplete={handleRefreshAnimationComplete}
        isProcessing={refreshing || refreshingParty}
      />
    </div>
  )
}
