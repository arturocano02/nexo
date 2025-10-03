"use client"
import React from "react"
import { AdvancedPoliticalProfile as AdvancedPoliticalProfileType } from "@/src/lib/ai/advancedAnalysis"

interface AdvancedPoliticalProfileProps {
  profile: AdvancedPoliticalProfileType
}

export default function AdvancedPoliticalProfile({ profile }: AdvancedPoliticalProfileProps) {
  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'very_liberal': return 'text-blue-600 bg-blue-50'
      case 'liberal': return 'text-blue-500 bg-blue-50'
      case 'moderate': return 'text-gray-600 bg-gray-50'
      case 'conservative': return 'text-red-500 bg-red-50'
      case 'very_conservative': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600'
    if (confidence >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getImportanceColor = (importance: number) => {
    if (importance >= 0.8) return 'bg-red-500'
    if (importance >= 0.6) return 'bg-orange-500'
    if (importance >= 0.4) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <div className="space-y-6">
      {/* Political Sentiment */}
      <section className="rounded-2xl border border-neutral-200 p-4">
        <h2 className="mb-3 text-sm font-semibold">Political Sentiment</h2>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSentimentColor(profile.sentiment.overall)}`}>
            {profile.sentiment.overall.replace('_', ' ').toUpperCase()}
          </span>
          <span className={`text-sm ${getConfidenceColor(profile.sentiment.confidence)}`}>
            {Math.round(profile.sentiment.confidence * 100)}% confidence
          </span>
        </div>
        <p className="mt-2 text-xs text-neutral-600">{profile.sentiment.reasoning}</p>
      </section>

      {/* Party Affinity */}
      <section className="rounded-2xl border border-neutral-200 p-4">
        <h2 className="mb-3 text-sm font-semibold">Party Affinity</h2>
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-black">{profile.political_affinity.closest_party}</span>
          <span className={`text-sm ${getConfidenceColor(profile.political_affinity.confidence)}`}>
            {Math.round(profile.political_affinity.confidence * 100)}% match
          </span>
        </div>
        <p className="mt-2 text-xs text-neutral-600">{profile.political_affinity.reasoning}</p>
      </section>

      {/* Key Values */}
      <section className="rounded-2xl border border-neutral-200 p-4">
        <h2 className="mb-3 text-sm font-semibold">Key Values</h2>
        <div className="flex flex-wrap gap-2">
          {profile.key_values.map((value, index) => (
            <span 
              key={index}
              className="px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full text-xs font-medium"
            >
              {value}
            </span>
          ))}
        </div>
      </section>

      {/* Policy Priorities */}
      <section className="rounded-2xl border border-neutral-200 p-4">
        <h2 className="mb-3 text-sm font-semibold">Policy Priorities</h2>
        <div className="space-y-2">
          {profile.policy_priorities.map((priority, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center">
                {index + 1}
              </div>
              <span className="text-sm text-neutral-700">{priority}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Advanced Issues Analysis */}
      <section className="rounded-2xl border border-neutral-200 p-4">
        <h2 className="mb-3 text-sm font-semibold">Issue Analysis</h2>
        <div className="space-y-4">
          {profile.top_issues.map((issue, index) => (
            <div key={index} className="border-l-4 border-neutral-200 pl-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-black">{issue.title}</h3>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    issue.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                    issue.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {issue.sentiment}
                  </span>
                  <div className="flex items-center gap-1">
                    <div className="w-16 h-2 bg-neutral-200 rounded">
                      <div 
                        className={`h-2 rounded ${getImportanceColor(issue.importance)}`}
                        style={{ width: `${issue.importance * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-neutral-500">
                      {Math.round(issue.importance * 100)}%
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-neutral-600 mb-2">{issue.summary}</p>
              <div className="flex flex-wrap gap-1">
                {issue.keywords.map((keyword, keywordIndex) => (
                  <span 
                    key={keywordIndex}
                    className="px-2 py-1 bg-neutral-100 text-neutral-600 rounded text-xs"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pillars with Confidence */}
      <section className="rounded-2xl border border-neutral-200 p-4">
        <h2 className="mb-3 text-sm font-semibold">Pillars Analysis</h2>
        <div className="space-y-3">
          {Object.entries(profile.pillars).map(([pillar, data]) => (
            <div key={pillar}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-neutral-700 capitalize">{pillar}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{data.score}</span>
                  <span className={`text-xs ${getConfidenceColor(data.confidence)}`}>
                    {Math.round(data.confidence * 100)}%
                  </span>
                </div>
              </div>
              <div className="h-2 w-full rounded bg-neutral-200">
                <div 
                  className="h-2 rounded bg-black" 
                  style={{ width: `${Math.max(0, Math.min(100, data.score))}%` }} 
                />
              </div>
              <p className="mt-1 text-xs text-neutral-600">{data.rationale}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

