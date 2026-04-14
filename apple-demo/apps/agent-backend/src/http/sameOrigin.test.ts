import { describe, expect, it, vi } from 'vitest'

import { requireSameOrigin } from './sameOrigin.js'
import * as configLoader from '../memory/ConfigLoader.js'

function buildRequest(origin: string | undefined) {
  return {
    method: 'POST',
    secure: false,
    protocol: 'http',
    get(name: string) {
      const key = name.toLowerCase()
      if (key === 'origin') return origin
      if (key === 'host') return 'localhost:3100'
      return undefined
    }
  }
}

function mockConfig() {
  return {
    auth: {
      baseUrl: '',
      sameOriginProtection: {
        enabled: true,
        allowedOrigins: ['http://localhost:517*']
      }
    }
  } as unknown as ReturnType<typeof configLoader.loadConfig>
}

describe('requireSameOrigin', () => {
  it('accepts wildcard development origins', () => {
    vi.spyOn(configLoader, 'loadConfig').mockReturnValue(mockConfig())
    const next = vi.fn()
    const res = { status: vi.fn(() => ({ json: vi.fn() })) }

    requireSameOrigin(buildRequest('http://localhost:5175') as never, res as never, next)

    expect(next).toHaveBeenCalled()
  })

  it('rejects unmatched origins even when wildcard policy exists', () => {
    vi.spyOn(configLoader, 'loadConfig').mockReturnValue(mockConfig())
    const json = vi.fn()
    const res = { status: vi.fn(() => ({ json })) }

    requireSameOrigin(buildRequest('http://localhost:4173') as never, res as never, vi.fn())

    expect(res.status).toHaveBeenCalledWith(403)
    expect(json).toHaveBeenCalled()
  })
})
