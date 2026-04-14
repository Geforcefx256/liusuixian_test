import { describe, expect, it } from 'vitest'
import { MCPGateway } from './gateway.js'
import type { MCPConfig, MCPExecuteRequest, MCPServerConfig } from './types.js'

const baseServer: MCPServerConfig = {
  id: 'default',
  enabled: true,
  transport: 'http',
  endpoint: 'http://example.com/mcp',
  tools: ['normalize_rows']
}

const baseConfig: MCPConfig = {
  timeoutMs: 50,
  defaultServer: 'default',
  servers: [baseServer]
}

const baseRequest: MCPExecuteRequest = {
  sessionKey: 's-1',
  agentId: 'a-1',
  input: 'do task',
  tool: 'normalize_rows'
}

describe('MCPGateway.execute', () => {
  it('returns MCP_VALIDATION_ERROR when tool is missing', async () => {
    const gateway = new MCPGateway(baseConfig)
    const result = await gateway.execute({
      sessionKey: 's-1',
      agentId: 'a-1',
      input: 'do task'
    })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('MCP_VALIDATION_ERROR')
  })

  it('returns MCP_NOT_FOUND when server is missing', async () => {
    const gateway = new MCPGateway({ ...baseConfig, servers: [] })
    const result = await gateway.execute(baseRequest)

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('MCP_NOT_FOUND')
  })

  it('returns MCP_DENIED when tool is not allowed', async () => {
    const gateway = new MCPGateway(baseConfig)
    const result = await gateway.execute({ ...baseRequest, tool: 'forbidden_tool' })

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('MCP_DENIED')
  })

  it('returns MCP_TIMEOUT when transport times out', async () => {
    const gateway = new MCPGateway(baseConfig, () => ({
      execute: () => new Promise(resolve => setTimeout(() => resolve({ operations: [] }), 80))
    }))

    const result = await gateway.execute(baseRequest)

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('MCP_TIMEOUT')
  })

  it('returns MCP_EXEC_FAILED when transport throws', async () => {
    const gateway = new MCPGateway(baseConfig, () => ({
      execute: async () => {
        throw new Error('upstream failure')
      }
    }))

    const result = await gateway.execute(baseRequest)

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('MCP_EXEC_FAILED')
  })

  it('returns MCP_INVALID_OUTPUT when payload cannot map operations', async () => {
    const gateway = new MCPGateway(baseConfig, () => ({
      execute: async () => ({ foo: 'bar' })
    }))

    const result = await gateway.execute(baseRequest)

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('MCP_INVALID_OUTPUT')
  })

  it('returns success when payload maps to operations', async () => {
    const gateway = new MCPGateway(baseConfig, () => ({
      execute: async () => ({
        operations: [{ type: 'insert', sheetName: 'VLR', rows: [{ VN: '100' }] }]
      })
    }))

    const result = await gateway.execute(baseRequest)

    expect(result.success).toBe(true)
    expect(result.operations).toHaveLength(1)
    expect(result.operations[0].type).toBe('insert')
    expect(result.meta?.inputChars).toBeGreaterThan(0)
    expect(result.meta?.operationsChars).toBeGreaterThan(0)
  })

  it('invoke returns compact response with summary', async () => {
    const gateway = new MCPGateway(baseConfig, () => ({
      execute: async () => ({
        operations: [{ type: 'insert', sheetName: 'VLR', rows: [{ VN: '100' }] }]
      })
    }))

    const result = await gateway.invoke(baseRequest)

    expect(result.success).toBe(true)
    expect(result.summary.length).toBeGreaterThan(0)
    expect(result.truncated).toBe(false)
    expect(result.meta?.summaryChars).toBe(result.summary.length)
  })

  it('invoke truncates large operation sets and exposes handle', async () => {
    const gateway = new MCPGateway(baseConfig, () => ({
      execute: async () => ({
        operations: Array.from({ length: 12 }, (_, idx) => ({
          type: 'insert',
          sheetName: 'VLR',
          rows: [{ VN: `${idx}` }]
        }))
      })
    }))

    const result = await gateway.invoke(baseRequest)

    expect(result.success).toBe(true)
    expect(result.truncated).toBe(true)
    expect(result.handleId).toBeDefined()
    expect(result.operations).toHaveLength(10)

    const stored = gateway.getResult(result.handleId!)
    expect(stored).not.toBeNull()
  })
})
