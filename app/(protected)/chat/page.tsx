"use client"
import { useState } from "react"
import RequireAuth from "@/components/RequireAuth"
import Navigation from "@/components/Navigation"
import ChatInterface from "@/src/components/ChatInterface"
import { supabaseBrowser } from "@/src/lib/supabase/client"
import toast from "react-hot-toast"

export default function ChatPage() {
  return (
    <RequireAuth>
      <ChatPageInner />
    </RequireAuth>
  )
}

function ChatPageInner() {
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<{ changes: any; timestamp: number } | null>(null)

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
      
      // Check if there was an error (like no new messages)
      if (result.error) {
        toast.error(result.error)
        return
      }
      
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

  const handleViewUpdate = () => {
    // This will be called after each chat exchange to potentially update views
    // For now, we'll just show a subtle notification
    toast.success("Views updated from conversation")
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div 
        className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-neutral-200"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Chat</h1>
              <p className="text-sm text-neutral-600">AI-powered political discussions</p>
            </div>
            <button
              onClick={handleRefreshViews}
              disabled={refreshing}
              className="h-10 px-4 rounded-lg bg-black text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-800 transition-colors"
            >
              {refreshing ? "Refreshing..." : "Refresh views"}
            </button>
          </div>
          
          {/* Changes indicator */}
          {lastRefresh && (
            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
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
        </div>
      </div>

      {/* Main Content */}
      <main 
        className="flex-1 flex flex-col"
        style={{ 
          height: 'calc(100vh - env(safe-area-inset-top) - 4rem)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 5rem)'
        }}
      >
        <ChatInterface onViewUpdate={handleViewUpdate} />
      </main>

      <Navigation />
    </div>
  )
}
