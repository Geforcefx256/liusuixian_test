import type {
  GatewayInvokeResponse,
  GatewayToolManifest,
  GatewayToolsInvokeRequest
} from '../../gateway/tools/types.js'
import type {
  ToolProvider,
  ToolProviderCatalogRequest,
  ToolRegistryCatalogResponse,
  ToolRegistryRefreshResponse
} from './types.js'

function namespaceToolId(providerId: string, toolId: string): string {
  return `${providerId}:${toolId}`
}

function splitProviderTool(tool: string): { providerId: string; providerToolId: string } | null {
  const firstColon = tool.indexOf(':')
  if (firstColon <= 0 || firstColon >= tool.length - 1) return null
  return {
    providerId: tool.slice(0, firstColon),
    providerToolId: tool.slice(firstColon + 1)
  }
}

function withProviderNamespace(providerId: string, manifest: GatewayToolManifest): GatewayToolManifest {
  return {
    ...manifest,
    id: namespaceToolId(providerId, manifest.id)
  }
}

function validationFailure(requestId: string, message: string): GatewayInvokeResponse {
  return {
    ok: false,
    requestId,
    error: {
      type: 'VALIDATION_ERROR',
      message
    }
  }
}

function providerNotFoundFailure(requestId: string, providerId: string): GatewayInvokeResponse {
  return {
    ok: false,
    requestId,
    error: {
      type: 'VALIDATION_ERROR',
      message: `Unknown tool provider "${providerId}". Expected namespace: local|gateway|mcp:<tool>.`
    }
  }
}

function toolNotFoundFailure(requestId: string, tool: string): GatewayInvokeResponse {
  return {
    ok: false,
    requestId,
    error: {
      type: 'TOOL_NOT_FOUND',
      message: `Tool "${tool}" not found`
    }
  }
}

export class ToolProviderRegistry {
  private providers = new Map<string, ToolProvider>()
  private readonly deny: Set<string>

  constructor(options: { deny?: string[] } = {}) {
    this.deny = new Set((options.deny || []).map(item => item.trim()).filter(Boolean))
  }

  register(provider: ToolProvider): void {
    this.providers.set(provider.id, provider)
  }

  unregister(providerId: string): void {
    this.providers.delete(providerId)
  }

  getProvider(providerId: string): ToolProvider | null {
    return this.providers.get(providerId) || null
  }

  catalog(request: ToolProviderCatalogRequest = {}): ToolRegistryCatalogResponse {
    const requestedProvider = request.toolProvider?.trim()
    const providers = requestedProvider
      ? [this.providers.get(requestedProvider)].filter((item): item is ToolProvider => Boolean(item))
      : Array.from(this.providers.values())

    const tools = providers.flatMap(provider =>
      provider.catalog(request)
        .map(manifest => withProviderNamespace(provider.id, manifest))
        .filter(manifest => !this.isDenied(manifest.id))
    )

    return {
      ok: true,
      tools
    }
  }

  async invoke(request: GatewayToolsInvokeRequest): Promise<GatewayInvokeResponse> {
    const requestId = crypto.randomUUID()
    if (this.isDenied(request.tool || '')) {
      return toolNotFoundFailure(requestId, request.tool || '')
    }
    const parsed = splitProviderTool(request.tool || '')
    if (!parsed) {
      return validationFailure(requestId, 'Tool must use provider namespace: <provider>:<tool>.')
    }

    const provider = this.providers.get(parsed.providerId)
    if (!provider) {
      return providerNotFoundFailure(requestId, parsed.providerId)
    }

    const response = await provider.invoke({
      ...request,
      tool: parsed.providerToolId
    })

    if (!response.ok) {
      return response
    }

    return {
      ...response,
      result: {
        ...response.result,
        tool: namespaceToolId(parsed.providerId, response.result.tool)
      }
    }
  }

  async refresh(request: ToolProviderCatalogRequest = {}): Promise<ToolRegistryRefreshResponse> {
    const sources: Record<string, string | undefined> = {}
    const providers: string[] = []

    for (const provider of this.providers.values()) {
      providers.push(provider.id)
      const refreshed = await provider.refresh?.(request)
      sources[provider.id] = refreshed?.source
    }

    return {
      ok: true,
      providers,
      sources
    }
  }

  private isDenied(toolId: string): boolean {
    return this.deny.has(toolId.trim())
  }
}
