"use client"
import React from "react"
import { Scatter, ScatterChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceArea } from "recharts"

interface PoliticalCompassProps {
  point: { x: number; y: number }
}

// UK political parties data for reference
const PARTIES = [
  { name: "Conservative", x: 70, y: 50, color: "#0087DC" },
  { name: "Labour", x: -30, y: 20, color: "#E4003B" },
  { name: "Liberal Democrats", x: -10, y: -20, color: "#FDBB30" },
  { name: "Green", x: -60, y: -40, color: "#008066" },
  { name: "SNP", x: -40, y: 10, color: "#FFFF00" },
  { name: "Reform UK", x: 80, y: 70, color: "#00AEEF" }
]

export default function PoliticalCompass({ point }: PoliticalCompassProps) {
  // Add safety checks for undefined or invalid data
  if (!point || typeof point.x !== 'number' || typeof point.y !== 'number' || isNaN(point.x) || isNaN(point.y)) {
    return (
      <div className="w-full text-center py-8">
        <p className="text-sm text-neutral-500">No compass data available</p>
      </div>
    )
  }

  // Ensure values are within valid range
  const validPoint = {
    x: Math.max(-100, Math.min(100, point.x)),
    y: Math.max(-100, Math.min(100, point.y))
  }

  const data = [{ x: validPoint.x, y: validPoint.y }]

  // Create aria-label for accessibility
  const ariaLabel = `Political compass: Economic position ${Math.round(validPoint.x)}, Social position ${Math.round(validPoint.y)}`

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
            label={{ value: "Left ← Economic Scale → Right", position: "bottom", offset: 15 }}
            hide={false}
          />
          
          <YAxis 
            type="number" 
            dataKey="y" 
            domain={[-100, 100]}
            ticks={[-100, -50, 0, 50, 100]}
            tick={{ fontSize: 11, fill: "#374151" }}
            axisLine={{ stroke: "#000", strokeWidth: 2 }}
            tickLine={{ stroke: "#000" }}
            label={{ value: "Libertarian ↑ Social Scale ↓ Authoritarian", angle: -90, position: "left", offset: 20 }}
            hide={false}
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
          
          {/* User's position - make it very distinct */}
          <Scatter
            data={data}
            fill="#FF0000"
            r={15}
            stroke="#000"
            strokeWidth={4}
            className="animate-pulse"
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
      
      {/* Removed axis labels since they're now on the graph */}
      
      {/* Legend */}
      <div className="mt-4 space-y-3">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 rounded-full">
            <div className="w-4 h-4 rounded-full bg-red-400 border-2 border-white" />
            <span className="text-sm font-semibold text-red-700">Your Position</span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="space-y-1">
            <div className="font-medium text-neutral-700">UK Political Parties</div>
            {PARTIES.slice(0, 3).map((party) => (
              <div key={party.name} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full border border-neutral-300" 
                  style={{ backgroundColor: party.color }}
                />
                <span className="text-neutral-600 text-xs">{party.name}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <div className="font-medium text-neutral-700">More Parties</div>
            {PARTIES.slice(3).map((party) => (
              <div key={party.name} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full border border-neutral-300" 
                  style={{ backgroundColor: party.color }}
                />
                <span className="text-neutral-600 text-xs">{party.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
