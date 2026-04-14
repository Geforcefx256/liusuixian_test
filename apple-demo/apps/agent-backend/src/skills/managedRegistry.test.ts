import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createSkillFixtureSet } from '../../tests/skillFixtures.js'
import { SkillCatalog } from './catalog.js'
import { ManagedSkillRegistry } from './managedRegistry.js'

describe('ManagedSkillRegistry', () => {
  let tempDir = ''
  let cleanupFixture: (() => Promise<void>) | null = null

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

  it('seeds governed records for imported skills with published and draft defaults', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'managed-skill-registry-'))
    const registry = new ManagedSkillRegistry(new SkillCatalog(), join(tempDir, 'managed-skills.json'))

    await registry.initialize()

    const dpi = registry.getManagedSkill('dpi-new-bwm-pcc')
    const pcGuide = registry.getManagedSkill('pc-config-guide')

    expect(dpi).toMatchObject({
      lifecycle: 'published',
      intentGroup: 'planning',
      starterEnabled: true
    })
    expect(pcGuide).toMatchObject({
      lifecycle: 'draft',
      starterEnabled: false
    })
    expect(registry.getManagedSkill('pc-config-guide')).toMatchObject({
      lifecycle: 'draft',
      starterEnabled: false
    })
    expect(registry.getManagedSkill('dpi-new-bwm-pcc')).toMatchObject({
      lifecycle: 'published',
      intentGroup: 'planning'
    })
  })

  it('persists governed display metadata and agent bindings outside canonical skill files', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'managed-skill-registry-'))
    const registryPath = join(tempDir, 'managed-skills.json')
    const firstRegistry = new ManagedSkillRegistry(new SkillCatalog(), registryPath)

    await firstRegistry.initialize()
    await firstRegistry.updateManagedSkill('dpi-new-bwm-pcc', {
      displayName: 'DPI 带宽策略起点',
      displayDescription: '用于 DPI 带宽模型规划的正式入口技能。',
      starterSummary: '根据业务场景描述，生成 DPI 配置草案。',
      agentBindings: [{
        agentId: 'workspace-agent'
      }],
      starterPriority: 120
    })

    const reloadedRegistry = new ManagedSkillRegistry(new SkillCatalog(), registryPath)
    await reloadedRegistry.initialize()

    expect(reloadedRegistry.getManagedSkill('dpi-new-bwm-pcc')).toMatchObject({
      displayName: 'DPI 带宽策略起点',
      displayDescription: '用于 DPI 带宽模型规划的正式入口技能。',
      starterSummary: '根据业务场景描述，生成 DPI 配置草案。',
      agentBindings: [{
        agentId: 'workspace-agent'
      }],
      starterPriority: 120
    })
  })

  it('syncs expanded canonical metadata mirrors into managed records and resets governance on overwrite', async () => {
    const firstFixture = await createSkillFixtureSet([{
      id: 'sync-metadata',
      content: [
        '---',
        'id: sync-metadata',
        'name: Sync Metadata',
        'description: First canonical description.',
        'when-to-use: First pass',
        'input-example: Collect the first sample',
        'user-invocable: true',
        'model: gpt-5-mini',
        'effort: medium',
        'context: inline',
        'allowed-tools:',
        '  - skill:skill',
        '---',
        '',
        'Body'
      ].join('\n')
    }])
    cleanupFixture = firstFixture.cleanup
    tempDir = await mkdtemp(join(tmpdir(), 'managed-skill-registry-'))
    const registryPath = join(tempDir, 'managed-skills.json')
    const registry = new ManagedSkillRegistry(new SkillCatalog(firstFixture.assetsRoot), registryPath)

    await registry.initialize()
    await registry.updateManagedSkill('sync-metadata', {
      displayName: '治理名称',
      displayDescription: '治理描述',
      lifecycle: 'draft',
      starterEnabled: true
    })

    expect(registry.getManagedSkill('sync-metadata')).toMatchObject({
      whenToUse: 'First pass',
      inputExample: 'Collect the first sample',
      userInvocable: true,
      model: 'gpt-5-mini',
      effort: 'medium',
      context: 'inline',
      allowedTools: ['skill:skill'],
      displayName: '治理名称',
      displayDescription: '治理描述',
      starterEnabled: true
    })

    await cleanupFixture()
    cleanupFixture = null

    const overwriteFixture = await createSkillFixtureSet([{
      id: 'sync-metadata',
      content: [
        '---',
        'id: sync-metadata',
        'name: Sync Metadata Updated',
        'description: Updated canonical description.',
        'output-example: Updated output',
        'disable-model-invocation: true',
        '---',
        '',
        'Body'
      ].join('\n')
    }])
    cleanupFixture = overwriteFixture.cleanup
    const overwriteRegistry = new ManagedSkillRegistry(new SkillCatalog(overwriteFixture.assetsRoot), registryPath)

    await overwriteRegistry.initialize()
    const imported = await overwriteRegistry.syncFromCatalog(['sync-metadata'], { resetGovernance: true })

    expect(imported[0]).toMatchObject({
      canonicalName: 'Sync Metadata Updated',
      canonicalDescription: 'Updated canonical description.',
      outputExample: 'Updated output',
      disableModelInvocation: true,
      displayName: '',
      displayDescription: '',
      lifecycle: 'draft',
      starterEnabled: false,
      agentBindings: []
    })
    expect(imported[0]?.whenToUse).toBeUndefined()
    expect(imported[0]?.inputExample).toBeUndefined()
    expect(imported[0]?.allowedTools).toBeUndefined()
  })

  it('migrates legacy binding-scoped display names into a unified managed display name', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'managed-skill-registry-'))
    const registryPath = join(tempDir, 'managed-skills.json')
    await writeFile(registryPath, JSON.stringify({
      version: 3,
      skills: [{
        skillId: 'dpi-new-bwm-pcc',
        canonicalName: 'dpi-new-bwm-pcc',
        canonicalDescription: 'legacy',
        displayName: 'dpi-new-bwm-pcc',
        displayDescription: '遗留描述',
        ownerAgentId: 'workspace-agent',
        sourceAgentId: 'workspace-agent',
        sourcePath: '/tmp/dpi',
        surface: 'experimental',
        starterEnabled: false,
        starterPriority: 0,
        agentBindings: [
          {
            agentId: 'workspace-agent',
            displayName: '遗留规划入口'
          },
          {
            agentId: 'review-agent',
            displayName: '  '
          }
        ],
        importedAt: 1,
        updatedAt: 1
      }]
    }, null, 2), 'utf8')

    const registry = new ManagedSkillRegistry(new SkillCatalog(), registryPath)
    await registry.initialize()

    expect(registry.getManagedSkill('dpi-new-bwm-pcc')).toMatchObject({
      displayName: '遗留规划入口',
      agentBindings: [
        { agentId: 'workspace-agent' },
        { agentId: 'review-agent' }
      ]
    })
  })

  it('repairs a legacy intent group to the current default group and persists the repaired record', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'managed-skill-registry-'))
    const registryPath = join(tempDir, 'managed-skills.json')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await writeLegacyRegistryFile(registryPath, [{
      skillId: 'dpi-new-bwm-pcc',
      intentGroup: 'data-transformation'
    }])

    const registry = new ManagedSkillRegistry(new SkillCatalog(), registryPath)
    await registry.initialize()

    expect(registry.getManagedSkill('dpi-new-bwm-pcc')).toMatchObject({
      intentGroup: 'planning'
    })
    await expect(readPersistedIntentGroup(registryPath, 'dpi-new-bwm-pcc')).resolves.toBe('planning')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('"dpi-new-bwm-pcc" -> "planning"'))
  })

  it('clears a legacy intent group when no current default mapping exists', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'managed-skill-registry-'))
    const registryPath = join(tempDir, 'managed-skills.json')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await writeLegacyRegistryFile(registryPath, [{
      skillId: 'ne-csv-processor',
      intentGroup: 'data-transformation'
    }])

    const registry = new ManagedSkillRegistry(new SkillCatalog(), registryPath)
    await registry.initialize()

    expect(registry.getManagedSkill('ne-csv-processor')).toMatchObject({
      intentGroup: undefined
    })
    await expect(readPersistedIntentGroup(registryPath, 'ne-csv-processor')).resolves.toBeUndefined()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('"ne-csv-processor" -> "ungrouped"'))
  })

  it('loads a version 4 registry file and repopulates new metadata mirror fields from catalog sync', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'managed-skill-registry-'))
    const registryPath = join(tempDir, 'managed-skills.json')
    await writeFile(registryPath, JSON.stringify({
      version: 4,
      skills: [{
        skillId: 'dpi-new-bwm-pcc',
        canonicalName: 'Legacy Canonical',
        canonicalDescription: 'legacy',
        displayName: 'Legacy Display',
        displayDescription: 'legacy description',
        starterSummary: '',
        ownerAgentId: 'workspace-agent',
        sourceAgentId: 'workspace-agent',
        sourcePath: '/tmp/dpi',
        lifecycle: 'published',
        starterEnabled: true,
        starterPriority: 100,
        agentBindings: [{ agentId: 'workspace-agent' }],
        importedAt: 1,
        updatedAt: 1
      }]
    }, null, 2), 'utf8')

    const registry = new ManagedSkillRegistry(new SkillCatalog(), registryPath)
    await registry.initialize()

    expect(registry.getManagedSkill('dpi-new-bwm-pcc')).toMatchObject({
      canonicalName: 'dpi-new-bwm-pcc',
      canonicalDescription: expect.stringContaining('DPI 业务场景描述'),
      allowedTools: ['local:question']
    })
    expect(registry.getManagedSkill('dpi-new-bwm-pcc')?.whenToUse).toBeUndefined()
    expect(registry.getManagedSkill('dpi-new-bwm-pcc')?.inputExample).toBeUndefined()
    expect(registry.getManagedSkill('dpi-new-bwm-pcc')?.outputExample).toBeUndefined()
  })

  it('preserves an empty starter summary without copying the governed description', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'managed-skill-registry-'))
    const registryPath = join(tempDir, 'managed-skills.json')
    const registry = new ManagedSkillRegistry(new SkillCatalog(), registryPath)

    await registry.initialize()
    await registry.updateManagedSkill('dpi-new-bwm-pcc', {
      lifecycle: 'draft',
      displayDescription: '用于 DPI 带宽模型规划的正式入口技能。',
      starterSummary: '   '
    })

    expect(registry.getManagedSkill('dpi-new-bwm-pcc')).toMatchObject({
      displayDescription: '用于 DPI 带宽模型规划的正式入口技能。',
      starterSummary: ''
    })
  })

  it('rejects publication when any bound agent keeps the default imported name', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'managed-skill-registry-'))
    const registry = new ManagedSkillRegistry(new SkillCatalog(), join(tempDir, 'managed-skills.json'))
    await registry.initialize()

    await expect(registry.updateManagedSkill('dpi-new-bwm-pcc', {
      lifecycle: 'published',
      displayName: 'dpi-new-bwm-pcc',
      agentBindings: [{
        agentId: 'workspace-agent'
      }]
    })).rejects.toThrow('必须保持草稿')
  })

  it('rejects duplicate governed names inside the same agent scope', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'managed-skill-registry-'))
    const registry = new ManagedSkillRegistry(new SkillCatalog(), join(tempDir, 'managed-skills.json'))
    await registry.initialize()

    await registry.updateManagedSkill('dpi-new-bwm-pcc', {
      displayName: '统一入口'
    })

    await expect(registry.updateManagedSkill('pc-config-guide', {
      displayName: '统一入口',
      agentBindings: [{
        agentId: 'workspace-agent'
      }]
    })).rejects.toThrow('已存在')
  })

  it('rejects publication when the governed description is empty', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'managed-skill-registry-'))
    const registry = new ManagedSkillRegistry(new SkillCatalog(), join(tempDir, 'managed-skills.json'))
    await registry.initialize()

    await expect(registry.updateManagedSkill('dpi-new-bwm-pcc', {
      displayName: 'DPI 正式入口',
      displayDescription: '   ',
      lifecycle: 'published',
      agentBindings: [{
        agentId: 'workspace-agent'
      }]
    })).rejects.toThrow('用户可见描述未完成治理')
  })

  it('rejects publication when no agent bindings remain', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'managed-skill-registry-'))
    const registry = new ManagedSkillRegistry(new SkillCatalog(), join(tempDir, 'managed-skills.json'))
    await registry.initialize()

    await expect(registry.updateManagedSkill('dpi-new-bwm-pcc', {
      displayName: 'DPI 正式入口',
      displayDescription: '用于 DPI 带宽模型规划的正式入口技能。',
      lifecycle: 'published',
      agentBindings: []
    })).rejects.toThrow('发布前至少需要绑定一个 Agent')
  })
})

async function readPersistedIntentGroup(registryPath: string, skillId: string): Promise<string | undefined> {
  const payload = JSON.parse(await readFile(registryPath, 'utf8')) as {
    skills: Array<{ skillId: string; intentGroup?: string }>
  }
  return payload.skills.find(skill => skill.skillId === skillId)?.intentGroup
}

async function writeLegacyRegistryFile(
  registryPath: string,
  skills: Array<{ skillId: string; intentGroup: string }>
): Promise<void> {
  await writeFile(registryPath, JSON.stringify({
    version: 3,
    skills: skills.map(buildLegacyManagedSkillRecord)
  }, null, 2), 'utf8')
}

function buildLegacyManagedSkillRecord(skill: { skillId: string; intentGroup: string }) {
  return {
    skillId: skill.skillId,
    canonicalName: `${skill.skillId}-canonical`,
    canonicalDescription: 'legacy',
    displayName: `${skill.skillId}-display`,
    displayDescription: 'legacy description',
    starterSummary: '',
    ownerAgentId: 'workspace-agent',
    sourceAgentId: 'workspace-agent',
    sourcePath: `/tmp/${skill.skillId}`,
    surface: 'production',
    intentGroup: skill.intentGroup,
    starterEnabled: true,
    starterPriority: 100,
    agentBindings: [{
      agentId: 'workspace-agent',
      displayName: `${skill.skillId}-display`
    }],
    importedAt: 1,
    updatedAt: 1
  }
}
