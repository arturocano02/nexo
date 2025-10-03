import OpenAI from "openai"
import { z } from "zod"
import { getOpenAIKey } from "@/src/lib/env"

export interface SurveyResponse {
  question_id: string
  choice: string
  text?: string
}

export interface SurveyAnalysis {
  pillars: {
    economy: { score: number; rationale: string }
    social: { score: number; rationale: string }
    environment: { score: number; rationale: string }
    governance: { score: number; rationale: string }
    foreign: { score: number; rationale: string }
  }
  issues: Array<{ title: string; summary: string }>
}

const SurveyAnalysisSchema = z.object({
  pillars: z.object({
    economy: z.object({
      score: z.number().min(0).max(100),
      rationale: z.string().min(10).max(200)
    }),
    social: z.object({
      score: z.number().min(0).max(100),
      rationale: z.string().min(10).max(200)
    }),
    environment: z.object({
      score: z.number().min(0).max(100),
      rationale: z.string().min(10).max(200)
    }),
    governance: z.object({
      score: z.number().min(0).max(100),
      rationale: z.string().min(10).max(200)
    }),
    foreign: z.object({
      score: z.number().min(0).max(100),
      rationale: z.string().min(10).max(200)
    })
  }),
  issues: z.array(z.object({
    title: z.string().min(5).max(50),
    summary: z.string().min(10).max(100)
  })).max(5)
})

const SURVEY_ANALYSIS_PROMPT = `You are a political analysis expert specializing in UK politics. Analyze the survey responses to determine political positioning across five key pillars.

For each pillar, provide:
1. A score from 0-100 (0 = very left/liberal, 100 = very right/conservative)
2. A clear rationale explaining the positioning based on the responses

Also identify 3-5 key political issues based on the responses.

Return your response as a JSON object with this structure:
{
  "pillars": {
    "economy": { "score": 75, "rationale": "Clear explanation of economic positioning" },
    "social": { "score": 60, "rationale": "Clear explanation of social positioning" },
    "environment": { "score": 85, "rationale": "Clear explanation of environmental positioning" },
    "governance": { "score": 70, "rationale": "Clear explanation of governance positioning" },
    "foreign": { "score": 55, "rationale": "Clear explanation of foreign policy positioning" }
  },
  "issues": [
    { "title": "Issue Title", "summary": "Brief explanation of why this is important" }
  ]
}

Guidelines:
- Scores should reflect UK political spectrum positioning
- Rationales should be specific and based on the actual responses
- Issue titles should be clear and politically relevant
- Issue summaries should be concise (max 100 characters)
- Be objective and analytical, not judgmental
- Ensure all scores are between 0-100
- Provide exactly 5 issues (no more, no less)`

export async function analyzeSurvey(responses: SurveyResponse[]): Promise<SurveyAnalysis> {
  const openaiKey = getOpenAIKey()
  if (!openaiKey) {
    throw new Error('OpenAI API key not configured')
  }

  const openai = new OpenAI({ apiKey: openaiKey })

  // Format responses for analysis
  const responseText = responses
    .map(r => `Question ${r.question_id}: ${r.choice}${r.text ? ` (Additional: ${r.text})` : ""}`)
    .join('\n\n')

  console.log('Analyzing survey responses:', responseText)

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SURVEY_ANALYSIS_PROMPT },
        { role: "user", content: `Analyze these survey responses:\n\n${responseText}` }
      ],
      temperature: 0.2,
      max_tokens: 1500
    })

    const analysisText = response.choices[0]?.message?.content
    if (!analysisText) {
      throw new Error('Failed to get analysis from OpenAI')
    }

    // Parse and validate JSON
    let analysisData
    try {
      analysisData = JSON.parse(analysisText)
    } catch (parseError) {
      console.error('Failed to parse survey analysis JSON:', parseError)
      throw new Error('Invalid JSON from survey analysis')
    }

    // Validate with zod
    const validatedData = SurveyAnalysisSchema.parse(analysisData)

    // Ensure scores are properly clamped
    Object.values(validatedData.pillars).forEach(pillar => {
      pillar.score = Math.max(0, Math.min(100, Math.round(pillar.score)))
    })

    console.log('Survey analysis completed successfully')
    return validatedData

  } catch (error) {
    console.error('Survey analysis failed:', error)
    
    if (error instanceof z.ZodError) {
      console.error('Validation errors:', error.issues)
      throw new Error('Survey analysis validation failed')
    }
    
    throw error
  }
}

