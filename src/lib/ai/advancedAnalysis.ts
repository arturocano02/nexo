import OpenAI from "openai"

// Initialize OpenAI (only when API key is available)
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

export type PoliticalSentiment = {
  overall: 'very_liberal' | 'liberal' | 'moderate' | 'conservative' | 'very_conservative'
  confidence: number
  reasoning: string
}

export type IssueAnalysis = {
  title: string
  importance: number
  sentiment: 'positive' | 'negative' | 'neutral'
  keywords: string[]
  summary: string
}

export type AdvancedPoliticalProfile = {
  pillars: Record<string, { score: number; rationale: string; confidence: number }>
  top_issues: IssueAnalysis[]
  sentiment: PoliticalSentiment
  political_affinity: {
    closest_party: string
    confidence: number
    reasoning: string
  }
  key_values: string[]
  policy_priorities: string[]
}

const ADVANCED_ANALYZER_PROMPT = `You are an expert political analyst specializing in UK politics. Analyze the provided data to create a comprehensive political profile.

Your analysis should include:

1. **Pillars Analysis**: Score each pillar (economy, social, environment, governance, foreign) from 0-100 with confidence levels and detailed rationales
2. **Issue Analysis**: Identify key political issues with importance scores, sentiment, and keywords
3. **Political Sentiment**: Determine overall political leaning with confidence
4. **Party Affinity**: Identify which UK political party they align with most closely
5. **Key Values**: Extract core political values and principles
6. **Policy Priorities**: Rank their top policy concerns

Return your response as a JSON object with this structure:
{
  "pillars": {
    "economy": { "score": 75, "rationale": "Detailed explanation", "confidence": 0.85 },
    "social": { "score": 60, "rationale": "Detailed explanation", "confidence": 0.90 },
    "environment": { "score": 85, "rationale": "Detailed explanation", "confidence": 0.80 },
    "governance": { "score": 70, "rationale": "Detailed explanation", "confidence": 0.75 },
    "foreign": { "score": 55, "rationale": "Detailed explanation", "confidence": 0.70 }
  },
  "top_issues": [
    {
      "title": "Climate Action",
      "importance": 0.95,
      "sentiment": "positive",
      "keywords": ["climate", "environment", "green", "sustainability"],
      "summary": "Strong support for environmental protection"
    }
  ],
  "sentiment": {
    "overall": "liberal",
    "confidence": 0.80,
    "reasoning": "Analysis of their expressed views shows..."
  },
  "political_affinity": {
    "closest_party": "Labour",
    "confidence": 0.75,
    "reasoning": "Their views align most closely with Labour's platform on..."
  },
  "key_values": ["equality", "environmental protection", "social justice"],
  "policy_priorities": ["Climate action", "Healthcare reform", "Economic equality"]
}

Guidelines:
- Be precise and evidence-based
- Use UK political context and terminology
- Confidence scores should be 0.0 to 1.0
- Issue importance should be 0.0 to 1.0
- Sentiment should be one of: positive, negative, neutral
- Political sentiment should be one of: very_liberal, liberal, moderate, conservative, very_conservative
- Be objective and analytical, not judgmental`

export async function analyzeAdvancedPoliticalProfile(
  surveyAnswers: Record<string, { choice?: string; text?: string }>,
  conversationHistory?: string
): Promise<AdvancedPoliticalProfile> {
  if (!openai) {
    console.warn("OpenAI API key not configured, using mock advanced analysis")
    return getMockAdvancedProfile()
  }

  try {
    // Format the input data for analysis
    const surveyText = Object.entries(surveyAnswers)
      .map(([questionId, response]) => {
        const choice = response.choice || "No choice made"
        const text = response.text || ""
        return `Question ${questionId}: ${choice}${text ? ` (Additional: ${text})` : ""}`
      })
      .join('\n')

    const analysisInput = conversationHistory 
      ? `Survey Responses:\n${surveyText}\n\nConversation History:\n${conversationHistory}`
      : `Survey Responses:\n${surveyText}`

    console.log("Performing advanced political analysis with AI")

    // Call OpenAI for advanced analysis
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: ADVANCED_ANALYZER_PROMPT },
        { role: "user", content: `Analyze this political data:\n\n${analysisInput}` }
      ],
      temperature: 0.2,
      max_tokens: 2000
    })

    const analysisText = response.choices[0]?.message?.content
    if (!analysisText) {
      throw new Error("Failed to get advanced analysis from OpenAI")
    }

    let analysisData
    try {
      analysisData = JSON.parse(analysisText)
    } catch (parseError) {
      console.error("Failed to parse advanced AI analysis:", parseError)
      throw new Error("Invalid JSON from advanced AI analysis")
    }

    // Validate the response structure
    if (!analysisData.pillars || !analysisData.top_issues || !analysisData.sentiment) {
      throw new Error("Invalid advanced analysis structure from AI")
    }

    // Ensure all required pillars are present with proper structure
    const requiredPillars = ['economy', 'social', 'environment', 'governance', 'foreign']
    for (const pillar of requiredPillars) {
      if (!analysisData.pillars[pillar] || typeof analysisData.pillars[pillar].score !== 'number') {
        analysisData.pillars[pillar] = { 
          score: 50, 
          rationale: "Analysis incomplete for this pillar",
          confidence: 0.0
        }
      }
    }

    console.log("Advanced AI analysis completed:", analysisData)
    return analysisData

  } catch (error) {
    console.error("Advanced AI analysis failed:", error)
    return getMockAdvancedProfile()
  }
}

function getMockAdvancedProfile(): AdvancedPoliticalProfile {
  return {
    pillars: {
      economy: { score: 50, rationale: "Analysis unavailable - using default positioning", confidence: 0.0 },
      social: { score: 50, rationale: "Analysis unavailable - using default positioning", confidence: 0.0 },
      environment: { score: 50, rationale: "Analysis unavailable - using default positioning", confidence: 0.0 },
      governance: { score: 50, rationale: "Analysis unavailable - using default positioning", confidence: 0.0 },
      foreign: { score: 50, rationale: "Analysis unavailable - using default positioning", confidence: 0.0 }
    },
    top_issues: [
      { 
        title: "Political Analysis", 
        importance: 0.5, 
        sentiment: "neutral", 
        keywords: ["analysis"], 
        summary: "AI analysis temporarily unavailable" 
      }
    ],
    sentiment: {
      overall: "moderate",
      confidence: 0.0,
      reasoning: "Analysis unavailable"
    },
    political_affinity: {
      closest_party: "Unknown",
      confidence: 0.0,
      reasoning: "Analysis unavailable"
    },
    key_values: ["Analysis unavailable"],
    policy_priorities: ["Analysis unavailable"]
  }
}

export async function analyzeConversationSentiment(conversationText: string): Promise<PoliticalSentiment> {
  if (!openai) {
    return {
      overall: "moderate",
      confidence: 0.0,
      reasoning: "AI analysis unavailable"
    }
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Analyze the political sentiment of this conversation. Determine if the person is very_liberal, liberal, moderate, conservative, or very_conservative. Provide a confidence score (0-1) and reasoning. Return JSON: {\"overall\": \"moderate\", \"confidence\": 0.8, \"reasoning\": \"explanation\"}"
        },
        {
          role: "user",
          content: conversationText
        }
      ],
      temperature: 0.1,
      max_tokens: 300
    })

    const analysisText = response.choices[0]?.message?.content
    if (!analysisText) {
      throw new Error("Failed to get sentiment analysis")
    }

    return JSON.parse(analysisText)
  } catch (error) {
    console.error("Sentiment analysis failed:", error)
    return {
      overall: "moderate",
      confidence: 0.0,
      reasoning: "Analysis failed"
    }
  }
}

