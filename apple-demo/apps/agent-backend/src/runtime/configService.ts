import { createHash } from 'node:crypto'
import type { AgentCatalogDetail } from '../agents/service.js'
import type { RuntimeBootstrapGatewayPayload } from './bootstrap.js'
import type { WorkspaceAgentRuntimeConfig } from '../agent/workspace/runtimeConfig.js'

export interface RuntimeConfigMetadata {
  configVersion: string
  configChecksum: string
  sources: {
    skills: string
    gateway: string
    mcp: string
    model: string
  }
}

export interface RuntimeConfigPayload {
  agent: AgentCatalogDetail
  gateway: RuntimeBootstrapGatewayPayload
  workspaceAgent: WorkspaceAgentRuntimeConfig
  toolDisplayNames: Record<string, string>
  mcpConfigSource?: string
}

const SKILLS_SOURCE = 'preload'

export class RuntimeConfigService {
  build(payload: RuntimeConfigPayload): RuntimeConfigMetadata {
    const serialized = JSON.stringify({
      agentId: payload.agent.id,
      model: payload.agent.runtime,
      workspaceAgent: payload.workspaceAgent,
      gatewaySource: payload.gateway.configSource,
      gatewayTools: payload.gateway.tools.map(tool => tool.id).sort(),
      toolDisplayNames: Object.entries(payload.toolDisplayNames).sort(([left], [right]) => left.localeCompare(right))
    })
    const checksum = createHash('sha1')
      .update(serialized)
      .digest('hex')
      .slice(0, 12)

    return {
      configVersion: `config-${checksum}`,
      configChecksum: checksum,
      sources: {
        skills: SKILLS_SOURCE,
        gateway: payload.gateway.configSource,
        mcp: payload.mcpConfigSource || 'runtime',
        model: payload.agent.runtime.source
      }
    }
  }
}
