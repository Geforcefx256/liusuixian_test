import { describe, expect, it, vi, afterEach } from 'vitest'

vi.mock('@/config/apiConfig', () => ({
  getAgentApiBase: () => '/agent/api'
}))

import { agentApi } from './agentApi'
import type { AgentRunRequest, AgentStreamEvent } from './types'

function createNdjsonResponse(events: AgentStreamEvent[]): Response {
  const payload = events.map(event => JSON.stringify(event)).join('\n')
  return {
    ok: true,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(payload))
        controller.close()
      }
    })
  } as Response
}

describe('agentApi.runStream', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('parses existing NDJSON event contract and returns terminal result', async () => {
    const request = {
      agentId: 'workspace-agent',
      sessionId: 'session-1',
      input: 'hello'
    } as AgentRunRequest
    const result = {
      runId: 'run-1',
      sessionId: 'session-1',
      agentId: 'workspace-agent',
      output: { kind: 'text' as const, text: 'done' },
      text: 'done',
      completedAt: Date.now()
    }
    const events: AgentStreamEvent[] = [
      { type: 'lifecycle.start', runId: 'run-1', agentId: 'workspace-agent', sessionId: 'session-1', startedAt: Date.now() },
      {
        type: 'tool.started',
        runId: 'run-1',
        agentId: 'workspace-agent',
        sessionId: 'session-1',
        toolCallId: 'tool-1',
        tool: 'local:read_file',
        displayName: 'read_file',
        toolKind: 'tool',
        startedAt: Date.now()
      },
      { type: 'assistant.delta', runId: 'run-1', delta: 'do' },
      { type: 'assistant.final', runId: 'run-1', text: 'done' },
      { type: 'run.completed', runId: 'run-1', status: 'success', result, endedAt: Date.now() }
    ]
    global.fetch = vi.fn(async () => createNdjsonResponse(events)) as unknown as typeof fetch

    const seen: AgentStreamEvent[] = []
    const terminal = await agentApi.runStream(request, event => seen.push(event))

    expect(seen.map(event => event.type)).toEqual([
      'lifecycle.start',
      'tool.started',
      'assistant.delta',
      'assistant.final',
      'run.completed'
    ])
    expect(terminal).toEqual(result)
  })
})

describe('agentApi.cancelRun', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns acknowledged cancel no-op responses without treating them as request failures', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        runId: 'run-1',
        cancelled: false
      })
    } as Response)) as unknown as typeof fetch

    await expect(agentApi.cancelRun('run-1')).resolves.toEqual({
      ok: true,
      runId: 'run-1',
      cancelled: false
    })
  })
})

describe('agentApi.downloadWorkspaceFile', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns attachment blob data with the authoritative filename from headers', async () => {
    const blob = new Blob(['name,value\nalpha,1\n'], { type: 'text/csv' })
    global.fetch = vi.fn(async () => ({
      ok: true,
      blob: async () => blob,
      headers: new Headers({
        'content-disposition': "attachment; filename*=UTF-8''%E4%B8%AD%E6%96%87%E8%B5%84%E6%96%99.csv"
      })
    } as Response)) as unknown as typeof fetch

    await expect(agentApi.downloadWorkspaceFile('workspace-agent', 'file-1')).resolves.toEqual({
      blob,
      fileName: '中文资料.csv'
    })
  })

  it('fails explicitly when the download response omits the authoritative filename header', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(['missing header']),
      headers: new Headers()
    } as Response)) as unknown as typeof fetch

    await expect(agentApi.downloadWorkspaceFile('workspace-agent', 'file-1')).rejects.toThrow('Missing download filename')
  })
})

describe('agentApi.clearHistorySessions', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('posts the bulk-clear request and returns the deletion summary', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        deletedCount: 2,
        excludedSessionId: 'session-current',
        skippedActiveSessionIds: ['session-active']
      })
    } as Response)) as unknown as typeof fetch

    await expect(agentApi.clearHistorySessions('workspace-agent', 'session-current')).resolves.toEqual({
      deletedCount: 2,
      excludedSessionId: 'session-current',
      skippedActiveSessionIds: ['session-active']
    })
    expect(global.fetch).toHaveBeenCalledWith('/agent/api/agent/sessions/history/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'workspace-agent',
        excludedSessionId: 'session-current'
      }),
      credentials: 'include'
    })
  })
})

describe('agentApi.getSessionUsageSummary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requests the dedicated session usage endpoint and returns the summary payload', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        usage: {
          userId: 1,
          agentId: 'workspace-agent',
          sessionId: 'session-1',
          totalTokens: 18234,
          inputTokens: 12000,
          outputTokens: 6234,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          assistantMessageCount: 3
        }
      })
    } as Response)) as unknown as typeof fetch

    await expect(agentApi.getSessionUsageSummary('workspace-agent', 'session-1')).resolves.toEqual({
      userId: 1,
      agentId: 'workspace-agent',
      sessionId: 'session-1',
      totalTokens: 18234,
      inputTokens: 12000,
      outputTokens: 6234,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      assistantMessageCount: 3
    })
    expect(global.fetch).toHaveBeenCalledWith('/agent/api/agent/sessions/session-1/usage?agentId=workspace-agent', {
      credentials: 'include'
    })
  })
})
