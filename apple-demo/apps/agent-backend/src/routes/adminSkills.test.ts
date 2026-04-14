import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SkillCatalog } from '../skills/catalog.js'
import { ManagedSkillRegistry } from '../skills/managedRegistry.js'
import { createAdminSkillsRouter } from './adminSkills.js'

describe('createAdminSkillsRouter', () => {
  let tempDir = ''

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
      tempDir = ''
    }
  })

  it('saves successfully after legacy intent-group remediation', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'admin-skills-route-'))
    const registryPath = join(tempDir, 'managed-skills.json')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await writeFile(registryPath, JSON.stringify({
      version: 3,
      skills: [buildLegacyManagedSkillRecord()]
    }, null, 2), 'utf8')

    const registry = new ManagedSkillRegistry(new SkillCatalog(), registryPath)
    await registry.initialize()
    const patchHandler = getPatchHandler(registry)
    const response = createMockResponse()

    await patchHandler({
      params: { skillId: 'dpi-new-bwm-pcc' },
      body: { displayDescription: '修复后的治理描述' },
      auth: { userId: 1, roles: ['admin'] }
    }, response)

    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({
      ok: true,
      skill: {
        skillId: 'dpi-new-bwm-pcc',
        displayDescription: '修复后的治理描述',
        intentGroup: 'planning'
      }
    })
    expect(warnSpy).toHaveBeenCalled()
  })
})

function getPatchHandler(registry: ManagedSkillRegistry) {
  const router = createAdminSkillsRouter(registry, {
    listAgents: () => []
  })
  const layer = router.stack.find(entry => entry.route?.path === '/skills/:skillId')
  if (!layer?.route?.stack?.length) {
    throw new Error('PATCH /skills/:skillId handler not found')
  }
  return layer.route.stack[0].handle as (
    req: { params: { skillId: string }; body: Record<string, unknown>; auth: { userId: number; roles: string[] } },
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

function buildLegacyManagedSkillRecord() {
  return {
    skillId: 'dpi-new-bwm-pcc',
    canonicalName: 'dpi-new-bwm-pcc',
    canonicalDescription: 'legacy',
    displayName: '遗留规划入口',
    displayDescription: 'legacy description',
    starterSummary: '',
    ownerAgentId: 'workspace-agent',
    sourceAgentId: 'workspace-agent',
    sourcePath: '/tmp/dpi',
    lifecycle: 'published',
    intentGroup: 'data-transformation',
    starterEnabled: true,
    starterPriority: 100,
    agentBindings: [{
      agentId: 'workspace-agent',
      displayName: '遗留规划入口'
    }],
    importedAt: 1,
    updatedAt: 1
  }
}
