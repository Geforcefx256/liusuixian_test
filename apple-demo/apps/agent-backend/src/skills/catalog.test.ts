import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'

import { createSkillFixtureSet } from '../../tests/skillFixtures.js'
import { ManagedSkillRegistry } from './managedRegistry.js'
import { SkillCatalog } from './catalog.js'

describe('SkillCatalog canonical metadata', () => {
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

  it('rejects missing canonical name and description instead of falling back to manifest metadata', async () => {
    const fixture = await createSkillFixtureSet([
      {
        id: 'dpi-new-bwm-pcc',
        content: ['---', 'description: canonical description', '---', '', 'Body'].join('\n')
      },
      {
        id: 'pc-config-guide',
        content: ['---', 'name: pc-config-guide', '---', '', 'Body'].join('\n')
      }
    ])
    cleanupFixture = fixture.cleanup

    const catalog = new SkillCatalog(fixture.assetsRoot)

    expect(catalog.getSkillsForAgent('workspace-agent')).toEqual([])
    expect(catalog.getSkillByName('dpi-new-bwm-pcc')).toBeNull()
    expect(catalog.getSkillByName('pc-config-guide')).toBeNull()
    expect(catalog.getLoadIssues()).toHaveLength(2)
  })

  it('syncs canonical parsed metadata into governance records for valid skills only', async () => {
    const fixture = await createSkillFixtureSet([
      {
        id: 'dpi-new-bwm-pcc',
        content: [
          '---',
          'id: dpi-new-bwm-pcc',
          'name: "Canonical: DPI"',
          'description: >-',
          '  用于规划阶段的',
          '  canonical 描述',
          '---',
          '',
          'Body'
        ].join('\n')
      },
      {
        id: 'pc-config-guide',
        content: ['---', 'id: pc-config-guide', 'name: pc-config-guide', '---', '', 'Body'].join('\n')
      }
    ])
    cleanupFixture = fixture.cleanup
    tempDir = await mkdtemp(join(tmpdir(), 'skill-catalog-'))

    const catalog = new SkillCatalog(fixture.assetsRoot)
    const registry = new ManagedSkillRegistry(catalog, join(tempDir, 'managed-skills.json'))
    await registry.initialize()

    expect(registry.getManagedSkill('dpi-new-bwm-pcc')).toMatchObject({
      canonicalName: 'Canonical: DPI',
      canonicalDescription: '用于规划阶段的 canonical 描述'
    })
    expect(registry.getManagedSkill('pc-config-guide')).toBeNull()
  })

  it('prefers managed runtime skills over builtin assets for the same canonical skill id', async () => {
    const fixture = await createSkillFixtureSet([{
      id: 'shared-skill',
      content: [
        '---',
        'id: shared-skill',
        'name: Shared Skill',
        'description: Builtin canonical description.',
        '---',
        '',
        'Body'
      ].join('\n')
    }])
    cleanupFixture = fixture.cleanup
    tempDir = await mkdtemp(join(tmpdir(), 'skill-catalog-'))
    const managedSkillsRoot = join(tempDir, 'managed-skills')
    await mkdir(join(managedSkillsRoot, 'shared-skill'), { recursive: true })
    await writeFile(join(managedSkillsRoot, 'shared-skill', 'SKILL.md'), [
      '---',
      'id: shared-skill',
      'name: Shared Skill',
      'description: Managed canonical override.',
      '---',
      '',
      'Body'
    ].join('\n'), 'utf8')
    await mkdir(join(managedSkillsRoot, 'managed-only-skill'), { recursive: true })
    await writeFile(join(managedSkillsRoot, 'managed-only-skill', 'SKILL.md'), [
      '---',
      'id: managed-only-skill',
      'name: Managed Only Skill',
      'description: Runtime managed skill.',
      '---',
      '',
      'Body'
    ].join('\n'), 'utf8')

    const CatalogCtor = SkillCatalog as unknown as { new(assetsRoot?: string, managedSkillsRoot?: string): SkillCatalog }
    const catalog = new CatalogCtor(fixture.assetsRoot, managedSkillsRoot)

    expect(catalog.getSkillByName('shared-skill')).toMatchObject({
      description: 'Managed canonical override.',
      sourcePath: join(managedSkillsRoot, 'shared-skill', 'SKILL.md')
    })
    expect(catalog.getSkillByName('managed-only-skill')).toMatchObject({
      description: 'Runtime managed skill.',
      sourcePath: join(managedSkillsRoot, 'managed-only-skill', 'SKILL.md')
    })
  })
})
