import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'

import { SkillCatalog } from '../../../skills/catalog.js'
import { ManagedSkillRegistry } from '../../../skills/managedRegistry.js'
import { createSkillFixtureSet } from '../../../../tests/skillFixtures.js'
import { SkillToolProvider } from './skillProvider.js'

describe('SkillToolProvider catalog governance', () => {
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

  it('denies loading known draft skills that are hidden from the governed agent surface', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skill-tool-provider-'))
    const skillCatalog = new SkillCatalog()
    const registry = new ManagedSkillRegistry(skillCatalog, join(tempDir, 'managed-skills.json'))
    await registry.initialize()

    const provider = new SkillToolProvider(skillCatalog, registry)
    const response = await provider.invoke({
      tool: 'skill',
      agentId: 'workspace-agent',
      args: {
        name: 'pc-config-guide'
      }
    })

    expect(response.ok).toBe(false)
    if (response.ok) return
    expect(response.error.type).toBe('TOOL_DENIED')
    expect(response.error.message).toContain('E_SKILL_NOT_APPROVED')
  })

  it('keeps other draft skills unavailable for the governed agent surface', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skill-tool-provider-'))
    const skillCatalog = new SkillCatalog()
    const registry = new ManagedSkillRegistry(skillCatalog, join(tempDir, 'managed-skills.json'))
    await registry.initialize()

    const provider = new SkillToolProvider(skillCatalog, registry)
    const response = await provider.invoke({
      tool: 'skill',
      agentId: 'workspace-agent',
      args: {
        name: 'pc-config-guide'
      }
    })

    expect(response.ok).toBe(false)
    if (response.ok) return
    expect(response.error.type).toBe('TOOL_DENIED')
    expect(response.error.message).toContain('E_SKILL_NOT_APPROVED')
  })

  it('keeps the skill tool description static even when display metadata differs', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'skill-tool-provider-'))
    const skillCatalog = new SkillCatalog()
    const registry = new ManagedSkillRegistry(skillCatalog, join(tempDir, 'managed-skills.json'))
    await registry.initialize()
    await registry.updateManagedSkill('dpi-new-bwm-pcc', {
      displayName: 'DPI 规划入口',
      displayDescription: '面向规划的 display 描述。'
    })

    const provider = new SkillToolProvider(skillCatalog, registry)
    const manifest = provider.catalog({ agentId: 'workspace-agent' })[0]

    expect(manifest?.description).toContain('Load the canonical SKILL.md instructions for an approved skill by name or id.')
    expect(manifest?.description).toContain('Use this first when you need a skill\'s workflow')
    expect(manifest?.description).toContain('Use local:* only for workspace files')
    expect(manifest?.description).not.toContain('Canonical Overwrite Fixture')
    expect(manifest?.description).not.toContain('Valid overwrite fixture')
    expect(manifest?.description).not.toContain('DPI 规划入口')
    expect(manifest?.description).not.toContain('display 描述')
  })

  it('keeps invalid canonical skills out of the governed skill tool catalog', async () => {
    const fixture = await createSkillFixtureSet([
      {
        id: 'dpi-new-bwm-pcc',
        content: ['---', 'id: dpi-new-bwm-pcc', 'name: dpi-new-bwm-pcc', 'description: canonical dpi description', '---', '', 'Body'].join('\n')
      },
      {
        id: 'pc-config-guide',
        content: ['---', 'description: missing name should fail', '---', '', 'Body'].join('\n')
      }
    ])
    cleanupFixture = fixture.cleanup
    tempDir = await mkdtemp(join(tmpdir(), 'skill-tool-provider-'))

    const skillCatalog = new SkillCatalog(fixture.assetsRoot)
    const registry = new ManagedSkillRegistry(skillCatalog, join(tempDir, 'managed-skills.json'))
    await registry.initialize()
    await registry.updateManagedSkill('dpi-new-bwm-pcc', {
      displayName: 'Canonical DPI'
    })

    const provider = new SkillToolProvider(skillCatalog, registry)
    const manifests = provider.catalog({ agentId: 'workspace-agent' })
    const manifest = manifests[0]

    expect(manifest?.description).toContain('Load the canonical SKILL.md instructions for an approved skill by name or id.')
    expect(manifest?.description).not.toContain('canonical dpi description')
    expect(manifest?.description).not.toContain('pc-config-guide')
    expect(manifests.map(item => item.id)).toEqual([
      'skill',
      'read_asset',
      'list_assets',
      'find_assets'
    ])
    expect(registry.getManagedSkill('pc-config-guide')).toBeNull()
  })
})
