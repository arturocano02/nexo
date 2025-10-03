"use client"
import { useState, useEffect } from "react"
import { trackViewsEvent, trackError } from "@/src/lib/analytics"
import toast from "react-hot-toast"

interface MagicRefreshButtonProps {
  onSuccess?: (result: any) => void
  className?: string
  children?: React.ReactNode
  variant?: 'views' | 'party'
}

export default function MagicRefreshButton({ 
  onSuccess, 
  className = "",
  children = "Refresh Views",
  variant = 'views'
}: MagicRefreshButtonProps) {
  const [loading, setLoading] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [sparkles, setSparkles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([])

  const generateSparkles = () => {
    const newSparkles = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 0.5
    }))
    setSparkles(newSparkles)
  }

  const handleRefresh = async () => {
    if (loading) return

    setLoading(true)
    setIsAnimating(true)
    generateSparkles()

    try {
      const supa = (await import("@/src/lib/supabase/client")).supabaseBrowser()
      const { data: { session } } = await supa.auth.getSession()
      
      if (!session) {
        toast.error("Please sign in to refresh views")
        return
      }

      const endpoint = variant === 'views' ? "/api/views/refresh-since" : "/api/party/refresh"
      const body = variant === 'views' 
        ? { maxMessages: 200, lookbackDays: 30 }
        : {}

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to refresh")
      }

      const result = await response.json()
      
      // Show success toast with changes
      if (variant === 'views') {
        if (result.processedCount === 0) {
          toast.success("✨ No new messages since last refresh", {
            duration: 3000,
            style: {
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '16px 20px',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
            }
          })
        } else if (result.changes && result.changes.pillarsDelta) {
          const changes = Object.entries(result.changes.pillarsDelta)
            .filter(([_, delta]) => delta !== 0)
            .map(([pillar, delta]) => {
              const sign = (delta as number) > 0 ? "+" : ""
              return `${pillar} ${sign}${delta}`
            })
            .join(", ")
          
          if (changes) {
            toast.success(`✨ Views refreshed (${result.processedCount} messages): ${changes}`, {
              duration: 4000,
              style: {
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '16px 20px',
                fontSize: '14px',
                fontWeight: '500',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
              }
            })
          } else {
            toast.success(`✨ Views refreshed (${result.processedCount} messages)`, {
              duration: 3000,
              style: {
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '16px 20px',
                fontSize: '14px',
                fontWeight: '500',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
              }
            })
          }
        } else {
          toast.success(`✨ Views refreshed (${result.processedCount} messages)`, {
            duration: 3000,
            style: {
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '16px 20px',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
            }
          })
        }
      } else {
        // Party refresh
        toast.success("✨ Party refreshed", {
          duration: 3000,
          style: {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '16px 20px',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }
        })
      }

      // Track successful refresh
      trackViewsEvent('VIEWS_REFRESHED', 'success')
      
      // Call success callback
      if (onSuccess) {
        onSuccess(result)
      }

    } catch (error: any) {
      console.error("Refresh error:", error)
      trackError('refresh_failed', error.message)
      toast.error(error.message || "Failed to refresh")
    } finally {
      setLoading(false)
      // Keep animation for a bit longer for the magic effect
      setTimeout(() => {
        setIsAnimating(false)
        setSparkles([])
      }, 1000)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleRefresh}
        disabled={loading}
        className={`
          relative overflow-hidden px-6 py-3 rounded-xl text-sm font-medium 
          disabled:opacity-50 disabled:cursor-not-allowed 
          transition-all duration-300 ease-out
          ${loading || isAnimating
            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg scale-105'
            : 'bg-black text-white hover:bg-neutral-800 hover:scale-105'
          }
          ${className}
        `}
      >
        {/* Sparkle animation overlay */}
        {isAnimating && (
          <div className="absolute inset-0 pointer-events-none">
            {sparkles.map((sparkle) => (
              <div
                key={sparkle.id}
                className="absolute w-1 h-1 bg-white rounded-full animate-ping"
                style={{
                  left: `${sparkle.x}%`,
                  top: `${sparkle.y}%`,
                  animationDelay: `${sparkle.delay}s`,
                  animationDuration: '1s'
                }}
              />
            ))}
          </div>
        )}
        
        {/* Button content */}
        <div className="relative z-10 flex items-center justify-center gap-2">
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Refreshing...</span>
            </>
          ) : (
            <>
              <span>{children}</span>
              <div className="text-lg">✨</div>
            </>
          )}
        </div>
        
        {/* Shimmer effect */}
        {isAnimating && (
          <div className="absolute inset-0 -top-1 -left-1 -right-1 -bottom-1 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse" />
        )}
      </button>
    </div>
  )
}
