import { describe, expect, it, vi } from 'vitest'

import { createAgentRouter } from './agent.js'
import type { AgentService } from '../agent/service.js'

describe('createAgentRouter session usage route', () => {
  it('returns session usage for admin users', async () => {
    const service = createServiceStub({
      getSessionMeta: vi.fn().mockResolvedValue({
        userId: 1,
        agentId: 'agent-1',
        sessionId: 'session-1'
      }),
      getSessionUsageSummary: vi.fn().mockResolvedValue({
        userId: 1,
        agentId: 'agent-1',
        sessionId: 'session-1',
        totalTokens: 18234,
        inputTokens: 12000,
        outputTokens: 6234,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        assistantMessageCount: 3
      })
    })
    const handler = getGetHandler(service, '/sessions/:sessionId/usage')
    const response = createMockResponse()

    await handler({
      params: { sessionId: 'session-1' },
      query: { agentId: 'agent-1' },
      auth: { userId: 1, roles: ['admin'] }
    }, response)

    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({
      ok: true,
      usage: {
        totalTokens: 18234,
        assistantMessageCount: 3
      }
    })
    expect(service.getSessionUsageSummary).toHaveBeenCalledWith(1, 'agent-1', 'session-1')
  })

  it('rejects non-admin users before querying usage', async () => {
    const service = createServiceStub()
    const handler = getGetHandler(service, '/sessions/:sessionId/usage')
    const response = createMockResponse()

    await handler({
      params: { sessionId: 'session-1' },
      query: { agentId: 'agent-1' },
      auth: { userId: 1, roles: ['user'] }
    }, response)

    expect(response.statusCode).toBe(403)
    expect(response.body).toEqual({ error: 'Admin access required' })
    expect(service.getSessionMeta).not.toHaveBeenCalled()
    expect(service.getSessionUsageSummary).not.toHaveBeenCalled()
  })

  it('returns an explicit zero summary for empty sessions', async () => {
    const service = createServiceStub({
      getSessionMeta: vi.fn().mockResolvedValue({
        userId: 1,
        agentId: 'agent-1',
        sessionId: 'session-empty'
      }),
      getSessionUsageSummary: vi.fn().mockResolvedValue({
        userId: 1,
        agentId: 'agent-1',
        sessionId: 'session-empty',
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        assistantMessageCount: 0
      })
    })
    const handler = getGetHandler(service, '/sessions/:sessionId/usage')
    const response = createMockResponse()

    await handler({
      params: { sessionId: 'session-empty' },
      query: { agentId: 'agent-1' },
      auth: { userId: 1, roles: ['super_admin'] }
    }, response)

    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({
      ok: true,
      usage: {
        totalTokens: 0,
        assistantMessageCount: 0
      }
    })
  })
})

function createServiceStub(overrides: Record<string, unknown> = {}) {
  return {
    getSessionMeta: vi.fn(),
    getSessionUsageSummary: vi.fn(),
    ...overrides
  } as unknown as AgentService & {
    getSessionMeta: ReturnType<typeof vi.fn>
    getSessionUsageSummary: ReturnType<typeof vi.fn>
  }
}

function getGetHandler(service: AgentService, path: string) {
  const router = createAgentRouter(service)
  const layer = router.stack.find(entry => entry.route?.path === path && entry.route.methods.get)
  if (!layer?.route?.stack?.length) {
    throw new Error(`GET ${path} handler not found`)
  }
  return layer.route.stack[0].handle as (
    req: {
      params: Record<string, string>
      query: Record<string, string>
      auth: { userId: number; roles: string[] }
    },
    res: ReturnType<typeof createMockResponse>
  ) => Promise<void>
}

function createMockResponse() {
  return {
    body: null as unknown,
    statusCode: 200,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: unknown) {
      this.body = payload
      return this
    }
  }
}
