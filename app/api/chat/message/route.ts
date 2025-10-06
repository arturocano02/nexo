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

// Topic inference keywords for fallback
const TOPIC_KEYWORDS = {
  'immigration': ['immigration', 'migrants', 'asylum', 'refugees', 'borders', 'visa', 'migration', 'illegal immigration'],
  'housing': ['housing', 'homes', 'homeless', 'rent', 'mortgage', 'property', 'affordable housing', 'homelessness', 'rental', 'buying homes'],
  'nhs': ['nhs', 'health', 'healthcare', 'hospitals', 'doctors', 'nurses', 'medical', 'health service', 'waiting lists'],
  'economy': ['economy', 'economic', 'recession', 'inflation', 'growth', 'gdp', 'budget', 'cost of living', 'jobs', 'unemployment'],
  'education': ['education', 'schools', 'universities', 'students', 'teachers', 'tuition', 'school funding', 'exams'],
  'environment': ['environment', 'climate', 'green', 'carbon', 'renewable', 'pollution', 'climate change', 'net zero', 'emissions'],
  'taxation': ['tax', 'taxes', 'taxation', 'income tax', 'corporation tax', 'vat', 'tax cuts', 'tax rises'],
  'crime': ['crime', 'police', 'justice', 'prisons', 'criminal', 'safety', 'policing', 'sentencing', 'law and order'],
  'foreign_policy': ['foreign policy', 'international', 'diplomacy', 'trade deals', 'alliances', 'gaza', 'ukraine', 'russia', 'china'],
  'brexit': ['brexit', 'eu', 'europe', 'single market', 'customs union', 'european union', 'leaving eu'],
  'welfare': ['welfare', 'benefits', 'universal credit', 'social security', 'poverty', 'benefits system', 'social care'],
  'defense': ['defense', 'military', 'armed forces', 'nato', 'security', 'defence', 'army', 'navy', 'air force'],
  'transport': ['transport', 'trains', 'buses', 'roads', 'rail', 'public transport', 'infrastructure', 'hs2'],
  'energy': ['energy', 'electricity', 'gas', 'power', 'energy bills', 'renewable energy', 'nuclear'],
  'politics': ['politics', 'government', 'parliament', 'mp', 'minister', 'election', 'voting', 'democracy']
}

// Parse topic tag from AI response
function parseTopicTag(content: string): { topic: string; confidence: number; cleanContent: string } {
  const tagRegex = /\[\[topic:\s*([^;\]]+)(?:;\s*confidence:\s*([0-9.]+))?\]\]$/i
  const match = content.match(tagRegex)
  
  if (match) {
    const topic = match[1].trim().toLowerCase()
    const confidence = match[2] ? parseFloat(match[2]) : 0.8
    const cleanContent = content.replace(tagRegex, '').trim()
    return { topic, confidence, cleanContent }
  }
  
  return { topic: '', confidence: 0, cleanContent: content }
}

// Infer topic from user message using keyword matching
function inferTopicFromMessage(message: string): { topic: string; confidence: number } {
  const lowerMessage = message.toLowerCase()
  
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        return { topic, confidence: 0.7 }
      }
    }
  }
  
  return { topic: 'general', confidence: 0.3 }
}

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

Topic handling - EXTREMELY IMPORTANT

CRITICAL: You MUST ALWAYS respond to the EXACT topic in the user's MOST RECENT message. 
NEVER continue discussing a previous topic if the user has moved on to a new topic.

IMPORTANT: If the user's latest message mentions Palestine, genocide, Israel, or any similar topic - you MUST respond to THAT topic, not refugees or immigration.

If the user says 'I don't care about X' or 'I'm not talking about X' - you MUST IMMEDIATELY stop discussing X.

If the user says 'let's talk about [topic]' or 'what do you think about [topic]' - IMMEDIATELY engage with that topic.

If the user expresses ANY frustration with your responses - IMMEDIATELY apologize and focus 100% on their current topic.

Treat the survey as background only. Do not bring it up unless clearly relevant to the exact point.

If they ask for a list or facts, answer directly on that topic.

Answer then challenge

If the user asks for facts, lists, definitions, or "who/what/when/where", give the answer directly and cite sources with links.

After answering, briefly stress-test the claim or raise a trade-off, using UK examples when possible.

If evidence conflicts, say so and show both sides in one line.

NEVER ignore the user's topic. If they change topics, follow them immediately. If they express frustration about you not listening, acknowledge it and engage with their current topic.

Be conversational and engaging - ask follow-up questions that advance the debate on their chosen topic.

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

IMPORTANT: At the very end of your response, append a hidden metadata tag for backend tracking:
[[topic: <topic_slug>; confidence: <0-1>]]

This tag is for backend analytics only and will be stripped from the user-facing content. Do not include any visible bracketed tags in your response.

Topic examples: immigration, housing, nhs, economy, education, environment, taxation, crime, foreign_policy, brexit, welfare, defense, etc.

EXAMPLE: If user says "i don't care about trade, let's discuss homeless people" - IMMEDIATELY switch to homelessness and end with [[topic: housing; confidence: 0.9]]. If they say "are you even listening?" - apologize and engage with their current topic.`

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

    // Parse topic tag from AI response
    const { topic: aiTopic, confidence: aiConfidence, cleanContent } = parseTopicTag(aiResponse)
    
    // Use AI topic if available, otherwise infer from user message
    let finalTopic = aiTopic
    let finalConfidence = aiConfidence
    
    if (!finalTopic) {
      const inferred = inferTopicFromMessage(message)
      finalTopic = inferred.topic
      finalConfidence = inferred.confidence
    }
    
    console.log(`[Chat] Topic inference - AI: ${aiTopic} (${aiConfidence}), Final: ${finalTopic} (${finalConfidence})`)

    // Store AI response (with cleaned content)
    const { data: aiMessage, error: aiMsgError } = await supa
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        role: "assistant",
        content: cleanContent
      })
      .select("id")
      .single()

    if (aiMsgError) {
      throw aiMsgError
    }

    // Store topic metadata
    if (finalTopic && aiMessage?.id) {
      const { error: topicError } = await supa
        .from("message_topics")
        .insert({
          message_id: aiMessage.id,
          user_id: userId,
          topic: finalTopic,
          confidence: finalConfidence
        })
      
      if (topicError) {
        console.error("Failed to store topic metadata:", topicError)
        // Don't throw - topic storage is not critical
      }
    }

    console.log(`[Chat] Generated response for user ${userId}`)

    return NextResponse.json({
      success: true,
      response: cleanContent,
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
