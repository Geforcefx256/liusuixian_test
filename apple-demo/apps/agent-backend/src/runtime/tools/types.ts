import type {
  GatewayCatalogRequest,
  GatewayInvokeResponse,
  GatewayToolManifest,
  GatewayToolsInvokeRequest
} from '../../gateway/tools/types.js'

export type ToolProviderCatalogRequest = GatewayCatalogRequest & {
  toolProvider?: string
}

export type ToolProviderInvokeRequest = GatewayToolsInvokeRequest
export type ToolProviderInvokeResponse = GatewayInvokeResponse

export interface ToolProviderRefreshResult {
  source?: string
}

export interface ToolProvider {
  id: string
  catalog(request?: ToolProviderCatalogRequest): GatewayToolManifest[]
  invoke(request: ToolProviderInvokeRequest): Promise<ToolProviderInvokeResponse>
  refresh?(request?: ToolProviderCatalogRequest): Promise<ToolProviderRefreshResult> | ToolProviderRefreshResult
}

export interface ToolRegistryCatalogResponse {
  ok: true
  tools: GatewayToolManifest[]
}

export interface ToolRegistryRefreshResponse {
  ok: true
  providers: string[]
  sources: Record<string, string | undefined>
}

