"use client"
import React from "react"

type Pillars = Record<string, { score: number; rationale: string }>

export default function PillarChart({ pillars }: { pillars: Pillars }) {
  const entries = Object.entries(pillars)
  const labels: Record<string,string> = {
    economy: "Economy",
    social: "Social",
    environment: "Environment",
    governance: "Governance",
    foreign: "Foreign"
  }
  return (
    <div className="space-y-3">
      {entries.map(([key, val]) => (
        <div key={key}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-neutral-700">{labels[key] ?? key}</span>
            <span className="font-medium">{val.score}</span>
          </div>
          <div className="h-2 w-full rounded bg-neutral-200">
            <div className="h-2 rounded bg-black" style={{ width: `${Math.max(0, Math.min(100, val.score))}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
