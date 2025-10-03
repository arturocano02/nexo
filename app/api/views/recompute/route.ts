import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"
import { z } from "zod"
import { assertServerEnv, createEnvErrorResponse, EnvError } from "@/src/lib/env"
import { getSupabaseConfig } from "@/src/lib/env"
import { analyzeSurvey } from "@/src/lib/ai/analyzeSurvey"
import { summarizeConversation } from "@/src/lib/ai/summarizeConversation"
import { extractDeltas } from "@/src/lib/ai/extractDeltas"
import { mergeSnapshot, createInitialSnapshot, validateSnapshot } from "@/src/lib/ai/mergeSnapshot"
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
const RATE_LIMIT_WINDOW = 15000 // 15 seconds

// Request schema
const RecomputeRequestSchema = z.object({
  lookbackDays: z.number().min(1).max(30).default(30),
  maxMessages: z.number().min(1).max(200).default(200)
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

// Response schema
const RecomputeResponseSchema = z.object({
  ok: z.boolean(),
  snapshot: z.object({
    pillars: z.record(z.string(), z.object({
      score: z.number(),
      rationale: z.string()
    })),
    top_issues: z.array(z.object({
      title: z.string(),
      summary: z.string()
    }))
  }),
  changes: z.object({
    pillarsDelta: z.record(z.string(), z.number()),
    topIssuesDelta: z.array(z.object({
      op: z.enum(["add", "remove", "update"]),
      title: z.string().optional(),
      summary: z.string().optional()
    }))
  }),
  context: z.object({
    fromSurvey: z.boolean(),
    analyzedMessages: z.number(),
    timeSpanDays: z.number()
  })
})

// Initialize OpenAI (only when API key is available)
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

// Rate limiting check
function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const userLimit = rateLimit.get(userId)
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimit.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }
  
  if (userLimit.count >= 1) {
    return false // Rate limited
  }
  
  userLimit.count++
  return true
}

// Create a client bound to the user's JWT so RLS auth.uid() works
function supabaseFromAuthHeader(req: NextRequest) {
  const { url, anonKey } = getSupabaseConfig()
  const auth = req.headers.get("authorization") || ""
  return createClient(url, anonKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  })
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  let userId = "unknown"
  
  try {
    // Check environment configuration
    try {
      assertServerEnv()
    } catch (error) {
      if (error instanceof EnvError) {
        return NextResponse.json(createEnvErrorResponse(error), { status: 503 })
      }
      throw error
    }

    // Check authentication
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
    userId = me.user.id

    // Check rate limit
    if (!checkRateLimit(userId)) {
      return NextResponse.json({ error: "Rate limited. Please wait 15 seconds." }, { status: 429 })
    }

    // Parse request body
    const body = await req.json()
    const { lookbackDays, maxMessages } = RecomputeRequestSchema.parse(body)

    console.log(`[Recompute] Starting for user ${userId}`)

    // 1. Check if user has survey responses
    const { data: surveyResponses, error: surveyErr } = await supa
      .from("survey_responses")
      .select("question_id, choice, text")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (surveyErr) {
      throw surveyErr
    }

    if (!surveyResponses || surveyResponses.length === 0) {
      return NextResponse.json({ 
        error: "Please complete the survey first to establish your baseline political profile" 
      }, { status: 400 })
    }

    // 2. Load conversation messages
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays)

    const { data: messages, error: messagesErr } = await supa
      .from("messages")
      .select("role, content, created_at")
      .eq("user_id", userId)
      .gte("created_at", cutoffDate.toISOString())
      .order("created_at", { ascending: true })
      .limit(maxMessages)

    if (messagesErr) {
      throw messagesErr
    }

    // 3. Analyze survey responses (baseline)
    console.log(`[Recompute] Analyzing ${surveyResponses.length} survey responses`)
    const surveyAnalysis = await analyzeSurvey(surveyResponses)

    // 4. Analyze conversation with Nexo Analyzer
    let analyzerData = {
      top_issues: [],
      pillar_deltas: { economy: 0, environment: 0, social: 0, governance: 0, foreign: 0 },
      summary_message: "[NEXO-SUMMARY] No conversation to analyze."
    }
    
    if (messages && messages.length > 0 && openai) {
      console.log(`[Recompute] Analyzing ${messages.length} messages with Nexo Analyzer`)
      
      // Prepare conversation context
      const conversationText = messages
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n\n')
      
      // Call Nexo Analyzer
      const analyzerResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: NEXO_ANALYZER_PROMPT },
          { role: "user", content: `Analyze this political conversation:\n\n${conversationText}` }
        ],
        temperature: 0.2,
        max_tokens: 800
      })
      
      const analyzerText = analyzerResponse.choices[0]?.message?.content
      if (analyzerText) {
        try {
          analyzerData = JSON.parse(analyzerText)
          NexoAnalyzerSchema.parse(analyzerData)
        } catch (error) {
          console.error("Invalid analyzer data, using fallback:", error)
        }
      }
    }

    // 5. Get prior snapshot (if exists)
    const { data: priorSnapshot } = await supa
      .from("views_snapshots")
      .select("pillars, top_issues")
      .eq("user_id", userId)
      .maybeSingle()

    let newSnapshot
    let changes: any = { pillarsDelta: {}, topIssuesDelta: [] }

    if (priorSnapshot) {
      // Use Nexo Analyzer data to update prior snapshot
      console.log(`[Recompute] Applying analyzer deltas to prior snapshot`)
      const deltas = {
        pillarsDelta: analyzerData.pillar_deltas,
        topIssuesDelta: analyzerData.top_issues.map((issue: any) => ({
          op: "add" as const,
          title: issue.issue,
          summary: `Mentioned ${issue.mentions} time(s)`,
          mentions: issue.mentions
        }))
      }
      newSnapshot = mergeSnapshot(priorSnapshot, deltas)
      changes = deltas
    } else {
      // Create initial snapshot from survey
      console.log(`[Recompute] Creating initial snapshot from survey`)
      newSnapshot = createInitialSnapshot(surveyAnalysis)
      
      // Apply analyzer deltas if conversation provides evidence
      if (messages && messages.length > 0) {
        const deltas = {
          pillarsDelta: analyzerData.pillar_deltas,
          topIssuesDelta: analyzerData.top_issues.map((issue: any) => ({
            op: "add" as const,
            title: issue.issue,
            summary: `Mentioned ${issue.mentions} time(s)`,
            mentions: issue.mentions
          }))
        }
        newSnapshot = mergeSnapshot(newSnapshot, deltas)
        changes = deltas
      }
    }

    // Validate the new snapshot
    if (!validateSnapshot(newSnapshot)) {
      throw new Error("Generated snapshot failed validation")
    }

    // Normalize snapshot before upsert to ensure numeric scores
    const normalizedSnapshot = normalizeSnapshot(newSnapshot)
    console.log("Normalized snapshot:", JSON.stringify(normalizedSnapshot, null, 2))

    // 6. Upsert views_snapshots
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

    // 7. Insert view_updates audit
    const { error: updateError } = await supa
      .from("view_updates")
      .insert({
        user_id: userId,
        source: "recompute",
        delta: changes
      })

    if (updateError) {
      throw updateError
    }

    // 8. Fire-and-forget aggregates refresh
    try {
      await fetch(`${process.env.NEXT_PUBLIC_VERCEL_URL || 'http://localhost:3000'}/api/aggregates/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      console.error("Failed to refresh aggregates:", error)
    }

    const duration = Date.now() - startTime
    console.log(`[Recompute] Completed for user ${userId} in ${duration}ms`)

    // 9. Return response
    const response = {
      ok: true,
      snapshot: newSnapshot,
      changes,
      context: {
        fromSurvey: !priorSnapshot,
        analyzedMessages: messages ? messages.length : 0,
        timeSpanDays: 0
      }
    }

    // Validate response
    RecomputeResponseSchema.parse(response)

    return NextResponse.json(response)

  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error(`[Recompute] Failed for user ${userId} in ${duration}ms:`, error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Data validation failed", details: error.issues },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to recompute views" },
      { status: 500 }
    )
  }
}

