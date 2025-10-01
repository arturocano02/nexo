const KEY = "nexo_survey_draft_v1"

export type DraftAnswer = { choice?: string; text?: string }
export type Draft = Record<string, DraftAnswer>

export function saveDraft(draft: Draft) {
  if (typeof window === "undefined") return
  localStorage.setItem(KEY, JSON.stringify(draft))
}

export function loadDraft(): Draft | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export function clearDraft() {
  if (typeof window === "undefined") return
  localStorage.removeItem(KEY)
}
