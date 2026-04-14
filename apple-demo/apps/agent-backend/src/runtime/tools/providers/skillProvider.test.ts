import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'

import { SkillCatalog } from '../../../skills/catalog.js'
import { createSkillFixtureSet } from '../../../../tests/skillFixtures.js'
import { SkillToolProvider } from './skillProvider.js'

describe('SkillToolProvider exec governance', () => {
  let cleanupFixture: (() => Promise<void>) | null = null

  afterEach(async () => {
    if (cleanupFixture) {
      await cleanupFixture()
      cleanupFixture = null
    }
  })

  it('returns a short visible summary plus hidden injected skill-context side effects for skill loads', async () => {
    const fixture = await createSkillFixtureSet([
      {
        id: 'demo-skill',
        content: [
          '---',
          'id: demo-skill',
          'name: demo-skill',
          'description: governed skill',
          '---',
          '',
          'Step 1',
          'Step 2'
        ].join('\n'),
        files: {
          'docs/reference.md': 'ref'
        }
      }
    ])
    cleanupFixture = fixture.cleanup

    const provider = new SkillToolProvider(new SkillCatalog(fixture.assetsRoot))
    const response = await provider.invoke({
      tool: 'skill',
      args: {
        name: 'demo-skill'
      }
    })

    expect(response.ok).toBe(true)
    if (!response.ok) return
    expect(response.result.summary).toContain('Loaded skill "demo-skill"')
    expect(response.result.summary).not.toContain('Step 1')
    expect(response.result.sideEffects?.injectedMessages).toEqual([expect.objectContaining({
      role: 'assistant',
      visibility: 'hidden',
      semantic: 'skill-context',
      skillName: 'demo-skill',
      text: expect.stringContaining('<skill_content name="demo-skill">')
    })])
    expect(response.result.sideEffects?.injectedMessages[0]?.text).toContain('Step 1')
  })

  it('executes approved governed templates and registers artifact outputs', async () => {
    const fixture = await createSkillFixtureSet([
      {
        id: 'approved-script',
        content: ['---', 'id: approved-script', 'name: approved-script', 'description: governed script', 'allowed-tools:', '  - skill:exec', '---', '', 'Body'].join('\n'),
        scriptsYaml: [
          'templates:',
          '  - id: generate',
          '    description: Generate an artifact',
          '    entry: scripts/generate.js',
          '    timeoutSeconds: 5',
          '    inputSchema:',
          '      type: object',
          '      additionalProperties: false',
          '      properties:',
          '        fileName:',
          '          type: string',
          '      required: [fileName]',
          '    argv:',
          '      - kind: payload',
          '        encoding: json'
        ].join('\n'),
        files: {
          'scripts/generate.js': [
            'const fs = require("node:fs")',
            'const path = require("node:path")',
            'const payload = JSON.parse(process.argv[2])',
            'const outputPath = path.join(process.env.WORKSPACE_PROJECT_DIR, payload.fileName)',
            'fs.mkdirSync(path.dirname(outputPath), { recursive: true })',
            'fs.writeFileSync(outputPath, "artifact", "utf8")',
            'process.stdout.write(JSON.stringify({',
            '  kind: "artifact_ref",',
            '  data: { path: outputPath }',
            '}))'
          ].join('\n')
        }
      }
    ])
    cleanupFixture = fixture.cleanup

    const provider = new SkillToolProvider(new SkillCatalog(fixture.assetsRoot), undefined, {
      runtimeRoot: fixture.assetsRoot
    })
    const response = await provider.invoke({
      tool: 'exec',
      allowedSkillIds: ['approved-script'],
      args: {
        skillName: 'approved-script',
        templateId: 'generate',
        args: {
          fileName: 'reports/output.json'
        }
      },
      workspaceScope: {
        userId: 7,
        agentId: `skill-exec-${randomUUID()}`
      }
    })

    expect(response.ok).toBe(true)
    if (!response.ok) return
    const summary = JSON.parse(response.result.summary) as {
      kind: string
      data: Record<string, unknown>
    }
    expect(summary.kind).toBe('artifact_ref')
    expect(summary.data.fileId).toEqual(expect.any(String))
    expect(summary.data.fileKey).toEqual(expect.any(String))
    expect(summary.data.path).toBe('project/reports/output.json')
  })

  it('returns TOOL_NOT_FOUND when the template id is missing on an approved skill', async () => {
    const fixture = await createSkillFixtureSet([
      {
        id: 'approved-script',
        content: ['---', 'id: approved-script', 'name: approved-script', 'description: governed script', '---', '', 'Body'].join('\n'),
        scriptsYaml: [
          'templates:',
          '  - id: generate',
          '    description: Generate',
          '    entry: scripts/generate.js',
          '    inputSchema:',
          '      type: object',
          '      additionalProperties: false',
          '      properties: {}',
          '    argv:',
          '      - kind: payload',
          '        encoding: json'
        ].join('\n'),
        files: {
          'scripts/generate.js': 'process.stdout.write("ok")'
        }
      }
    ])
    cleanupFixture = fixture.cleanup

    const provider = new SkillToolProvider(new SkillCatalog(fixture.assetsRoot))
    const response = await provider.invoke({
      tool: 'exec',
      allowedSkillIds: ['approved-script'],
      args: {
        skillName: 'approved-script',
        templateId: 'missing',
        args: {}
      },
      workspaceScope: {
        userId: 7,
        agentId: 'skill-exec-missing-template'
      }
    })

    expect(response.ok).toBe(false)
    if (response.ok) return
    expect(response.error.type).toBe('TOOL_NOT_FOUND')
    expect(response.error.message).toContain('E_TEMPLATE_NOT_FOUND')
  })

  it('returns TOOL_DENIED when the skill exists but is not approved for execution', async () => {
    const fixture = await createSkillFixtureSet([
      {
        id: 'approved-script',
        content: ['---', 'id: approved-script', 'name: approved-script', 'description: governed script', '---', '', 'Body'].join('\n'),
        scriptsYaml: [
          'templates:',
          '  - id: generate',
          '    description: Generate',
          '    entry: scripts/generate.js',
          '    inputSchema:',
          '      type: object',
          '      additionalProperties: false',
          '      properties: {}',
          '    argv:',
          '      - kind: payload',
          '        encoding: json'
        ].join('\n'),
        files: {
          'scripts/generate.js': 'process.stdout.write("ok")'
        }
      }
    ])
    cleanupFixture = fixture.cleanup

    const provider = new SkillToolProvider(new SkillCatalog(fixture.assetsRoot))
    const response = await provider.invoke({
      tool: 'exec',
      allowedSkillIds: [],
      args: {
        skillName: 'approved-script',
        templateId: 'generate',
        args: {}
      },
      workspaceScope: {
        userId: 7,
        agentId: 'skill-exec-denied'
      }
    })

    expect(response.ok).toBe(false)
    if (response.ok) return
    expect(response.error.type).toBe('TOOL_DENIED')
    expect(response.error.message).toContain('E_SKILL_NOT_APPROVED')
  })

  it('returns VALIDATION_ERROR when structured exec args fail before process start', async () => {
    const fixture = await createSkillFixtureSet([
      {
        id: 'approved-script',
        content: ['---', 'id: approved-script', 'name: approved-script', 'description: governed script', '---', '', 'Body'].join('\n'),
        scriptsYaml: [
          'templates:',
          '  - id: generate',
          '    description: Generate',
          '    entry: scripts/generate.js',
          '    inputSchema:',
          '      type: object',
          '      additionalProperties: false',
          '      properties:',
          '        fileName:',
          '          type: string',
          '      required: [fileName]',
          '    argv:',
          '      - kind: payload',
          '        encoding: json'
        ].join('\n'),
        files: {
          'scripts/generate.js': 'process.stdout.write("ok")'
        }
      }
    ])
    cleanupFixture = fixture.cleanup

    const provider = new SkillToolProvider(new SkillCatalog(fixture.assetsRoot))
    const response = await provider.invoke({
      tool: 'exec',
      allowedSkillIds: ['approved-script'],
      args: {
        skillName: 'approved-script',
        templateId: 'generate',
        args: {}
      },
      workspaceScope: {
        userId: 7,
        agentId: 'skill-exec-invalid'
      }
    })

    expect(response.ok).toBe(false)
    if (response.ok) return
    expect(response.error.type).toBe('VALIDATION_ERROR')
    expect(response.error.message).toContain('args.fileName is required')
  })
})
