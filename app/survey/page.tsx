"use client"
import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { QUESTIONS } from "@/src/lib/survey/questions"
import { Textarea } from "@/src/components/ui/textarea"
import { saveDraft, loadDraft } from "@/src/lib/survey/storage"
import { trackSurveyEvent, trackPageView } from "@/src/lib/analytics"

type Answer = { choice?: string; text?: string }

function SurveyPageInner() {
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const router = useRouter()
  const params = useSearchParams()
  const nextAfterAuth = params.get("next") || "/survey/finish"

  const currentQ = QUESTIONS[currentQuestion]
  const isLastQuestion = currentQuestion === QUESTIONS.length - 1
  const isFirstQuestion = currentQuestion === 0
  const progress = ((currentQuestion + 1) / QUESTIONS.length) * 100

  useEffect(() => {
    trackPageView('survey')
    const draft = loadDraft()
    if (draft) {
      setAnswers(draft)
      // Find the last answered question
      const lastAnsweredIndex = QUESTIONS.findIndex(q => !draft[q.id]?.choice && !draft[q.id]?.text)
      if (lastAnsweredIndex === -1) {
        setCurrentQuestion(QUESTIONS.length - 1)
      } else {
        setCurrentQuestion(Math.max(0, lastAnsweredIndex - 1))
      }
    } else {
      trackSurveyEvent('SURVEY_STARTED')
    }
  }, [])

  const setChoice = (id: string, choice: string) => {
    setAnswers(a => ({ ...a, [id]: { choice } }))
  }

  const setText = (id: string, text: string) => {
    setAnswers(a => ({ ...a, [id]: { text } }))
  }

  const goNext = () => {
    if (isLastQuestion) {
      // Save draft and redirect to complete page
      saveDraft(answers)
      trackSurveyEvent('SURVEY_COMPLETED')
      router.push("/survey/complete")
      return
    }

    setIsTransitioning(true)
    setTimeout(() => {
      setCurrentQuestion(prev => prev + 1)
      setIsTransitioning(false)
    }, 150)
  }

  const goBack = () => {
    if (isFirstQuestion) return
    
    setIsTransitioning(true)
    setTimeout(() => {
      setCurrentQuestion(prev => prev - 1)
      setIsTransitioning(false)
    }, 150)
  }

  const currentAnswer = answers[currentQ.id]
  const hasAnswer = currentAnswer?.choice || currentAnswer?.text

  return (
    <div className="min-h-screen bg-white">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-neutral-100">
        <div 
          className="h-full bg-black transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question counter */}
      <div className="fixed top-4 right-4 text-sm text-neutral-500">
        {currentQuestion + 1} of {QUESTIONS.length}
      </div>

      {/* Main content */}
      <div className="flex min-h-screen flex-col justify-center px-6 py-12">
        <div className={`mx-auto w-full max-w-lg transition-opacity duration-150 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
          {/* Question */}
          <div className="mb-8 text-center">
            <h1 className="mb-4 text-2xl font-semibold leading-tight text-neutral-900">
              {currentQ.prompt}
            </h1>
            <p className="text-sm text-neutral-500">
              Choose an option or share your own thoughts
            </p>
          </div>

          {/* Answer options */}
          <div className="mb-8 space-y-3">
            {currentQ.choices.map((choice, index) => {
              const isSelected = currentAnswer?.choice === choice
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => setChoice(currentQ.id, choice)}
                  className={`w-full rounded-2xl border-2 p-4 text-left transition-all duration-200 ${
                    isSelected
                      ? 'border-black bg-black text-white'
                      : 'border-neutral-200 bg-white text-neutral-900 hover:border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{choice}</span>
                    {isSelected && (
                      <div className="h-2 w-2 rounded-full bg-white" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Custom text input */}
          <div className="mb-8">
            <Textarea
              placeholder="Or share your own thoughts..."
              value={currentAnswer?.text || ""}
              onChange={(e) => setText(currentQ.id, e.target.value)}
              className="min-h-[100px] w-full rounded-2xl border-2 border-neutral-200 p-4 text-sm placeholder:text-neutral-400 focus:border-black focus:outline-none"
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={goBack}
              disabled={isFirstQuestion}
              className={`rounded-xl px-6 py-3 text-sm font-medium transition-all duration-200 ${
                isFirstQuestion
                  ? 'invisible'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Back
            </button>

            <button
              onClick={goNext}
              disabled={!hasAnswer}
              className={`rounded-xl px-8 py-3 text-sm font-medium transition-all duration-200 ${
                hasAnswer
                  ? 'bg-black text-white hover:bg-neutral-800'
                  : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
              }`}
            >
              {isLastQuestion ? 'Complete Survey' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SurveyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <h1 className="text-xl font-semibold">Loading survey...</h1>
      </div>
    }>
      <SurveyPageInner />
    </Suspense>
  )
}
