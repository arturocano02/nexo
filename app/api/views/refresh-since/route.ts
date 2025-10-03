import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"
import { z } from "zod"
import { mergeDeltas, DeltaSchema } from "@/src/lib/ai/mergeDeltas"
import { NEXO_ANALYZER_PROMPT } from "@/src/lib/ai/systemPrompts"

// Helper to normalize snapshot pillars to numeric scores
function toNumberScore(s: any, fallback = 50): number {
  if (typeof s === 'number') return s
  if (s && typeof s === 'object' && typeof s.score === 'number') return s.score
  return fallback
}

function normalizeSnapshot(s: any) {
  const out = { pillars: {} as any, top_issues: s.top_issues || [] }
  for (const k of ['economy', 'social', 'environment', 'governance', 'foreign']) {
    const p = s.pillars?.[k] || {}
    out.pillars[k] = { 
      score: toNumberScore(p.score), 
      rationale: String(p.rationale || '') 
    }
  }
  return out
}

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
  maxMessages: z.number().min(1).max(200).default(200),
  lookbackDays: z.number().min(1).max(30).default(30)
})

// Nexo Analyzer response schema
const NexoAnalyzerSchema = z.object({
  top_issues: z.array(z.object({
    issue: z.string(),
    mentions: z.number()
  })),
  pillar_deltas: z.object({
    economy: z.number().min(-10).max(10),
    environment: z.number().min(-10).max(10),
    social: z.number().min(-10).max(10),
    governance: z.number().min(-10).max(10),
    foreign: z.number().min(-10).max(10)
  }),
  summary_message: z.string()
})

// Rate limiting check
function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const userLimit = rateLimit.get(userId)
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimit.set(userId, { count: 1, resetTime: now + 10000 }) // 10 seconds
    return true
  }
  
  if (userLimit.count >= 1) {
    return false // Rate limited
  }
  
  userLimit.count++
  return true
}

// Debounced party refresh (fire-and-forget)
let lastPartyRefresh = 0
async function debouncedPartyRefresh() {
  const now = Date.now()
  if (now - lastPartyRefresh < 30000) { // 30 seconds debounce
    return
  }
  lastPartyRefresh = now
  
  try {
    await fetch(`${process.env.NEXT_PUBLIC_VERCEL_URL || 'http://localhost:3000'}/api/party/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error("Failed to refresh party aggregates:", error)
  }
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
      return NextResponse.json({ error: "Rate limited. Please wait 10 seconds." }, { status: 429 })
    }

    // Parse request body
    const body = await req.json()
    const { maxMessages, lookbackDays } = RefreshRequestSchema.parse(body)

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

    // Read analysis_state for this user
    const { data: analysisState } = await supa
      .from("analysis_state")
      .select("last_processed_message_id, last_processed_at")
      .eq("user_id", userId)
      .maybeSingle()

    // Determine reference point for new messages
    let referencePoint: string | null = null
    if (analysisState?.last_processed_message_id) {
      referencePoint = analysisState.last_processed_message_id
    } else if (analysisState?.last_processed_at) {
      referencePoint = analysisState.last_processed_at
    } else {
      // No previous processing, use lookback window
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - lookbackDays)
      referencePoint = cutoffDate.toISOString()
    }

    // Query ONLY new messages since reference point
    let messagesQuery = supa
      .from("messages")
      .select("id, content, role, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .limit(maxMessages)

    if (analysisState?.last_processed_message_id) {
      // Use message ID for precise tracking
      messagesQuery = messagesQuery.gt("id", analysisState.last_processed_message_id)
    } else {
      // Use timestamp
      messagesQuery = messagesQuery.gt("created_at", referencePoint)
    }

    const { data: messages, error: messagesErr } = await messagesQuery

    if (messagesErr) {
      throw messagesErr
    }

    if (!messages || messages.length === 0) {
      // Return current snapshot with no changes
      const { data: currentSnapshot } = await supa
        .from("views_snapshots")
        .select("pillars, top_issues")
        .eq("user_id", userId)
        .maybeSingle()

      return NextResponse.json({ 
        ok: true, 
        processedCount: 0, 
        snapshot: currentSnapshot || {
          pillars: {
            economy: { score: 50, rationale: "Default starting point" },
            social: { score: 50, rationale: "Default starting point" },
            environment: { score: 50, rationale: "Default starting point" },
            governance: { score: 50, rationale: "Default starting point" },
            foreign: { score: 50, rationale: "Default starting point" }
          },
          top_issues: []
        },
        changes: {
          pillarsDelta: { economy: 0, social: 0, environment: 0, governance: 0, foreign: 0 },
          topIssuesDelta: []
        },
        note: "No new messages since last refresh."
      })
    }

    if (!openai) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 503 })
    }

    // Prepare conversation context for OpenAI
    const conversationText = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n\n')

    console.log(`[RefreshSince] Analyzing ${messages.length} new messages for user ${userId}`)

    // Step 4: Single Nexo Analyzer call (OpenAI, temp ~0.2)
    const analyzerResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: NEXO_ANALYZER_PROMPT
        },
        { role: "user", content: `Analyze this political conversation:\n\n${conversationText}` }
      ],
      temperature: 0.2,
      max_tokens: 800
    })

    const analyzerText = analyzerResponse.choices[0]?.message?.content
    if (!analyzerText) {
      throw new Error("Failed to get analysis from OpenAI")
    }

    let analyzerData
    try {
      analyzerData = JSON.parse(analyzerText)
      NexoAnalyzerSchema.parse(analyzerData) // Validate schema
    } catch (error) {
      console.error("Invalid analyzer data, using fallback:", error)
      // Fallback to empty analysis to prevent 500 errors
      analyzerData = {
        top_issues: [],
        pillar_deltas: { economy: 0, environment: 0, social: 0, governance: 0, foreign: 0 },
        summary_message: "[NEXO-SUMMARY] Analysis failed - no changes detected."
      }
    }

    // Convert analyzer format to existing delta format
    const deltaData = {
      pillarsDelta: analyzerData.pillar_deltas,
      topIssuesDelta: analyzerData.top_issues.map((issue: any) => ({
        op: "add" as const,
        title: issue.issue,
        summary: `Mentioned ${issue.mentions} time(s)`
      }))
    }

    // Step 6: Merge deltas
    const { data: currentSnapshot } = await supa
      .from("views_snapshots")
      .select("pillars, top_issues")
      .eq("user_id", userId)
      .maybeSingle()

    // If no snapshot exists, create a default one
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

    // Merge deltas with 0-100 clamping
    const mergedSnapshot = mergeDeltas(currentSnapshot || defaultSnapshot, deltaData)
    console.log("Merged snapshot:", JSON.stringify(mergedSnapshot, null, 2))

    // Normalize snapshot before upsert to ensure numeric scores
    const normalizedSnapshot = normalizeSnapshot(mergedSnapshot)
    console.log("Normalized snapshot:", JSON.stringify(normalizedSnapshot, null, 2))

    // Update views_snapshots with summary message
    const { error: snapshotError } = await supa
      .from("views_snapshots")
      .upsert({
        user_id: userId,
        pillars: normalizedSnapshot.pillars,
        top_issues: normalizedSnapshot.top_issues,
        summary_message: analyzerData.summary_message,
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

    // Step 7: Append a summary note into chat
    const summaryNote = analyzerData.summary_message
    
    const { error: messageError } = await supa
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        role: "assistant",
        content: summaryNote
      })

    if (messageError) {
      console.error("Failed to insert summary message:", messageError)
      // Don't fail the whole operation for this
    }

    // Step 8: Update analysis_state
    const newestMessageId = messages[messages.length - 1].id
    const { error: stateError } = await supa
      .from("analysis_state")
      .upsert({
        user_id: userId,
        last_processed_message_id: newestMessageId,
        last_processed_at: new Date().toISOString(),
        last_refresh_result: {
          pillarsDelta: deltaData.pillarsDelta,
          topIssuesDelta: deltaData.topIssuesDelta,
          processed: messages.length
        },
        updated_at: new Date().toISOString()
      })

    if (stateError) {
      console.error("Failed to update analysis state:", stateError)
      // Don't fail the whole operation for this
    }

    // Step 9: Fire-and-forget party aggregate refresh
    debouncedPartyRefresh()

    console.log(`[RefreshSince] Successfully updated views for user ${userId}`)

    return NextResponse.json({
      ok: true,
      snapshot: mergedSnapshot,
      changes: {
        pillarsDelta: deltaData.pillarsDelta,
        topIssuesDelta: deltaData.topIssuesDelta
      },
      processedCount: messages.length
    })

  } catch (error: any) {
    console.error("Refresh views error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to refresh views" },
      { status: 500 }
    )
  }
}
