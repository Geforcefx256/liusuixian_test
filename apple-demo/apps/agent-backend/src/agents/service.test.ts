import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'

import { SkillCatalog } from '../skills/catalog.js'
import { ManagedSkillRegistry } from '../skills/managedRegistry.js'
import { AgentCatalogService } from './service.js'

describe('AgentCatalogService governance', () => {
  let tempDir = ''

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
      tempDir = ''
    }
  })

  async function createGovernedService(): Promise<{
    registry: ManagedSkillRegistry
    service: AgentCatalogService
  }> {
    tempDir = await mkdtemp(join(tmpdir(), 'agent-catalog-governed-'))
    const skillCatalog = new SkillCatalog()
    const registry = new ManagedSkillRegistry(skillCatalog, join(tempDir, 'managed-skills.json'))
    await registry.initialize()
    return {
      registry,
      service: new AgentCatalogService(undefined, skillCatalog, registry)
    }
  }

  it('returns only governed published skills with governed display metadata', async () => {
    const { registry, service } = await createGovernedService()
    await registry.updateManagedSkill('dpi-new-bwm-pcc', {
      displayName: 'DPI 规划入口',
      displayDescription: '面向核心网规划阶段的正式起点。',
      starterSummary: '根据业务场景描述，生成 DPI 配置草案。'
    })

    const detail = service.getAgentDetail('workspace-agent')
    const skillIds = detail?.skills.map(skill => skill.id) || []
    const dpi = detail?.skills.find(skill => skill.id === 'dpi-new-bwm-pcc')

    expect(skillIds).toContain('dpi-new-bwm-pcc')
    expect(skillIds).not.toContain('pc-config-guide')
    expect(skillIds).not.toContain('pc-config-guide')
    expect(dpi).toMatchObject({
      name: 'DPI 规划入口',
      description: '面向核心网规划阶段的正式起点。',
      allowedTools: ['local:question'],
      starterSummary: '根据业务场景描述，生成 DPI 配置草案。',
      lifecycle: 'published',
      intentGroup: 'planning',
      starterEnabled: true
    })
    expect(dpi?.whenToUse).toBeUndefined()
    expect(dpi?.inputExample).toBeUndefined()
    expect(dpi?.outputExample).toBeUndefined()
    expect(dpi?.userInvocable).toBeUndefined()
    expect(dpi?.disableModelInvocation).toBeUndefined()
    expect(dpi?.model).toBeUndefined()
    expect(dpi?.effort).toBeUndefined()
    expect(dpi?.context).toBeUndefined()
  })

  it('keeps execution catalog skills on canonical metadata even when governed display metadata differs', async () => {
    const { registry, service } = await createGovernedService()
    await registry.updateManagedSkill('dpi-new-bwm-pcc', {
      displayName: 'DPI 规划入口',
      displayDescription: 'display 描述'
    })

    const execution = service.getExecutionCatalog('workspace-agent')
    const dpi = execution?.skills.find(skill => skill.id === 'dpi-new-bwm-pcc')

    expect(dpi).toMatchObject({
      name: 'dpi-new-bwm-pcc',
      allowedTools: ['local:question']
    })
    expect(dpi?.description).toContain('DPI 业务场景描述')
    expect(dpi?.description).not.toContain('display 描述')
    expect(dpi?.whenToUse).toBeUndefined()
    expect(dpi?.userInvocable).toBeUndefined()
    expect(dpi?.disableModelInvocation).toBeUndefined()
    expect(dpi?.model).toBeUndefined()
    expect(dpi?.effort).toBeUndefined()
    expect(dpi?.context).toBeUndefined()
  })

  it('keeps passthrough metadata behavior-neutral in governed runtime surfaces', async () => {
    const { registry, service } = await createGovernedService()
    await registry.updateManagedSkill('dpi-new-bwm-pcc', {
      displayName: 'DPI 规划入口',
      displayDescription: '用于校验 passthrough metadata 的治理描述。'
    })

    const detail = service.getAgentDetail('workspace-agent')
    const execution = service.getExecutionCatalog('workspace-agent')
    const detailIds = detail?.skills.map(skill => skill.id) || []
    const executionIds = execution?.skills.map(skill => skill.id) || []

    expect(detailIds).toContain('dpi-new-bwm-pcc')
    expect(detailIds).not.toContain('pc-config-guide')
    expect(executionIds).toContain('dpi-new-bwm-pcc')
  })

  it('shares the same governed display name across every bound agent', async () => {
    const { registry, service } = await createGovernedService()
    await registry.updateManagedSkill('dpi-new-bwm-pcc', {
      displayName: '统一规划入口',
      displayDescription: '所有绑定 agent 共用同一名称。',
      lifecycle: 'published',
      agentBindings: [
        { agentId: 'workspace-agent' },
        { agentId: 'mml-converter' }
      ]
    })

    expect(service.resolveGovernedSkillName('dpi-new-bwm-pcc', 'workspace-agent')).toBe('统一规划入口')
    expect(service.resolveGovernedSkillName('dpi-new-bwm-pcc', 'mml-converter')).toBe('统一规划入口')
  })

  it('keeps draft-only managed skills out of the active agent detail', async () => {
    const { registry, service } = await createGovernedService()
    await registry.updateManagedSkill('pc-config-guide', {
      lifecycle: 'draft',
      agentBindings: []
    })

    const detail = service.getAgentDetail('workspace-agent')

    expect(detail?.skills.map(skill => skill.id)).not.toContain('pc-config-guide')
  })
})
