import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    
    // Check if API key is configured
    const isConfigured = !!apiKey
    
    // Test the API key if it's configured
    let isValid = false
    let modelList: string[] = []
    let error: string | null = null
    
    if (isConfigured) {
      try {
        const openai = new OpenAI({ apiKey })
        const response = await openai.models.list()
        isValid = true
        modelList = response.data.map(model => model.id).slice(0, 10) // Get first 10 models
      } catch (err: any) {
        isValid = false
        error = err.message || "Failed to validate OpenAI API key"
      }
    }
    
    return NextResponse.json({
      isConfigured,
      isValid,
      models: isValid ? modelList : [],
      error: error || (isConfigured ? null : "OpenAI API key not configured"),
      keyLength: apiKey ? apiKey.length : 0,
      keyPrefix: apiKey ? apiKey.substring(0, 3) + "..." : null
    })

  } catch (error: any) {
    console.error("Debug check OpenAI error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to check OpenAI API key" },
      { status: 500 }
    )
  }
}
