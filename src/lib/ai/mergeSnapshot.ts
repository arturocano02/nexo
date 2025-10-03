export interface PillarData {
  score: number
  rationale: string
}

export interface IssueData {
  title: string
  summary: string
}

export interface Snapshot {
  pillars: Record<string, PillarData>
  top_issues: IssueData[]
}

export interface DeltaExtraction {
  pillarsDelta: {
    economy?: number
    social?: number
    environment?: number
    governance?: number
    foreign?: number
  }
  topIssuesDelta: Array<{
    op: "add" | "remove" | "update"
    title?: string
    summary?: string
  }>
}

/**
 * Normalize issue title for comparison (case-insensitive, trimmed)
 */
function normalizeIssueTitle(title: string): string {
  return title.toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * Find similar issue by title (case-insensitive matching)
 */
function findSimilarIssue(issues: IssueData[], title: string): IssueData | null {
  const normalized = normalizeIssueTitle(title)
  return issues.find(issue => normalizeIssueTitle(issue.title) === normalized) || null
}

/**
 * Merge baseline snapshot with deltas to create new snapshot
 */
export function mergeSnapshot(
  baselineSnapshot: Snapshot,
  deltas: DeltaExtraction
): Snapshot {
  // Start with baseline
  const newSnapshot: Snapshot = {
    pillars: { ...baselineSnapshot.pillars },
    top_issues: [...baselineSnapshot.top_issues]
  }

  // Apply pillar deltas
  Object.entries(deltas.pillarsDelta).forEach(([pillar, delta]) => {
    if (delta !== undefined && newSnapshot.pillars[pillar]) {
      const currentScore = newSnapshot.pillars[pillar].score
      const newScore = Math.max(0, Math.min(100, currentScore + delta))
      newSnapshot.pillars[pillar] = {
        ...newSnapshot.pillars[pillar],
        score: Math.round(newScore)
      }
    }
  })

  // Apply issue deltas
  deltas.topIssuesDelta.forEach(delta => {
    if (!delta.title) return

    switch (delta.op) {
      case 'add':
        if (delta.summary) {
          // Only add if not already exists
          const existing = findSimilarIssue(newSnapshot.top_issues, delta.title)
          if (!existing) {
            newSnapshot.top_issues.push({
              title: delta.title,
              summary: delta.summary
            })
          }
        }
        break

      case 'update':
        if (delta.summary) {
          const existing = findSimilarIssue(newSnapshot.top_issues, delta.title)
          if (existing) {
            existing.title = delta.title
            existing.summary = delta.summary
          } else {
            // If not found, add as new
            newSnapshot.top_issues.push({
              title: delta.title,
              summary: delta.summary
            })
          }
        }
        break

      case 'remove':
        const indexToRemove = newSnapshot.top_issues.findIndex(
          issue => normalizeIssueTitle(issue.title) === normalizeIssueTitle(delta.title!)
        )
        if (indexToRemove !== -1) {
          newSnapshot.top_issues.splice(indexToRemove, 1)
        }
        break
    }
  })

  // Keep only top 10 issues
  newSnapshot.top_issues = newSnapshot.top_issues.slice(0, 10)

  return newSnapshot
}

/**
 * Create initial snapshot from survey analysis
 */
export function createInitialSnapshot(surveyAnalysis: {
  pillars: Record<string, { score: number; rationale: string }>
  issues: Array<{ title: string; summary: string }>
}): Snapshot {
  return {
    pillars: { ...surveyAnalysis.pillars },
    top_issues: [...surveyAnalysis.issues]
  }
}

/**
 * Validate snapshot structure
 */
export function validateSnapshot(snapshot: Snapshot): boolean {
  // Check pillars
  const requiredPillars = ['economy', 'social', 'environment', 'governance', 'foreign']
  for (const pillar of requiredPillars) {
    if (!snapshot.pillars[pillar]) return false
    if (typeof snapshot.pillars[pillar].score !== 'number') return false
    if (snapshot.pillars[pillar].score < 0 || snapshot.pillars[pillar].score > 100) return false
    if (typeof snapshot.pillars[pillar].rationale !== 'string') return false
  }

  // Check issues
  if (!Array.isArray(snapshot.top_issues)) return false
  if (snapshot.top_issues.length > 10) return false

  for (const issue of snapshot.top_issues) {
    if (typeof issue.title !== 'string' || issue.title.length === 0) return false
    if (typeof issue.summary !== 'string' || issue.summary.length === 0) return false
  }

  return true
}

