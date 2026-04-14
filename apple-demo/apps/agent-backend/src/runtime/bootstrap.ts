import { AgentCatalogService, type AgentCatalogDetail } from '../agents/service.js'
import { createDefaultToolProviderRegistry } from './tools/index.js'
import type { GatewayToolManifest } from '../gateway/tools/types.js'
import { RuntimeConfigService } from './configService.js'
import { loadConfig } from '../memory/ConfigLoader.js'
import { SkillCatalog } from '../skills/catalog.js'
import {
  getWorkspaceAgentRuntimeConfig,
  type WorkspaceAgentRuntimeConfig
} from '../agent/workspace/runtimeConfig.js'
import type { WorkspaceOccupancy } from '../agent/service/types.js'

export interface RuntimeBootstrapGatewayPayload {
  configSource: string
  tools: GatewayToolManifest[]
}

export interface RuntimeBootstrapPayload {
  agent: AgentCatalogDetail
  gateway: RuntimeBootstrapGatewayPayload
  workspaceAgent: WorkspaceAgentRuntimeConfig
  workspaceOccupancy: WorkspaceOccupancy
  toolDisplayNames: Record<string, string>
  configVersion: string
  configChecksum: string
}

export interface RuntimeBootstrapParams {
  agentId?: string
  provider?: string
  userId?: number
  sessionId?: string
}

type GatewayCatalogResolver = (params: RuntimeBootstrapParams) => RuntimeBootstrapGatewayPayload
type WorkspaceOccupancyResolver = (params: {
  userId?: number
  agentId: string
  sessionId?: string
}) => WorkspaceOccupancy | Promise<WorkspaceOccupancy>

const DEFAULT_WORKSPACE_OCCUPANCY: WorkspaceOccupancy = {
  occupied: false,
  state: 'idle',
  ownerSessionId: null,
  runId: null
}

function defaultGatewayCatalogResolver(params: RuntimeBootstrapParams): RuntimeBootstrapGatewayPayload {
  const config = loadConfig()
  const skillCatalog = new SkillCatalog()
  const registry = createDefaultToolProviderRegistry({
    runtimeRoot: config.runtime.workspaceDir,
    skillCatalog,
    toolDenyList: config.runtime.tools.deny,
    filesystemTools: config.runtime.filesystemTools
  })
  const catalog = registry.catalog({
    provider: params.provider,
    agentId: params.agentId
  })

  return {
    configSource: 'runtime',
    tools: catalog.tools
  }
}

export class RuntimeBootstrapService {
  constructor(
    private readonly agentCatalogService: Pick<AgentCatalogService, 'getAgentDetail'>,
    private readonly gatewayCatalogResolver: GatewayCatalogResolver = defaultGatewayCatalogResolver,
    private readonly workspaceOccupancyResolver: WorkspaceOccupancyResolver = () => DEFAULT_WORKSPACE_OCCUPANCY,
    private readonly runtimeConfigService = new RuntimeConfigService()
  ) {}

  async load(params: { agentId: string; provider?: string; userId?: number; sessionId?: string }): Promise<RuntimeBootstrapPayload | null> {
    const agent = this.agentCatalogService.getAgentDetail(params.agentId)
    if (!agent) return null
    const toolDisplayNames = { ...loadConfig().runtime.tools.displayNames }
    const gateway = this.gatewayCatalogResolver(params)
    const workspaceAgent = getWorkspaceAgentRuntimeConfig(params.agentId)
    const workspaceOccupancy = await this.workspaceOccupancyResolver({
      userId: params.userId,
      agentId: params.agentId,
      sessionId: params.sessionId
    })
    const runtimeConfig = this.runtimeConfigService.build({
      agent,
      gateway,
      workspaceAgent,
      toolDisplayNames
    })

    return {
      agent,
      gateway,
      workspaceAgent,
      workspaceOccupancy,
      toolDisplayNames,
      configVersion: runtimeConfig.configVersion,
      configChecksum: runtimeConfig.configChecksum
    }
  }

  refreshTools(params: RuntimeBootstrapParams): {
    configSource: string
    toolCount: number
    configVersion: string
    configChecksum: string
  } {
    const gateway = this.gatewayCatalogResolver(params)
    const runtimeConfig = this.runtimeConfigService.build({
      agent: {
        id: params.agentId || 'unknown',
        name: 'runtime',
        description: 'runtime',
        version: '0',
        skillCount: 0,
        presentation: {
          title: 'runtime',
          summary: 'runtime',
          role: '',
          capabilities: []
        },
        runtime: {
          provider: 'openai',
          modelName: 'runtime',
          stream: true,
          hasApiKey: false,
          hasCustomHeaders: false,
          source: 'default'
        },
        skills: []
      },
      gateway,
      workspaceAgent: getWorkspaceAgentRuntimeConfig(params.agentId || 'unknown'),
      toolDisplayNames: { ...loadConfig().runtime.tools.displayNames }
    })
    return {
      configSource: gateway.configSource,
      toolCount: gateway.tools.length,
      configVersion: runtimeConfig.configVersion,
      configChecksum: runtimeConfig.configChecksum
    }
  }
}
