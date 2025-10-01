export type SurveyQuestion = {
  id: string
  prompt: string
  choices: string[]
}

export const QUESTIONS: SurveyQuestion[] = [
  {
    id: "q1",
    prompt: "Public money first: what should government focus on most?",
    choices: [
      "Grow jobs and the economy",
      "Support people most in need",
      "Keep debt and taxes lower",
      "Protect core public services",
      "I don't know"
    ]
  },
  {
    id: "q2",
    prompt: "Climate and energy: what pace of change feels right?",
    choices: [
      "Strong action now, even if it costs more",
      "Steady transition with shared costs",
      "Balance costs with benefits carefully",
      "Let markets lead innovation",
      "I don't know"
    ]
  },
  {
    id: "q3",
    prompt: "Rights and social issues: what's your instinct?",
    choices: [
      "Expand protections and equal access",
      "Keep a similar balance as today",
      "Let local communities decide more",
      "Reduce government's role in social rules",
      "I don't know"
    ]
  },
  {
    id: "q4",
    prompt: "How should big decisions be made?",
    choices: [
      "More direct input from citizens",
      "Elected representatives decide",
      "Independent experts decide",
      "A mix of all three",
      "I don't know"
    ]
  },
  {
    id: "q5",
    prompt: "Abroad: what matters most?",
    choices: [
      "Security and defence",
      "Trade, jobs and growth",
      "Alliances and shared values",
      "Staying out of conflicts",
      "I don't know"
    ]
  }
]
