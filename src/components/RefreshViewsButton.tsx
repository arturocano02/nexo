"use client"
import { useState } from "react"
import { supabaseBrowser } from "@/src/lib/supabase/client"
import toast from "react-hot-toast"
import { trackViewsEvent, trackError } from "@/src/lib/analytics"

interface RefreshViewsButtonProps {
  onSuccess?: (result: any) => void
  className?: string
  children?: React.ReactNode
}

export default function RefreshViewsButton({ 
  onSuccess, 
  className = "",
  children = "Refresh Views"
}: RefreshViewsButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleRefresh = async () => {
    if (loading) return

    setLoading(true)
    try {
      const supa = supabaseBrowser()
      const { data: { session } } = await supa.auth.getSession()
      
      if (!session) {
        toast.error("Please sign in to refresh views")
        return
      }

      const response = await fetch("/api/views/recompute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          lookbackDays: 30,
          maxMessages: 200
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to refresh views")
      }

      const result = await response.json()
      
      // Show success toast with changes
      if (result.changes && result.changes.pillarsDelta) {
        const changes = Object.entries(result.changes.pillarsDelta)
          .filter(([_, delta]) => delta !== 0)
          .map(([pillar, delta]) => {
            const sign = (delta as number) > 0 ? "+" : ""
            return `${pillar} ${sign}${delta}`
          })
          .join(", ")
        
        if (changes) {
          toast.success(`Views refreshed: ${changes}`)
        } else {
          toast.success("Views refreshed")
        }
      } else {
        toast.success("Views refreshed")
      }

      // Track successful refresh
      trackViewsEvent('VIEWS_REFRESHED', 'success')
      
      // Call success callback
      if (onSuccess) {
        onSuccess(result)
      }

    } catch (error: any) {
      console.error("Refresh views error:", error)
      trackError('refresh_views_failed', error.message)
      toast.error(error.message || "Failed to refresh views")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={loading}
      className={`px-4 py-2 rounded-lg bg-black text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-800 transition-colors ${className}`}
    >
      {loading ? "Refreshing..." : children}
    </button>
  )
}

