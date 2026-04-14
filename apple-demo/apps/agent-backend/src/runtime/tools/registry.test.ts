import { describe, expect, it, vi } from 'vitest'
import { ToolProviderRegistry } from './registry.js'
import type { ToolProvider } from './types.js'

function createProvider(id: string): ToolProvider {
  return {
    id,
    catalog: vi.fn(() => ([
      {
        id: 'default:normalize_rows',
        server: 'default',
        name: 'normalize_rows',
        description: 'normalize rows'
      }
    ])),
    invoke: vi.fn(async request => ({
      ok: true as const,
      requestId: `req-${id}`,
        result: {
          tool: request.tool,
          action: request.action,
          summary: 'ok',
          operations: [],
          meta: {
            server: 'default',
            tool: 'normalize_rows',
            latencyMs: 1,
            inputChars: 1,
            operationsChars: 2,
          summaryChars: 2,
          trace: request.trace
        }
      }
    })),
    refresh: vi.fn(async () => ({
      source: `${id}.config.json`
    }))
  }
}

describe('ToolProviderRegistry', () => {
  it('adds provider namespace to catalog tool ids', () => {
    const registry = new ToolProviderRegistry()
    registry.register(createProvider('gateway'))

    const result = registry.catalog()
    expect(result.tools[0]?.id).toBe('gateway:default:normalize_rows')
  })

  it('routes invoke by provider namespace', async () => {
    const provider = createProvider('mcp')
    const registry = new ToolProviderRegistry()
    registry.register(provider)

    const result = await registry.invoke({
      tool: 'mcp:default:normalize_rows',
      action: 'run',
      args: { input: 'hello' }
    })

    expect(provider.invoke).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(true)
  })

  it('rejects invoke requests without provider namespace', async () => {
    const registry = new ToolProviderRegistry()
    registry.register(createProvider('gateway'))

    const result = await registry.invoke({
      tool: 'default:normalize_rows',
      args: { input: 'hello' }
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected failure')
    expect(result.error.type).toBe('VALIDATION_ERROR')
  })

  it('supports unregister and refresh lifecycle', async () => {
    const gateway = createProvider('gateway')
    const mcp = createProvider('mcp')
    const registry = new ToolProviderRegistry()
    registry.register(gateway)
    registry.register(mcp)

    const refreshed = await registry.refresh()
    expect(refreshed.providers).toEqual(expect.arrayContaining(['gateway', 'mcp']))

    registry.unregister('mcp')
    const result = registry.catalog()
    expect(result.tools.every(tool => !tool.id.startsWith('mcp:'))).toBe(true)
  })

  it('filters denied tools from catalog and invocation', async () => {
    const provider = createProvider('gateway')
    const registry = new ToolProviderRegistry({
      deny: ['gateway:default:normalize_rows']
    })
    registry.register(provider)

    const catalog = registry.catalog()
    expect(catalog.tools).toEqual([])

    const result = await registry.invoke({
      tool: 'gateway:default:normalize_rows',
      args: { input: 'hello' }
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected deny-list failure')
    expect(result.error.type).toBe('TOOL_NOT_FOUND')
  })
})
