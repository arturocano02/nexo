"use client"
import { useState, useEffect } from "react"
import { supabaseBrowser } from "@/src/lib/supabase/client"

interface ViewQuotesProps {
  userId: string
}

export default function ViewQuotes({ userId }: ViewQuotesProps) {
  const [quotes, setQuotes] = useState<{
    economy: string[]
    social: string[]
    environment: string[]
    governance: string[]
    foreign: string[]
  }>({
    economy: [],
    social: [],
    environment: [],
    governance: [],
    foreign: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchQuotes = async () => {
      setLoading(true)
      try {
        const supa = supabaseBrowser()
        
        // First get the conversation ID
        const { data: conversations } = await supa
          .from("conversations")
          .select("id")
          .eq("user_id", userId)
          .limit(1)
        
        if (!conversations || conversations.length === 0) {
          setLoading(false)
          return
        }
        
        const conversationId = conversations[0].id
        
        // Get user messages from the conversation
        const { data: messages } = await supa
          .from("messages")
          .select("content")
          .eq("conversation_id", conversationId)
          .eq("role", "user") // Only user messages
          .order("created_at", { ascending: false })
          .limit(50) // Get recent messages
        
        if (!messages || messages.length === 0) {
          setLoading(false)
          return
        }
        
        // Categorize messages by pillar keywords
        const pillarKeywords = {
          economy: ["economy", "economic", "tax", "spending", "budget", "debt", "inflation", "jobs", "business", "market"],
          social: ["social", "healthcare", "education", "welfare", "equality", "justice", "rights", "community", "society"],
          environment: ["environment", "climate", "green", "pollution", "renewable", "sustainable", "energy", "conservation"],
          governance: ["government", "democracy", "voting", "parliament", "law", "regulation", "policy", "corruption", "transparency"],
          foreign: ["foreign", "international", "trade", "war", "peace", "diplomacy", "immigration", "borders", "global"]
        }
        
        // Filter messages by keywords
        const categorizedQuotes = {
          economy: [] as string[],
          social: [] as string[],
          environment: [] as string[],
          governance: [] as string[],
          foreign: [] as string[]
        }
        
        messages.forEach(msg => {
          const content = msg.content.toLowerCase()
          
          Object.entries(pillarKeywords).forEach(([pillar, keywords]) => {
            if (keywords.some(keyword => content.includes(keyword))) {
              // Only add if not already in the array and it's not too long
              if (!categorizedQuotes[pillar as keyof typeof categorizedQuotes].includes(msg.content) && 
                  msg.content.length < 200) {
                categorizedQuotes[pillar as keyof typeof categorizedQuotes].push(msg.content)
              }
            }
          })
        })
        
        // Limit to 2 quotes per pillar
        Object.keys(categorizedQuotes).forEach(pillar => {
          categorizedQuotes[pillar as keyof typeof categorizedQuotes] = 
            categorizedQuotes[pillar as keyof typeof categorizedQuotes].slice(0, 2)
        })
        
        setQuotes(categorizedQuotes)
      } catch (error) {
        console.error("Error fetching quotes:", error)
      } finally {
        setLoading(false)
      }
    }
    
    if (userId) {
      fetchQuotes()
    }
  }, [userId])

  // Only show pillars that have quotes
  const hasQuotes = Object.values(quotes).some(pillarQuotes => pillarQuotes.length > 0)
  
  if (loading) {
    return <div className="text-sm text-neutral-500 text-center py-2">Loading quotes...</div>
  }
  
  if (!hasQuotes) {
    return null // Don't show anything if no quotes
  }

  return (
    <section className="rounded-2xl border border-neutral-200 p-4 bg-neutral-50 hover:shadow-md transition-shadow duration-300">
      <h2 className="mb-3 text-sm font-semibold">Your Political Statements</h2>
      <div className="space-y-4">
        {Object.entries(quotes).map(([pillar, pillarQuotes]) => {
          if (pillarQuotes.length === 0) return null
          
          return (
            <div key={pillar} className="space-y-2">
              <h3 className="text-xs font-semibold capitalize text-neutral-700">{pillar}</h3>
              {pillarQuotes.map((quote, index) => (
                <div key={index} className="text-xs bg-white p-2 rounded border border-neutral-200">
                  <blockquote className="italic text-neutral-700">"{quote}"</blockquote>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </section>
  )
}
