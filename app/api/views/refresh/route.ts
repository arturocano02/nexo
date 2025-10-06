import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"
import { z } from "zod"
import { mergeDeltas, DeltaSchema } from "@/src/lib/ai/mergeDeltas"
import { SUMMARIZER_PROMPT, EXTRACTOR_PROMPT } from "@/src/lib/ai/systemPrompts"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Rate limiting (in-memory for dev)
const rateLimit = new Map<string, { count: number; resetTime: number }>()

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

// Initialize OpenAI (only when API key is available)
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

// Request schema
const RefreshRequestSchema = z.object({
  lookbackDays: z.number().min(1).max(30).default(7),
  maxMessages: z.number().min(1).max(100).default(30)
})

// Rate limiting check
function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const userLimit = rateLimit.get(userId)
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimit.set(userId, { count: 1, resetTime: now + 15000 }) // 15 seconds
    return true
  }
  
  if (userLimit.count >= 3) {
    return false // Rate limited
  }
  
  userLimit.count++
  return true
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const supa = supabaseFromAuthHeader(req)
    
    // Get user
    const { data: me, error: meErr } = await supa.auth.getUser()
    if (meErr || !me?.user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }
    const userId = me.user.id

    // Check rate limit
    if (!checkRateLimit(userId)) {
      return NextResponse.json({ error: "Rate limited. Please wait 15 seconds." }, { status: 429 })
    }

    // Parse request body
    const body = await req.json()
    const { lookbackDays, maxMessages } = RefreshRequestSchema.parse(body)

    // Get user's conversation or create one if it doesn't exist
    let conversation
    const { data: existingConvs, error: convError } = await supa
      .from("conversations")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (convError) {
      throw convError
    }

    if (existingConvs && existingConvs.length > 0) {
      // Use the most recent conversation
      conversation = existingConvs[0]
    } else {
      // Create a new conversation if none exists
      const { data: newConv, error: newConvError } = await supa
        .from("conversations")
        .insert({
          user_id: userId,
          title: "Political Discussion"
        })
        .select("id")
        .single()

      if (newConvError) {
        throw newConvError
      }
      conversation = newConv
    }

    // Get the last view update to determine cutoff date
    const { data: lastUpdate } = await supa
      .from("view_updates")
      .select("created_at")
      .eq("user_id", userId)
      .eq("source", "chat")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    let cutoffDate
    if (lastUpdate) {
      // Use the last refresh time as cutoff
      cutoffDate = new Date(lastUpdate.created_at)
    } else {
      // If no previous refresh, use lookback days
      cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - lookbackDays)
    }

    const { data: messages, error: messagesErr } = await supa
      .from("messages")
      .select("content, role, created_at")
      .eq("conversation_id", conversation.id)
      .gte("created_at", cutoffDate.toISOString())
      .order("created_at", { ascending: true })
      .limit(maxMessages)

    if (messagesErr) {
      throw messagesErr
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ 
        error: "No new messages found since last refresh. Try chatting first!",
        snapshot: null,
        changes: null,
        summary: null
      }, { status: 200 }) // Return 200 with empty data instead of 404
    }

    if (!openai) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 })
    }

    // Prepare conversation context for OpenAI
    const conversationText = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n\n')

    console.log(`[Refresh] Analyzing ${messages.length} messages for user ${userId}`)

    // Call OpenAI for summarization
    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SUMMARIZER_PROMPT },
        { role: "user", content: `Analyze this political conversation:\n\n${conversationText}` }
      ],
      temperature: 0.3,
      max_tokens: 1000
    })

    const summaryText = summaryResponse.choices[0]?.message?.content
    if (!summaryText) {
      throw new Error("Failed to get summary from OpenAI")
    }

    let summaryData
    try {
      summaryData = JSON.parse(summaryText)
    } catch {
      throw new Error("Invalid JSON from summarizer")
    }

    // Call OpenAI for delta extraction
    const extractorResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: EXTRACTOR_PROMPT },
        { role: "user", content: `Based on this conversation, provide deltas:\n\n${conversationText}` }
      ],
      temperature: 0.1,
      max_tokens: 500
    })

    const extractorText = extractorResponse.choices[0]?.message?.content
    if (!extractorText) {
      throw new Error("Failed to get deltas from OpenAI")
    }

    let deltaData
    try {
      deltaData = JSON.parse(extractorText)
      DeltaSchema.parse(deltaData) // Validate schema
    } catch (error) {
      console.error("Invalid delta data:", error)
      throw new Error("Invalid delta data from extractor")
    }

    // Get current snapshot
    const { data: currentSnapshot } = await supa
      .from("views_snapshots")
      .select("pillars, top_issues")
      .eq("user_id", userId)
      .maybeSingle()

    // If no snapshot exists, create a default one
    const defaultSnapshot = {
      pillars: {
        economy: { score: 50, rationale: "" },
        social: { score: 50, rationale: "" },
        environment: { score: 50, rationale: "" },
        governance: { score: 50, rationale: "" },
        foreign: { score: 50, rationale: "" }
      },
      top_issues: []
    }

    // Merge deltas
    const mergedSnapshot = mergeDeltas(currentSnapshot || defaultSnapshot, deltaData)
    console.log("Merged snapshot:", JSON.stringify(mergedSnapshot, null, 2))

    // Update views_snapshots
    const { error: snapshotError } = await supa
      .from("views_snapshots")
      .upsert({
        user_id: userId,
        pillars: mergedSnapshot.pillars,
        top_issues: mergedSnapshot.top_issues,
        updated_at: new Date().toISOString()
      })

    if (snapshotError) {
      throw snapshotError
    }

    // Insert view_updates audit
    const { error: updateError } = await supa
      .from("view_updates")
      .insert({
        user_id: userId,
        source: "chat",
        delta: deltaData
      })

    if (updateError) {
      throw updateError
    }

    // Insert conversation summary
    const { error: summaryError } = await supa
      .from("conversation_summaries")
      .insert({
        user_id: userId,
        summary: summaryData
      })

    if (summaryError) {
      throw summaryError
    }

    // Fire-and-forget aggregates refresh (with debounce)
    try {
      await fetch(`/api/aggregates/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error("Failed to refresh aggregates:", error)
    }

    console.log(`[Refresh] Successfully updated views for user ${userId}`)

    return NextResponse.json({
      ok: true,
      snapshot: mergedSnapshot,
      changes: {
        pillarsDelta: deltaData.pillarsDelta,
        topIssuesDelta: deltaData.topIssuesDelta
      },
      summary: summaryData
    })

  } catch (error: any) {
    console.error("Refresh views error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to refresh views" },
      { status: 500 }
    )
  }
}
