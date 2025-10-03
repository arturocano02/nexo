/**
 * @jest-environment jsdom
 */

import { deriveCompass } from '@/src/lib/derive/compass'

describe('deriveCompass', () => {
  it('calculates compass position from pillars', () => {
    const pillars = {
      economy: { score: 80, rationale: 'test' },
      social: { score: 20, rationale: 'test' },
      environment: { score: 50, rationale: 'test' },
      governance: { score: 50, rationale: 'test' },
      foreign: { score: 50, rationale: 'test' }
    }

    const result = deriveCompass(pillars)
    
    expect(result).toHaveProperty('x')
    expect(result).toHaveProperty('y')
    expect(typeof result.x).toBe('number')
    expect(typeof result.y).toBe('number')
  })

  it('handles missing pillars gracefully', () => {
    const pillars = {
      economy: { score: 50, rationale: 'test' }
    }

    const result = deriveCompass(pillars)
    
    expect(result).toHaveProperty('x')
    expect(result).toHaveProperty('y')
    expect(typeof result.x).toBe('number')
    expect(typeof result.y).toBe('number')
  })

  it('handles empty pillars object', () => {
    const pillars = {}

    const result = deriveCompass(pillars)
    
    expect(result).toHaveProperty('x')
    expect(result).toHaveProperty('y')
    expect(typeof result.x).toBe('number')
    expect(typeof result.y).toBe('number')
  })

  it('handles invalid pillar scores', () => {
    const pillars = {
      economy: { score: NaN, rationale: 'test' },
      social: { score: null as any, rationale: 'test' },
      environment: { score: undefined as any, rationale: 'test' }
    }

    const result = deriveCompass(pillars)
    
    expect(result).toHaveProperty('x')
    expect(result).toHaveProperty('y')
    expect(typeof result.x).toBe('number')
    expect(typeof result.y).toBe('number')
  })

  it('returns values within expected range', () => {
    const pillars = {
      economy: { score: 100, rationale: 'test' },
      social: { score: 0, rationale: 'test' },
      environment: { score: 50, rationale: 'test' },
      governance: { score: 50, rationale: 'test' },
      foreign: { score: 50, rationale: 'test' }
    }

    const result = deriveCompass(pillars)
    
    expect(result.x).toBeGreaterThanOrEqual(-100)
    expect(result.x).toBeLessThanOrEqual(100)
    expect(result.y).toBeGreaterThanOrEqual(-100)
    expect(result.y).toBeLessThanOrEqual(100)
  })
})
