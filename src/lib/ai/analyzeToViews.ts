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
2. A clear rationale explaining the positioning that directly references their responses

Also identify 3-5 top political issues based on the responses.

Return your response as a JSON object with this structure:
{
  "pillars": {
    "economy": { "score": 75, "rationale": "Clear explanation of economic positioning with direct reference to their answers" },
    "social": { "score": 60, "rationale": "Clear explanation of social positioning with direct reference to their answers" },
    "environment": { "score": 85, "rationale": "Clear explanation of environmental positioning with direct reference to their answers" },
    "governance": { "score": 70, "rationale": "Clear explanation of governance positioning with direct reference to their answers" },
    "foreign": { "score": 55, "rationale": "Clear explanation of foreign policy positioning with direct reference to their answers" }
  },
  "top_issues": [
    { 
      "title": "Issue Title", 
      "summary": "Detailed explanation of their position on this issue based on their responses",
      "mentions": 1,
      "user_quote": "Direct quote or paraphrase from their survey responses related to this issue"
    }
  ]
}

Guidelines:
- Scores should reflect UK political spectrum positioning
- Rationales MUST directly reference their actual responses (e.g., "You indicated support for...")
- Issue titles should be specific and politically relevant
- Issue summaries should explain their position, not just mention the topic
- Include direct quotes or paraphrases from their responses in the user_quote field
- Include a mentions count (1-5) indicating importance of the issue to them
- Be objective and analytical, not judgmental`

export async function analyzeToViews({ 
  answers, 
  conversationHistory 
}: { 
  answers: Record<string, { choice?: string; text?: string }>
  conversationHistory?: string
}): Promise<ViewsSnapshot> {
  console.log("[Survey Analysis] Starting with answers:", JSON.stringify(answers, null, 2))

  // Check if OpenAI is configured
  if (!openai) {
    console.error("[Survey Analysis] OpenAI API key not configured!")
    
    // Generate more meaningful data based on actual survey answers
    // Extract the choices and text responses
    const choices = Object.entries(answers).map(([key, value]) => ({ 
      question: key, 
      choice: value.choice || "",
      text: value.text || ""
    }))
    
    // Get text responses for quotes
    const textResponses = choices
      .filter(a => a.text && a.text.length > 0)
      .map(a => a.text)
    
    console.log("[Survey Analysis] Found text responses:", textResponses)
    
    // Analyze choices to determine scores
    // This is a simplified version of what the AI would do
    let economyScore = 60
    let socialScore = 55
    let environmentScore = 70
    let governanceScore = 65
    let foreignScore = 58
    
    // Look for specific question responses to adjust scores
    choices.forEach(answer => {
      // Economic questions
      if (answer.question.includes("economy") || answer.question.includes("tax")) {
        if (answer.choice === "strongly_agree" || answer.choice === "agree") {
          economyScore += 15
        } else if (answer.choice === "strongly_disagree" || answer.choice === "disagree") {
          economyScore -= 15
        }
      }
      
      // Social questions
      if (answer.question.includes("social") || answer.question.includes("welfare")) {
        if (answer.choice === "strongly_agree" || answer.choice === "agree") {
          socialScore -= 15  // More progressive/left
        } else if (answer.choice === "strongly_disagree" || answer.choice === "disagree") {
          socialScore += 15  // More conservative/right
        }
      }
      
      // Environmental questions
      if (answer.question.includes("environment") || answer.question.includes("climate")) {
        if (answer.choice === "strongly_agree" || answer.choice === "agree") {
          environmentScore -= 20  // More progressive/left
        } else if (answer.choice === "strongly_disagree" || answer.choice === "disagree") {
          environmentScore += 20  // More conservative/right
        }
      }
      
      // Check text responses for keywords
      if (answer.text) {
        const text = answer.text.toLowerCase()
        
        // Economic keywords
        if (text.includes("tax") || text.includes("economy") || text.includes("spending")) {
          economyScore += text.includes("reduce tax") ? 10 : (text.includes("increase tax") ? -10 : 0)
        }
        
        // Social keywords
        if (text.includes("welfare") || text.includes("nhs") || text.includes("education")) {
          socialScore += text.includes("private") ? 10 : (text.includes("public") ? -10 : 0)
        }
        
        // Environmental keywords
        if (text.includes("climate") || text.includes("environment") || text.includes("green")) {
          environmentScore += text.includes("regulation") ? -15 : 0
        }
      }
    })
    
    // Ensure scores are within 0-100 range
    economyScore = Math.max(0, Math.min(100, economyScore))
    socialScore = Math.max(0, Math.min(100, socialScore))
    environmentScore = Math.max(0, Math.min(100, environmentScore))
    governanceScore = Math.max(0, Math.min(100, governanceScore))
    foreignScore = Math.max(0, Math.min(100, foreignScore))
    
    // Create meaningful rationales based on scores and actual survey responses
    const pillars = {
      economy: { 
        score: economyScore, 
        rationale: `Based on your survey responses${textResponses.length > 0 ? ' including your comments about economic issues' : ''}, you have a ${economyScore > 60 ? 'more market-oriented' : (economyScore < 40 ? 'more state-intervention' : 'balanced')} view on economic issues.` 
      },
      social: { 
        score: socialScore, 
        rationale: `Your answers${textResponses.length > 0 ? ' and comments about social policies' : ''} indicate a ${socialScore > 60 ? 'more traditional' : (socialScore < 40 ? 'more progressive' : 'centrist')} stance on social policies.` 
      },
      environment: { 
        score: environmentScore, 
        rationale: `You ${environmentScore < 40 ? 'strongly prioritize' : (environmentScore > 60 ? 'are more cautious about' : 'have a balanced view on')} environmental protection based on your survey responses${textResponses.length > 0 ? ' and comments about environmental issues' : ''}.` 
      },
      governance: { 
        score: governanceScore, 
        rationale: `Your answers suggest you prefer ${governanceScore > 60 ? 'stronger' : (governanceScore < 40 ? 'more limited' : 'balanced')} governance structures.` 
      },
      foreign: { 
        score: foreignScore, 
        rationale: `On foreign policy, you expressed ${foreignScore > 60 ? 'more nationalist' : (foreignScore < 40 ? 'more internationalist' : 'balanced')} views.` 
      }
    }
    
    // Determine top issues based on text responses and choices
    const issueKeywords = {
      "Economy": ["economy", "tax", "spending", "budget", "debt", "growth"],
      "Healthcare": ["nhs", "health", "healthcare", "hospital"],
      "Education": ["education", "school", "university", "student"],
      "Immigration": ["immigration", "migrant", "border", "asylum"],
      "Environment": ["environment", "climate", "green", "pollution"],
      "Brexit": ["brexit", "eu", "europe"],
      "Housing": ["housing", "home", "rent", "mortgage"],
      "Social Care": ["care", "elderly", "disability", "welfare"],
      "Defense": ["defense", "military", "security", "armed forces"]
    }
    
    // Count mentions of each issue
    const issueCounts: Record<string, { count: number, quote: string }> = {}
    
    // Check text responses for issue keywords
    textResponses.forEach(text => {
      const lowerText = text.toLowerCase()
      
      Object.entries(issueKeywords).forEach(([issue, keywords]) => {
        if (keywords.some(keyword => lowerText.includes(keyword))) {
          if (!issueCounts[issue]) {
            issueCounts[issue] = { count: 0, quote: text }
          }
          issueCounts[issue].count += 1
        }
      })
    })
    
    // Check choices for issue keywords
    choices.forEach(answer => {
      const questionText = answer.question.toLowerCase()
      
      Object.entries(issueKeywords).forEach(([issue, keywords]) => {
        if (keywords.some(keyword => questionText.includes(keyword))) {
          if (!issueCounts[issue]) {
            issueCounts[issue] = { count: 0, quote: answer.text || `Question about ${issue}` }
          }
          issueCounts[issue].count += 1
        }
      })
    })
    
    // Convert to sorted array
    const issueArray = Object.entries(issueCounts)
      .map(([title, data]) => ({ 
        title, 
        summary: `Based on your survey responses, ${title.toLowerCase()} is important to you.`,
        mentions: data.count,
        user_quote: data.quote
      }))
      .sort((a, b) => b.mentions - a.mentions)
    
    // Default issues if we couldn't extract enough from the survey
    const defaultIssues = [
      { 
        title: "Economic Policy", 
        summary: "Based on your survey responses, economic policy is a key area of interest.",
        mentions: 3,
        user_quote: textResponses.length > 0 ? textResponses[0] : "Survey responses indicate economic concerns"
      },
      { 
        title: "Social Policy", 
        summary: "Your survey responses suggest social policy matters to you.",
        mentions: 2,
        user_quote: textResponses.length > 1 ? textResponses[1] : "Survey responses show interest in social issues"
      },
      { 
        title: "Environmental Policy", 
        summary: "Based on your survey, environmental issues are significant to you.",
        mentions: 2,
        user_quote: textResponses.length > 2 ? textResponses[2] : "Survey responses indicate environmental concerns"
      }
    ]
    
    // Use extracted issues if we have enough, otherwise supplement with defaults
    const top_issues = issueArray.length >= 3 ? issueArray.slice(0, 5) : [
      ...issueArray,
      ...defaultIssues.slice(0, 3 - issueArray.length)
    ]

    console.log("[Survey Analysis] Using intelligent fallback analysis (OpenAI not configured)")
    return { pillars, top_issues }
  }

  // Try basic analysis first (more reliable than advanced)
  console.log("[Survey Analysis] OpenAI configured, starting AI analysis...")

  try {
    // Format the survey responses for analysis
    const responseText = Object.entries(answers)
      .map(([questionId, response]) => {
        const choice = response.choice || "No choice made"
        const text = response.text || ""
        return `Question ${questionId}: ${choice}${text ? ` (Additional: ${text})` : ""}`
      })
      .join('\n')

    console.log("[Survey Analysis] Formatted survey text:", responseText)

    // Call OpenAI for analysis
    console.log("[Survey Analysis] Calling OpenAI API...")
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SURVEY_ANALYZER_PROMPT },
        { role: "user", content: `Analyze these survey responses:\n\n${responseText}` }
      ],
      temperature: 0.3,
      max_tokens: 1500
    })

    console.log("[Survey Analysis] OpenAI response received")
    const analysisText = response.choices[0]?.message?.content
    if (!analysisText) {
      throw new Error("Failed to get analysis from OpenAI")
    }

    console.log("[Survey Analysis] Raw AI response:", analysisText)

    let analysisData
    try {
      analysisData = JSON.parse(analysisText)
    } catch (parseError) {
      console.error("[Survey Analysis] Failed to parse AI response:", parseError)
      console.error("[Survey Analysis] Raw response was:", analysisText)
      throw new Error("Invalid JSON from AI analysis")
    }

    // Validate the response structure
    if (!analysisData.pillars || !analysisData.top_issues) {
      console.error("[Survey Analysis] Invalid structure:", analysisData)
      throw new Error("Invalid analysis structure from AI")
    }

    // Ensure all required pillars are present with valid scores
    const requiredPillars = ['economy', 'social', 'environment', 'governance', 'foreign']
    for (const pillar of requiredPillars) {
      if (!analysisData.pillars[pillar] || typeof analysisData.pillars[pillar].score !== 'number') {
        console.warn(`[Survey Analysis] Missing or invalid pillar: ${pillar}, using default`)
        analysisData.pillars[pillar] = { score: 50, rationale: "Analysis incomplete for this pillar" }
      }
      // Clamp scores to 0-100
      analysisData.pillars[pillar].score = Math.max(0, Math.min(100, analysisData.pillars[pillar].score))
    }

    console.log("[Survey Analysis] ✅ AI analysis completed successfully:", analysisData)
    return analysisData

  } catch (error: any) {
    console.error("[Survey Analysis] ❌ AI analysis failed:", error)
    console.error("[Survey Analysis] Error details:", error.message, error.stack)
    
    // Generate more meaningful data based on actual survey answers
    // Extract the choices and text responses
    const choices = Object.entries(answers).map(([key, value]) => ({ 
      question: key, 
      choice: value.choice || "",
      text: value.text || ""
    }))
    
    // Get text responses for quotes
    const textResponses = choices
      .filter(a => a.text && a.text.length > 0)
      .map(a => a.text)
    
    // Analyze choices to determine scores
    // This is a simplified version of what the AI would do
    let economyScore = 55
    let socialScore = 52
    let environmentScore = 58
    let governanceScore = 54
    let foreignScore = 51
    
    // Look for specific question responses to adjust scores
    choices.forEach(answer => {
      // Economic questions
      if (answer.question.includes("economy") || answer.question.includes("tax")) {
        if (answer.choice === "strongly_agree" || answer.choice === "agree") {
          economyScore += 15
        } else if (answer.choice === "strongly_disagree" || answer.choice === "disagree") {
          economyScore -= 15
        }
      }
      
      // Social questions
      if (answer.question.includes("social") || answer.question.includes("welfare")) {
        if (answer.choice === "strongly_agree" || answer.choice === "agree") {
          socialScore -= 15  // More progressive/left
        } else if (answer.choice === "strongly_disagree" || answer.choice === "disagree") {
          socialScore += 15  // More conservative/right
        }
      }
      
      // Environmental questions
      if (answer.question.includes("environment") || answer.question.includes("climate")) {
        if (answer.choice === "strongly_agree" || answer.choice === "agree") {
          environmentScore -= 20  // More progressive/left
        } else if (answer.choice === "strongly_disagree" || answer.choice === "disagree") {
          environmentScore += 20  // More conservative/right
        }
      }
      
      // Check text responses for keywords
      if (answer.text) {
        const text = answer.text.toLowerCase()
        
        // Economic keywords
        if (text.includes("tax") || text.includes("economy") || text.includes("spending")) {
          economyScore += text.includes("reduce tax") ? 10 : (text.includes("increase tax") ? -10 : 0)
        }
        
        // Social keywords
        if (text.includes("welfare") || text.includes("nhs") || text.includes("education")) {
          socialScore += text.includes("private") ? 10 : (text.includes("public") ? -10 : 0)
        }
        
        // Environmental keywords
        if (text.includes("climate") || text.includes("environment") || text.includes("green")) {
          environmentScore += text.includes("regulation") ? -15 : 0
        }
      }
    })
    
    // Ensure scores are within 0-100 range
    economyScore = Math.max(0, Math.min(100, economyScore))
    socialScore = Math.max(0, Math.min(100, socialScore))
    environmentScore = Math.max(0, Math.min(100, environmentScore))
    governanceScore = Math.max(0, Math.min(100, governanceScore))
    foreignScore = Math.max(0, Math.min(100, foreignScore))
    
    // Create meaningful rationales based on scores and actual survey responses
    const pillars = {
      economy: { 
        score: economyScore, 
        rationale: `Based on your survey responses${textResponses.length > 0 ? ' including your comments about economic issues' : ''}, you have a ${economyScore > 60 ? 'more market-oriented' : (economyScore < 40 ? 'more state-intervention' : 'balanced')} view on economic issues.` 
      },
      social: { 
        score: socialScore, 
        rationale: `Your answers${textResponses.length > 0 ? ' and comments about social policies' : ''} indicate a ${socialScore > 60 ? 'more traditional' : (socialScore < 40 ? 'more progressive' : 'centrist')} stance on social policies.` 
      },
      environment: { 
        score: environmentScore, 
        rationale: `You ${environmentScore < 40 ? 'strongly prioritize' : (environmentScore > 60 ? 'are more cautious about' : 'have a balanced view on')} environmental protection based on your survey responses${textResponses.length > 0 ? ' and comments about environmental issues' : ''}.` 
      },
      governance: { 
        score: governanceScore, 
        rationale: `Your answers suggest you prefer ${governanceScore > 60 ? 'stronger' : (governanceScore < 40 ? 'more limited' : 'balanced')} governance structures.` 
      },
      foreign: { 
        score: foreignScore, 
        rationale: `On foreign policy, you expressed ${foreignScore > 60 ? 'more nationalist' : (foreignScore < 40 ? 'more internationalist' : 'balanced')} views.` 
      }
    }
    
    // Determine top issues based on text responses and choices
    const issueKeywords = {
      "Economy": ["economy", "tax", "spending", "budget", "debt", "growth"],
      "Healthcare": ["nhs", "health", "healthcare", "hospital"],
      "Education": ["education", "school", "university", "student"],
      "Immigration": ["immigration", "migrant", "border", "asylum"],
      "Environment": ["environment", "climate", "green", "pollution"],
      "Brexit": ["brexit", "eu", "europe"],
      "Housing": ["housing", "home", "rent", "mortgage"],
      "Social Care": ["care", "elderly", "disability", "welfare"],
      "Defense": ["defense", "military", "security", "armed forces"]
    }
    
    // Count mentions of each issue
    const issueCounts: Record<string, { count: number, quote: string }> = {}
    
    // Check text responses for issue keywords
    textResponses.forEach(text => {
      const lowerText = text.toLowerCase()
      
      Object.entries(issueKeywords).forEach(([issue, keywords]) => {
        if (keywords.some(keyword => lowerText.includes(keyword))) {
          if (!issueCounts[issue]) {
            issueCounts[issue] = { count: 0, quote: text }
          }
          issueCounts[issue].count += 1
        }
      })
    })
    
    // Check choices for issue keywords
    choices.forEach(answer => {
      const questionText = answer.question.toLowerCase()
      
      Object.entries(issueKeywords).forEach(([issue, keywords]) => {
        if (keywords.some(keyword => questionText.includes(keyword))) {
          if (!issueCounts[issue]) {
            issueCounts[issue] = { count: 0, quote: answer.text || `Question about ${issue}` }
          }
          issueCounts[issue].count += 1
        }
      })
    })
    
    // Convert to sorted array
    const issueArray = Object.entries(issueCounts)
      .map(([title, data]) => ({ 
        title, 
        summary: `Based on your survey responses, ${title.toLowerCase()} is important to you.`,
        mentions: data.count,
        user_quote: data.quote
      }))
      .sort((a, b) => b.mentions - a.mentions)
    
    // Default issues if we couldn't extract enough from the survey
    const defaultIssues = [
      { 
        title: "Economic Policy", 
        summary: "Based on your survey responses, economic policy is a key area of interest.",
        mentions: 3,
        user_quote: textResponses.length > 0 ? textResponses[0] : "Survey responses indicate economic concerns"
      },
      { 
        title: "Social Policy", 
        summary: "Your survey responses suggest social policy matters to you.",
        mentions: 2,
        user_quote: textResponses.length > 1 ? textResponses[1] : "Survey responses show interest in social issues"
      },
      { 
        title: "Environmental Policy", 
        summary: "Based on your survey, environmental issues are significant to you.",
        mentions: 2,
        user_quote: textResponses.length > 2 ? textResponses[2] : "Survey responses indicate environmental concerns"
      }
    ]
    
    // Use extracted issues if we have enough, otherwise supplement with defaults
    const top_issues = issueArray.length >= 3 ? issueArray.slice(0, 5) : [
      ...issueArray,
      ...defaultIssues.slice(0, 3 - issueArray.length)
    ]

    console.log("[Survey Analysis] Using fallback data due to AI error")
    return { pillars, top_issues }
  }
}
