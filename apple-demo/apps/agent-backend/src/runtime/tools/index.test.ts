import { describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createDefaultToolProviderRegistry } from './index.js'
import { SQLiteAgentSessionStore } from '../../agent/sessionStore.js'
import { loadConfig } from '../../memory/ConfigLoader.js'
import { SkillCatalog } from '../../skills/catalog.js'
import { ManagedSkillRegistry } from '../../skills/managedRegistry.js'
import { createSkillFixtureSet } from '../../../tests/skillFixtures.js'

describe('createDefaultToolProviderRegistry', () => {
  it('uses the injected workspace dir for local:read_file', async () => {
    const runtimeRoot = resolve(process.cwd(), '..')
    const registry = createDefaultToolProviderRegistry({ runtimeRoot })

    const result = await registry.invoke({
      tool: 'local:read_file',
      args: {
        path: 'agent-backend/assets/agents/workspace-agent/CONTEXT.md',
        limit: 5
      }
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('expected local:read_file to succeed')
    }
    const payload = JSON.parse(result.result.summary) as {
      success?: boolean
      type?: string
      content?: string
    }
    expect(payload.success).toBe(true)
    expect(payload.type).toBe('file')
    expect(payload.content).toContain('1 |')
  })

  it('passes filesystem compatibility mode to the local provider catalog', () => {
    const runtimeRoot = resolve(process.cwd(), '..')
    const registry = createDefaultToolProviderRegistry({
      runtimeRoot,
      filesystemTools: {
        compatibilityMode: true
      }
    })

    const localProvider = registry.getProvider('local') as {
      config?: {
        filesystemTools?: {
          compatibilityMode?: boolean
        }
      }
    }

    expect(localProvider.config).toEqual(
      expect.objectContaining({
        filesystemTools: {
          compatibilityMode: true
        }
      })
    )
  })

  it('catalogs all local filesystem tools through the registry', () => {
    const runtimeRoot = resolve(process.cwd(), '..')
    const registry = createDefaultToolProviderRegistry({ runtimeRoot })

    const catalog = registry.catalog({ toolProvider: 'local' })
    const toolIds = catalog.tools.map(tool => tool.id).sort()

    expect(toolIds).toEqual([
      'local:edit',
      'local:find_files',
      'local:grep',
      'local:list_directory',
      'local:question',
      'local:read_file',
      'local:write'
    ])
  })

  it('exposes explicit runtime retry eligibility for local tools', () => {
    const runtimeRoot = resolve(process.cwd(), '..')
    const registry = createDefaultToolProviderRegistry({ runtimeRoot })

    const catalog = registry.catalog({ toolProvider: 'local' })
    const readFile = catalog.tools.find(tool => tool.id === 'local:read_file')
    const edit = catalog.tools.find(tool => tool.id === 'local:edit')
    const write = catalog.tools.find(tool => tool.id === 'local:write')

    expect(readFile?.runtimePolicy).toEqual({
      idempotent: true,
      supportsRuntimeRetry: true,
      supportsModelRecovery: true
    })
    expect(edit?.runtimePolicy).toEqual({
      idempotent: false,
      supportsRuntimeRetry: false,
      supportsModelRecovery: true
    })
    expect(write?.runtimePolicy).toEqual({
      idempotent: false,
      supportsRuntimeRetry: false,
      supportsModelRecovery: true
    })
  })

  it('passes deny list to the registry without affecting provider wiring', () => {
    const runtimeRoot = resolve(process.cwd(), '..')
    const registry = createDefaultToolProviderRegistry({
      runtimeRoot,
      toolDenyList: ['local:grep']
    })

    const catalog = registry.catalog({ toolProvider: 'local' })
    const toolIds = catalog.tools.map(tool => tool.id)

    expect(toolIds).not.toContain('local:grep')
    expect(toolIds).toContain('local:read_file')
  })

  it('keeps shipped local defaults exposing local:grep for executor surfaces', () => {
    const config = loadConfig()
    const registry = createDefaultToolProviderRegistry({
      runtimeRoot: config.runtime.workspaceDir,
      toolDenyList: config.runtime.tools.deny,
      filesystemTools: config.runtime.filesystemTools
    })

    const toolIds = registry.catalog({ toolProvider: 'local' }).tools
      .map(tool => tool.id)
      .sort()

    expect(toolIds).toEqual([
      'local:edit',
      'local:find_files',
      'local:grep',
      'local:list_directory',
      'local:question',
      'local:read_file',
      'local:write'
    ])
  })

  it('catalogs namespaced skill asset tools for governed execution surfaces without script templates', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'tool-registry-skill-assets-'))
    try {
      const skillCatalog = new SkillCatalog()
      const managedSkillRegistry = new ManagedSkillRegistry(skillCatalog, join(tempDir, 'managed-skills.json'))
      await managedSkillRegistry.initialize()
      await managedSkillRegistry.updateManagedSkill('dpi-new-bwm-pcc', {
        displayName: 'DPI 规划入口'
      })

      const registry = createDefaultToolProviderRegistry({
        runtimeRoot: resolve(process.cwd(), '..'),
        skillCatalog,
        managedSkillRegistry
      })

      const toolIds = registry.catalog({ agentId: 'workspace-agent' }).tools
        .map(tool => tool.id)

      expect(toolIds).toContain('skill:skill')
      expect(toolIds).toContain('skill:read_asset')
      expect(toolIds).toContain('skill:list_assets')
      expect(toolIds).toContain('skill:find_assets')
      expect(toolIds).not.toContain('skill:exec')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('keeps skill:exec description stable without embedding template metadata', async () => {
    const fixture = await createSkillFixtureSet([
      {
        id: 'approved-script',
        content: ['---', 'id: approved-script', 'name: approved-script', 'description: approved skill', '---', '', 'Body'].join('\n'),
        scriptsYaml: [
          'templates:',
          '  - id: run',
          '    description: Approved script',
          '    entry: scripts/run.js',
          '    inputSchema:',
          '      type: object',
          '      additionalProperties: false',
          '      properties: {}',
          '    argv:',
          '      - kind: payload',
          '        encoding: json'
        ].join('\n'),
        files: {
          'scripts/run.js': 'process.stdout.write("ok")'
        }
      },
      {
        id: 'hidden-script',
        content: ['---', 'id: hidden-script', 'name: hidden-script', 'description: hidden skill', '---', '', 'Body'].join('\n'),
        scriptsYaml: [
          'templates:',
          '  - id: hide',
          '    description: Hidden script',
          '    entry: scripts/run.js',
          '    inputSchema:',
          '      type: object',
          '      additionalProperties: false',
          '      properties: {}',
          '    argv:',
          '      - kind: payload',
          '        encoding: json'
        ].join('\n'),
        files: {
          'scripts/run.js': 'process.stdout.write("hidden")'
        }
      }
    ])

    try {
      const registry = createDefaultToolProviderRegistry({
        runtimeRoot: resolve(process.cwd(), '..'),
        skillCatalog: new SkillCatalog(fixture.assetsRoot)
      })

      const execTool = registry.catalog({
        toolProvider: 'skill',
        allowedSkillIds: ['approved-script']
      }).tools.find(tool => tool.id === 'skill:exec')

      expect(execTool?.description).toContain('Execute an approved governed script template from a canonical skill package.')
      expect(execTool?.description).toContain('Load the relevant skill with the `skill` tool before calling `skill:exec`')
      expect(execTool?.description).not.toContain('approved-script')
      expect(execTool?.description).not.toContain('run')
      expect(execTool?.description).not.toContain('hidden-script')
      expect(execTool?.description).not.toContain('hide')
    } finally {
      await fixture.cleanup()
    }
  })

  it('removes local:search_in_files while keeping local:grep in the shipped local catalog', async () => {
    const config = loadConfig()
    const sessionStore = new SQLiteAgentSessionStore({ dbPath: ':memory:' })
    const registry = createDefaultToolProviderRegistry({
      runtimeRoot: config.runtime.workspaceDir,
      sessionStore,
      toolDenyList: config.runtime.tools.deny,
      filesystemTools: config.runtime.filesystemTools
    })

    const localToolIds = registry.catalog({ toolProvider: 'local' }).tools.map(tool => tool.id)

    expect(localToolIds).toContain('local:grep')
    expect(localToolIds).not.toContain('local:search_in_files')

    const interactive = await registry.invoke({
      tool: 'local:question',
      args: {
        prompt: '请确认默认工具集',
        fields: [
          {
            id: 'confirmation',
            label: '确认',
            type: 'text',
            required: true
          }
        ]
      },
      sessionKey: 'shipped-defaults-question',
      workspaceScope: {
        userId: 7,
        agentId: 'agent-defaults'
      },
      trace: {
        runId: 'run-defaults',
        turnId: 'turn-defaults',
        toolCallId: 'tool-defaults'
      }
    })
    expect(interactive.ok).toBe(true)
  })

  it('persists pending interactions for local:question when sessionStore is injected', async () => {
    const runtimeRoot = resolve(process.cwd(), '..')
    const sessionStore = new SQLiteAgentSessionStore({ dbPath: ':memory:' })
    const registry = createDefaultToolProviderRegistry({
      runtimeRoot,
      sessionStore
    })

    const result = await registry.invoke({
      tool: 'local:question',
      args: {
        prompt: '请补充预算',
        fields: [
          {
            id: 'budget',
            label: '预算',
            type: 'text',
            required: true
          }
        ]
      },
      sessionKey: 'session-question',
      workspaceScope: {
        userId: 42,
        agentId: 'agent-1'
      },
      trace: {
        runId: 'run-question',
        turnId: 'turn-1',
        toolCallId: 'tool-1'
      }
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('expected local:question to succeed')
    }

    const pending = await sessionStore.listInteractions({
      userId: 42,
      agentId: 'agent-1',
      sessionId: 'session-question',
      statuses: ['pending']
    })

    expect(pending).toHaveLength(1)
    expect(pending[0]).toMatchObject({
      runId: 'run-question',
      kind: 'question',
      status: 'pending'
    })
  })

  it('returns structured correction hints for stable local:question validation errors', async () => {
    const runtimeRoot = resolve(process.cwd(), '..')
    const sessionStore = new SQLiteAgentSessionStore({ dbPath: ':memory:' })
    const registry = createDefaultToolProviderRegistry({
      runtimeRoot,
      sessionStore
    })

    const result = await registry.invoke({
      tool: 'local:question',
      args: {
        prompt: '请选择发布环境',
        options: [{ label: '生产', value: 'prod' }]
      },
      sessionKey: 'session-question-invalid',
      workspaceScope: {
        userId: 42,
        agentId: 'agent-1'
      },
      trace: {
        runId: 'run-question-invalid',
        turnId: 'turn-1',
        toolCallId: 'tool-question-invalid'
      }
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error('expected local:question validation to fail')
    }
    expect(result.error).toMatchObject({
      type: 'VALIDATION_ERROR',
      message: 'Select options must contain at least 2 items.',
      field: 'options',
      expected: 'at least 2 options',
      actual: 'fewer than 2 options',
      fix: 'Add more options.'
    })
  })
})
