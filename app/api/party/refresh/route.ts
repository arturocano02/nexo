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
      count: z.number()
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
      metric: z.number()
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
  topIssues: Array<{ title: string; count: number }>,
  memberCount: number
): Promise<string> {
  if (!openai) {
    return `Our ${memberCount} members are focused on key political issues.`
  }

  const issuesText = topIssues.slice(0, 10).map(issue => `${issue.title} (${issue.count} mentions)`).join(', ')
  const pillarText = Object.entries(pillarMeans)
    .map(([pillar, score]) => `${pillar}: ${Math.round(score)}`)
    .join(', ')

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Generate a neutral, plain-English summary of a political group's focus areas. Keep it 3-5 sentences, under 400 characters, and avoid jargon or proper nouns. Be objective and descriptive."
        },
        {
          role: "user",
          content: `Based on ${memberCount} members with these pillar scores: ${pillarText}, and these top issues: ${issuesText}, write a brief party summary.`
        }
      ],
      temperature: 0.3,
      max_tokens: 200
    })

    return response.choices[0]?.message?.content?.trim() || `Our ${memberCount} members are focused on key political issues.`
  } catch (error) {
    console.error("Failed to generate party summary:", error)
    return `Our ${memberCount} members are focused on key political issues.`
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

    // Calculate member count by counting unique user IDs
    const uniqueUserIds = new Set(snapshots.map(snapshot => snapshot.user_id))
    const memberCount = uniqueUserIds.size

    // Calculate pillar means
    const pillarMeans: Record<string, number> = {
      economy: 0,
      social: 0,
      environment: 0,
      governance: 0,
      foreign: 0
    }

    snapshots.forEach(snapshot => {
      Object.entries(snapshot.pillars).forEach(([pillar, data]) => {
        if (pillarMeans.hasOwnProperty(pillar)) {
          pillarMeans[pillar] += (data as any).score || 0
        }
      })
    })

    Object.keys(pillarMeans).forEach(pillar => {
      pillarMeans[pillar] = pillarMeans[pillar] / memberCount
    })

    // Calculate top issues (normalize and count)
    const issueCounts = new Map<string, { count: number; displayTitle: string }>()
    
    snapshots.forEach(snapshot => {
      (snapshot.top_issues || []).forEach((issue: any) => {
        const normalized = normalizeTitle(issue.title)
        const existing = issueCounts.get(normalized)
        
        if (existing) {
          existing.count++
        } else {
          issueCounts.set(normalized, {
            count: 1,
            displayTitle: issue.title
          })
        }
      })
    })

    const topIssues = Array.from(issueCounts.entries())
      .map(([_, data]) => ({ title: data.displayTitle, count: data.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Calculate compass distribution
    const compassPoints = snapshots
      .map(snapshot => deriveCompass(snapshot.pillars))
      .filter(point => point.x !== undefined && point.y !== undefined)
      .slice(0, 500) // Cap at 500 points

    const compassDistribution = createCompassBins(compassPoints)

    // Calculate top contributor (last 14 days)
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

    const { data: messages } = await supa
      .from("messages")
      .select("user_id")
      .gte("created_at", fourteenDaysAgo.toISOString())

    const { data: viewUpdates } = await supa
      .from("view_updates")
      .select("user_id")
      .gte("created_at", fourteenDaysAgo.toISOString())

    // Count participation per user
    const participation = new Map<string, number>()
    
    messages?.forEach(msg => {
      const current = participation.get(msg.user_id) || 0
      participation.set(msg.user_id, current + 1)
    })

    viewUpdates?.forEach(update => {
      const current = participation.get(update.user_id) || 0
      participation.set(update.user_id, current + 0.5)
    })

    // Find top contributor
    let topContributor = { user_id: "", display_name: "No recent activity", metric: 0 }
    
    if (participation.size > 0) {
      const sortedParticipation = Array.from(participation.entries())
        .sort((a, b) => b[1] - a[1])
      
      const [topUserId, topMetric] = sortedParticipation[0]
      
      // Get display name
      const { data: profile } = await supa
        .from("profiles")
        .select("display_name")
        .eq("id", topUserId)
        .single()

      const displayName = profile?.display_name || `Member ${topUserId.slice(-4)}`
      
      topContributor = {
        user_id: topUserId,
        display_name: displayName,
        metric: topMetric
      }
    }

    // Generate party summary
    const partySummary = await generatePartySummary(pillarMeans, topIssues, memberCount)

    // Create aggregates object
    const aggregates = {
      member_count: memberCount,
      pillar_means: pillarMeans,
      top_issues: topIssues,
      compass_distribution: compassDistribution,
      party_summary: partySummary,
      top_contributor: topContributor
    }

    // Upsert aggregates
    const { error: upsertError } = await supa
      .from("aggregates")
      .upsert({
        id: true,
        ...aggregates,
        updated_at: new Date().toISOString()
      })

    if (upsertError) {
      throw upsertError
    }

    console.log(`[Party Refresh] Successfully updated aggregates for ${memberCount} members`)

    // Validate response
    const response = {
      ok: true,
      aggregates
    }

    PartyRefreshResponseSchema.parse(response)

    return NextResponse.json(response)

  } catch (error: any) {
    console.error("Party refresh error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to refresh party data" },
      { status: 500 }
    )
  }
}
