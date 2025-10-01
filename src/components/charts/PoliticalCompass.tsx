"use client"
import React from "react"
import { Scatter, ScatterChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceArea } from "recharts"

interface PoliticalCompassProps {
  point: { x: number; y: number }
}

// Canadian political parties data for reference
const PARTIES = [
  { name: "People's Party", x: 85, y: 60, color: "#dc2626" },
  { name: "Conservative", x: 70, y: 40, color: "#1f2937" },
  { name: "Liberal", x: 20, y: 30, color: "#ea580c" },
  { name: "Green", x: 10, y: -10, color: "#16a34a" },
  { name: "Bloc Québécois", x: -20, y: -20, color: "#0ea5e9" },
  { name: "NDP", x: -40, y: -30, color: "#dc2626" }
]

export default function PoliticalCompass({ point }: PoliticalCompassProps) {
  const data = [{ x: point.x, y: point.y }]

  // Create aria-label for accessibility
  const ariaLabel = `Political compass: Economic position ${Math.round(point.x)}, Social position ${Math.round(point.y)}`

  return (
    <div className="w-full" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
          {/* Quadrant backgrounds with distinct colors */}
          <ReferenceArea x1={-100} x2={0} y1={0} y2={100} fill="#fecaca" fillOpacity={0.4} />
          <ReferenceArea x1={0} x2={100} y1={0} y2={100} fill="#dbeafe" fillOpacity={0.4} />
          <ReferenceArea x1={-100} x2={0} y1={-100} y2={0} fill="#dcfce7" fillOpacity={0.4} />
          <ReferenceArea x1={0} x2={100} y1={-100} y2={0} fill="#f3e8ff" fillOpacity={0.4} />
          
          <CartesianGrid stroke="#e5e5e5" strokeDasharray="2 2" />
          
          <XAxis 
            type="number" 
            dataKey="x" 
            domain={[-100, 100]}
            ticks={[-100, -50, 0, 50, 100]}
            tick={{ fontSize: 11, fill: "#374151" }}
            axisLine={{ stroke: "#000", strokeWidth: 2 }}
            tickLine={{ stroke: "#000" }}
          />
          
          <YAxis 
            type="number" 
            dataKey="y" 
            domain={[-100, 100]}
            ticks={[-100, -50, 0, 50, 100]}
            tick={{ fontSize: 11, fill: "#374151" }}
            axisLine={{ stroke: "#000", strokeWidth: 2 }}
            tickLine={{ stroke: "#000" }}
          />
          
          {/* Plot all parties */}
          {PARTIES.map((party, index) => (
            <Scatter
              key={party.name}
              data={[{ x: party.x, y: party.y }]}
              fill={party.color}
              r={8}
            />
          ))}
          
          {/* User's position */}
          <Scatter
            data={data}
            fill="#000"
            r={10}
            stroke="#fff"
            strokeWidth={2}
          />
          
          <Tooltip
            formatter={(value: number, name: string) => [
              Math.round(value), 
              name === "x" ? "Economic" : "Social"
            ]}
            labelFormatter={() => "Your Position"}
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e5e5",
              borderRadius: "8px",
              fontSize: "12px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>
      
      {/* Axis labels */}
      <div className="mt-3 text-center">
        <div className="text-sm font-medium text-neutral-700 mb-1">
          Left ← Economic Scale → Right
        </div>
        <div className="text-sm font-medium text-neutral-700">
          Libertarian ↑ Social Scale ↓ Authoritarian
        </div>
      </div>
      
      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="space-y-1">
          <div className="font-medium text-neutral-700">Parties (Reference)</div>
          {PARTIES.slice(0, 3).map((party) => (
            <div key={party.name} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: party.color }}
              />
              <span className="text-neutral-600">{party.name}</span>
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <div className="font-medium text-neutral-700">Your Position</div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-black border-2 border-white" />
            <span className="text-neutral-600">You</span>
          </div>
        </div>
      </div>
    </div>
  )
}
