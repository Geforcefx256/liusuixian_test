import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AgentCatalogService } from '../../src/agents/service.js'
import { SkillCatalog } from '../../src/skills/catalog.js'

describe('AgentCatalogService', () => {
  it('lists agents from source asset catalog metadata', () => {
    const service = new AgentCatalogService(undefined, new SkillCatalog())
    const agents = service.listAgents()

    expect(agents.length).toBeGreaterThan(0)
    expect(agents.some(agent => agent.id === 'workspace-agent')).toBe(true)
  })

  it('returns workspace assistant detail with runtime and skill file requirements', () => {
    const skillCatalog = new SkillCatalog()
    const service = new AgentCatalogService(undefined, skillCatalog)
    const detail = service.getAgentDetail('workspace-agent')
    const expectedSkills = skillCatalog.getSkillsForAgent('workspace-agent').map(skill => skill.id)

    expect(detail?.id).toBe('workspace-agent')
    expect(detail?.name).toBe('小曼智能体')
    expect(detail?.presentation?.title).toBe('小曼智能体')
    expect(detail?.presentation?.summary).toBeTruthy()
    expect(detail?.runtime.modelName).toBeTruthy()
    expect(detail?.skills.map(skill => skill.id)).toEqual(expectedSkills)
  })

  it('loads execution catalog for workspace assistant', () => {
    const service = new AgentCatalogService(undefined, new SkillCatalog())
    const execution = service.getExecutionCatalog('workspace-agent')

    expect(execution?.agent.id).toBe('workspace-agent')
    expect(execution?.agent.instructions).toContain('workspace-agent')
    expect(execution?.agent.contextTemplate).toContain('`select` 只用于封闭选项，且至少提供 `2` 个选项')
    expect(execution?.skills.length).toBeGreaterThan(0)
  })

  it('supports published dist asset roots', async () => {
    const assetsRoot = await mkdtemp(join(tmpdir(), 'agent-backend-assets-'))
    await mkdir(join(assetsRoot, 'agents', 'workspace-agent'), { recursive: true })
    await mkdir(join(assetsRoot, 'skills', 'demo-skill'), { recursive: true })
    await writeFile(join(assetsRoot, 'agents', 'manifest.json'), JSON.stringify({
      agents: [{ id: 'workspace-agent', path: '/agents/workspace-agent', enabled: true }]
    }), 'utf8')
    await writeFile(join(assetsRoot, 'agents', 'workspace-agent', 'AGENT.md'), `---
id: workspace-agent
name: 小曼智能体
description: Dist asset
---
dist agent`, 'utf8')
    await writeFile(join(assetsRoot, 'agents', 'workspace-agent', 'CONTEXT.md'), 'dist context', 'utf8')
    await writeFile(join(assetsRoot, 'skills', 'demo-skill', 'SKILL.md'), `---
id: demo-skill
name: demo-skill
description: Dist skill
---
dist skill body`, 'utf8')

    const skillCatalog = new SkillCatalog(assetsRoot)
    const service = new AgentCatalogService(undefined, skillCatalog, undefined, assetsRoot)
    const detail = service.getAgentDetail('workspace-agent')

    expect(detail?.id).toBe('workspace-agent')
    expect(detail?.skills.some(skill => skill.id === 'demo-skill')).toBe(true)
  })

  it('loads workspace-agent skills from the shared skill library', () => {
    const catalog = new SkillCatalog()
    const skill = catalog.getSkillByName('dpi-new-bwm-pcc', 'workspace-agent')

    expect(skill).toBeTruthy()
    expect(skill?.ownerAgentId).toBe('shared-skill-library')
    expect(skill?.sourcePath.replace(/\\/g, '/')).toContain('apps/agent-backend/assets/skills/dpi-new-bwm-pcc/SKILL.md')
  })

  it('keeps current shared skills without script manifests free of exec templates', () => {
    const catalog = new SkillCatalog()
    const skill = catalog.getSkillByName('pc-config-guide', 'workspace-agent')

    expect(skill).toBeTruthy()
    expect(skill?.ownerAgentId).toBe('shared-skill-library')
    expect(skill?.sourcePath.replace(/\\/g, '/')).toContain('apps/agent-backend/assets/skills/pc-config-guide/SKILL.md')
    expect(skill?.execTemplates).toEqual([])
  })
})
