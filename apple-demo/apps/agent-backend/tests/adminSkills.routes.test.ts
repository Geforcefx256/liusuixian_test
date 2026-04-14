import express, { type Application } from 'express'
import { execFileSync } from 'node:child_process'
import { access, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { IncomingMessage, ServerResponse, type OutgoingHttpHeaders } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

import { requireSameOrigin } from '../src/http/sameOrigin.js'
import { createAdminSkillsRouter } from '../src/routes/adminSkills.js'
import { AdminSkillCatalogService } from '../src/skills/adminCatalogService.js'
import { SkillCatalog } from '../src/skills/catalog.js'
import { ManagedSkillRegistry } from '../src/skills/managedRegistry.js'
import { createSkillFixtureSet, type SkillFixtureEntry } from './skillFixtures.js'

const JSON_CONTENT_TYPE = 'application/json'
const LOCALHOST = 'localhost:3100'

type TestResponse = {
  status: number
  body: any
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
  const text = extractBodyText(Buffer.concat(chunks).toString('utf8'))
  const contentType = response.getHeader('content-type')
  const isJson = typeof contentType === 'string' && contentType.includes(JSON_CONTENT_TYPE)
  return {
    status: response.statusCode,
    body: isJson && text ? JSON.parse(text) : text,
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

async function createApp() {
  const fixture = await createSkillFixtureSet([buildCanonicalSkillFixture('dpi-new-bwm-pcc', 'Canonical DPI')])
  const tempDir = await mkdtemp(join(tmpdir(), 'admin-skills-routes-'))
  const managedSkillsDir = join(tempDir, 'managed-skills')
  const SkillCatalogCtor = SkillCatalog as unknown as { new(assetsRoot?: string, managedSkillsRoot?: string): SkillCatalog }
  const skillCatalog = new SkillCatalogCtor(fixture.assetsRoot, managedSkillsDir)
  const registry = new ManagedSkillRegistry(skillCatalog, join(tempDir, 'managed-skills.json'))
  await registry.initialize()
  const adminSkillCatalogService = new AdminSkillCatalogService(skillCatalog, registry, managedSkillsDir)

  const app = express()
  app.use(express.json())
  app.use(requireSameOrigin)
  app.use('/agent/api/admin', createAdminSkillsRouter(registry, {
    listAgents: () => [{ id: 'workspace-agent', name: 'Workspace Agent' }] as any
  }, adminSkillCatalogService))

  return {
    tempDir,
    cleanupFixture: fixture.cleanup,
    registry,
    assetsRoot: fixture.assetsRoot,
    managedSkillsDir,
    app: app as ExpressApp
  }
}

describe('admin skill routes', () => {
  let tempDir = ''
  let cleanupFixture: (() => Promise<void>) | null = null

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(async () => {
    if (cleanupFixture) {
      await cleanupFixture()
      cleanupFixture = null
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
      tempDir = ''
    }
  })

  it('rejects non-admin users from managed skill routes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            userId: 42,
            roles: [{ roleKey: 'member' }]
          }
        }
      })
    }))

    const created = await createApp()
    tempDir = created.tempDir
    cleanupFixture = created.cleanupFixture

    const response = await dispatchRequest(created.app, 'GET', '/agent/api/admin/skills', '', {
      cookie: 'mml_session=session-1'
    })

    expect(response.status).toBe(403)
    expect(response.body).toEqual({ error: 'Admin access required' })
  })

  it('lists governed skills for admins and preserves agent metadata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            userId: 7,
            roles: [{ roleKey: 'admin' }]
          }
        }
      })
    }))

    const created = await createApp()
    tempDir = created.tempDir
    cleanupFixture = created.cleanupFixture

    const response = await dispatchRequest(created.app, 'GET', '/agent/api/admin/skills', '', {
      cookie: 'mml_session=session-1'
    })

    expect(response.status).toBe(200)
    expect(response.body.ok).toBe(true)
    expect(response.body.agents).toEqual([{ id: 'workspace-agent', name: 'Workspace Agent' }])
    expect(response.body.skills.some((skill: { skillId: string }) => skill.skillId === 'dpi-new-bwm-pcc')).toBe(true)
  })

  it('updates managed skill metadata only for same-origin admin requests', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            userId: 9,
            roles: [{ roleKey: 'admin' }]
          }
        }
      })
    }))

    const created = await createApp()
    tempDir = created.tempDir
    cleanupFixture = created.cleanupFixture
    const body = JSON.stringify({
      displayName: 'DPI 正式入口',
      lifecycle: 'published',
      agentBindings: [{
        agentId: 'workspace-agent'
      }]
    })

    const response = await dispatchRequest(
      created.app,
      'PATCH',
      '/agent/api/admin/skills/dpi-new-bwm-pcc',
      body,
      {
        'content-type': JSON_CONTENT_TYPE,
        'content-length': String(Buffer.byteLength(body)),
        origin: 'http://localhost:5175',
        cookie: 'mml_session=session-1'
      }
    )

    expect(response.status).toBe(200)
    expect(response.body.skill).toMatchObject({
      skillId: 'dpi-new-bwm-pcc',
      displayName: 'DPI 正式入口',
      lifecycle: 'published',
      agentBindings: [{
        agentId: 'workspace-agent'
      }]
    })
    expect(created.registry.getManagedSkill('dpi-new-bwm-pcc')).toMatchObject({
      displayName: 'DPI 正式入口'
    })
  })

  it('uploads a valid skill zip and creates a managed record immediately', async () => {
    vi.stubGlobal('fetch', mockAdminFetch(12))

    const created = await createApp()
    tempDir = created.tempDir
    cleanupFixture = created.cleanupFixture
    const archive = await createSkillZip('uploaded-skill', buildCanonicalSkillContent('uploaded-skill', 'Uploaded skill description'))

    const response = await dispatchRequest(
      created.app,
      'POST',
      '/agent/api/admin/skills/upload',
      archive.body,
      archive.headers
    )

    expect(response.status).toBe(200)
    expect(response.body.skill).toMatchObject({
      skillId: 'uploaded-skill',
      canonicalName: 'uploaded-skill',
      canonicalDescription: 'Uploaded skill description'
    })
    expect(created.registry.getManagedSkill('uploaded-skill')).toBeTruthy()
    await expect(access(join(created.managedSkillsDir, 'uploaded-skill', 'SKILL.md'))).resolves.toBeUndefined()
    await expect(access(join(created.assetsRoot, 'skills', 'uploaded-skill', 'SKILL.md'))).rejects.toBeTruthy()
  }, 15000)

  it('returns conflict details until overwrite is explicitly confirmed and preserves governance', async () => {
    vi.stubGlobal('fetch', mockAdminFetch(13))

    const created = await createApp()
    tempDir = created.tempDir
    cleanupFixture = created.cleanupFixture
    await created.registry.updateManagedSkill('dpi-new-bwm-pcc', {
      displayName: '治理后入口',
      displayDescription: '治理描述',
      lifecycle: 'published'
    })
    const archive = await createSkillZip('dpi-new-bwm-pcc', [
      '---',
      'id: dpi-new-bwm-pcc',
      'name: "Canonical Overwrite"',
      'description: overwritten canonical description',
      '---',
      '',
      'Body'
    ].join('\n'))

    const conflict = await dispatchRequest(
      created.app,
      'POST',
      '/agent/api/admin/skills/upload',
      archive.body,
      archive.headers
    )

    expect(conflict.status).toBe(409)
    expect(conflict.body.conflict).toMatchObject({
      reason: 'id',
      skillId: 'dpi-new-bwm-pcc',
      canonicalName: 'dpi-new-bwm-pcc',
      lifecycle: 'published',
      boundAgents: ['workspace-agent']
    })

    const confirmed = await dispatchRequest(
      created.app,
      'POST',
      '/agent/api/admin/skills/upload?overwrite=true',
      archive.body,
      archive.headers
    )

    expect(confirmed.status).toBe(200)
    expect(confirmed.body.replaced).toBe(true)
    expect(created.registry.getManagedSkill('dpi-new-bwm-pcc')).toMatchObject({
      canonicalName: 'Canonical Overwrite',
      canonicalDescription: 'overwritten canonical description',
      displayName: '',
      displayDescription: '',
      lifecycle: 'draft',
      intentGroup: undefined,
      starterEnabled: false,
      starterPriority: 0,
      agentBindings: []
    })
  }, 20000)

  it('rejects canonical name conflicts even when overwrite is requested', async () => {
    vi.stubGlobal('fetch', mockAdminFetch(14))

    const created = await createApp()
    tempDir = created.tempDir
    cleanupFixture = created.cleanupFixture
    const archive = await createSkillZip('uploaded-skill', [
      '---',
      'id: uploaded-skill',
      'name: "dpi-new-bwm-pcc"',
      'description: conflicting canonical name',
      '---',
      '',
      'Body'
    ].join('\n'))

    const firstConflict = await dispatchRequest(
      created.app,
      'POST',
      '/agent/api/admin/skills/upload',
      archive.body,
      archive.headers
    )

    expect(firstConflict.status).toBe(409)
    expect(firstConflict.body.conflict).toMatchObject({
      reason: 'name',
      skillId: 'dpi-new-bwm-pcc',
      canonicalName: 'dpi-new-bwm-pcc'
    })
    expect(created.registry.getManagedSkill('uploaded-skill')).toBeNull()

    const overwriteConflict = await dispatchRequest(
      created.app,
      'POST',
      '/agent/api/admin/skills/upload?overwrite=true',
      archive.body,
      archive.headers
    )

    expect(overwriteConflict.status).toBe(409)
    expect(overwriteConflict.body.conflict).toMatchObject({
      reason: 'name',
      skillId: 'dpi-new-bwm-pcc',
      canonicalName: 'dpi-new-bwm-pcc'
    })
    expect(created.registry.getManagedSkill('uploaded-skill')).toBeNull()
  }, 20000)

  it('rejects invalid upload packages before persistence', async () => {
    vi.stubGlobal('fetch', mockAdminFetch(15))

    const created = await createApp()
    tempDir = created.tempDir
    cleanupFixture = created.cleanupFixture
    const archive = await createSkillZip('invalid-skill', [
      '---',
      'name: invalid-skill',
      'description: missing id',
      '---',
      '',
      'Body'
    ].join('\n'))

    const response = await dispatchRequest(
      created.app,
      'POST',
      '/agent/api/admin/skills/upload',
      archive.body,
      archive.headers
    )

    expect(response.status).toBe(400)
    expect(response.body.code).toBe('SKILL_UPLOAD_INVALID')
    expect(response.body.issues[0].field).toBe('id')
    expect(created.registry.getManagedSkill('invalid-skill')).toBeNull()
  }, 15000)

  it('returns structured JSON for non-zip upload rejections', async () => {
    vi.stubGlobal('fetch', mockAdminFetch(16))

    const created = await createApp()
    tempDir = created.tempDir
    cleanupFixture = created.cleanupFixture
    const body = buildMultipartUploadBody(Buffer.from('plain text'), 'invalid.txt', 'text/plain')

    const response = await dispatchRequest(
      created.app,
      'POST',
      '/agent/api/admin/skills/upload',
      body.body,
      body.headers
    )

    expect(response.status).toBe(400)
    expect(response.body).toEqual({
      error: 'Only ZIP skill packages are allowed',
      code: 'SKILL_UPLOAD_INVALID_FILE'
    })
  })

  it('returns structured JSON for upload middleware failures', async () => {
    vi.stubGlobal('fetch', mockAdminFetch(17))

    const created = await createApp()
    tempDir = created.tempDir
    cleanupFixture = created.cleanupFixture
    const boundary = '----skill-upload-multi'
    const body = buildMultipartFileEntriesBody([
      { fieldName: 'payload', fileName: 'broken.zip', contentType: 'application/zip', body: Buffer.from('broken') }
    ], boundary)

    const response = await dispatchRequest(
      created.app,
      'POST',
      '/agent/api/admin/skills/upload',
      body,
      buildMultipartHeaders(body, boundary)
    )

    expect(response.status).toBe(400)
    expect(response.body).toEqual({
      error: 'Invalid multipart skill upload request',
      code: 'SKILL_UPLOAD_MULTIPART_ERROR'
    })
  })

  it('deletes a managed canonical package and managed record after confirmation', async () => {
    vi.stubGlobal('fetch', mockAdminFetch(18))

    const created = await createApp()
    tempDir = created.tempDir
    cleanupFixture = created.cleanupFixture
    const archive = await createSkillZip('uploaded-skill', buildCanonicalSkillContent('uploaded-skill', 'Uploaded skill description'))

    const uploaded = await dispatchRequest(
      created.app,
      'POST',
      '/agent/api/admin/skills/upload',
      archive.body,
      archive.headers
    )
    expect(uploaded.status).toBe(200)

    const missingConfirm = await dispatchRequest(
      created.app,
      'DELETE',
      '/agent/api/admin/skills/uploaded-skill',
      '',
      { origin: 'http://localhost:5175', cookie: 'mml_session=session-1' }
    )
    expect(missingConfirm.status).toBe(400)

    const response = await dispatchRequest(
      created.app,
      'DELETE',
      '/agent/api/admin/skills/uploaded-skill?confirm=true',
      '',
      { origin: 'http://localhost:5175', cookie: 'mml_session=session-1' }
    )

    expect(response.status).toBe(200)
    expect(created.registry.getManagedSkill('uploaded-skill')).toBeNull()
  }, 15000)

  it('falls back to the builtin canonical skill after deleting a managed override', async () => {
    vi.stubGlobal('fetch', mockAdminFetch(19))

    const created = await createApp()
    tempDir = created.tempDir
    cleanupFixture = created.cleanupFixture
    const archive = await createSkillZip('dpi-new-bwm-pcc', [
      '---',
      'id: dpi-new-bwm-pcc',
      'name: "Canonical Overwrite"',
      'description: overridden from managed runtime',
      '---',
      '',
      'Body'
    ].join('\n'))

    const uploaded = await dispatchRequest(
      created.app,
      'POST',
      '/agent/api/admin/skills/upload?overwrite=true',
      archive.body,
      archive.headers
    )
    expect(uploaded.status).toBe(200)
    expect(created.registry.getManagedSkill('dpi-new-bwm-pcc')).toMatchObject({
      canonicalName: 'Canonical Overwrite'
    })

    const deleted = await dispatchRequest(
      created.app,
      'DELETE',
      '/agent/api/admin/skills/dpi-new-bwm-pcc?confirm=true',
      '',
      { origin: 'http://localhost:5175', cookie: 'mml_session=session-1' }
    )

    expect(deleted.status).toBe(200)
    expect(created.registry.getManagedSkill('dpi-new-bwm-pcc')).toMatchObject({
      canonicalName: 'dpi-new-bwm-pcc',
      canonicalDescription: 'Canonical DPI'
    })
    await expect(access(join(created.managedSkillsDir, 'dpi-new-bwm-pcc'))).rejects.toBeTruthy()
  }, 15000)
})

function buildCanonicalSkillFixture(id: string, description: string): SkillFixtureEntry {
  return {
    id,
    content: buildCanonicalSkillContent(id, description)
  }
}

function buildCanonicalSkillContent(id: string, description: string): string {
  return [
    '---',
    `id: ${id}`,
    `name: ${id}`,
    `description: ${description}`,
    '---',
    '',
    'Body'
  ].join('\n')
}

function mockAdminFetch(userId: number) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      success: true,
      data: {
        user: {
          userId,
          roles: [{ roleKey: 'admin' }]
        }
      }
    })
  })
}

async function createSkillZip(skillId: string, skillContent: string): Promise<{
  body: Buffer
  headers: Record<string, string>
}> {
  const tempRoot = await mkdtemp(join(tmpdir(), 'skill-zip-'))
  const skillRoot = join(tempRoot, skillId)
  const archivePath = join(tempRoot, `${skillId}.zip`)
  await mkdir(skillRoot, { recursive: true })
  await writeFile(join(skillRoot, 'SKILL.md'), skillContent, 'utf8')
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      'Compress-Archive',
      '-LiteralPath',
      skillRoot,
      '-DestinationPath',
      archivePath,
      '-Force'
    ],
    { cwd: tempRoot }
  )
  const archiveBuffer = await import('node:fs/promises').then(fs => fs.readFile(archivePath))
  await rm(tempRoot, { recursive: true, force: true })
  return buildMultipartUploadBody(archiveBuffer, `${skillId}.zip`, 'application/zip')
}

function buildMultipartUploadBody(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
): { body: Buffer; headers: Record<string, string> } {
  const boundary = `----skill-upload-${Date.now()}`
  const body = buildMultipartFileEntriesBody([{
    fieldName: 'file',
    fileName,
    contentType,
    body: fileBuffer
  }], boundary)
  return {
    body,
    headers: buildMultipartHeaders(body, boundary)
  }
}

function buildMultipartFileEntriesBody(
  files: Array<{ fieldName: string; fileName: string; contentType: string; body: Buffer }>,
  boundary = `----skill-upload-${Date.now()}`
): Buffer {
  const body = Buffer.concat([
    ...files.flatMap(file => [
      Buffer.from(
        `--${boundary}\r\n`
        + `Content-Disposition: form-data; name="${file.fieldName}"; filename="${file.fileName}"\r\n`
        + `Content-Type: ${file.contentType}\r\n\r\n`
      ),
      file.body,
      Buffer.from('\r\n')
    ]),
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ])
  return body
}

function buildMultipartHeaders(body: Buffer, boundary: string): Record<string, string> {
  return {
    'content-type': `multipart/form-data; boundary=${boundary}`,
    'content-length': String(body.byteLength),
    origin: 'http://localhost:5175',
    cookie: 'mml_session=session-1'
  }
}
