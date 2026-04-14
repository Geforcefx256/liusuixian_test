import { describe, expect, it } from 'vitest'
import { buildMCPToolCatalog } from './catalog.js'
import type { MCPConfig } from './types.js'

describe('buildMCPToolCatalog', () => {
  it('returns manifests for tools on enabled servers only', () => {
    const config: MCPConfig = {
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

    const manifests = buildMCPToolCatalog(config)

    expect(manifests).toHaveLength(2)
    expect(manifests.map(m => m.id)).toEqual([
      'enabled-http:normalize_rows',
      'enabled-http:summarize_rows'
    ])
    expect(manifests.every(m => m.server === 'enabled-http')).toBe(true)
  })
})
