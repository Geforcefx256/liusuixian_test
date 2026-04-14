import { describe, expect, it } from 'vitest'
import { GatewayToolsService } from './service.js'
import type { GatewayConfig, GatewayToolServerConfig, GatewayToolsInvokeRequest } from './types.js'

const baseServer: GatewayToolServerConfig = {
  id: 'default',
  enabled: true,
  transport: 'http',
  endpoint: 'http://example.com/mcp',
  tools: ['normalize_rows', 'summarize_rows']
}

const baseConfig: GatewayConfig = {
  timeoutMs: 50,
  defaultServer: 'default',
  servers: [baseServer],
  tools: {
    profiles: {
      safe: ['default:normalize_rows', 'default:summarize_rows']
    },
    byProvider: {
      openai: { profile: 'safe' }
    },
    allow: ['default:normalize_rows', 'default:summarize_rows'],
    deny: []
  },
  agents: {
    'agent-a': {
      tools: {
        allow: ['default:normalize_rows']
      }
    }
  },
  gateway: {
    tools: {
      deny: ['default:summarize_rows']
    }
  }
}

const baseRequest: GatewayToolsInvokeRequest = {
  tool: 'default:normalize_rows',
  sessionKey: 's-1'
}

describe('GatewayToolsService', () => {
  it('returns TOOL_NOT_FOUND when tool is missing', async () => {
    const service = new GatewayToolsService(baseConfig)
    const result = await service.invoke({ ...baseRequest, tool: 'default:not_exist' })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected invoke to fail')
    expect(result.error.type).toBe('TOOL_NOT_FOUND')
  })

  it('returns TOOL_DENIED when policy denies tool', async () => {
    const service = new GatewayToolsService(baseConfig)
    const result = await service.invoke({
      ...baseRequest,
      tool: 'default:summarize_rows',
      provider: 'openai',
      agentId: 'agent-a'
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected invoke to fail')
    expect(result.error.type).toBe('TOOL_DENIED')
  })

  it('returns EXECUTION_TIMEOUT when transport times out', async () => {
    const service = new GatewayToolsService(baseConfig, () => ({
      execute: () => new Promise(resolve => setTimeout(() => resolve({ operations: [] }), 80))
    }))

    const result = await service.invoke(baseRequest)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected invoke to fail')
    expect(result.error.type).toBe('EXECUTION_TIMEOUT')
  })

  it('returns EXECUTION_FAILED when transport throws', async () => {
    const service = new GatewayToolsService(baseConfig, () => ({
      execute: async () => {
        throw new Error('upstream failure')
      }
    }))

    const result = await service.invoke(baseRequest)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected invoke to fail')
    expect(result.error.type).toBe('EXECUTION_FAILED')
  })

  it('returns INVALID_RESULT when payload cannot map operations', async () => {
    const service = new GatewayToolsService(baseConfig, () => ({
      execute: async () => ({ foo: 'bar' })
    }))

    const result = await service.invoke(baseRequest)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected invoke to fail')
    expect(result.error.type).toBe('INVALID_RESULT')
  })

  it('returns success when payload maps to operations', async () => {
    const service = new GatewayToolsService(baseConfig, () => ({
      execute: async () => ({
        operations: [{ type: 'insert', sheetName: 'VLR', rows: [{ VN: '100' }] }]
      })
    }))

    const result = await service.invoke(baseRequest)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected invoke to succeed')
    expect(result.result.operations).toHaveLength(1)
    expect(result.result.operations[0].type).toBe('insert')
  })

  it('propagates trace context to transport and response meta', async () => {
    let capturedTrace: Record<string, unknown> | undefined
    const service = new GatewayToolsService(baseConfig, () => ({
      execute: async (_server, _tool, request) => {
        capturedTrace = request.trace as Record<string, unknown> | undefined
        return {
          operations: [{ type: 'insert', sheetName: 'VLR', rows: [{ VN: '100' }] }]
        }
      }
    }))

    const result = await service.invoke({
      ...baseRequest,
      trace: {
        runId: 'run-1',
        turnId: 'turn-1',
        toolCallId: 'tool-call-1'
      }
    })

    expect(capturedTrace).toEqual({
      runId: 'run-1',
      turnId: 'turn-1',
      toolCallId: 'tool-call-1'
    })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected invoke to succeed')
    expect(result.result.meta.trace).toEqual({
      runId: 'run-1',
      turnId: 'turn-1',
      toolCallId: 'tool-call-1'
    })
  })

  it('applies policy chain for catalog (provider -> allow/deny -> agent -> gateway deny)', () => {
    const service = new GatewayToolsService(baseConfig)

    const catalog = service.catalog({ provider: 'openai', agentId: 'agent-a' })

    expect(catalog.tools.map(item => item.id)).toEqual(['default:normalize_rows'])
  })
})
