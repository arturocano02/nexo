"use client"
import React from "react"
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts"

type Pillars = Record<string, { score: number; rationale: string }>

interface RadarPillarsProps {
  pillars: Pillars
}

const PILLAR_LABELS: Record<string, string> = {
  economy: "Economy",
  social: "Social", 
  environment: "Environment",
  governance: "Governance",
  foreign: "Foreign"
}

export default function RadarPillars({ pillars }: RadarPillarsProps) {
  // Add safety checks for undefined or invalid data
  if (!pillars || typeof pillars !== 'object') {
    return (
      <div className="w-full text-center py-8">
        <p className="text-sm text-neutral-500">No pillar data available</p>
      </div>
    )
  }

  // Debug each pillar entry (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log("RadarPillars received pillars:", pillars)
  }
  
  // Transform data for Recharts with validation
  const data = Object.entries(pillars)
    .filter(([key, value]) => {
      // Handle different data structures - score might be an object with a score property
      let scoreValue = value?.score
      if (typeof scoreValue === 'object' && scoreValue !== null && 'score' in scoreValue) {
        scoreValue = (scoreValue as any).score
      }
      
      const isValid = value && typeof scoreValue === 'number' && !isNaN(scoreValue)
      if (!isValid && process.env.NODE_ENV === 'development') {
        console.log(`Filtering out invalid pillar ${key}:`, value, `extracted score: ${scoreValue}`)
      }
      return isValid
    })
    .map(([key, value]) => {
      // Handle different data structures - score might be an object with a score property
      let scoreValue = value.score
      if (typeof scoreValue === 'object' && scoreValue !== null && 'score' in scoreValue) {
        scoreValue = (scoreValue as any).score
      }
      
      return {
        pillar: PILLAR_LABELS[key] || key,
        score: Math.round(Math.max(0, Math.min(100, scoreValue)))
      }
    })
  
  if (process.env.NODE_ENV === 'development' && data.length === 0) {
    console.log("RadarPillars: No valid pillar data available")
  }

  // Check if we have valid data to display
  if (data.length === 0) {
    return (
      <div className="w-full text-center py-8">
        <p className="text-sm text-neutral-500">No valid pillar data available</p>
      </div>
    )
  }

  // Create aria-label for accessibility
  const ariaLabel = `Pillars radar: ${data.map(d => `${d.pillar} ${d.score}`).join(", ")}`

  return (
    <div className="w-full" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={256}>
        <RadarChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <PolarGrid stroke="#e5e5e5" />
          <PolarAngleAxis 
            dataKey="pillar" 
            tick={{ fontSize: 12, fill: "#666" }}
            className="text-xs"
          />
          <PolarRadiusAxis 
            domain={[0, 100]} 
            tick={{ fontSize: 10, fill: "#999" }}
            tickCount={6}
            axisLine={false}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke="#000"
            fill="#000"
            fillOpacity={0.15}
            strokeWidth={2}
            className="animate-pulse"
          />
          <Tooltip
            formatter={(value: number) => [value, "Score"]}
            labelFormatter={(label: string) => `Pillar: ${label}`}
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e5e5",
              borderRadius: "8px",
              fontSize: "12px"
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
