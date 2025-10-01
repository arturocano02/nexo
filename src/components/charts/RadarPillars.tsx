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
  // Transform data for Recharts
  const data = Object.entries(pillars).map(([key, value]) => ({
    pillar: PILLAR_LABELS[key] || key,
    score: Math.round(value.score)
  }))

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
