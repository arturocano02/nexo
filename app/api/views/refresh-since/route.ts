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
    mentions: z.number(),
    user_quote: z.string().optional() // Make optional for backward compatibility
  })).min(1), // Require at least one issue
  pillar_deltas: z.object({
    economy: z.number().min(-10).max(10),
    environment: z.number().min(-10).max(10),
    social: z.number().min(-10).max(10),
    governance: z.number().min(-10).max(10),
    foreign: z.number().min(-10).max(10)
  }),
  pillar_evidence: z.record(z.string(), z.string()).optional(), // Make optional for backward compatibility
  summary_message: z.string().startsWith("[NEXO-SUMMARY]")
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
    // Use relative URL path instead of absolute URL with environment variables
    await fetch(`/api/party/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).catch(err => {
      console.error("Party refresh fetch error:", err)
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
    console.log('Request body:', body)
    
    let maxMessages, lookbackDays
    try {
      const parsed = RefreshRequestSchema.parse(body)
      maxMessages = parsed.maxMessages
      lookbackDays = parsed.lookbackDays
    } catch (error) {
      console.error('Request validation error:', error)
      return NextResponse.json({ 
        error: 'Invalid request parameters', 
        details: error instanceof Error ? error.message : 'Unknown validation error'
      }, { status: 400 })
    }

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
    const { data: analysisState, error: analysisStateError } = await supa
      .from("analysis_state")
      .select("last_processed_message_id, last_processed_at")
      .eq("user_id", userId)
      .maybeSingle()
    
    console.log(`[RefreshSince] Analysis state for user ${userId}:`, analysisState || "Not found")
    
    // If analysis_state doesn't exist, create it
    let forceFullAnalysis = false
    if (!analysisState && !analysisStateError) {
      console.log(`[RefreshSince] Creating new analysis_state for user ${userId}`)
      const { error: createError } = await supa
        .from("analysis_state")
        .insert({
          user_id: userId,
          last_processed_at: null,
          last_processed_message_id: null
        })
      
      if (createError) {
        console.error(`[RefreshSince] Error creating analysis_state:`, createError)
      }
      
      // Force a full analysis of all messages when analysis_state is created for the first time
      forceFullAnalysis = true
      console.log(`[RefreshSince] First refresh - will analyze all messages`)
    }

    // Determine reference point for new messages
    let referencePoint: string | null = null
    if (forceFullAnalysis) {
      // For first-time analysis, don't use any reference point to get all messages
      referencePoint = null
      console.log(`[RefreshSince] Forcing full analysis of all messages`)
    } else if (analysisState?.last_processed_message_id) {
      referencePoint = analysisState.last_processed_message_id
      console.log(`[RefreshSince] Using last_processed_message_id as reference: ${referencePoint}`)
    } else if (analysisState?.last_processed_at) {
      referencePoint = analysisState.last_processed_at
      console.log(`[RefreshSince] Using last_processed_at as reference: ${referencePoint}`)
    } else {
      // No previous processing, use lookback window
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - lookbackDays)
      referencePoint = cutoffDate.toISOString()
      console.log(`[RefreshSince] No previous processing, using lookback window: ${referencePoint}`)
    }

    // Query messages based on reference point
    let messagesQuery = supa
      .from("messages")
      .select("id, content, role, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .limit(maxMessages)

    // If forcing full analysis, don't apply any filters (get all messages)
    if (forceFullAnalysis) {
      console.log(`[RefreshSince] Forcing full analysis - getting all messages`)
    }
    // Check for message ID reference first (most precise)
    else if (analysisState?.last_processed_message_id) {
      console.log(`[RefreshSince] Querying messages after ID: ${analysisState.last_processed_message_id}`)
      messagesQuery = messagesQuery.gt("id", analysisState.last_processed_message_id)
    } 
    // Fall back to timestamp if no message ID
    else if (referencePoint) {
      console.log(`[RefreshSince] Querying messages after timestamp: ${referencePoint}`)
      messagesQuery = messagesQuery.gt("created_at", referencePoint)
    }
    // If no reference point at all, just get the latest messages
    else {
      console.log(`[RefreshSince] No reference point, getting latest ${maxMessages} messages`)
    }

    const { data: messages, error: messagesErr } = await messagesQuery

    if (messagesErr) {
      console.error(`[RefreshSince] Error querying messages:`, messagesErr)
      throw messagesErr
    }
    
    console.log(`[RefreshSince] Found ${messages?.length || 0} new messages to analyze`)
    
    // Debug: Log first few messages if any
    if (messages && messages.length > 0) {
      console.log(`[RefreshSince] First message:`, {
        id: messages[0].id,
        created_at: messages[0].created_at,
        role: messages[0].role,
        content_preview: messages[0].content.substring(0, 50) + '...'
      })
    }

    if (!messages || messages.length === 0) {
      console.log(`[RefreshSince] No new messages found for user ${userId}`)
      
      // Check if we have any messages at all
      const { data: allMessages, error: allMsgError } = await supa
        .from("messages")
        .select("id")
        .eq("conversation_id", conversation.id)
        .limit(1)
      
      if (allMsgError) {
        console.error(`[RefreshSince] Error checking for any messages:`, allMsgError)
      }
      
      // If we have no messages at all, it's a new user - force a refresh by ignoring the "no messages" check
      if (allMessages && allMessages.length === 0) {
        console.log(`[RefreshSince] No messages at all - new user. Will force analysis of survey data.`)
        
        // For new users, try to analyze their survey data instead
        const { data: surveyData } = await supa
          .from("survey_responses")
          .select("responses")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
          
        if (surveyData) {
          console.log(`[RefreshSince] Found survey data for new user, will analyze`)
          // We'll handle this in a separate function later
          // For now, continue to return the current snapshot
        } else {
          console.log(`[RefreshSince] No survey data found for new user`)
        }
      }
      
      // Return current snapshot with no changes
      const { data: currentSnapshot } = await supa
        .from("views_snapshots")
        .select("pillars, top_issues, summary_message")
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
          top_issues: [],
          summary_message: ""
        },
        changes: {
          pillarsDelta: { economy: 0, social: 0, environment: 0, governance: 0, foreign: 0 },
          topIssuesDelta: []
        },
        note: "No new messages since last refresh."
      })
    }

    if (!openai) {
      console.error("[RefreshSince] OpenAI API key not configured, using fallback analysis")
      // Instead of returning an error, use fallback analysis
      // Analyze messages to find political content
      const allUserMessages = messages.filter(m => m.role === 'user');
      
      // Extract topic-specific messages
      const envMessages = allUserMessages.filter(m => 
        m.content.toLowerCase().includes("environment") || 
        m.content.toLowerCase().includes("climate") ||
        m.content.toLowerCase().includes("green") ||
        m.content.toLowerCase().includes("pollution")
      );
      
      const econMessages = allUserMessages.filter(m => 
        m.content.toLowerCase().includes("econom") || 
        m.content.toLowerCase().includes("tax") ||
        m.content.toLowerCase().includes("spend") ||
        m.content.toLowerCase().includes("budget") ||
        m.content.toLowerCase().includes("job")
      );
      
      const socialMessages = allUserMessages.filter(m => 
        m.content.toLowerCase().includes("social") || 
        m.content.toLowerCase().includes("health") ||
        m.content.toLowerCase().includes("nhs") ||
        m.content.toLowerCase().includes("education") ||
        m.content.toLowerCase().includes("welfare")
      );
      
      const foreignMessages = allUserMessages.filter(m => 
        m.content.toLowerCase().includes("foreign") || 
        m.content.toLowerCase().includes("international") ||
        m.content.toLowerCase().includes("war") ||
        m.content.toLowerCase().includes("peace") ||
        m.content.toLowerCase().includes("immigration") ||
        m.content.toLowerCase().includes("palestine") ||
        m.content.toLowerCase().includes("israel") ||
        m.content.toLowerCase().includes("gaza")
      );
      
      const govMessages = allUserMessages.filter(m => 
        m.content.toLowerCase().includes("govern") || 
        m.content.toLowerCase().includes("democra") ||
        m.content.toLowerCase().includes("parliament") ||
        m.content.toLowerCase().includes("election") ||
        m.content.toLowerCase().includes("vote")
      );
      
      // Create top issues array based on what was found
      const topIssues = [];
      
      if (envMessages.length > 0) {
        topIssues.push({
          issue: "Environmental Policy",
          mentions: envMessages.length,
          user_quote: envMessages[0].content
        });
      }
      
      if (econMessages.length > 0) {
        topIssues.push({
          issue: "Economic Policy",
          mentions: econMessages.length,
          user_quote: econMessages[0].content
        });
      }
      
      if (socialMessages.length > 0) {
        topIssues.push({
          issue: "Social Policy",
          mentions: socialMessages.length,
          user_quote: socialMessages[0].content
        });
      }
      
      if (foreignMessages.length > 0) {
        topIssues.push({
          issue: "Foreign Policy",
          mentions: foreignMessages.length,
          user_quote: foreignMessages[0].content
        });
      }
      
      if (govMessages.length > 0) {
        topIssues.push({
          issue: "Governance",
          mentions: govMessages.length,
          user_quote: govMessages[0].content
        });
      }
      
      // If no specific topics found, use the first user message
      if (topIssues.length === 0 && allUserMessages.length > 0) {
        topIssues.push({
          issue: "Political Views",
          mentions: 1,
          user_quote: allUserMessages[0].content
        });
      }
      
      // Create pillar deltas based on message content
      const fallbackAnalysis = {
        top_issues: topIssues,
        pillar_deltas: { 
          // Check for specific mentions and give appropriate deltas
          economy: econMessages.length > 0 ? (econMessages[0].content.includes("tax") ? 5 : -5) : 0,
          environment: envMessages.length > 0 ? -5 : 0, // Assume pro-environment is more left-leaning
          social: socialMessages.length > 0 ? -3 : 0,
          governance: govMessages.length > 0 ? 2 : 0,
          foreign: foreignMessages.length > 0 ? (foreignMessages[0].content.includes("palestine") ? -4 : 2) : 0
        },
        pillar_evidence: {
          economy: econMessages.length > 0 ? econMessages[0].content : "",
          environment: envMessages.length > 0 ? envMessages[0].content : "",
          social: socialMessages.length > 0 ? socialMessages[0].content : "",
          governance: govMessages.length > 0 ? govMessages[0].content : "",
          foreign: foreignMessages.length > 0 ? foreignMessages[0].content : ""
        },
        summary_message: "[NEXO-SUMMARY] Your views have been updated based on your recent conversation. " + 
          (envMessages.length > 0 ? `You expressed interest in environmental topics: "${envMessages[0].content.substring(0, 50)}..." ` : "") +
          (econMessages.length > 0 ? `You discussed economic issues: "${econMessages[0].content.substring(0, 50)}..." ` : "") +
          (foreignMessages.length > 0 ? `You shared views on foreign policy: "${foreignMessages[0].content.substring(0, 50)}..." ` : "") +
          "These statements have been reflected in your political profile."
      }
      
      // Skip to delta conversion
      const deltaData = {
        pillarsDelta: fallbackAnalysis.pillar_deltas,
        topIssuesDelta: fallbackAnalysis.top_issues.map((issue: any) => ({
          op: "add" as const,
          title: issue.issue,
          summary: `Mentioned ${issue.mentions} time(s)`
        }))
      }
      
      // Continue with snapshot merging
      const { data: currentSnapshot } = await supa
        .from("views_snapshots")
        .select("pillars, top_issues")
        .eq("user_id", userId)
        .maybeSingle()
      
      // Default snapshot if none exists
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
      console.log("[RefreshSince] Merged snapshot (fallback):", JSON.stringify(mergedSnapshot, null, 2))
      
      // Save the merged snapshot
      const { error: updateErr } = await supa
        .from("views_snapshots")
        .upsert({
          user_id: userId,
          pillars: mergedSnapshot.pillars,
          top_issues: mergedSnapshot.top_issues,
          summary_message: fallbackAnalysis.summary_message
        })
      
      if (updateErr) {
        throw updateErr
      }
      
      // Update analysis state
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1]
        await supa
          .from("analysis_state")
          .upsert({
            user_id: userId,
            last_processed_message_id: lastMessage.id,
            last_processed_at: new Date().toISOString(),
            last_refresh_result: { processedCount: messages.length, mode: "fallback" }
          })
      }
      
      // Add message to conversation
      await supa
        .from("messages")
        .insert({
          conversation_id: conversation.id,
          user_id: userId,
          role: "assistant",
          content: fallbackAnalysis.summary_message
        })
      
      // Record the update
      await supa
        .from("view_updates")
        .insert({
          user_id: userId,
          source: "refresh_since",
          delta: deltaData
        })
      
      // Trigger party refresh (fire and forget)
      debouncedPartyRefresh()
      
      return NextResponse.json({
        ok: true,
        processedCount: messages.length,
        snapshot: mergedSnapshot,
        changes: deltaData,
        note: "Fallback analysis used (OpenAI not configured)"
      })
    }

    // Prepare conversation context for OpenAI
    const conversationText = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n\n')

    console.log(`[RefreshSince] Analyzing ${messages.length} new messages for user ${userId}`)

    // Step 4: Single Nexo Analyzer call with GPT-4o for better analysis
    const analyzerResponse = await openai.chat.completions.create({
      model: "gpt-4o", // Use full GPT-4o for better analysis
      messages: [
        { 
          role: "system", 
          content: NEXO_ANALYZER_PROMPT
        },
        { role: "user", content: `Analyze this political conversation carefully and extract all political views:\n\n${conversationText}` }
      ],
      temperature: 0.2,
      max_tokens: 1000 // Increased token limit for more detailed analysis
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
      pillarEvidence: analyzerData.pillar_evidence || {}, // Store evidence if available
      topIssuesDelta: analyzerData.top_issues.map((issue: any) => {
        // Create a more detailed summary that includes both the issue and the user's quote
        const quote = issue.user_quote || "";
        const truncatedQuote = quote.length > 100 ? 
          `${quote.substring(0, 100)}...` : 
          quote;
          
        return {
          op: "add" as const,
          title: issue.issue,
          summary: truncatedQuote ? 
            `"${truncatedQuote}"` : 
            `You expressed views on ${issue.issue.toLowerCase()} ${issue.mentions > 1 ? `${issue.mentions} times` : ''}`
        };
      })
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
        source: "refresh_since",
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
    console.log(`[RefreshSince] Updating analysis_state with last message ID: ${newestMessageId}`)
    
    const { error: stateError } = await supa
      .from("analysis_state")
      .upsert({
        user_id: userId,
        last_processed_message_id: newestMessageId,
        last_processed_at: new Date().toISOString(),
        last_refresh_result: {
          pillarsDelta: deltaData.pillarsDelta,
          topIssuesDelta: deltaData.topIssuesDelta,
          processed: messages.length,
          timestamp: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })

    if (stateError) {
      console.error("[RefreshSince] Failed to update analysis state:", stateError)
      // Don't fail the whole operation for this
    } else {
      console.log(`[RefreshSince] Successfully updated analysis_state`)
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
    console.error("Refresh views error:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    })
    
    // Return more specific error information
    const statusCode = error.status || error.statusCode || 500
    return NextResponse.json(
      { 
        error: error.message || "Failed to refresh views",
        code: error.code,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: statusCode }
    )
  }
}
