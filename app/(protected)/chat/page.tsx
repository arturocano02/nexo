"use client"
import { useState, useEffect } from "react"
import RequireAuth from "@/components/RequireAuth"
import Navigation from "@/components/Navigation"
import ChatInterface from "@/src/components/ChatInterface"
import { supabaseBrowser } from "@/src/lib/supabase/client"
import toast from "react-hot-toast"
import { trackPageView, trackChatEvent, trackError } from "@/src/lib/analytics"

export default function ChatPage() {
  return (
    <RequireAuth>
      <ChatPageInner />
    </RequireAuth>
  )
}

function ChatPageInner() {
  // Track page view on mount
  useEffect(() => {
    trackPageView('chat')
    trackChatEvent('CHAT_STARTED')
  }, [])

  const handleViewUpdate = () => {
    // This will be called after each chat exchange to potentially update views
    // No notification needed - views should only be updated manually from views page
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div 
        className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-neutral-200"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="px-4 py-3">
          <div>
            <h1 className="text-xl font-semibold">Chat</h1>
            <p className="text-sm text-neutral-600">AI-powered political discussions</p>
          </div>
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
