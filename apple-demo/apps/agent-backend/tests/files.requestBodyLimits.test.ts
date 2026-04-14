import express, { type Application } from 'express'
import { IncomingMessage, ServerResponse, type OutgoingHttpHeaders } from 'node:http'
import { rm } from 'node:fs/promises'
import { PassThrough } from 'node:stream'
import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/auth/authConfig.js', () => ({
  authEndpoints: {
    currentUser: () => 'http://localhost:3200/web/api/auth/me'
  }
}))

import { createFilesRouter } from '../src/routes/files.js'
import { createDefaultJsonParser, createFileSaveJsonParser } from '../src/http/requestBodyParsers.js'
import { fileStore, type WorkspaceScope } from '../src/files/fileStore.js'

const JSON_CONTENT_TYPE = 'application/json'
const LOCALHOST = '127.0.0.1'
const MULTIPART_BOUNDARY = '----codex-agent-backend-test-boundary'

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
  return splitIndex === -1 ? rawText : rawText.slice(splitIndex + separator.length)
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

function createMultipartBody(fileName: string, content: string): Buffer {
  const payload =
    `--${MULTIPART_BOUNDARY}\r\n`
    + `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`
    + 'Content-Type: text/plain\r\n\r\n'
    + `${content}\r\n`
    + `--${MULTIPART_BOUNDARY}--\r\n`
  return Buffer.from(payload, 'utf8')
}

function createScope(): WorkspaceScope {
  return {
    userId: 42,
    agentId: `workspace-agent-${randomUUID()}`
  }
}

async function uploadWorkspaceFile(
  app: ExpressApp,
  scope: WorkspaceScope,
  fileName: string,
  content: string
): Promise<TestResponse> {
  const body = createMultipartBody(fileName, content)
  return dispatchRequest(app, 'POST', `/api/files/upload?agentId=${scope.agentId}`, body, {
    'content-type': `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
    'content-length': String(body.byteLength),
    cookie: 'mml_session=session-1'
  })
}

function createApp(): ExpressApp {
  const app = express()
  const limits = {
    defaultJson: '2mb',
    fileSaveJson: '50mb'
  }
  app.put('/api/files/:fileKey', createFileSaveJsonParser(limits))
  app.use(createDefaultJsonParser(limits))
  app.use('/api/files', createFilesRouter())
  app.use((error: Error & { status?: number; statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = typeof error.status === 'number'
      ? error.status
      : typeof error.statusCode === 'number'
        ? error.statusCode
        : 500
    res.status(status).json({ error: error.message })
  })
  return app as ExpressApp
}

describe('file route request body limits', () => {
  const scopes: WorkspaceScope[] = []

  beforeEach(async () => {
    scopes.length = 0
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

  it('allows large workspace file saves above the default json parser limit', async () => {
    const app = createApp()
    const scope = createScope()
    scopes.push(scope)
    const upload = await uploadWorkspaceFile(app, scope, 'notes.md', '# Notes\n')
    const content = 'A'.repeat(3 * 1024 * 1024)
    const body = JSON.stringify({
      content,
      mode: 'markdown'
    })

    const response = await dispatchRequest(app, 'PUT', `/api/files/${upload.body.fileKey}`, body, {
      'content-type': JSON_CONTENT_TYPE,
      'content-length': String(Buffer.byteLength(body)),
      cookie: 'mml_session=session-1'
    })

    expect(response.status).toBe(200)
    expect(response.body.file).toMatchObject({
      fileKey: upload.body.fileKey,
      content
    })
  })

  it('keeps the default json limit on non-save file routes', async () => {
    const app = createApp()
    const scope = createScope()
    scopes.push(scope)
    const largeFileName = `notes-${'x'.repeat(3 * 1024 * 1024)}`
    const body = JSON.stringify({
      kind: 'folder',
      fileName: largeFileName
    })

    const response = await dispatchRequest(app, 'POST', `/api/files/project?agentId=${scope.agentId}`, body, {
      'content-type': JSON_CONTENT_TYPE,
      'content-length': String(Buffer.byteLength(body)),
      cookie: 'mml_session=session-1'
    })

    expect(response.status).toBe(413)
  })
})
