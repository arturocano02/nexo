/**
 * @jest-environment node
 */

import { GET } from '@/app/api/health/route'

describe('/api/health', () => {
  it('returns health status', async () => {
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('status')
    expect(data.status).toBe('ok')
  })

  it('includes timestamp', async () => {
    const response = await GET()
    const data = await response.json()

    expect(data).toHaveProperty('timestamp')
    expect(typeof data.timestamp).toBe('string')
  })

  it('includes environment info', async () => {
    const response = await GET()
    const data = await response.json()

    expect(data).toHaveProperty('environment')
    expect(data.environment).toBe('test')
  })
})
