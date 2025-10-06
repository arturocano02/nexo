import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"
import { z } from "zod"
import { deriveCompass } from "@/src/lib/derive/compass"

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

// Rate limiting (in-memory for dev)
const rateLimit = new Map<string, { count: number; resetTime: number }>()
let lastGlobalRefresh = 0
const GLOBAL_COOLDOWN = 30000 // 30 seconds
const USER_COOLDOWN = 60000 // 60 seconds

// Response schema
const PartyRefreshResponseSchema = z.object({
  ok: z.boolean(),
  aggregates: z.object({
    member_count: z.number(),
    pillar_means: z.record(z.string(), z.number()),
    top_issues: z.array(z.object({
      title: z.string(),
      count: z.number(),
      mentions: z.number().optional(),
      quotes: z.array(z.string()).optional()
    })),
    compass_distribution: z.object({
      bins: z.object({
        x: z.array(z.number()),
        y: z.array(z.number()),
        counts: z.array(z.array(z.number()))
      })
    }),
    party_summary: z.string(),
    top_contributor: z.object({
      user_id: z.string(),
      display_name: z.string(),
      metric: z.number(),
      statement_count: z.number().optional(),
      topic_count: z.number().optional(),
      examples: z.array(z.string()).optional()
    })
  })
})

// Normalize issue title for grouping
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Collapse multiple spaces
}

// Create histogram bins for compass distribution
function createCompassBins(points: Array<{ x: number; y: number }>) {
  const bins = 10
  const xBins = Array.from({ length: bins }, (_, i) => -100 + (i * 200 / bins))
  const yBins = Array.from({ length: bins }, (_, i) => -100 + (i * 200 / bins))
  const counts = Array.from({ length: bins }, () => Array.from({ length: bins }, () => 0))

  points.forEach(point => {
    const xIndex = Math.min(Math.floor((point.x + 100) / (200 / bins)), bins - 1)
    const yIndex = Math.min(Math.floor((point.y + 100) / (200 / bins)), bins - 1)
    counts[yIndex][xIndex]++
  })

  return { x: xBins, y: yBins, counts }
}

// Generate party summary using OpenAI
async function generatePartySummary(
  pillarMeans: Record<string, number>,
  topIssues: Array<{ title: string; count: number; mentions: number; quotes?: string[] }>,
  memberCount: number
): Promise<string> {
  if (!openai) {
    return `Our ${memberCount} members are focused on key political issues including ${
      topIssues.slice(0, 3).map(i => i.title.toLowerCase()).join(', ')
    }.`
  }

  // Create more detailed issue text with mentions and quotes
  const issuesText = topIssues.slice(0, 5).map(issue => {
    const quoteText = issue.quotes && issue.quotes.length > 0 
      ? `Example: "${issue.quotes[0]}"` 
      : '';
    return `${issue.title} (${issue.mentions} mentions across ${issue.count} members). ${quoteText}`;
  }).join('\n');

  // Format pillar scores with descriptive labels
  const pillarDescriptions = {
    economy: (score: number) => score < 40 ? "left-leaning" : (score > 60 ? "right-leaning" : "centrist"),
    social: (score: number) => score < 40 ? "progressive" : (score > 60 ? "traditional" : "moderate"),
    environment: (score: number) => score < 40 ? "pro-environment" : (score > 60 ? "pro-development" : "balanced"),
    governance: (score: number) => score < 40 ? "decentralized" : (score > 60 ? "centralized" : "balanced"),
    foreign: (score: number) => score < 40 ? "internationalist" : (score > 60 ? "nationalist" : "pragmatic")
  };
  
  const pillarText = Object.entries(pillarMeans)
    .map(([pillar, score]) => {
      const description = pillarDescriptions[pillar as keyof typeof pillarDescriptions]?.(score) || "";
      return `${pillar}: ${Math.round(score)} (${description})`;
    })
    .join('\n');

  try {
    console.log(`[Party Refresh] Generating party summary with OpenAI for ${memberCount} members`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Use full GPT-4o for better quality
      messages: [
        {
          role: "system",
          content: `Generate a neutral, plain-English summary of a political group's focus areas and positions.
          
Guidelines:
- Write 4-6 sentences, under 600 characters
- Avoid jargon and proper nouns (like party names)
- Be objective and descriptive, not prescriptive
- Include specific issues mentioned by members
- Reference the overall political leaning based on pillar scores
- Mention the diversity of views if there are contradictions
- Use UK political context
- Start with "Our X members..." where X is the member count`
        },
        {
          role: "user",
          content: `Based on ${memberCount} members with these pillar scores:
${pillarText}

And these top issues:
${issuesText}

Write a brief party summary.`
        }
      ],
      temperature: 0.4,
      max_tokens: 300
    })

    const summary = response.choices[0]?.message?.content?.trim();
    console.log(`[Party Refresh] Generated summary: ${summary?.substring(0, 100)}...`);
    
    return summary || `Our ${memberCount} members are focused on key political issues including ${
      topIssues.slice(0, 3).map(i => i.title.toLowerCase()).join(', ')
    }.`;
  } catch (error) {
    console.error("Failed to generate party summary:", error);
    return `Our ${memberCount} members are focused on key political issues including ${
      topIssues.slice(0, 3).map(i => i.title.toLowerCase()).join(', ')
    }.`;
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

    // Check rate limits
    const now = Date.now()
    
    // Global cooldown
    if (now - lastGlobalRefresh < GLOBAL_COOLDOWN) {
      return NextResponse.json({ error: "Global cooldown active. Please wait 30 seconds." }, { status: 429 })
    }

    // User cooldown
    const userLimit = rateLimit.get(userId)
    if (userLimit && now < userLimit.resetTime) {
      return NextResponse.json({ error: "User cooldown active. Please wait 60 seconds." }, { status: 429 })
    }

    // Update rate limits
    lastGlobalRefresh = now
    rateLimit.set(userId, { count: 1, resetTime: now + USER_COOLDOWN })

    console.log(`[Party Refresh] Starting refresh for user ${userId}`)

    // Load all views snapshots
    const { data: snapshots, error: snapshotsErr } = await supa
      .from("views_snapshots")
      .select("user_id, pillars, top_issues")

    if (snapshotsErr) {
      throw snapshotsErr
    }

    if (!snapshots || snapshots.length === 0) {
      return NextResponse.json({ error: "No user data found" }, { status: 404 })
    }

    // Get all active users with profiles
    const { data: activeProfiles, error: profilesErr } = await supa
      .from("profiles")
      .select("id")
    
    if (profilesErr) {
      console.error("[Party Refresh] Error fetching profiles:", profilesErr)
      // Continue with snapshots as fallback
    }
    
    // Calculate member count by counting unique user IDs
    // First from snapshots, then cross-reference with active profiles if available
    const uniqueUserIds = new Set(snapshots.map(snapshot => snapshot.user_id))
    
    // Log the unique user IDs for debugging
    console.log(`[Party Refresh] Found ${uniqueUserIds.size} unique users in snapshots`)
    
    // Filter to only include users who have profiles
    let activeUserIds = uniqueUserIds
    if (activeProfiles && activeProfiles.length > 0) {
      const profileIds = new Set(activeProfiles.map(profile => profile.id))
      activeUserIds = new Set([...uniqueUserIds].filter(id => profileIds.has(id)))
      console.log(`[Party Refresh] After filtering for active profiles: ${activeUserIds.size} users`)
    }
    
    const memberCount = activeUserIds.size

    // Calculate pillar means - only use active users
    const pillarMeans: Record<string, number> = {
      economy: 0,
      social: 0,
      environment: 0,
      governance: 0,
      foreign: 0
    }

    // Filter snapshots to only include active users
    const activeSnapshots = snapshots.filter(snapshot => 
      [...activeUserIds].includes(snapshot.user_id)
    )
    
    console.log(`[Party Refresh] Using ${activeSnapshots.length} snapshots from active users for pillar means`)

    activeSnapshots.forEach(snapshot => {
      Object.entries(snapshot.pillars).forEach(([pillar, data]) => {
        if (pillarMeans.hasOwnProperty(pillar)) {
          pillarMeans[pillar] += (data as any).score || 0
        }
      })
    })

    Object.keys(pillarMeans).forEach(pillar => {
      pillarMeans[pillar] = memberCount > 0 ? pillarMeans[pillar] / memberCount : 50
    })

    // Calculate top issues with mentions count
    const issueCounts = new Map<string, { 
      count: number;       // Number of users who have this issue
      mentions: number;    // Total mentions across all users
      displayTitle: string;
      quotes: string[];    // Collection of user quotes about this issue
    }>()
    
    activeSnapshots.forEach(snapshot => {
      (snapshot.top_issues || []).forEach((issue: any) => {
        const normalized = normalizeTitle(issue.title)
        const existing = issueCounts.get(normalized)
        
        // Get mentions count from issue if available, default to 1
        const mentions = issue.mentions || 1
        
        // Get user quote if available
        const quote = issue.user_quote || issue.summary || null
        
        if (existing) {
          existing.count++
          existing.mentions += mentions
          if (quote && !existing.quotes.includes(quote)) {
            existing.quotes.push(quote)
          }
        } else {
          issueCounts.set(normalized, {
            count: 1,
            mentions: mentions,
            displayTitle: issue.title,
            quotes: quote ? [quote] : []
          })
        }
      })
    })

    const topIssues = Array.from(issueCounts.entries())
      .map(([_, data]) => ({ 
        title: data.displayTitle, 
        count: data.count,
        mentions: data.mentions,
        quotes: data.quotes.slice(0, 3) // Include up to 3 user quotes per issue
      }))
      .sort((a, b) => b.mentions - a.mentions) // Sort by mentions instead of count
      .slice(0, 10)

    // Calculate compass distribution
    const compassPoints = snapshots
      .map(snapshot => deriveCompass(snapshot.pillars))
      .filter(point => point.x !== undefined && point.y !== undefined)
      .slice(0, 500) // Cap at 500 points

    const compassDistribution = createCompassBins(compassPoints)

    // Calculate top contributor based on political statements (last 14 days)
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

    // Get user messages with content to analyze for political statements
    const { data: userMessages } = await supa
      .from("messages")
      .select("id, user_id, content, created_at")
      .eq("role", "user") // Only user messages, not assistant
      .gte("created_at", fourteenDaysAgo.toISOString())
    
    // Get message topics to identify political messages
    const { data: messageTopics } = await supa
      .from("message_topics")
      .select("message_id, topic, confidence")
      .gte("created_at", fourteenDaysAgo.toISOString())
    
    // Get view updates to track political profile changes
    const { data: viewUpdates } = await supa
      .from("view_updates")
      .select("id, user_id, source, delta")
      .gte("created_at", fourteenDaysAgo.toISOString())

    console.log(`[Party Refresh] Found ${userMessages?.length || 0} user messages, ${messageTopics?.length || 0} topics, ${viewUpdates?.length || 0} view updates in last 14 days`)
    
    // Create a map of message IDs to topics for quick lookup
    const messageTopicsMap = new Map()
    messageTopics?.forEach(topic => {
      messageTopicsMap.set(topic.message_id, {
        topic: topic.topic,
        confidence: topic.confidence
      })
    })
    
    // Political keywords to identify political statements
    const politicalKeywords = [
      "government", "policy", "economy", "tax", "climate", "environment", 
      "healthcare", "nhs", "education", "immigration", "brexit", "eu", 
      "election", "vote", "democracy", "parliament", "minister", "party",
      "labour", "conservative", "tory", "liberal", "democrat", "green",
      "reform", "ukip", "snp", "welfare", "benefit", "housing", "transport",
      "defense", "foreign", "military", "police", "crime", "justice", "court",
      "law", "regulation", "privatisation", "nationalisation", "public", "private",
      "spending", "budget", "debt", "deficit", "austerity", "inequality",
      "poverty", "wealth", "rich", "poor", "class", "worker", "union", "strike",
      "protest", "rights", "freedom", "liberty", "equality", "discrimination",
      "racism", "sexism", "gender", "lgbt", "abortion", "religion", "secular",
      "palestine", "israel", "gaza", "ukraine", "russia", "china", "eu", "europe",
      "nato", "un", "trade", "tariff", "subsidy", "regulation", "deregulation"
    ]
    
    // Count political statements per user
    const politicalStatements = new Map<string, {
      count: number,
      topics: Map<string, number>,
      viewUpdates: number,
      examples: string[]
    }>()
    
    // Process user messages
    userMessages?.forEach(msg => {
      // Skip messages without content
      if (!msg.content) return
      
      const userId = msg.user_id
      if (!userId) return
      
      // Check if we have a topic for this message
      const topicInfo = messageTopicsMap.get(msg.id)
      
      // Initialize user data if not exists
      if (!politicalStatements.has(userId)) {
        politicalStatements.set(userId, {
          count: 0,
          topics: new Map(),
          viewUpdates: 0,
          examples: []
        })
      }
      
      const userData = politicalStatements.get(userId)!
      
      // Check if message contains political keywords or has a political topic
      const isPolitical = 
        topicInfo || // Has a tagged topic
        politicalKeywords.some(keyword => msg.content.toLowerCase().includes(keyword))
      
      if (isPolitical) {
        // Increment political statement count
        userData.count += 1
        
        // Track topic
        if (topicInfo) {
          const topic = topicInfo.topic
          userData.topics.set(
            topic, 
            (userData.topics.get(topic) || 0) + 1
          )
        }
        
        // Store example (limited to 100 chars)
        if (userData.examples.length < 3) {
          const preview = msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '')
          userData.examples.push(preview)
        }
      }
    })
    
    // Process view updates
    viewUpdates?.forEach(update => {
      const userId = update.user_id
      if (!userId) return
      
      // Initialize user data if not exists
      if (!politicalStatements.has(userId)) {
        politicalStatements.set(userId, {
          count: 0,
          topics: new Map(),
          viewUpdates: 0,
          examples: []
        })
      }
      
      const userData = politicalStatements.get(userId)!
      
      // Increment view updates count
      userData.viewUpdates += 1
      
      // Calculate contribution score based on delta size
      try {
        const delta = update.delta
        if (delta && delta.pillarsDelta) {
          // Count non-zero pillar deltas
          const nonZeroDeltas = Object.values(delta.pillarsDelta).filter(v => v !== 0).length
          userData.count += nonZeroDeltas * 0.5 // Each pillar change counts as 0.5
        }
        
        if (delta && delta.topIssuesDelta && Array.isArray(delta.topIssuesDelta)) {
          // Count issue changes
          userData.count += delta.topIssuesDelta.length * 0.3 // Each issue change counts as 0.3
        }
      } catch (e) {
        // Ignore parsing errors
      }
    })
    
    // Find top contributor
    let topContributor: {
      user_id: string;
      display_name: string;
      metric: number;
      statement_count?: number;
      topic_count?: number;
      examples?: string[];
    } = { 
      user_id: "", 
      display_name: "No recent activity", 
      metric: 0
    }
    
    if (politicalStatements.size > 0) {
      // Calculate total score for each user
      const userScores = Array.from(politicalStatements.entries()).map(([userId, data]) => {
        const statementScore = data.count * 1.0 // Each political statement is worth 1.0
        const topicScore = data.topics.size * 0.5 // Each unique topic is worth 0.5
        const updateScore = data.viewUpdates * 0.2 // Each view update is worth 0.2
        
        const totalScore = statementScore + topicScore + updateScore
        
        return {
          userId,
          score: totalScore,
          statementCount: data.count,
          topicCount: data.topics.size,
          examples: data.examples
        }
      })
      
      // Sort by total score
      userScores.sort((a, b) => b.score - a.score)
      
      if (userScores.length > 0) {
        const topUser = userScores[0]
        
        // Get display name
        const { data: profile } = await supa
          .from("profiles")
          .select("display_name")
          .eq("id", topUser.userId)
          .single()
  
        const displayName = profile?.display_name || `Member ${topUser.userId.slice(-4)}`
        
        topContributor = {
          user_id: topUser.userId,
          display_name: displayName,
          metric: Math.round(topUser.score * 10) / 10, // Round to 1 decimal place
          statement_count: topUser.statementCount,
          topic_count: topUser.topicCount,
          examples: topUser.examples
        }
        
        console.log(`[Party Refresh] Top contributor: ${displayName} with score ${topContributor.metric} (${topUser.statementCount} statements)`)
      }
    }

    // Generate party summary
    const partySummary = await generatePartySummary(pillarMeans, topIssues, memberCount)

    // Create aggregates object with enhanced data
    const aggregates = {
      member_count: memberCount,
      pillar_means: pillarMeans,
      top_issues: topIssues,
      compass_distribution: compassDistribution,
      party_summary: partySummary,
      top_contributor: topContributor
    }

    console.log(`[Party Refresh] Aggregated data: ${memberCount} members, ${topIssues.length} issues, ${Object.keys(pillarMeans).length} pillars`)
    
    // Upsert aggregates
    const { error: upsertError } = await supa
      .from("aggregates")
      .upsert({
        id: true,
        ...aggregates,
        updated_at: new Date().toISOString()
      })

    if (upsertError) {
      console.error("[Party Refresh] Error upserting aggregates:", upsertError)
      throw upsertError
    }

    console.log(`[Party Refresh] Successfully updated aggregates for ${memberCount} members`)

    // Validate response with enhanced schema
    const response = {
      ok: true,
      aggregates
    }

    try {
      PartyRefreshResponseSchema.parse(response)
    } catch (validationError) {
      console.error("[Party Refresh] Schema validation error:", validationError)
      // Continue anyway, but log the error
    }

    return NextResponse.json(response)

  } catch (error: any) {
    console.error("Party refresh error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to refresh party data" },
      { status: 500 }
    )
  }
}
