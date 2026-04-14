import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'

import { SkillCatalog } from '../../../skills/catalog.js'
import { ManagedSkillRegistry } from '../../../skills/managedRegistry.js'
import { createSkillFixtureSet } from '../../../../tests/skillFixtures.js'
import { SkillToolProvider } from './skillProvider.js'

describe('SkillToolProvider asset tools', () => {
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

  it('reads, lists, and finds assets within one approved skill package', async () => {
    const provider = await createGovernedProvider()

    const readResponse = await provider.invoke({
      tool: 'read_asset',
      agentId: 'workspace-agent',
      args: {
        skillName: 'sheet-analyzer',
        path: 'reference/guide.md'
      }
    })
    const listResponse = await provider.invoke({
      tool: 'list_assets',
      agentId: 'workspace-agent',
      args: {
        skillName: 'sheet-analyzer',
        path: 'reference'
      }
    })
    const findResponse = await provider.invoke({
      tool: 'find_assets',
      agentId: 'workspace-agent',
      args: {
        skillName: 'sheet-analyzer',
        pattern: '**/*.md'
      }
    })

    expect(readResponse.ok).toBe(true)
    expect(listResponse.ok).toBe(true)
    expect(findResponse.ok).toBe(true)
    if (!readResponse.ok || !listResponse.ok || !findResponse.ok) {
      throw new Error('expected skill asset tools to succeed')
    }

    const readPayload = JSON.parse(readResponse.result.summary) as {
      type: string
      path: string
      content: string
    }
    const listPayload = JSON.parse(listResponse.result.summary) as {
      type: string
      path: string
      entries: Array<{ name: string; type: string }>
    }
    const findPayload = JSON.parse(findResponse.result.summary) as {
      type: string
      matches: string[]
    }

    expect(readPayload).toMatchObject({
      type: 'file',
      path: 'reference/guide.md'
    })
    expect(readPayload.content).toContain('1 | # Guide')
    expect(listPayload).toMatchObject({
      type: 'directory',
      path: 'reference'
    })
    expect(listPayload.entries).toEqual([
      { name: 'guide.md', type: 'file' }
    ])
    expect(findPayload).toMatchObject({
      type: 'search_results'
    })
    expect(findPayload.matches.map(match => match.replace(/\\/g, '/'))).toContain('reference/guide.md')
  })

  it('rejects direct SKILL.md reads through read_asset', async () => {
    const provider = await createGovernedProvider()

    const response = await provider.invoke({
      tool: 'read_asset',
      agentId: 'workspace-agent',
      args: {
        skillName: 'sheet-analyzer',
        path: 'skill.md'
      }
    })

    expect(response.ok).toBe(false)
    if (response.ok) {
      throw new Error('expected SKILL.md read to fail')
    }
    expect(response.error.message).toBe('Direct SKILL.md reads are not allowed. Use the skill tool instead.')
  })

  it('denies asset access for unapproved skills', async () => {
    const provider = await createGovernedProvider()

    const response = await provider.invoke({
      tool: 'read_asset',
      agentId: 'workspace-agent',
      args: {
        skillName: 'hidden-skill',
        path: 'reference/secret.md'
      }
    })

    expect(response.ok).toBe(false)
    if (response.ok) {
      throw new Error('expected unapproved skill access to fail')
    }
    expect(response.error.type).toBe('TOOL_DENIED')
    expect(response.error.message).toContain('E_SKILL_NOT_APPROVED')
  })

  it('rejects missing skillName and path escapes explicitly', async () => {
    const provider = await createGovernedProvider()

    const missingSkill = await provider.invoke({
      tool: 'read_asset',
      agentId: 'workspace-agent',
      args: {
        path: 'reference/guide.md'
      }
    })
    const escapedPath = await provider.invoke({
      tool: 'list_assets',
      agentId: 'workspace-agent',
      args: {
        skillName: 'sheet-analyzer',
        path: '../'
      }
    })

    expect(missingSkill.ok).toBe(false)
    expect(escapedPath.ok).toBe(false)
    if (missingSkill.ok || escapedPath.ok) {
      throw new Error('expected validation and boundary failures')
    }
    expect(missingSkill.error.type).toBe('VALIDATION_ERROR')
    expect(missingSkill.error.message).toBe('skillName is required')
    expect(escapedPath.error.message).toContain('outside workspace')
  })

  it('keeps file-versus-directory mismatches explicit', async () => {
    const provider = await createGovernedProvider()

    const readDirectory = await provider.invoke({
      tool: 'read_asset',
      agentId: 'workspace-agent',
      args: {
        skillName: 'sheet-analyzer',
        path: 'reference'
      }
    })
    const listFile = await provider.invoke({
      tool: 'list_assets',
      agentId: 'workspace-agent',
      args: {
        skillName: 'sheet-analyzer',
        path: 'reference/guide.md'
      }
    })

    expect(readDirectory.ok).toBe(false)
    expect(listFile.ok).toBe(false)
    if (readDirectory.ok || listFile.ok) {
      throw new Error('expected type mismatch failures')
    }
    expect(readDirectory.error.message).toBe('Path is a directory. Use list_assets instead.')
    expect(listFile.error.message).toBe('Path is not a directory. Use read_asset instead.')
  })

  async function createGovernedProvider(): Promise<SkillToolProvider> {
    const fixture = await createSkillFixtureSet([
      {
        id: 'sheet-analyzer',
        content: [
          '---',
          'id: sheet-analyzer',
          'name: sheet-analyzer',
          'description: analyze sheets',
          '---',
          '',
          'Read the guide before execution.'
        ].join('\n'),
        files: {
          'reference/guide.md': '# Guide\nUse approved assets only.\n',
          'templates/config.json': '{\n  "mode": "strict"\n}\n'
        }
      },
      {
        id: 'hidden-skill',
        content: [
          '---',
          'id: hidden-skill',
          'name: hidden-skill',
          'description: hidden',
          '---',
          '',
          'Not approved.'
        ].join('\n'),
        files: {
          'reference/secret.md': 'top secret\n'
        }
      }
    ])
    cleanupFixture = fixture.cleanup
    tempDir = await mkdtemp(join(tmpdir(), 'skill-tool-provider-assets-'))

    const skillCatalog = new SkillCatalog(fixture.assetsRoot)
    const registry = new ManagedSkillRegistry(skillCatalog, join(tempDir, 'managed-skills.json'))
    await registry.initialize()
    await registry.updateManagedSkill('sheet-analyzer', {
      lifecycle: 'published',
      displayName: 'Sheet Analyzer'
    })

    return new SkillToolProvider(skillCatalog, registry)
  }
})
