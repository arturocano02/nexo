type Pillars = Record<string, { score: number; rationale: string }>

export function deriveCompass(pillars: Pillars): { x: number; y: number } {
  // TODO: Refine mapping later by blending more pillars for more nuanced positioning
  
  // Current simple mapping:
  // x = Economic axis: economy score mapped to [-100, 100]
  // y = Social axis: governance score mapped to [-100, 100]
  
  const economyScore = pillars.economy?.score || 50
  const governanceScore = pillars.governance?.score || 50
  
  const x = Math.max(-100, Math.min(100, (economyScore - 50) * 2))
  const y = Math.max(-100, Math.min(100, (governanceScore - 50) * 2))
  
  return { x, y }
}
