import type { GatewayConfig, GatewayToolManifest, GatewayToolsInvokeRequest } from '../../../gateway/tools/types.js'
import { GatewayToolsService } from '../../../gateway/tools/service.js'
import { loadGatewayConfigWithSource } from '../../../gateway/tools/config.js'
import type { ToolProvider, ToolProviderCatalogRequest, ToolProviderRefreshResult } from '../types.js'

export class GatewayToolProvider implements ToolProvider {
  readonly id = 'gateway'
  private service: GatewayToolsService
  private source: string
  private config: GatewayConfig

  constructor(config?: GatewayConfig, source = 'runtime') {
    this.config = config || loadGatewayConfigWithSource().config
    this.source = source
    this.service = new GatewayToolsService(this.config)
  }

  catalog(request: ToolProviderCatalogRequest = {}): GatewayToolManifest[] {
    return this.service.catalog({
      provider: request.provider,
      agentId: request.agentId
    }).tools
  }

  invoke(request: GatewayToolsInvokeRequest) {
    return this.service.invoke(request)
  }

  refresh(): ToolProviderRefreshResult {
    const loaded = loadGatewayConfigWithSource()
    this.config = loaded.config
    this.source = loaded.source
    this.service = new GatewayToolsService(loaded.config)
    return {
      source: this.source
    }
  }
}

