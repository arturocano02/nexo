export type SurveyQuestion = {
  id: string
  prompt: string
  choices: string[]
}

export const QUESTIONS: SurveyQuestion[] = [
  {
    id: "q1",
    prompt: "Economy: What should be the government's top economic priority?",
    choices: [
      "Reduce inequality and support the most vulnerable",
      "Grow the economy and create jobs for everyone",
      "Keep taxes low and reduce government spending",
      "Invest in infrastructure and public services",
      "Let the market decide with minimal intervention"
    ]
  },
  {
    id: "q2",
    prompt: "Climate: How should the UK approach environmental challenges?",
    choices: [
      "Take immediate, bold action regardless of cost",
      "Gradual transition with government support",
      "Balance environmental goals with economic growth",
      "Focus on innovation and technology solutions",
      "Let businesses and individuals choose their approach"
    ]
  },
  {
    id: "q3",
    prompt: "Social issues: What's your view on social equality and rights?",
    choices: [
      "Expand protections and ensure equal opportunities for all",
      "Maintain current protections while being practical",
      "Let local communities decide what works for them",
      "Reduce government involvement in social issues",
      "Focus on individual responsibility and choice"
    ]
  },
  {
    id: "q4",
    prompt: "Democracy: How should important decisions be made?",
    choices: [
      "More direct democracy and citizen participation",
      "Trust elected representatives to make decisions",
      "Rely on independent experts and evidence",
      "A combination of all approaches",
      "Streamline decision-making for efficiency"
    ]
  },
  {
    id: "q5",
    prompt: "International relations: What should guide UK foreign policy?",
    choices: [
      "Promote human rights and democratic values globally",
      "Focus on trade and economic partnerships",
      "Prioritize national security and defence",
      "Maintain alliances while staying independent",
      "Minimize international involvement and focus domestically"
    ]
  }
]
