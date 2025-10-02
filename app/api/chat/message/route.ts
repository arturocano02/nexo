import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"
import { z } from "zod"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

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
const ChatRequestSchema = z.object({
  message: z.string().min(1).max(1000),
  conversationId: z.string().optional()
})

// Rate limiting (in-memory for dev)
const rateLimit = new Map<string, { count: number; resetTime: number }>()

// Web search function
async function searchWeb(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  try {
    // Using DuckDuckGo Instant Answer API (free, no API key needed)
    const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`)
    const data = await response.json()
    
    const results = []
    
    // Add instant answer if available
    if (data.Abstract) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        snippet: data.Abstract
      })
    }
    
    // Add related topics
    if (data.RelatedTopics) {
      data.RelatedTopics.slice(0, 3).forEach((topic: any) => {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || topic.Text.substring(0, 50),
            url: topic.FirstURL,
            snippet: topic.Text
          })
        }
      })
    }
    
    return results.slice(0, 3) // Limit to 3 results
  } catch (error) {
    console.error('Web search error:', error)
    return []
  }
}

// Check rate limit
function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const userLimit = rateLimit.get(userId)
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimit.set(userId, { count: 1, resetTime: now + 2000 }) // 2 seconds between messages
    return true
  }
  
  if (userLimit.count >= 10) {
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
      return NextResponse.json({ error: "Rate limited. Please wait 2 seconds between messages." }, { status: 429 })
    }

    if (!openai) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 })
    }

    // Parse request body
    const body = await req.json()
    const { message, conversationId } = ChatRequestSchema.parse(body)

    console.log(`[Chat] Processing message from user ${userId}`)

    // Get or create conversation
    let conversation
    if (conversationId) {
      const { data: existingConv } = await supa
        .from("conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("user_id", userId)
        .single()
      
      if (existingConv) {
        conversation = existingConv
      }
    }

    if (!conversation) {
      const { data: newConv, error: convError } = await supa
        .from("conversations")
        .insert({
          user_id: userId,
          title: "Political Discussion"
        })
        .select("id")
        .single()

      if (convError) {
        throw convError
      }
      conversation = newConv
    }

    // Store user message
    const { error: userMsgError } = await supa
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        role: "user",
        content: message
      })

    if (userMsgError) {
      throw userMsgError
    }

    // Get recent conversation history (last 10 messages)
    const { data: recentMessages, error: messagesError } = await supa
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .limit(10)

    if (messagesError) {
      throw messagesError
    }

    // Get user's current political views for context
    const { data: userViews } = await supa
      .from("views_snapshots")
      .select("pillars, top_issues")
      .eq("user_id", userId)
      .single()

    // Check if user is asking about current events or specific topics that might need web search
    const needsWebSearch = /(latest|recent|current|today|this week|news|update|happening|what's|who is|when did|where is)/i.test(message)
    
    let webResults: { title: string; url: string; snippet: string }[] = []
    if (needsWebSearch) {
      console.log(`[Chat] Performing web search for: ${message}`)
      webResults = await searchWeb(message)
    }

    // Prepare context for OpenAI
    const systemPrompt = `You're a casual political chat buddy. Keep responses short, punchy, and conversational. Use "you" not "users". Be direct, avoid jargon, and stay neutral.

User's current political profile:
${userViews ? `
Pillars: ${JSON.stringify(userViews.pillars)}
Top Issues: ${JSON.stringify(userViews.top_issues)}
` : 'No political profile yet - user hasn\'t completed the survey.'}

${webResults.length > 0 ? `
Recent web search results for context:
${webResults.map((result, i) => `${i + 1}. ${result.title} - ${result.url}\n   ${result.snippet}`).join('\n')}
` : ''}

Guidelines:
- Keep responses under 100 words
- Be conversational and casual
- Focus on UK politics
- If you reference web search results, include the links
- Ask short follow-up questions
- Avoid formal language
- Stay neutral but engaging`

    // Prepare conversation history for OpenAI
    const conversationHistory = recentMessages?.map(msg => ({
      role: msg.role as "user" | "assistant",
      content: msg.content
    })) || []

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationHistory
      ],
      temperature: 0.7,
      max_tokens: 500
    })

    const aiResponse = response.choices[0]?.message?.content
    if (!aiResponse) {
      throw new Error("Failed to get response from OpenAI")
    }

    // Store AI response
    const { error: aiMsgError } = await supa
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        role: "assistant",
        content: aiResponse
      })

    if (aiMsgError) {
      throw aiMsgError
    }

    console.log(`[Chat] Generated response for user ${userId}`)

    return NextResponse.json({
      success: true,
      response: aiResponse,
      conversationId: conversation.id,
      webResults: webResults.length > 0 ? webResults : undefined
    })

  } catch (error: any) {
    console.error("Chat error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to process message" },
      { status: 500 }
    )
  }
}
