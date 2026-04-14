import { loadGatewayConfigWithSource } from '../../gateway/tools/config.js'
import { loadMCPConfigWithSource } from '../../mcp/config.js'
import { ToolProviderRegistry } from './registry.js'
import { GatewayToolProvider } from './providers/gatewayProvider.js'
import { MCPToolProvider } from './providers/mcpProvider.js'
import { LocalToolProvider } from './providers/localProvider.js'
import { SkillToolProvider } from './providers/skillProvider.js'
import type { SkillCatalog } from '../../skills/catalog.js'
import type { ManagedSkillRegistry } from '../../skills/managedRegistry.js'
import type { AgentSessionStore } from '../../agent/sessionStore.js'

export interface DefaultToolProviderRegistryParams {
  runtimeRoot: string
  logDetail?: boolean
  sessionStore?: AgentSessionStore
  skillCatalog?: SkillCatalog
  managedSkillRegistry?: ManagedSkillRegistry
  toolDenyList?: string[]
  filesystemTools?: {
    compatibilityMode?: boolean
  }
}

export function createDefaultToolProviderRegistry(params: DefaultToolProviderRegistryParams): ToolProviderRegistry {
  const registry = new ToolProviderRegistry({
    deny: params.toolDenyList
  })

  const gateway = loadGatewayConfigWithSource()
  const mcp = loadMCPConfigWithSource()

  registry.register(new LocalToolProvider({
    runtimeRoot: params.runtimeRoot,
    logDetail: params.logDetail,
    sessionStore: params.sessionStore,
    filesystemTools: {
      compatibilityMode: params.filesystemTools?.compatibilityMode ?? true
    }
  }))
  if (params.skillCatalog) {
    registry.register(new SkillToolProvider(params.skillCatalog, params.managedSkillRegistry, {
      logDetail: params.logDetail,
      runtimeRoot: params.runtimeRoot
    }))
  }
  registry.register(new GatewayToolProvider(gateway.config, gateway.source))
  registry.register(new MCPToolProvider(mcp.config, mcp.source))

  return registry
}

export { ToolProviderRegistry } from './registry.js'
export type * from './types.js'
