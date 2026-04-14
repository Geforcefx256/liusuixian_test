import express, { type Application } from 'express'
import { IncomingMessage, ServerResponse, type OutgoingHttpHeaders } from 'node:http'
import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/memory/ConfigLoader.js', () => ({
  loadConfig: () => ({
    auth: {
      sameOriginProtection: {
        enabled: true,
        allowedOrigins: ['http://localhost:5175']
      }
    }
  })
}))

vi.mock('../src/auth/authConfig.js', () => ({
  authEndpoints: {
    currentUser: () => 'http://localhost:3200/web/api/auth/me'
  }
}))

import { createAgentRouter } from '../src/routes/agent.js'
import { requireSameOrigin } from '../src/http/sameOrigin.js'

const JSON_CONTENT_TYPE = 'application/json'
const LOCALHOST = 'localhost:3100'

type TestResponse = {
  status: number
  body: any
  text: string
  headers: OutgoingHttpHeaders
}

type ExpressApp = Application & {
  handle: (req: IncomingMessage, res: ServerResponse) => void
}

function extractBodyText(rawText: string): string {
  const separator = '\r\n\r\n'
  const splitIndex = rawText.indexOf(separator)
  if (splitIndex === -1) return rawText
  return rawText.slice(splitIndex + separator.length)
}

function buildResponse(response: ServerResponse, chunks: Buffer[]): TestResponse {
  const rawText = Buffer.concat(chunks).toString('utf8')
  const text = extractBodyText(rawText)
  const contentType = response.getHeader('content-type')
  const isJson = typeof contentType === 'string' && contentType.includes(JSON_CONTENT_TYPE)
  return {
    status: response.statusCode,
    body: isJson && text ? JSON.parse(text) : text,
    text,
    headers: response.getHeaders()
  }
}

function dispatchRequest(
  app: ExpressApp,
  method: string,
  path: string,
  body: Buffer | string = '',
  headers: Record<string, string> = {}
): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const socket = new PassThrough()
    const request = new IncomingMessage(socket as never)
    request.method = method
    request.url = path
    request.headers = {
      host: LOCALHOST,
      ...headers
    }

    const response = new ServerResponse(request)
    response.assignSocket(socket as never)

    const chunks: Buffer[] = []
    socket.on('data', chunk => chunks.push(Buffer.from(chunk)))
    response.on('finish', () => resolve(buildResponse(response, chunks)))
    response.on('error', reject)

    app.handle(request, response)

    process.nextTick(() => {
      if (body.length > 0) {
        request.emit('data', typeof body === 'string' ? Buffer.from(body) : body)
      }
      request.emit('end')
    })
  })
}

function createApp() {
  const service = {
    executeRun: vi.fn(async (_request: unknown, emit: (event: unknown) => void) => {
      emit({
        type: 'run.completed',
        runId: 'run-1',
        status: 'success',
        endedAt: Date.now(),
        result: {
          runId: 'run-1',
          sessionId: 'session-1',
          agentId: 'workspace-agent',
          output: {
            kind: 'text',
            text: 'done'
          },
          text: 'done',
          completedAt: Date.now()
        }
      })
      return {
        runId: 'run-1',
        sessionId: 'session-1',
        agentId: 'workspace-agent',
        output: {
          kind: 'text',
          text: 'done'
        },
        text: 'done',
        completedAt: Date.now()
      }
    }),
    cancelRun: vi.fn(() => true),
    getRunResult: vi.fn(() => null),
    listInteractions: vi.fn(async () => []),
    assertWorkspaceRunAllowed: vi.fn(async () => undefined),
    assertSessionMutationAllowed: vi.fn(async () => undefined),
    createSession: vi.fn(async (userId: number, agentId: string, title?: string) => ({
      sessionId: 'session-1',
      userId,
      agentId,
      title
    })),
    listSessions: vi.fn(async () => []),
    deleteSession: vi.fn(async () => true),
    clearHistorySessions: vi.fn(async (_userId: number, _agentId: string, excludedSessionId?: string | null) => ({
      deletedCount: 3,
      excludedSessionId: excludedSessionId || null,
      skippedActiveSessionIds: []
    })),
    listWorkspaceFiles: vi.fn(() => [
      {
        fileKey: 'file-1',
        fileName: 'input.csv',
        source: 'upload',
        groupId: 'upload',
        addedAt: 123
      }
    ]),
    getSessionMeta: vi.fn(async () => ({
      sessionId: 'session-1',
      title: 'Session Title'
    })),
    getWorkspaceFiles: vi.fn(async () => [
      {
        fileKey: 'file-1',
        fileName: 'input.csv',
        source: 'upload',
        groupId: 'upload',
        addedAt: 123
      }
    ]),
    replaceWorkspaceFiles: vi.fn(async (_userId: number, agentId: string, sessionId: string, files: unknown[]) => ({
      userId: 42,
      agentId,
      sessionId,
      title: 'Session Title',
      createdAt: 1,
      updatedAt: 2,
      messageCount: 0,
      preview: '',
      activePrimaryAgent: 'build',
      planState: null,
      workspaceFiles: files
    }))
  }
  const modelProvider = {
    resolve: vi.fn(() => null),
    getRuntime: vi.fn(() => null)
  }

  const app = express()
  app.use(express.json())
  app.use(requireSameOrigin)
  app.use('/agent/api/agent', createAgentRouter(service as any, modelProvider))

  return {
    app: app as ExpressApp,
    service
  }
}

describe('agent auth routes', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('allows same-origin-proxied POST requests and looks up the current user via auth service', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            userId: 42
          }
        }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { app, service } = createApp()
    const body = JSON.stringify({
      agentId: 'workspace-agent',
      title: 'Session Title'
    })

    const response = await dispatchRequest(app, 'POST', '/agent/api/agent/sessions', body, {
      'content-type': JSON_CONTENT_TYPE,
      'content-length': String(Buffer.byteLength(body)),
      origin: 'http://localhost:5175',
      cookie: 'mml_session=session-1'
    })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      ok: true,
      session: {
        sessionId: 'session-1',
        userId: 42,
        agentId: 'workspace-agent',
        title: 'Session Title'
      }
    })
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3200/web/api/auth/me', {
      headers: {
        Cookie: 'mml_session=session-1'
      }
    })
    expect(service.createSession).toHaveBeenCalledWith(42, 'workspace-agent', 'Session Title')
  })

  it('rejects cross-origin state-changing requests before auth lookup', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { app, service } = createApp()
    const body = JSON.stringify({
      agentId: 'workspace-agent',
      title: 'Blocked Session'
    })

    const response = await dispatchRequest(app, 'POST', '/agent/api/agent/sessions', body, {
      'content-type': JSON_CONTENT_TYPE,
      'content-length': String(Buffer.byteLength(body)),
      origin: 'https://evil.example',
      cookie: 'mml_session=session-1'
    })

    expect(response.status).toBe(403)
    expect(response.body).toEqual({
      error: 'Cross-origin state-changing requests are not allowed'
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(service.createSession).not.toHaveBeenCalled()
  })

  it('allows deleting a session after confirmed same-origin auth flow', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            userId: 42
          }
        }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { app, service } = createApp()
    const response = await dispatchRequest(
      app,
      'DELETE',
      '/agent/api/agent/sessions/session-1?agentId=workspace-agent',
      '',
      {
        origin: 'http://localhost:5175',
        cookie: 'mml_session=session-1'
      }
    )

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      ok: true,
      sessionId: 'session-1'
    })
    expect(service.deleteSession).toHaveBeenCalledWith(42, 'workspace-agent', 'session-1')
  })

  it('allows deleting a running session without returning an occupancy conflict', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            userId: 42
          }
        }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { app, service } = createApp()
    service.assertSessionMutationAllowed.mockRejectedValueOnce(new Error('should not be called'))

    const response = await dispatchRequest(
      app,
      'DELETE',
      '/agent/api/agent/sessions/session-running?agentId=workspace-agent',
      '',
      {
        origin: 'http://localhost:5175',
        cookie: 'mml_session=session-1'
      }
    )

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      ok: true,
      sessionId: 'session-running'
    })
    expect(service.assertSessionMutationAllowed).not.toHaveBeenCalled()
    expect(service.deleteSession).toHaveBeenCalledWith(42, 'workspace-agent', 'session-running')
  })

  it('allows deleting an awaiting-question session without returning an occupancy conflict', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            userId: 42
          }
        }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { app, service } = createApp()
    service.assertSessionMutationAllowed.mockRejectedValueOnce(new Error('should not be called'))

    const response = await dispatchRequest(
      app,
      'DELETE',
      '/agent/api/agent/sessions/session-awaiting?agentId=workspace-agent',
      '',
      {
        origin: 'http://localhost:5175',
        cookie: 'mml_session=session-1'
      }
    )

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      ok: true,
      sessionId: 'session-awaiting'
    })
    expect(service.assertSessionMutationAllowed).not.toHaveBeenCalled()
    expect(service.deleteSession).toHaveBeenCalledWith(42, 'workspace-agent', 'session-awaiting')
  })

  it('allows clearing session history while preserving the excluded current session', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            userId: 42
          }
        }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { app, service } = createApp()
    const body = JSON.stringify({
      agentId: 'workspace-agent',
      excludedSessionId: 'session-current'
    })
    const response = await dispatchRequest(
      app,
      'POST',
      '/agent/api/agent/sessions/history/clear',
      body,
      {
        'content-type': JSON_CONTENT_TYPE,
        'content-length': String(Buffer.byteLength(body)),
        origin: 'http://localhost:5175',
        cookie: 'mml_session=session-1'
      }
    )

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      ok: true,
      deletedCount: 3,
      excludedSessionId: 'session-current',
      skippedActiveSessionIds: []
    })
    expect(service.clearHistorySessions).toHaveBeenCalledWith(42, 'workspace-agent', 'session-current')
  })

  it('returns workspace metadata for a session', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            userId: 42
          }
        }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { app, service } = createApp()
    const response = await dispatchRequest(
      app,
      'GET',
      '/agent/api/agent/sessions/session-1/workspace?agentId=workspace-agent',
      '',
      {
        cookie: 'mml_session=session-1'
      }
    )

    expect(response.status).toBe(200)
    expect(response.body.ok).toBe(true)
    expect(response.body.workspace.agentId).toBe('workspace-agent')
    expect(response.body.workspace.tasks[0]?.groups[0]).toMatchObject({
      id: 'upload',
      label: 'upload'
    })
    expect(response.body.workspace.tasks[0]?.groups[0]?.entries[0]).toMatchObject({
      fileKey: 'file-1',
      fileName: 'input.csv',
      source: 'upload',
      groupId: 'upload',
      addedAt: 123
    })
    expect(response.body.workspace.tasks[0]?.groups[1]).toMatchObject({
      id: 'project',
      label: 'project'
    })
    expect(service.getSessionMeta).toHaveBeenCalledWith(42, 'workspace-agent', 'session-1')
    expect(service.getWorkspaceFiles).toHaveBeenCalledWith(42, 'workspace-agent', 'session-1')
  })

  it('replaces workspace metadata for a session', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            userId: 42
          }
        }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { app, service } = createApp()
    const body = JSON.stringify({
      agentId: 'workspace-agent',
      workspaceFiles: [
        {
          nodeId: 'file-1',
          fileId: 'file-1',
          fileKey: 'file-1',
          path: 'upload/input.csv',
          fileName: 'input.csv',
          relativePath: 'input.csv',
          nodeType: 'file',
          source: 'upload',
          groupId: 'upload',
          writable: true,
          addedAt: 123
        },
        {
          nodeId: 'file-2',
          fileId: 'file-2',
          fileKey: 'file-2',
          path: 'project/output.mml',
          fileName: 'output.mml',
          relativePath: 'output.mml',
          nodeType: 'file',
          source: 'project',
          groupId: 'project',
          writable: true,
          addedAt: 456
        }
      ]
    })

    service.getWorkspaceFiles.mockResolvedValueOnce([
      {
        nodeId: 'file-1',
        fileId: 'file-1',
        fileKey: 'file-1',
        path: 'upload/input.csv',
        fileName: 'input.csv',
        relativePath: 'input.csv',
        nodeType: 'file',
        source: 'upload',
        groupId: 'upload',
        writable: true,
        addedAt: 123
      },
      {
        nodeId: 'file-2',
        fileId: 'file-2',
        fileKey: 'file-2',
        path: 'project/output.mml',
        fileName: 'output.mml',
        relativePath: 'output.mml',
        nodeType: 'file',
        source: 'project',
        groupId: 'project',
        writable: true,
        addedAt: 456
      }
    ])

    const response = await dispatchRequest(
      app,
      'PATCH',
      '/agent/api/agent/sessions/session-1/workspace',
      body,
      {
        'content-type': JSON_CONTENT_TYPE,
        'content-length': String(Buffer.byteLength(body)),
        origin: 'http://localhost:5175',
        cookie: 'mml_session=session-1'
      }
    )

    expect(response.status).toBe(200)
    expect(response.body.workspace.tasks[0]?.groups[0]?.entries[0]).toMatchObject({
      fileId: 'file-1',
      fileName: 'input.csv'
    })
    expect(response.body.workspace.tasks[0]?.groups[1]?.entries[0]).toMatchObject({
      fileId: 'file-2',
      fileName: 'output.mml'
    })
    expect(service.replaceWorkspaceFiles).not.toHaveBeenCalled()
  })

  it('returns agent-scoped workspace metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            userId: 42
          }
        }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { app, service } = createApp()
    const response = await dispatchRequest(
      app,
      'GET',
      '/agent/api/agent/workspace?agentId=workspace-agent',
      '',
      {
        cookie: 'mml_session=session-1'
      }
    )

    expect(response.status).toBe(200)
    expect(response.body.workspace.agentId).toBe('workspace-agent')
    expect(response.body.workspace.tasks[0]?.label).toBe('工作目录')
    expect(service.listWorkspaceFiles).toHaveBeenCalledWith(42, 'workspace-agent')
  })

  it('forwards the active workspace file path during run requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            userId: 42
          }
        }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { app, service } = createApp()
    const body = JSON.stringify({
      agentId: 'workspace-agent',
      sessionId: 'session-1',
      input: '继续处理',
      invocationContext: {
        activeFile: {
          path: 'uploads/current.mml',
          fileName: 'current.mml',
          source: 'upload',
          writable: false
        }
      }
    })

    const response = await dispatchRequest(
      app,
      'POST',
      '/agent/api/agent/run',
      body,
      {
        'content-type': JSON_CONTENT_TYPE,
        'content-length': String(Buffer.byteLength(body)),
        origin: 'http://localhost:5175',
        cookie: 'mml_session=session-1'
      }
    )

    expect(response.status).toBe(200)
    expect(service.executeRun).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        invocationContext: {
          activeFile: {
            path: 'uploads/current.mml',
            fileName: 'current.mml',
            source: 'upload',
            writable: false
          }
        }
      }),
      expect.any(Function)
    )
  })

  it('cancels only the addressed active run through the run-scoped endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            userId: 42
          }
        }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { app, service } = createApp()
    const response = await dispatchRequest(
      app,
      'POST',
      '/agent/api/agent/runs/run-1/cancel',
      '',
      {
        origin: 'http://localhost:5175',
        cookie: 'mml_session=session-1'
      }
    )

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      ok: true,
      runId: 'run-1',
      cancelled: true
    })
    expect(service.cancelRun).toHaveBeenCalledWith('run-1')
  })

  it('returns an acknowledged no-op when the addressed run is no longer active', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            userId: 42
          }
        }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { app, service } = createApp()
    service.cancelRun.mockReturnValueOnce(false)
    const response = await dispatchRequest(
      app,
      'POST',
      '/agent/api/agent/runs/run-finished/cancel',
      '',
      {
        origin: 'http://localhost:5175',
        cookie: 'mml_session=session-1'
      }
    )

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      ok: true,
      runId: 'run-finished',
      cancelled: false
    })
    expect(service.cancelRun).toHaveBeenCalledWith('run-finished')
  })

  it('rejects ordinary /agent/run input when the session still has a pending interaction', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            userId: 42
          }
        }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { app, service } = createApp()
    service.listInteractions.mockResolvedValueOnce([{
      interactionId: 'interaction-1',
      status: 'pending'
    }])
    const body = JSON.stringify({
      agentId: 'workspace-agent',
      sessionId: 'session-1',
      input: '继续处理'
    })

    const response = await dispatchRequest(
      app,
      'POST',
      '/agent/api/agent/run',
      body,
      {
        'content-type': JSON_CONTENT_TYPE,
        'content-length': String(Buffer.byteLength(body)),
        origin: 'http://localhost:5175',
        cookie: 'mml_session=session-1'
      }
    )

    expect(response.status).toBe(409)
    expect(response.body).toEqual({
      error: '当前会话有待回答的问题，请先提交或拒绝该问题后再继续。',
      code: 'PENDING_INTERACTION_BLOCKED'
    })
    expect(service.executeRun).not.toHaveBeenCalled()
  })

  it('rejects a second concurrent run for the same session', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            userId: 42
          }
        }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { app, service } = createApp()
    service.assertWorkspaceRunAllowed.mockImplementationOnce(() => {
      throw Object.assign(new Error('当前会话还在处理中，请等它结束后再发送。'), {
        code: 'WORKSPACE_OCCUPIED',
        occupancy: {
          occupied: true,
          state: 'running',
          ownerSessionId: 'session-2',
          runId: 'run-current'
        }
      })
    })
    const body = JSON.stringify({
      agentId: 'workspace-agent',
      sessionId: 'session-2',
      input: '继续处理'
    })

    const response = await dispatchRequest(
      app,
      'POST',
      '/agent/api/agent/run',
      body,
      {
        'content-type': JSON_CONTENT_TYPE,
        'content-length': String(Buffer.byteLength(body)),
        origin: 'http://localhost:5175',
        cookie: 'mml_session=session-1'
      }
    )

    expect(response.status).toBe(409)
    expect(response.body).toEqual({
      error: '当前会话还在处理中，请等它结束后再发送。',
      code: 'WORKSPACE_OCCUPIED',
      occupancy: {
        occupied: true,
        state: 'running',
        ownerSessionId: 'session-2',
        runId: 'run-current'
      }
    })
    expect(service.executeRun).not.toHaveBeenCalled()
  })

  it('allows deleting an active session even if an old occupancy check would have failed', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            userId: 42
          }
        }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { app, service } = createApp()
    service.assertSessionMutationAllowed.mockRejectedValueOnce(Object.assign(
      new Error('当前会话仍在处理中，暂时不能删除。'),
      {
        code: 'WORKSPACE_OCCUPIED',
        occupancy: {
          occupied: true,
          state: 'awaiting-question',
          ownerSessionId: 'session-owner',
          runId: null
        }
      }
    ))

    const response = await dispatchRequest(
      app,
      'DELETE',
      '/agent/api/agent/sessions/session-1?agentId=workspace-agent',
      '',
      {
        origin: 'http://localhost:5175',
        cookie: 'mml_session=session-1'
      }
    )

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      ok: true,
      sessionId: 'session-1'
    })
    expect(service.assertSessionMutationAllowed).not.toHaveBeenCalled()
    expect(service.deleteSession).toHaveBeenCalledWith(42, 'workspace-agent', 'session-1')
  })

  it('returns skipped active session ids when bulk-clear preserves active sessions', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            userId: 42
          }
        }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { app, service } = createApp()
    service.clearHistorySessions.mockResolvedValueOnce({
      deletedCount: 2,
      excludedSessionId: 'session-current',
      skippedActiveSessionIds: ['session-owner']
    })
    const body = JSON.stringify({
      agentId: 'workspace-agent',
      excludedSessionId: 'session-current'
    })

    const response = await dispatchRequest(
      app,
      'POST',
      '/agent/api/agent/sessions/history/clear',
      body,
      {
        'content-type': JSON_CONTENT_TYPE,
        'content-length': String(Buffer.byteLength(body)),
        origin: 'http://localhost:5175',
        cookie: 'mml_session=session-1'
      }
    )

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      ok: true,
      deletedCount: 2,
      excludedSessionId: 'session-current',
      skippedActiveSessionIds: ['session-owner']
    })
    expect(service.clearHistorySessions).toHaveBeenCalledWith(42, 'workspace-agent', 'session-current')
  })
})
