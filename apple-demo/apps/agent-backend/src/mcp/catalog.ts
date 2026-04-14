import type { MCPConfig, MCPToolManifest } from './types.js'

function toManifest(serverId: string, toolName: string): MCPToolManifest {
  return {
    id: `${serverId}:${toolName}`,
    server: serverId,
    name: toolName,
    description: `MCP tool "${toolName}" on server "${serverId}".`
  }
}

export function buildMCPToolCatalog(config: MCPConfig): MCPToolManifest[] {
  return config.servers
    .filter(server => server.enabled)
    .flatMap(server => server.tools.map(toolName => toManifest(server.id, toolName)))
}
