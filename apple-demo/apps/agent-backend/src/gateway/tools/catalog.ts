import type { GatewayConfig, GatewayToolManifest } from './types.js'

function toManifest(serverId: string, toolName: string): GatewayToolManifest {
  return {
    id: `${serverId}:${toolName}`,
    server: serverId,
    name: toolName,
    description: `Gateway tool "${toolName}" on server "${serverId}".`
  }
}

export function buildGatewayToolsCatalog(config: GatewayConfig): GatewayToolManifest[] {
  return config.servers
    .filter(server => server.enabled)
    .flatMap(server => server.tools.map(toolName => toManifest(server.id, toolName)))
}
