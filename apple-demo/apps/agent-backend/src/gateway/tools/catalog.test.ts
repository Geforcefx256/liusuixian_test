import { describe, expect, it } from 'vitest'
import { buildGatewayToolsCatalog } from './catalog.js'
import type { GatewayConfig } from './types.js'

describe('buildGatewayToolsCatalog', () => {
  it('returns manifests for enabled tools only', () => {
    const config: GatewayConfig = {
      timeoutMs: 15000,
      defaultServer: 'enabled-http',
      servers: [
        {
          id: 'enabled-http',
          enabled: true,
          transport: 'http',
          endpoint: 'http://localhost:3200/mcp',
          tools: ['normalize_rows', 'summarize_rows']
        },
        {
          id: 'disabled-stdio',
          enabled: false,
          transport: 'stdio',
          command: 'node',
          tools: ['secret_tool']
        }
      ]
    }

    const manifests = buildGatewayToolsCatalog(config)

    expect(manifests).toHaveLength(2)
    expect(manifests.map(m => m.id)).toEqual([
      'enabled-http:normalize_rows',
      'enabled-http:summarize_rows'
    ])
    expect(manifests.every(m => m.server === 'enabled-http')).toBe(true)
  })
})
