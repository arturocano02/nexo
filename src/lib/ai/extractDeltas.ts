import OpenAI from "openai"
import { z } from "zod"
import { getOpenAIKey } from "@/src/lib/env"

export interface PriorSnapshot {
  pillars: Record<string, { score: number; rationale: string }>
  top_issues: Array<{ title: string; summary: string }>
}

export interface ConversationSummary {
  summary: string
  key_points: string[]
}

export interface DeltaExtraction {
  pillarsDelta: {
    economy?: number
    social?: number
    environment?: number
    governance?: number
    foreign?: number
  }
  topIssuesDelta: Array<{
    op: "add" | "remove" | "update"
    title?: string
    summary?: string
  }>
}

const DeltaExtractionSchema = z.object({
  pillarsDelta: z.object({
    economy: z.number().min(-10).max(10).optional(),
    social: z.number().min(-10).max(10).optional(),
    environment: z.number().min(-10).max(10).optional(),
    governance: z.number().min(-10).max(10).optional(),
    foreign: z.number().min(-10).max(10).optional()
  }),
  topIssuesDelta: z.array(z.object({
    op: z.enum(["add", "remove", "update"]),
    title: z.string().min(3).max(50).optional(),
    summary: z.string().min(10).max(140).optional()
  }))
})

const DELTA_EXTRACTION_PROMPT = `You are a political analysis expert. Analyze how a conversation affects someone's political positioning compared to their previous snapshot.

Compare the conversation summary against their prior political snapshot and determine what changes occurred.

For each pillar, provide a delta score (-10 to +10) indicating how the conversation shifts their positioning:
- Negative values = more left/liberal positioning
- Positive values = more right/conservative positioning
- 0 = no significant change
- Only provide non-zero values if there's clear evidence of a shift

For issues, identify new topics, updates to existing ones, or removals based on the conversation.

Return your response as a JSON object with this structure:
{
  "pillarsDelta": {
    "economy": 0,
    "social": 0,
    "environment": 0,
    "governance": 0,
    "foreign": 0
  },
  "topIssuesDelta": [
    {
      "op": "add",
      "title": "New Issue Title",
      "summary": "Brief summary of the new issue"
    },
    {
      "op": "update",
      "title": "Existing Issue Title",
      "summary": "Updated summary"
    },
    {
      "op": "remove",
      "title": "Issue to Remove"
    }
  ]
}

Rules:
- Deltas must be between -10 and +10
- Only provide non-zero deltas if there's clear evidence of a shift
- For issues, prefer 'update' over 'add' if titles are similar
- Issue titles should be specific and politically relevant
- Issue summaries must be ≤140 characters
- Return empty arrays/objects if no changes
- Be conservative with deltas - only adjust when there's clear evidence`

export async function extractDeltas(
  conversationSummary: ConversationSummary,
  priorSnapshot: PriorSnapshot
): Promise<DeltaExtraction> {
  const openaiKey = getOpenAIKey()
  if (!openaiKey) {
    throw new Error('OpenAI API key not configured')
  }

  const openai = new OpenAI({ apiKey: openaiKey })

  // Format the comparison data
  const priorPillars = Object.entries(priorSnapshot.pillars)
    .map(([key, value]) => `${key}: ${value.score} (${value.rationale})`)
    .join('\n')

  const priorIssues = priorSnapshot.top_issues
    .map(issue => `- ${issue.title}: ${issue.summary}`)
    .join('\n')

  const comparisonText = `
PRIOR POLITICAL SNAPSHOT:
Pillars:
${priorPillars}

Issues:
${priorIssues}

CONVERSATION SUMMARY:
${conversationSummary.summary}

Key Points:
${conversationSummary.key_points.map(point => `- ${point}`).join('\n')}
`.trim()

  console.log('Extracting deltas from conversation vs prior snapshot')

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: DELTA_EXTRACTION_PROMPT },
        { role: "user", content: comparisonText }
      ],
      temperature: 0.1,
      max_tokens: 800
    })

    const deltaText = response.choices[0]?.message?.content
    if (!deltaText) {
      throw new Error('Failed to get delta extraction from OpenAI')
    }

    // Parse and validate JSON
    let deltaData
    try {
      deltaData = JSON.parse(deltaText)
    } catch (parseError) {
      console.error('Failed to parse delta extraction JSON:', parseError)
      throw new Error('Invalid JSON from delta extraction')
    }

    // Validate with zod
    const validatedData = DeltaExtractionSchema.parse(deltaData)

    // Ensure all deltas are properly clamped
    Object.keys(validatedData.pillarsDelta).forEach(pillar => {
      const delta = validatedData.pillarsDelta[pillar as keyof typeof validatedData.pillarsDelta]
      if (delta !== undefined) {
        validatedData.pillarsDelta[pillar as keyof typeof validatedData.pillarsDelta] = Math.max(-10, Math.min(10, Math.round(delta)))
      }
    })

    console.log('Delta extraction completed successfully')
    return validatedData

  } catch (error) {
    console.error('Delta extraction failed:', error)
    
    if (error instanceof z.ZodError) {
      console.error('Validation errors:', error.issues)
      throw new Error('Delta extraction validation failed')
    }
    
    throw error
  }
}

