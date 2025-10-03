"use client"
import { useState, useEffect } from "react"

interface RefreshAnimationProps {
  isVisible: boolean
  onComplete: () => void
  isProcessing?: boolean
}

const STEPS = [
  { id: "messages", text: "Final messages are being analysed", duration: 2000 },
  { id: "views", text: "Views are being summarised", duration: 2000 },
  { id: "scoring", text: "Views are being scored", duration: 2000 },
  { id: "visuals", text: "Visuals are being updated", duration: 1500 }
]

export default function RefreshAnimation({ isVisible, onComplete, isProcessing = true }: RefreshAnimationProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!isVisible) {
      setCurrentStep(0)
      setProgress(0)
      return
    }

    let stepIndex = 0
    let stepProgress = 0
    const totalDuration = STEPS.reduce((sum, step) => sum + step.duration, 0)
    let startTime = Date.now()

    const updateProgress = () => {
      const elapsed = Date.now() - startTime
      const totalProgress = Math.min(elapsed / totalDuration, 1)
      setProgress(totalProgress)

      // Update current step based on elapsed time
      let cumulativeTime = 0
      let newStepIndex = 0
      for (let i = 0; i < STEPS.length; i++) {
        cumulativeTime += STEPS[i].duration
        if (elapsed < cumulativeTime) {
          newStepIndex = i
          break
        }
        newStepIndex = i + 1
      }
      setCurrentStep(Math.min(newStepIndex, STEPS.length - 1))

      // Only complete if processing is done AND we've reached the end
      if (!isProcessing && totalProgress >= 1) {
        // Animation complete
        setTimeout(() => {
          onComplete()
        }, 500)
      } else if (totalProgress < 1) {
        requestAnimationFrame(updateProgress)
      } else {
        // Keep running until processing is complete
        requestAnimationFrame(updateProgress)
      }
    }

    requestAnimationFrame(updateProgress)
  }, [isVisible, onComplete, isProcessing])

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center">
      <div className="text-center text-white max-w-md mx-4">
        {/* Logo/Icon */}
        <div className="mb-8">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h2 className="text-2xl font-bold">Refreshing Views</h2>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="w-full bg-white/20 rounded-full h-2 mb-4">
            <div 
              className="bg-white h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="text-sm text-white/80">
            {Math.round(progress * 100)}% complete
          </div>
        </div>

        {/* Current Step */}
        <div className="space-y-4">
          {STEPS.map((step, index) => {
            const isActive = index === currentStep
            const isCompleted = index < currentStep
            const isUpcoming = index > currentStep

            return (
              <div
                key={step.id}
                className={`flex items-center space-x-3 transition-all duration-500 ${
                  isActive 
                    ? 'text-white scale-105' 
                    : isCompleted 
                    ? 'text-green-400' 
                    : 'text-white/40'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isCompleted 
                    ? 'bg-green-400' 
                    : isActive 
                    ? 'bg-white' 
                    : 'bg-white/20'
                }`}>
                  {isCompleted ? (
                    <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : isActive ? (
                    <div className="w-3 h-3 bg-black rounded-full animate-pulse"></div>
                  ) : (
                    <div className="w-3 h-3 bg-white/40 rounded-full"></div>
                  )}
                </div>
                <span className={`text-lg font-medium transition-all duration-300 ${
                  isActive ? 'animate-pulse' : ''
                }`}>
                  {step.text}
                </span>
              </div>
            )
          })}
        </div>

        {/* Sparkle effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-ping"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
