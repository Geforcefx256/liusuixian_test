import cors from 'cors'
import express, { type Application } from 'express'
import { IncomingMessage, ServerResponse, type OutgoingHttpHeaders } from 'node:http'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/auth/authConfig.js', () => ({
  authEndpoints: {
    currentUser: () => 'http://localhost:3200/web/api/auth/me'
  }
}))

import { fileStore, type WorkspaceScope } from '../src/files/fileStore.js'
import { agentBackendCorsOptions } from '../src/http/cors.js'
import { createFilesRouter } from '../src/routes/files.js'

const LOCALHOST = '127.0.0.1'

type TestResponse = {
  status: number
  headers: OutgoingHttpHeaders
}

type ExpressApp = Application & {
  handle: (req: IncomingMessage, res: ServerResponse) => void
}

function buildResponse(response: ServerResponse): TestResponse {
  return {
    status: response.statusCode,
    headers: response.getHeaders()
  }
}

function dispatchRequest(
  app: ExpressApp,
  method: string,
  path: string,
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
    response.on('finish', () => resolve(buildResponse(response)))
    response.on('error', reject)

    app.handle(request, response)
    process.nextTick(() => request.emit('end'))
  })
}

function createApp(): ExpressApp {
  const app = express()
  app.use(cors(agentBackendCorsOptions))
  app.use('/api/files', createFilesRouter())
  return app as ExpressApp
}

function createScope(): WorkspaceScope {
  return {
    userId: 42,
    agentId: `workspace-agent-${randomUUID()}`
  }
}

describe('agent backend CORS headers', () => {
  let scopes: WorkspaceScope[] = []

  beforeEach(async () => {
    scopes = []
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            userId: 42
          }
        }
      })
    }))
    await fileStore.initialize()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await Promise.all(scopes.map(scope => rm(fileStore.getWorkspaceRoot(scope), {
      recursive: true,
      force: true
    })))
  })

  it('exposes Content-Disposition for cross-origin workspace downloads', async () => {
    const app = createApp()
    const scope = createScope()
    scopes.push(scope)

    const registration = await fileStore.registerProjectPath('reports/result.csv', scope)
    const outputPath = fileStore.getProjectEntryPath(registration.entry)
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, 'name,value\nalpha,1\n', 'utf8')

    const response = await dispatchRequest(
      app,
      'GET',
      `/api/files/${registration.entry.fileKey}/download?agentId=${scope.agentId}`,
      {
        origin: 'http://localhost:5175',
        cookie: 'mml_session=session-1'
      }
    )

    expect(response.status).toBe(200)
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5175')
    expect(response.headers['access-control-expose-headers']).toBe('Content-Disposition')
    expect(response.headers['content-disposition']).toContain('filename=')
  })
})
