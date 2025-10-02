import { z } from "zod"

// Schema for the delta structure
export const DeltaSchema = z.object({
  pillarsDelta: z.record(z.string(), z.number().min(-10).max(10)),
  topIssuesDelta: z.array(z.object({
    op: z.enum(["add", "remove", "update"]),
    title: z.string().optional(),
    summary: z.string().max(140).optional()
  }))
})

export type Delta = z.infer<typeof DeltaSchema>

export interface CurrentSnapshot {
  pillars: Record<string, { score: number; rationale: string }>
  top_issues: Array<{ title: string; summary: string }>
}

export interface MergedSnapshot {
  pillars: Record<string, { score: number; rationale: string }>
  top_issues: Array<{ title: string; summary: string }>
}

// Normalize title for comparison
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Collapse multiple spaces
}

// Find similar issue by title
function findSimilarIssue(issues: Array<{ title: string; summary: string }>, targetTitle: string): number {
  const normalizedTarget = normalizeTitle(targetTitle)
  
  for (let i = 0; i < issues.length; i++) {
    const normalizedIssue = normalizeTitle(issues[i].title)
    if (normalizedIssue === normalizedTarget) {
      return i
    }
  }
  
  return -1
}

export function mergeDeltas(
  currentSnapshot: CurrentSnapshot | null,
  delta: Delta
): MergedSnapshot {
  // Default scores if no current snapshot
  const defaultScores = {
    economy: 50,
    social: 50,
    environment: 50,
    governance: 50,
    foreign: 50
  }

  // Start with current snapshot or defaults
  const currentPillars = currentSnapshot?.pillars || {}
  const currentIssues = currentSnapshot?.top_issues || []

  // Apply pillar deltas
  const newPillars: Record<string, { score: number; rationale: string }> = {}
  
  for (const [pillar, currentScore] of Object.entries({
    ...defaultScores,
    ...currentPillars
  })) {
    const deltaValue = delta.pillarsDelta[pillar] || 0
    const newScore = Math.max(0, Math.min(100, (currentScore as number) + deltaValue))
    
    newPillars[pillar] = {
      score: newScore,
      rationale: currentPillars[pillar]?.rationale || `Updated based on recent conversation`
    }
  }

  // Apply issue deltas
  let newIssues = [...currentIssues]

  for (const issueDelta of delta.topIssuesDelta) {
    if (!issueDelta.title) continue

    switch (issueDelta.op) {
      case "add":
        if (issueDelta.summary) {
          newIssues.push({
            title: issueDelta.title,
            summary: issueDelta.summary
          })
        }
        break

      case "remove":
        const removeIndex = findSimilarIssue(newIssues, issueDelta.title)
        if (removeIndex !== -1) {
          newIssues.splice(removeIndex, 1)
        }
        break

      case "update":
        const updateIndex = findSimilarIssue(newIssues, issueDelta.title)
        if (updateIndex !== -1) {
          newIssues[updateIndex] = {
            title: issueDelta.title,
            summary: issueDelta.summary || newIssues[updateIndex].summary
          }
        } else if (issueDelta.summary) {
          // If not found, treat as add
          newIssues.push({
            title: issueDelta.title,
            summary: issueDelta.summary
          })
        }
        break
    }
  }

  // Limit to top 5 issues
  newIssues = newIssues.slice(0, 5)

  return {
    pillars: newPillars,
    top_issues: newIssues
  }
}
