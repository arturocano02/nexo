type Pillars = Record<string, { score: number; rationale: string }>

export function deriveCompass(pillars: Pillars): { x: number; y: number } {
  // Add safety checks for invalid input
  if (!pillars || typeof pillars !== 'object') {
    console.warn("Invalid pillars data for compass derivation")
    return { x: 0, y: 0 }
  }

  // UK political compass mapping:
  // x = Economic axis: economy score (0-100) mapped to [-100, 100]
  //     Higher economy score = more right-wing economically
  // y = Social axis: governance score (0-100) mapped to [-100, 100] 
  //     Higher governance score = more authoritarian socially
  
  const economyScore = (pillars.economy?.score && typeof pillars.economy.score === 'number' && !isNaN(pillars.economy.score)) 
    ? Math.max(0, Math.min(100, pillars.economy.score)) 
    : 50
  
  const governanceScore = (pillars.governance?.score && typeof pillars.governance.score === 'number' && !isNaN(pillars.governance.score)) 
    ? Math.max(0, Math.min(100, pillars.governance.score)) 
    : 50
  
  // Map economy: 0-100 -> -100 to +100 (left to right)
  const x = Math.max(-100, Math.min(100, (economyScore - 50) * 2))
  
  // Map governance: 0-100 -> +100 to -100 (libertarian to authoritarian)
  // Note: Invert Y so higher governance = more authoritarian (bottom)
  const y = Math.max(-100, Math.min(100, (50 - governanceScore) * 2))
  
  return { x, y }
}
