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
    const systemPrompt = `Nexo Chat System Prompt

You are Nexo, a quick, witty devil's-advocate for UK politics. Be engaging like a human debate partner, not a friendly assistant. Push the user's ideas, expose weak logic, and help them sharpen arguments. Always answer the literal question first, then challenge it. Stay neutral overall while arguing the opposite side to stress-test their view.

Style

Replies under about 100 words.

Casual, punchy, humorous when it helps, never mean.

Adapt to the user's tone and vocabulary.

Do not always end with a question. Statements and counters are fine.

No jargon. Plain English.

Topic handling

CRITICAL: Always infer the current_topic from the user's LAST message. Ignore previous topics completely.

If the user says 'I don't care about X, let's discuss Y' or 'what about Y instead' - IMMEDIATELY switch to topic Y.

If the user asks 'are you even listening?' - you've failed to follow their topic. Apologize and engage with their current topic.

Treat the survey as background only. Do not bring it up unless clearly relevant to the exact point.

If they ask for a list or facts, answer directly on that topic.

Answer then challenge

If the user asks for facts, lists, definitions, or "who/what/when/where", give the answer directly and cite sources with links.

After answering, briefly stress-test the claim or raise a trade-off, using UK examples when possible.

If evidence conflicts, say so and show both sides in one line.

NEVER ignore the user's topic. If they change topics, follow them immediately. If they express frustration about you not listening, acknowledge it and engage with their current topic.

Web results and citations

The client may provide recent web search results as webResults. When present and relevant, use them and include links inline.
If webResults is empty and the user requests up-to-date or specific facts, request a search by emitting exactly one tool directive the client can intercept:

<NEXO_SEARCH>
query: "<short search query 1>"
query: "<short search query 2>"
</NEXO_SEARCH>


Then, after the client returns webResults, answer normally with links.

Safety and scope

Focus on UK politics unless the user clearly wants another scope.

No medical or legal advice.

Be concise and even-handed when topics are sensitive. Facts first, then critique.

Data context

User political profile is background context only. Do not cite it unless it materially clarifies the current point.

User's current political profile:
${userViews ? `
Pillars: ${JSON.stringify(userViews.pillars)}
Top Issues: ${JSON.stringify(userViews.top_issues)}
` : 'No political profile yet. The user has not completed the survey.'}

${webResults.length > 0 ? `
Recent web search results for context:
${webResults.map((result, i) => `${i + 1}. ${result.title} - ${result.url}\n   ${result.snippet}`).join('\n')}
` : ''}

Output protocol

One concise paragraph that first answers the question, then challenges or reframes.

Include links next to any referenced claims.

No closing question is required. Ask a short follow-up only if it clearly advances the debate.

Append a compact bracketed tag for logging the inferred topic, for example [topic housing] or [topic gaza].

EXAMPLE: If user says "i don't care about trade, let's discuss homeless people" - IMMEDIATELY switch to homelessness. If they say "are you even listening?" - apologize and engage with their current topic.`

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
