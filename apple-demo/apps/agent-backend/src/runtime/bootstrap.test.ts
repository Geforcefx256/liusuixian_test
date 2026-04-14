import { describe, expect, it } from 'vitest'
import { RuntimeBootstrapService } from './bootstrap.js'
import type { AgentCatalogDetail } from '../agents/service.js'
import type { GatewayToolManifest } from '../gateway/tools/types.js'

function makeAgentDetail(): AgentCatalogDetail {
  return {
    id: 'mml-converter',
    name: 'MML Converter',
    description: 'desc',
    version: '1.0.0',
    skillCount: 1,
    runtime: {
      provider: 'openai',
      modelName: 'gpt-4o-mini',
      hasApiKey: true,
      source: 'default'
    },
    skills: [
      {
        id: 'tai-fqdn-converter',
        name: 'TAI/FQDN',
        description: 'convert'
      }
    ]
  }
}

function makeGatewayTools(): GatewayToolManifest[] {
  return [
    {
      id: 'default:normalize_rows',
      server: 'default',
      name: 'normalize_rows',
      description: 'normalize'
    }
  ]
}

describe('RuntimeBootstrapService', () => {
  it('returns null when agent is missing', async () => {
    const service = new RuntimeBootstrapService(
      {
        getAgentDetail: () => null
      } as any,
      () => ({ configSource: 'default', tools: makeGatewayTools() })
    )

    const result = await service.load({ agentId: 'missing-agent' })
    expect(result).toBeNull()
  })

  it('aggregates catalog and gateway tools', async () => {
    const service = new RuntimeBootstrapService(
      {
        getAgentDetail: () => makeAgentDetail()
      } as any,
      ({ provider, agentId }) => ({
        configSource: 'gateway.config.json',
        tools: provider === 'openai' && agentId === 'mml-converter'
          ? makeGatewayTools()
          : []
      }),
      () => ({
        occupied: true,
        state: 'running',
        ownerSessionId: 'session-1',
        runId: 'run-1'
      })
    )

    const result = await service.load({
      agentId: 'mml-converter',
      provider: 'openai',
      userId: 42,
      sessionId: 'session-1'
    })
    expect(result).not.toBeNull()
    expect(result?.agent.id).toBe('mml-converter')
    expect(result?.gateway.configSource).toBe('gateway.config.json')
    expect(result?.gateway.tools).toHaveLength(1)
    expect(result?.workspaceAgent).toEqual({
      plannerEnabled: false,
      defaultPrimaryAgent: 'build'
    })
    expect(result?.workspaceOccupancy).toEqual({
      occupied: true,
      state: 'running',
      ownerSessionId: 'session-1',
      runId: 'run-1'
    })
    expect(result?.toolDisplayNames).toMatchObject({
      'local:question': '等待你回答',
      'skill:read_asset': '读取技能文件'
    })
    expect(typeof result?.configVersion).toBe('string')
    expect(typeof result?.configChecksum).toBe('string')
    expect(result?.configVersion.length).toBeGreaterThan(0)
    expect(result?.configChecksum.length).toBeGreaterThan(0)
  })

  it('refreshes tool catalog metadata without loading agent', () => {
    const service = new RuntimeBootstrapService(
      {
        getAgentDetail: () => makeAgentDetail()
      } as any,
      ({ provider }) => ({
        configSource: 'gateway.config.json',
        tools: provider === 'openai' ? makeGatewayTools() : []
      })
    )

    const refreshed = service.refreshTools({ provider: 'openai' })
    expect(refreshed.configSource).toBe('gateway.config.json')
    expect(refreshed.toolCount).toBe(1)
    expect(typeof refreshed.configVersion).toBe('string')
    expect(typeof refreshed.configChecksum).toBe('string')
  })

  it('keeps shipped bootstrap local tools aligned with runtime deny policy', async () => {
    const service = new RuntimeBootstrapService({
      getAgentDetail: () => makeAgentDetail()
    } as any)

    const result = await service.load({ agentId: 'mml-converter', provider: 'openai' })
    expect(result).not.toBeNull()

    const toolIds = result?.gateway.tools
      .map(tool => tool.id)
      .filter(toolId => toolId.startsWith('local:'))
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
    expect(result?.toolDisplayNames.local_question).toBeUndefined()
    expect(result?.toolDisplayNames['local:question']).toBe('等待你回答')
    expect(result?.workspaceOccupancy).toEqual({
      occupied: false,
      state: 'idle',
      ownerSessionId: null,
      runId: null
    })
  })
})
