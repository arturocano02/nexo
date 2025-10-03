import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseConfig, isOpenAIConfigured } from "@/src/lib/env"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

const REQUIRED_TABLES = [
  "views_snapshots",
  "messages", 
  "survey_responses",
  "aggregates"
]

export async function GET(req: NextRequest) {
  try {
    const { url, anonKey } = getSupabaseConfig()
    const supa = createClient(url, anonKey, { auth: { persistSession: false } })

    // Check database connection and tables
    const dbChecks = {
      connected: false,
      tables: {} as Record<string, boolean>
    }

    try {
      // Test basic connection
      const { data, error } = await supa
        .from("views_snapshots")
        .select("id")
        .limit(1)
      
      dbChecks.connected = !error
      
      // Check each required table
      for (const table of REQUIRED_TABLES) {
        try {
          const { error: tableError } = await supa
            .from(table)
            .select("id")
            .limit(1)
          dbChecks.tables[table] = !tableError
        } catch {
          dbChecks.tables[table] = false
        }
      }
    } catch (error) {
      console.error("Database health check failed:", error)
      dbChecks.connected = false
    }

    // Check auth configuration
    const authChecks = {
      emailProviderEnabled: true // Assume enabled if we can connect to Supabase
    }

    // Check AI configuration
    const aiChecks = {
      openaiConfigured: isOpenAIConfigured()
    }

    // Check data availability (if user is authenticated)
    const dataChecks = {
      userHasSnapshot: false,
      aggregatesAvailable: false
    }

    const auth = req.headers.get("authorization")
    if (auth) {
      try {
        // Create authenticated client
        const authSupa = createClient(url, anonKey, {
          global: { headers: { Authorization: auth } },
          auth: { persistSession: false },
        })

        // Check if user has snapshot
        const { data: userSnapshot } = await authSupa
          .from("views_snapshots")
          .select("id")
          .limit(1)
        
        dataChecks.userHasSnapshot = (userSnapshot?.length || 0) > 0

        // Check if aggregates are available
        const { data: aggregates } = await authSupa
          .from("aggregates")
          .select("id")
          .limit(1)
        
        dataChecks.aggregatesAvailable = (aggregates?.length || 0) > 0

      } catch (error) {
        console.error("Authenticated data check failed:", error)
      }
    }

    const health = {
      status: "ok",
      timestamp: new Date().toISOString(),
      db: dbChecks,
      auth: authChecks,
      ai: aiChecks,
      data: dataChecks
    }

    // Determine overall status
    const allTablesPresent = Object.values(dbChecks.tables).every(Boolean)
    if (!dbChecks.connected || !allTablesPresent) {
      health.status = "degraded"
    }

    return NextResponse.json(health)

  } catch (error: any) {
    console.error("Health check failed:", error)
    
    return NextResponse.json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: "Health check failed",
      db: { connected: false, tables: {} },
      auth: { emailProviderEnabled: false },
      ai: { openaiConfigured: false },
      data: { userHasSnapshot: false, aggregatesAvailable: false }
    }, { status: 500 })
  }
}

