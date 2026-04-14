import express, { type Application } from 'express'
import { IncomingMessage, ServerResponse, type OutgoingHttpHeaders } from 'node:http'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { PassThrough } from 'node:stream'
import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/auth/authConfig.js', () => ({
  authEndpoints: {
    currentUser: () => 'http://localhost:3200/web/api/auth/me'
  }
}))

import { createAgentRouter } from '../src/routes/agent.js'
import { createFilesRouter } from '../src/routes/files.js'
import { fileStore, type FileMapEntry, type WorkspaceScope } from '../src/files/fileStore.js'

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

function createMultipartBody(fileName: string, content: string): Buffer {
  const payload =
    `--${MULTIPART_BOUNDARY}\r\n`
    + `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`
    + 'Content-Type: text/plain\r\n\r\n'
    + `${content}\r\n`
    + `--${MULTIPART_BOUNDARY}--\r\n`
  return Buffer.from(payload, 'utf8')
}

function createWorkspaceListService() {
  return {
    listWorkspaceFiles: vi.fn((userId: number, agentId: string) => fileStore.listWorkspaceEntries({ userId, agentId }).map(entry => ({
      nodeId: entry.fileKey,
      fileId: entry.fileId,
      fileKey: entry.fileKey,
      relativePath: entry.relativePath || entry.originalName,
      path: fileStore.getWorkspaceRelativePath(entry),
      fileName: entry.originalName,
      nodeType: entry.kind === 'folder' ? 'folder' : 'file',
      source: entry.kind,
      groupId: entry.kind === 'project' ? 'project' : 'upload',
      writable: entry.kind !== 'folder',
      addedAt: entry.createdAt
    })))
  }
}

function createApp(options: {
  agentService?: ReturnType<typeof createWorkspaceListService>
} = {}): ExpressApp {
  const app = express()
  app.use(express.json())
  app.use('/api/files', createFilesRouter())
  if (options.agentService) {
    app.use('/api/agent', createAgentRouter(options.agentService as any))
  }
  return app as ExpressApp
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
  content: string,
  overwrite = false
): Promise<TestResponse> {
  const body = createMultipartBody(fileName, content)
  const suffix = overwrite ? '&overwrite=true' : ''
  return dispatchRequest(app, 'POST', `/api/files/upload?agentId=${scope.agentId}${suffix}`, body, {
    'content-type': `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
    'content-length': String(body.byteLength),
    cookie: 'mml_session=session-1'
  })
}

async function renameWorkspaceFile(
  app: ExpressApp,
  scope: WorkspaceScope,
  fileKey: string,
  fileName: string
): Promise<TestResponse> {
  const body = JSON.stringify({ fileName })
  return dispatchRequest(app, 'PATCH', `/api/files/${fileKey}/rename?agentId=${scope.agentId}`, body, {
    'content-type': JSON_CONTENT_TYPE,
    'content-length': String(Buffer.byteLength(body)),
    cookie: 'mml_session=session-1'
  })
}

describe('files routes', () => {
  let scopes: WorkspaceScope[] = []
  let uploadedPath = ''

  beforeEach(async () => {
    scopes = []
    uploadedPath = ''
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

  it('uploads files under upload/ with original names and writable metadata', async () => {
    const app = createApp()
    const scope = createScope()
    scopes.push(scope)

    const response = await uploadWorkspaceFile(app, scope, 'sample.csv', 'name\nalpha\n')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      originalName: 'sample.csv',
      path: 'upload/sample.csv',
      source: 'upload',
      writable: true,
      replaced: false
    })

    const entry = fileStore.resolveFileKey(response.body.fileKey)
    expect(entry).toMatchObject({
      originalName: 'sample.csv',
      kind: 'upload',
      relativePath: 'sample.csv',
      scope
    })
    if (!entry) {
      throw new Error('expected uploaded entry')
    }
    expect(await readFile(fileStore.getUploadEntryPath(entry), 'utf8')).toBe('name\nalpha\n')
  })

  it('rejects uploads outside the TXT MD CSV allowlist explicitly', async () => {
    const app = createApp()
    const scope = createScope()
    scopes.push(scope)

    const response = await uploadWorkspaceFile(app, scope, 'bad.json', '{"ok":true}')

    expect(response.status).toBe(400)
    expect(response.body).toEqual({
      error: 'Only TXT/MD/CSV files are allowed'
    })
  })

  it('removes the legacy blank-file creation route from the files router', () => {
    const router = createFilesRouter() as unknown as {
      stack?: Array<{ route?: { path?: string; methods?: Record<string, boolean> } }>
    }

    const hasCreateRoute = (router.stack || []).some(layer => {
      return layer.route?.path === '/' && layer.route.methods?.post
    })

    expect(hasCreateRoute).toBe(false)
  })

  it('preserves UTF-8 upload filenames across upload response, workspace metadata, and reopen flows', async () => {
    const agentService = createWorkspaceListService()
    const app = createApp({ agentService })
    const scope = createScope()
    scopes.push(scope)

    const upload = await uploadWorkspaceFile(app, scope, '中文资料.csv', 'name,value\nalpha,1\n')

    expect(upload.status).toBe(200)
    expect(upload.body).toMatchObject({
      originalName: '中文资料.csv',
      path: 'upload/中文资料.csv',
      source: 'upload',
      writable: true
    })

    const entry = fileStore.resolveFileKey(upload.body.fileKey)
    expect(entry).toMatchObject({
      originalName: '中文资料.csv',
      relativePath: '中文资料.csv',
      scope
    })

    const workspaceResponse = await dispatchRequest(
      app,
      'GET',
      `/api/agent/workspace?agentId=${scope.agentId}`,
      '',
      { cookie: 'mml_session=session-1' }
    )

    expect(workspaceResponse.status).toBe(200)
    expect(agentService.listWorkspaceFiles).toHaveBeenCalledWith(42, scope.agentId)
    expect(workspaceResponse.body.workspace.tasks[0]?.groups[0]?.entries[0]).toMatchObject({
      fileKey: upload.body.fileKey,
      fileId: expect.any(String),
      fileName: '中文资料.csv',
      path: 'upload/中文资料.csv',
      source: 'upload',
      writable: true
    })

    const openResponse = await dispatchRequest(app, 'GET', `/api/files/${upload.body.fileKey}`, '', {
      cookie: 'mml_session=session-1'
    })

    expect(openResponse.status).toBe(200)
    expect(openResponse.body.file).toMatchObject({
      fileKey: upload.body.fileKey,
      fileName: '中文资料.csv',
      path: 'upload/中文资料.csv',
      source: 'upload',
      writable: true,
      mode: 'csv',
      content: 'name,value\nalpha,1\n'
    })
  })

  it('returns upload conflict errors until overwrite is explicitly confirmed', async () => {
    const app = createApp()
    const scope = createScope()
    scopes.push(scope)

    const first = await uploadWorkspaceFile(app, scope, 'notes.md', '# First\n')
    const conflict = await uploadWorkspaceFile(app, scope, 'notes.md', '# Second\n')
    const replaced = await uploadWorkspaceFile(app, scope, 'notes.md', '# Second\n', true)

    expect(first.status).toBe(200)
    expect(conflict.status).toBe(409)
    expect(conflict.body).toEqual({
      error: 'Upload already exists: upload/notes.md',
      code: 'UPLOAD_CONFLICT',
      path: 'upload/notes.md'
    })
    expect(replaced.status).toBe(200)
    expect(replaced.body.replaced).toBe(true)

    const entry = fileStore.resolveFileKey(replaced.body.fileKey)
    if (!entry) {
      throw new Error('expected replaced upload entry')
    }
    expect(await readFile(fileStore.getUploadEntryPath(entry), 'utf8')).toBe('# Second\n')
  })

  it('opens uploaded MML-like text files as writable workspace files', async () => {
    const app = createApp()
    const scope = createScope()
    scopes.push(scope)

    const upload = await uploadWorkspaceFile(
      app,
      scope,
      'site.txt',
      '/* ME TYPE=UNC, Version=20.11.2 */\nADD TEST:NAME="A";\n'
    )
    const response = await dispatchRequest(app, 'GET', `/api/files/${upload.body.fileKey}`, '', {
      cookie: 'mml_session=session-1'
    })

    expect(response.status).toBe(200)
    expect(response.body.file).toMatchObject({
      fileKey: upload.body.fileKey,
      fileName: 'site.txt',
      path: 'upload/site.txt',
      source: 'upload',
      writable: true,
      mode: 'mml',
      mmlMetadata: {
        networkType: 'UNC',
        networkVersion: '20.11.2'
      }
    })
  })

  it('saves uploaded files in place', async () => {
    const app = createApp()
    const scope = createScope()
    scopes.push(scope)

    const upload = await uploadWorkspaceFile(app, scope, 'notes.md', '# Notes\n')
    const body = JSON.stringify({
      content: '# Updated\n',
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
      path: 'upload/notes.md',
      source: 'upload',
      writable: true,
      content: '# Updated\n'
    })
  })

  it('opens and saves path-addressed outputs in place', async () => {
    const app = createApp()
    const scope = createScope()
    scopes.push(scope)
    const registration = await fileStore.registerProjectPath('reports/final/result.csv', scope)
    const outputPath = fileStore.getProjectEntryPath(registration.entry)
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, 'name,value\nalpha,1\n', 'utf8')

    const openResponse = await dispatchRequest(app, 'GET', `/api/files/${registration.entry.fileKey}`, '', {
      cookie: 'mml_session=session-1'
    })
    expect(openResponse.status).toBe(200)
    expect(openResponse.body.file).toMatchObject({
      fileName: 'reports/final/result.csv',
      path: 'project/reports/final/result.csv',
      source: 'project',
      writable: true,
      mode: 'csv'
    })

    const body = JSON.stringify({
      content: 'name,value\nbeta,2\n',
      mode: 'csv'
    })
    const saveResponse = await dispatchRequest(app, 'PUT', `/api/files/${registration.entry.fileKey}`, body, {
      'content-type': JSON_CONTENT_TYPE,
      'content-length': String(Buffer.byteLength(body)),
      cookie: 'mml_session=session-1'
    })

    expect(saveResponse.status).toBe(200)
    expect(saveResponse.body.file.content).toBe('name,value\nbeta,2\n')
    expect(await readFile(outputPath, 'utf8')).toBe('name,value\nbeta,2\n')
  })

  it('renames uploaded workspace files and updates later metadata and open flows', async () => {
    const agentService = createWorkspaceListService()
    const app = createApp({ agentService })
    const scope = createScope()
    scopes.push(scope)
    const upload = await uploadWorkspaceFile(app, scope, 'source.csv', 'name,value\nalpha,1\n')

    const renameResponse = await renameWorkspaceFile(app, scope, upload.body.fileKey, 'renamed.csv')
    const workspaceResponse = await dispatchRequest(
      app,
      'GET',
      `/api/agent/workspace?agentId=${scope.agentId}`,
      '',
      { cookie: 'mml_session=session-1' }
    )
    const openResponse = await dispatchRequest(app, 'GET', `/api/files/${upload.body.fileKey}`, '', {
      cookie: 'mml_session=session-1'
    })

    expect(renameResponse.status).toBe(200)
    expect(renameResponse.body.file).toMatchObject({
      fileKey: upload.body.fileKey,
      fileName: 'renamed.csv',
      path: 'upload/renamed.csv',
      source: 'upload',
      writable: true
    })
    expect(workspaceResponse.body.workspace.tasks[0]?.groups[0]?.entries[0]).toMatchObject({
      fileKey: upload.body.fileKey,
      fileName: 'renamed.csv',
      path: 'upload/renamed.csv'
    })
    expect(openResponse.body.file).toMatchObject({
      fileKey: upload.body.fileKey,
      fileName: 'renamed.csv',
      path: 'upload/renamed.csv',
      content: 'name,value\nalpha,1\n'
    })
  })

  it('renames path-addressed outputs in place while preserving the parent directory', async () => {
    const app = createApp()
    const scope = createScope()
    scopes.push(scope)
    const registration = await fileStore.registerProjectPath('reports/final/result.csv', scope)
    const originalPath = fileStore.getProjectEntryPath(registration.entry)
    await mkdir(dirname(originalPath), { recursive: true })
    await writeFile(originalPath, 'name,value\nalpha,1\n', 'utf8')

    const renameResponse = await renameWorkspaceFile(app, scope, registration.entry.fileKey, 'summary.csv')
    const renamedEntry = fileStore.resolveFileKey(registration.entry.fileKey)

    expect(renameResponse.status).toBe(200)
    expect(renameResponse.body.file).toMatchObject({
      fileKey: registration.entry.fileKey,
      fileName: 'reports/final/summary.csv',
      path: 'project/reports/final/summary.csv',
      writable: true
    })
    expect(renamedEntry).toMatchObject({
      fileKey: registration.entry.fileKey,
      fileId: registration.entry.fileId,
      createdAt: registration.entry.createdAt,
      relativePath: 'reports/final/summary.csv'
    })
    expect(await readFile(fileStore.getProjectEntryPath(renamedEntry as FileMapEntry), 'utf8')).toBe('name,value\nalpha,1\n')
    await expect(readFile(originalPath, 'utf8')).rejects.toThrow()
  })

  it('rejects rename requests outside the current user-agent scope', async () => {
    const app = createApp()
    const sourceScope = createScope()
    const foreignScope = createScope()
    scopes.push(sourceScope, foreignScope)
    const upload = await uploadWorkspaceFile(app, sourceScope, 'scoped.csv', 'name,value\nalpha,1\n')

    const renameResponse = await renameWorkspaceFile(app, foreignScope, upload.body.fileKey, 'renamed.csv')

    expect(renameResponse.status).toBe(404)
    expect(renameResponse.body).toEqual({ error: 'File not found' })
    expect(fileStore.resolveFileKey(upload.body.fileKey)).toMatchObject({
      originalName: 'scoped.csv',
      scope: sourceScope
    })
  })

  it('rejects rename requests outside the v1 boundary and surfaces collisions explicitly', async () => {
    const app = createApp()
    const scope = createScope()
    scopes.push(scope)
    const upload = await uploadWorkspaceFile(app, scope, 'source.csv', 'name,value\nalpha,1\n')
    await uploadWorkspaceFile(app, scope, 'existing.csv', 'name,value\nbeta,2\n')
    const legacyOutput = await fileStore.registerProject(`legacy-${randomUUID()}`, scope)
    ;(fileStore as unknown as { setEntry: (entry: FileMapEntry) => void }).setEntry({
      ...legacyOutput,
      relativePath: undefined
    })

    const nestedResponse = await renameWorkspaceFile(app, scope, upload.body.fileKey, 'nested/source.csv')
    const extensionResponse = await renameWorkspaceFile(app, scope, upload.body.fileKey, 'source.txt')
    const caseOnlyResponse = await renameWorkspaceFile(app, scope, upload.body.fileKey, 'SOURCE.csv')
    const collisionResponse = await renameWorkspaceFile(app, scope, upload.body.fileKey, 'existing.csv')
    const legacyResponse = await renameWorkspaceFile(app, scope, legacyOutput.fileKey, 'legacy.json')

    expect(nestedResponse.status).toBe(400)
    expect(nestedResponse.body).toEqual({ error: 'Workspace file rename only supports basename changes' })
    expect(extensionResponse.status).toBe(400)
    expect(extensionResponse.body).toEqual({ error: 'Workspace rename must keep the existing extension' })
    expect(caseOnlyResponse.status).toBe(400)
    expect(caseOnlyResponse.body).toEqual({ error: 'Workspace file rename does not support case-only changes' })
    expect(collisionResponse.status).toBe(409)
    expect(collisionResponse.body).toEqual({
      error: 'Workspace rename target already exists: upload/existing.csv',
      code: 'WORKSPACE_RENAME_CONFLICT',
      path: 'upload/existing.csv'
    })
    expect(legacyResponse.status).toBe(400)
    expect(legacyResponse.body).toEqual({ error: 'Legacy project files do not support rename' })
  })

  it('rolls rename back when metadata persistence fails', async () => {
    const app = createApp()
    const scope = createScope()
    scopes.push(scope)
    const registration = await fileStore.registerProjectPath('reports/final/result.csv', scope)
    const originalPath = fileStore.getProjectEntryPath(registration.entry)
    await mkdir(dirname(originalPath), { recursive: true })
    await writeFile(originalPath, 'name,value\nalpha,1\n', 'utf8')
    vi.spyOn(
      fileStore as unknown as { persistScope: (scope: WorkspaceScope) => Promise<void> },
      'persistScope'
    ).mockRejectedValueOnce(new Error('persist exploded'))

    const renameResponse = await renameWorkspaceFile(app, scope, registration.entry.fileKey, 'summary.csv')

    expect(renameResponse.status).toBe(500)
    expect(renameResponse.body).toEqual({ error: 'persist exploded' })
    expect(fileStore.resolveFileKey(registration.entry.fileKey)).toMatchObject({
      relativePath: 'reports/final/result.csv'
    })
    expect(await readFile(originalPath, 'utf8')).toBe('name,value\nalpha,1\n')
    await expect(readFile(fileStore.getProjectDir(scope) + '/reports/final/summary.csv', 'utf8')).rejects.toThrow()
  })

  it('downloads tracked workspace files in scope as attachment responses', async () => {
    const app = createApp()
    const scope = createScope()
    scopes.push(scope)

    const upload = await uploadWorkspaceFile(app, scope, '中文资料.csv', 'name,value\nalpha,1\n')
    const response = await dispatchRequest(
      app,
      'GET',
      `/api/files/${upload.body.fileKey}/download?agentId=${scope.agentId}`,
      '',
      { cookie: 'mml_session=session-1' }
    )

    expect(response.status).toBe(200)
    expect(response.text).toBe('name,value\nalpha,1\n')
    expect(response.headers['content-disposition']).toContain("filename*=UTF-8''%E4%B8%AD%E6%96%87%E8%B5%84%E6%96%99.csv")
  })

  it('rejects download requests outside the current user-agent scope', async () => {
    const app = createApp()
    const sourceScope = createScope()
    const foreignScope = createScope()
    scopes.push(sourceScope, foreignScope)

    const upload = await uploadWorkspaceFile(app, sourceScope, 'scoped.csv', 'name\nalpha\n')
    const response = await dispatchRequest(
      app,
      'GET',
      `/api/files/${upload.body.fileKey}/download?agentId=${foreignScope.agentId}`,
      '',
      { cookie: 'mml_session=session-1' }
    )

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: 'File not found' })
  })

  it('fails downloads explicitly when tracked storage is missing', async () => {
    const app = createApp()
    const scope = createScope()
    scopes.push(scope)
    const registration = await fileStore.registerProjectPath('reports/missing/result.csv', scope)
    const outputPath = fileStore.getProjectEntryPath(registration.entry)
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, 'name,value\nalpha,1\n', 'utf8')
    await rm(outputPath)

    const response = await dispatchRequest(
      app,
      'GET',
      `/api/files/${registration.entry.fileKey}/download?agentId=${scope.agentId}`,
      '',
      { cookie: 'mml_session=session-1' }
    )

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: 'File content missing' })
  })

  it('deletes uploaded workspace files and removes them from later open and metadata flows', async () => {
    const app = createApp()
    const scope = createScope()
    scopes.push(scope)

    const upload = await uploadWorkspaceFile(app, scope, 'remove-me.md', '# Remove me\n')
    const deleteResponse = await dispatchRequest(
      app,
      'DELETE',
      `/api/files/${upload.body.fileKey}?agentId=${scope.agentId}`,
      '',
      { cookie: 'mml_session=session-1' }
    )

    expect(deleteResponse.status).toBe(200)
    expect(deleteResponse.body).toEqual({
      ok: true,
      fileKey: upload.body.fileKey
    })
    expect(fileStore.resolveFileKey(upload.body.fileKey)).toBeNull()
    expect(fileStore.listWorkspaceEntries(scope)).toEqual([])

    const openResponse = await dispatchRequest(app, 'GET', `/api/files/${upload.body.fileKey}`, '', {
      cookie: 'mml_session=session-1'
    })
    expect(openResponse.status).toBe(404)
  })

  it('deletes output workspace files and removes the backing file', async () => {
    const app = createApp()
    const scope = createScope()
    scopes.push(scope)
    const registration = await fileStore.registerProjectPath('reports/delete/result.csv', scope)
    const outputPath = fileStore.getProjectEntryPath(registration.entry)
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, 'name,value\nalpha,1\n', 'utf8')

    const deleteResponse = await dispatchRequest(
      app,
      'DELETE',
      `/api/files/${registration.entry.fileKey}?agentId=${scope.agentId}`,
      '',
      { cookie: 'mml_session=session-1' }
    )

    expect(deleteResponse.status).toBe(200)
    expect(fileStore.resolveFileKey(registration.entry.fileKey)).toBeNull()
    await expect(readFile(outputPath, 'utf8')).rejects.toThrow()

    const openResponse = await dispatchRequest(app, 'GET', `/api/files/${registration.entry.fileKey}`, '', {
      cookie: 'mml_session=session-1'
    })
    expect(openResponse.status).toBe(404)
  })

  it('deletes tracked working folders together with descendant metadata and files', async () => {
    const app = createApp()
    const scope = createScope()
    scopes.push(scope)
    const folderEntry = await fileStore.createProjectFolder(null, 'plans', scope)
    const nestedFolderEntry = await fileStore.createProjectFolder('plans', 'drafts', scope)
    const childFileEntry = await fileStore.createProjectFile('plans', 'root.md', scope)
    const nestedFileEntry = await fileStore.createProjectFile('plans/drafts', 'notes.md', scope)

    const deleteResponse = await dispatchRequest(
      app,
      'DELETE',
      `/api/files/${folderEntry.fileKey}?agentId=${scope.agentId}`,
      '',
      { cookie: 'mml_session=session-1' }
    )

    expect(deleteResponse.status).toBe(200)
    expect(deleteResponse.body).toEqual({
      ok: true,
      fileKey: folderEntry.fileKey
    })
    expect(fileStore.resolveFileKey(folderEntry.fileKey)).toBeNull()
    expect(fileStore.resolveFileKey(nestedFolderEntry.fileKey)).toBeNull()
    expect(fileStore.resolveFileKey(childFileEntry.fileKey)).toBeNull()
    expect(fileStore.resolveFileKey(nestedFileEntry.fileKey)).toBeNull()
    expect(fileStore.listWorkspaceEntries(scope)).toEqual([])

    await expect(readFile(fileStore.getProjectEntryPath(childFileEntry), 'utf8')).rejects.toThrow()
    await expect(readFile(fileStore.getProjectEntryPath(nestedFileEntry), 'utf8')).rejects.toThrow()
  })

  it('rejects deletion requests outside the current user-agent scope', async () => {
    const app = createApp()
    const sourceScope = createScope()
    const foreignScope = createScope()
    scopes.push(sourceScope, foreignScope)

    const upload = await uploadWorkspaceFile(app, sourceScope, 'scoped.md', '# Scoped\n')
    const deleteResponse = await dispatchRequest(
      app,
      'DELETE',
      `/api/files/${upload.body.fileKey}?agentId=${foreignScope.agentId}`,
      '',
      { cookie: 'mml_session=session-1' }
    )

    expect(deleteResponse.status).toBe(404)
    expect(deleteResponse.body).toEqual({ error: 'File not found' })
    expect(fileStore.resolveFileKey(upload.body.fileKey)).toMatchObject({
      originalName: 'scoped.md',
      scope: sourceScope
    })
  })

  it('returns explicit delete failures when metadata persistence aborts', async () => {
    const app = createApp()
    const scope = createScope()
    scopes.push(scope)
    const registration = await fileStore.registerProjectPath('reports/persist/result.csv', scope)
    const outputPath = fileStore.getProjectEntryPath(registration.entry)
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, 'name,value\nalpha,1\n', 'utf8')

    vi.spyOn(fileStore as any, 'persistScope').mockRejectedValueOnce(new Error('persist exploded'))

    const deleteResponse = await dispatchRequest(
      app,
      'DELETE',
      `/api/files/${registration.entry.fileKey}?agentId=${scope.agentId}`,
      '',
      { cookie: 'mml_session=session-1' }
    )

    expect(deleteResponse.status).toBe(500)
    expect(deleteResponse.body).toEqual({ error: 'persist exploded' })
    expect(fileStore.resolveFileKey(registration.entry.fileKey)).toMatchObject({
      fileKey: registration.entry.fileKey
    })
  })

  it('opens legacy rows_result artifacts as csv editor content', async () => {
    const scope = createScope()
    scopes.push(scope)
    const entry: FileMapEntry = {
      fileId: `artifact-${randomUUID()}`,
      fileKey: `f_${randomUUID().slice(0, 6)}`,
      originalName: 'artifact-output.json',
      storageExtension: '.json',
      createdAt: Date.now(),
      kind: 'project',
      scope
    }
    vi.spyOn(fileStore, 'resolveFileKey').mockReturnValue(entry)

    const outputPath = fileStore.getProjectPath(entry.fileId, scope)
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, JSON.stringify({
      kind: 'rows_result',
      data: {
        columns: ['name', 'value'],
        rows: [{ name: 'alpha', value: '1' }]
      }
    }, null, 2), 'utf8')

    const app = createApp()
    const response = await dispatchRequest(app, 'GET', `/api/files/${entry.fileKey}`, '', {
      cookie: 'mml_session=session-1'
    })

    expect(response.status).toBe(200)
    expect(response.body.file).toMatchObject({
      fileName: 'artifact-output.csv',
      source: 'project',
      writable: true,
      mode: 'csv'
    })
    expect(response.body.file.content).toContain('name,value')
  })

  it('saves MML toolbar metadata back into the leading header comment', async () => {
    const entry: FileMapEntry = {
      fileId: 'output-mml-save',
      fileKey: 'f_mml02',
      originalName: 'site.txt',
      storageExtension: '.txt',
      createdAt: Date.now(),
      kind: 'project',
      relativePath: 'site.txt',
      scope: {
        userId: 42,
        agentId: 'workspace-agent'
      }
    }
    vi.spyOn(fileStore, 'resolveFileKey').mockReturnValue(entry)
    uploadedPath = fileStore.getProjectEntryPath(entry)
    await mkdir(dirname(uploadedPath), { recursive: true })
    await writeFile(uploadedPath, '/* ME TYPE=UNC, Version=20.11.2 */\nADD TEST:NAME="A";\n', 'utf8')

    const app = createApp()
    const body = JSON.stringify({
      content: '/* ME TYPE=UNC, Version=20.11.2 */\nADD TEST:NAME="B";\n',
      mode: 'mml',
      mmlMetadata: {
        networkType: 'AMF',
        networkVersion: '20.9.2'
      }
    })
    const response = await dispatchRequest(app, 'PUT', `/api/files/${entry.fileKey}`, body, {
      'content-type': JSON_CONTENT_TYPE,
      'content-length': String(Buffer.byteLength(body)),
      cookie: 'mml_session=session-1'
    })

    expect(response.status).toBe(200)
    expect(response.body.file).toMatchObject({
      mode: 'mml',
      mmlMetadata: {
        networkType: 'AMF',
        networkVersion: '20.9.2'
      }
    })
    const savedRaw = await readFile(uploadedPath, 'utf8')
    expect(savedRaw.startsWith('/* ME TYPE=AMF, Version=20.9.2 */')).toBe(true)
  })

  it('opens rows_result artifacts as csv-capable workspace files and saves them in place', async () => {
    const entry: FileMapEntry = {
      fileId: 'artifact-output',
      fileKey: 'f_out01',
      originalName: 'artifact-artifact-output.json',
      storageExtension: '.json',
      createdAt: Date.now(),
      kind: 'project',
      scope: {
        userId: 42,
        agentId: 'workspace-agent'
      }
    }
    vi.spyOn(fileStore, 'resolveFileKey').mockReturnValue(entry)
    uploadedPath = fileStore.getProjectPath(entry.fileId, entry.scope)
    await mkdir(dirname(uploadedPath), { recursive: true })
    await writeFile(uploadedPath, JSON.stringify({
      kind: 'rows_result',
      data: {
        columns: ['name', 'value'],
        rows: [{ name: 'alpha', value: '1' }]
      }
    }, null, 2), 'utf8')

    const app = createApp()
    const openResponse = await dispatchRequest(app, 'GET', `/api/files/${entry.fileKey}`, '', {
      cookie: 'mml_session=session-1'
    })

    expect(openResponse.status).toBe(200)
    expect(openResponse.body.file).toMatchObject({
      mode: 'csv',
      fileName: 'artifact-artifact-output.csv'
    })
    expect(openResponse.body.file.content).toContain('name,value')

    const body = JSON.stringify({
      content: 'name,value\nbeta,2\n',
      mode: 'csv'
    })
    const saveResponse = await dispatchRequest(app, 'PUT', `/api/files/${entry.fileKey}`, body, {
      'content-type': JSON_CONTENT_TYPE,
      'content-length': String(Buffer.byteLength(body)),
      cookie: 'mml_session=session-1'
    })

    expect(saveResponse.status).toBe(200)
    expect(saveResponse.body.file.content).toContain('beta,2')
  })

  it('opens and saves path-addressed workspace outputs without legacy artifact wrapping', async () => {
    const entry: FileMapEntry = {
      fileId: 'write-output',
      fileKey: 'f_out02',
      originalName: 'reports/final/result.csv',
      storageExtension: '.csv',
      createdAt: Date.now(),
      kind: 'project',
      relativePath: 'reports/final/result.csv',
      scope: {
        userId: 42,
        agentId: 'workspace-agent'
      }
    }
    vi.spyOn(fileStore, 'resolveFileKey').mockReturnValue(entry)
    uploadedPath = fileStore.getProjectEntryPath(entry)
    await mkdir(dirname(uploadedPath), { recursive: true })
    await writeFile(uploadedPath, 'name,value\nalpha,1\n', 'utf8')

    const app = createApp()
    const openResponse = await dispatchRequest(app, 'GET', `/api/files/${entry.fileKey}`, '', {
      cookie: 'mml_session=session-1'
    })

    expect(openResponse.status).toBe(200)
    expect(openResponse.body.file).toMatchObject({
      fileName: 'reports/final/result.csv',
      mode: 'csv',
      content: 'name,value\nalpha,1\n'
    })

    const body = JSON.stringify({
      content: 'name,value\nbeta,2\n',
      mode: 'csv'
    })
    const saveResponse = await dispatchRequest(app, 'PUT', `/api/files/${entry.fileKey}`, body, {
      'content-type': JSON_CONTENT_TYPE,
      'content-length': String(Buffer.byteLength(body)),
      cookie: 'mml_session=session-1'
    })

    expect(saveResponse.status).toBe(200)
    expect(saveResponse.body.file.content).toBe('name,value\nbeta,2\n')
    expect(await readFile(uploadedPath, 'utf8')).toBe('name,value\nbeta,2\n')
  })
})
