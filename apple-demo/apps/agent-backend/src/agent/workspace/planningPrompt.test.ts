import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'

import { SkillCatalog } from '../../skills/catalog.js'
import { ManagedSkillRegistry } from '../../skills/managedRegistry.js'
import { AgentCatalogService } from '../../agents/service.js'
import { buildPlanningSystemPrompt, buildPlanningUserInput } from './planningPrompt.js'

describe('buildPlanningSystemPrompt', () => {
  let tempDir = ''

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
      tempDir = ''
    }
  })

  it('includes agent instructions and context template', () => {
    const prompt = buildPlanningSystemPrompt({
      id: 'workspace-agent',
      name: 'Workspace Agent',
      description: 'Plan-first agent',
      version: '1.0.0',
      instructions: 'Plan before build.',
      contextTemplate: 'Question rules from CONTEXT.md'
    })

    expect(prompt).toContain('Plan before build.')
    expect(prompt).toContain('Question rules from CONTEXT.md')
  })

  it('documents planner tool boundaries and JSON output constraints', () => {
    const prompt = buildPlanningSystemPrompt({
      id: 'workspace-agent',
      name: 'Workspace Agent',
      description: 'Plan-first agent',
      version: '1.0.0',
      instructions: '',
      contextTemplate: ''
    })

    expect(prompt).toContain('local:question')
    expect(prompt).toContain('skill:skill')
    expect(prompt).toContain('local:read_file')
    expect(prompt).toContain('local:find_files')
    expect(prompt).toContain('skill:read_asset')
    expect(prompt).toContain('不能产出执行结果')
    expect(prompt).toContain('最终 JSON 对象字段为')
  })

  it('renders planner skill summaries from canonical catalog metadata', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'planning-prompt-'))
    const skillCatalog = new SkillCatalog()
    const registry = new ManagedSkillRegistry(skillCatalog, join(tempDir, 'managed-skills.json'))
    await registry.initialize()
    await registry.updateManagedSkill('dpi-new-bwm-pcc', {
      displayName: 'DPI 规划入口',
      displayDescription: 'display 描述'
    })
    const service = new AgentCatalogService(undefined, skillCatalog, registry)
    const executionCatalog = service.getExecutionCatalog('workspace-agent')

    expect(executionCatalog).not.toBeNull()
    if (!executionCatalog) return

    const prompt = buildPlanningUserInput({
      request: {
        runId: 'run-1',
        userId: 1,
        agentId: 'workspace-agent',
        sessionId: 'session-1',
        input: '帮我规划 DPI 配置'
      },
      history: [],
      availableSkills: executionCatalog.skills,
      candidateSkills: executionCatalog.skills.slice(0, 1),
      latestPlan: null
    })

    expect(prompt).toContain('id: dpi-new-bwm-pcc')
    expect(prompt).toContain('name: dpi-new-bwm-pcc')
    expect(prompt).toContain('description: 当用户提供 DPI 业务场景描述')
    expect(prompt).not.toContain('DPI 规划入口')
    expect(prompt).not.toContain('display 描述')
  })
})
