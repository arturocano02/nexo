import OpenAI from "openai"
import { getOpenAIKey } from "@/src/lib/env"

const MAX_TOKENS_PER_CHUNK = 2000
const MAX_CHUNKS = 10
const MAX_MESSAGES = 200

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

export interface ConversationSummary {
  summary: string
  key_points: string[]
  message_count: number
  time_span_days: number
}

const SUMMARIZATION_PROMPT = `You are a political conversation summarizer. Analyze this conversation and create a concise, neutral summary focusing on political views, policy positions, and key issues discussed.

Guidelines:
- Keep summary under 500 words
- Focus on political content, ignore small talk
- Maintain neutral, objective tone
- Extract 3-5 key political points
- No personal information or identifying details
- Use present tense, third person

Return JSON:
{
  "summary": "Concise political conversation summary...",
  "key_points": [
    "Key political point 1",
    "Key political point 2",
    "Key political point 3"
  ]
}`

export async function summarizeConversation(messages: Message[]): Promise<ConversationSummary> {
  const openaiKey = getOpenAIKey()
  if (!openaiKey) {
    throw new Error('OpenAI API key not configured')
  }

  const openai = new OpenAI({ apiKey: openaiKey })

  // Limit messages to last 200
  const recentMessages = messages.slice(-MAX_MESSAGES)
  
  if (recentMessages.length === 0) {
    return {
      summary: "No conversation history available",
      key_points: [],
      message_count: 0,
      time_span_days: 0
    }
  }

  // Calculate time span
  const firstMessage = new Date(recentMessages[0].created_at)
  const lastMessage = new Date(recentMessages[recentMessages.length - 1].created_at)
  const timeSpanDays = Math.ceil((lastMessage.getTime() - firstMessage.getTime()) / (1000 * 60 * 60 * 24))

  // Chunk messages if too long
  const chunks = chunkMessages(recentMessages)
  
  try {
    if (chunks.length === 1) {
      // Single chunk - direct summarization
      const conversationText = chunks[0].map(msg => `${msg.role}: ${msg.content}`).join('\n\n')
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SUMMARIZATION_PROMPT },
          { role: "user", content: conversationText }
        ],
        temperature: 0.2,
        max_tokens: 800
      })

      const result = JSON.parse(response.choices[0]?.message?.content || '{}')
      
      return {
        summary: result.summary || "Unable to summarize conversation",
        key_points: result.key_points || [],
        message_count: recentMessages.length,
        time_span_days: timeSpanDays
      }
    } else {
      // Multiple chunks - hierarchical summarization
      const chunkSummaries = []
      
      for (const chunk of chunks) {
        const chunkText = chunk.map(msg => `${msg.role}: ${msg.content}`).join('\n\n')
        
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SUMMARIZATION_PROMPT },
            { role: "user", content: chunkText }
          ],
          temperature: 0.2,
          max_tokens: 400
        })

        const result = JSON.parse(response.choices[0]?.message?.content || '{}')
        chunkSummaries.push({
          summary: result.summary || "Chunk summary unavailable",
          key_points: result.key_points || []
        })
      }

      // Summarize the summaries
      const summaryText = chunkSummaries.map((chunk, i) => `Chunk ${i + 1}:\n${chunk.summary}`).join('\n\n')
      
      const finalResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Create a final summary from these chunk summaries. Focus on the most important political points. Return JSON with 'summary' and 'key_points' fields." },
          { role: "user", content: summaryText }
        ],
        temperature: 0.2,
        max_tokens: 600
      })

      const finalResult = JSON.parse(finalResponse.choices[0]?.message?.content || '{}')
      
      // Combine key points from all chunks
      const allKeyPoints = chunkSummaries.flatMap(chunk => chunk.key_points)
      const uniqueKeyPoints = [...new Set(allKeyPoints)].slice(0, 5)

      return {
        summary: finalResult.summary || "Unable to summarize conversation",
        key_points: uniqueKeyPoints,
        message_count: recentMessages.length,
        time_span_days: timeSpanDays
      }
    }
  } catch (error) {
    console.error('Conversation summarization failed:', error)
    return {
      summary: "Error summarizing conversation",
      key_points: [],
      message_count: recentMessages.length,
      time_span_days: timeSpanDays
    }
  }
}

function chunkMessages(messages: Message[]): Message[][] {
  const chunks: Message[][] = []
  let currentChunk: Message[] = []
  let currentTokens = 0

  for (const message of messages) {
    const messageTokens = estimateTokens(message.content)
    
    if (currentTokens + messageTokens > MAX_TOKENS_PER_CHUNK && currentChunk.length > 0) {
      chunks.push(currentChunk)
      currentChunk = [message]
      currentTokens = messageTokens
    } else {
      currentChunk.push(message)
      currentTokens += messageTokens
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk)
  }

  // Limit to max chunks
  return chunks.slice(0, MAX_CHUNKS)
}

function estimateTokens(text: string): number {
  // Rough estimation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4)
}

