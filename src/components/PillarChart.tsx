"use client"
import React from "react"

type Pillars = Record<string, { score: number; rationale: string }>

export default function PillarChart({ pillars }: { pillars: Pillars }) {
  // Add safety checks for undefined or invalid data
  if (!pillars || typeof pillars !== 'object') {
    return (
      <div className="w-full text-center py-8">
        <p className="text-sm text-neutral-500">No pillar data available</p>
      </div>
    )
  }

  const entries = Object.entries(pillars)
  
  // Check if we have valid entries
  if (entries.length === 0) {
    return (
      <div className="w-full text-center py-8">
        <p className="text-sm text-neutral-500">No pillar data available</p>
      </div>
    )
  }

  const labels: Record<string,string> = {
    economy: "Economy",
    social: "Social",
    environment: "Environment",
    governance: "Governance",
    foreign: "Foreign"
  }
  
  return (
    <div className="space-y-3">
      {entries.map(([key, val]) => {
        // Handle different data structures - score might be an object with a score property
        let scoreValue = val?.score
        if (typeof scoreValue === 'object' && scoreValue !== null && 'score' in scoreValue) {
          scoreValue = (scoreValue as any).score
        }
        
        // Validate each pillar entry
        if (!val || typeof scoreValue !== 'number' || isNaN(scoreValue)) {
          return (
            <div key={key} className="text-sm text-neutral-500">
              {labels[key] ?? key}: Invalid data
            </div>
          )
        }

        return (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-neutral-700">{labels[key] ?? key}</span>
              <span className="font-medium">{Math.round(scoreValue)}</span>
            </div>
            <div className="h-2 w-full rounded bg-neutral-200 overflow-hidden">
              <div 
                className="h-2 rounded bg-black transition-all duration-1000 ease-out" 
                style={{ width: `${Math.max(0, Math.min(100, scoreValue))}%` }} 
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
