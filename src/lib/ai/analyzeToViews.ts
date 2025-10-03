import OpenAI from "openai"
import { analyzeAdvancedPoliticalProfile, AdvancedPoliticalProfile } from "./advancedAnalysis"

export type ViewsSnapshot = {
  pillars: Record<string, { score: number; rationale: string }>
  top_issues: { title: string; summary: string }[]
  advanced?: AdvancedPoliticalProfile
}

// Initialize OpenAI (only when API key is available)
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

const SURVEY_ANALYZER_PROMPT = `You are a political analysis expert specializing in UK politics. Analyze survey responses to determine political positioning across five key pillars: economy, social, environment, governance, and foreign policy.

For each pillar, provide:
1. A score from 0-100 (0 = very left/liberal, 100 = very right/conservative)
2. A clear rationale explaining the positioning

Also identify 3-5 top political issues based on the responses.

Return your response as a JSON object with this structure:
{
  "pillars": {
    "economy": { "score": 75, "rationale": "Clear explanation of economic positioning" },
    "social": { "score": 60, "rationale": "Clear explanation of social positioning" },
    "environment": { "score": 85, "rationale": "Clear explanation of environmental positioning" },
    "governance": { "score": 70, "rationale": "Clear explanation of governance positioning" },
    "foreign": { "score": 55, "rationale": "Clear explanation of foreign policy positioning" }
  },
  "top_issues": [
    { "title": "Issue Title", "summary": "Brief explanation of why this is important" }
  ]
}

Guidelines:
- Scores should reflect UK political spectrum positioning
- Rationales should be specific and based on the actual responses
- Issue titles should be clear and politically relevant
- Issue summaries should be concise (max 100 characters)
- Be objective and analytical, not judgmental`

export async function analyzeToViews({ 
  answers, 
  conversationHistory 
}: { 
  answers: Record<string, { choice?: string; text?: string }>
  conversationHistory?: string
}): Promise<ViewsSnapshot> {
  // Use advanced analysis if available
  try {
    const advancedProfile = await analyzeAdvancedPoliticalProfile(answers, conversationHistory)
    
    // Convert advanced profile to basic format
    const pillars = Object.fromEntries(
      Object.entries(advancedProfile.pillars).map(([key, value]) => [
        key, 
        { score: value.score, rationale: value.rationale }
      ])
    )
    
    const top_issues = advancedProfile.top_issues.map(issue => ({
      title: issue.title,
      summary: issue.summary
    }))

    return { 
      pillars, 
      top_issues, 
      advanced: advancedProfile 
    }
  } catch (error) {
    console.error("Advanced analysis failed, falling back to basic analysis:", error)
  }

  // Fallback to basic analysis
  if (!openai) {
    console.warn("OpenAI API key not configured, using mock analysis")
    const pillars = {
      economy: { score: 75, rationale: "Strong focus on economic growth and job creation" },
      social: { score: 60, rationale: "Moderate support for social programs and equality" },
      environment: { score: 85, rationale: "High priority on environmental protection and climate action" },
      governance: { score: 70, rationale: "Support for democratic participation and transparency" },
      foreign: { score: 55, rationale: "Balanced approach to international relations" }
    }
    
    const top_issues = [
      { title: "Climate Action", summary: "Urgent need to address environmental challenges" },
      { title: "Economic Recovery", summary: "Focus on job creation and economic stability" },
      { title: "Healthcare Access", summary: "Ensuring affordable healthcare for all citizens" },
      { title: "Education Reform", summary: "Improving educational opportunities and funding" },
      { title: "Social Justice", summary: "Addressing inequality and systemic issues" }
    ]

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    return { pillars, top_issues }
  }

  try {
    // Format the survey responses for analysis
    const responseText = Object.entries(answers)
      .map(([questionId, response]) => {
        const choice = response.choice || "No choice made"
        const text = response.text || ""
        return `Question ${questionId}: ${choice}${text ? ` (Additional: ${text})` : ""}`
      })
      .join('\n')

    console.log("Analyzing survey responses with AI:", responseText)

    // Call OpenAI for analysis
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SURVEY_ANALYZER_PROMPT },
        { role: "user", content: `Analyze these survey responses:\n\n${responseText}` }
      ],
      temperature: 0.3,
      max_tokens: 1500
    })

    const analysisText = response.choices[0]?.message?.content
    if (!analysisText) {
      throw new Error("Failed to get analysis from OpenAI")
    }

    let analysisData
    try {
      analysisData = JSON.parse(analysisText)
    } catch (parseError) {
      console.error("Failed to parse AI analysis:", parseError)
      throw new Error("Invalid JSON from AI analysis")
    }

    // Validate the response structure
    if (!analysisData.pillars || !analysisData.top_issues) {
      throw new Error("Invalid analysis structure from AI")
    }

    // Ensure all required pillars are present
    const requiredPillars = ['economy', 'social', 'environment', 'governance', 'foreign']
    for (const pillar of requiredPillars) {
      if (!analysisData.pillars[pillar] || typeof analysisData.pillars[pillar].score !== 'number') {
        analysisData.pillars[pillar] = { score: 50, rationale: "Analysis incomplete for this pillar" }
      }
    }

    console.log("AI analysis completed:", analysisData)
    return analysisData

  } catch (error) {
    console.error("AI analysis failed:", error)
    
    // Fallback to mock data if AI fails
    const pillars = {
      economy: { score: 50, rationale: "Analysis unavailable - using default positioning" },
      social: { score: 50, rationale: "Analysis unavailable - using default positioning" },
      environment: { score: 50, rationale: "Analysis unavailable - using default positioning" },
      governance: { score: 50, rationale: "Analysis unavailable - using default positioning" },
      foreign: { score: 50, rationale: "Analysis unavailable - using default positioning" }
    }
    
    const top_issues = [
      { title: "Political Analysis", summary: "AI analysis temporarily unavailable" }
    ]

    return { pillars, top_issues }
  }
}
