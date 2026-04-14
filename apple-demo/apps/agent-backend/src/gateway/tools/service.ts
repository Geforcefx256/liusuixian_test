import { mapToOperations } from '../../mcp/mapper.js'
import { createTransport as createMCPTransport } from '../../mcp/transport/factory.js'
import type { MCPExecuteRequest, MCPServerConfig } from '../../mcp/types.js'
import { buildGatewayToolsCatalog } from './catalog.js'
import type {
  GatewayCatalogRequest,
  GatewayCatalogResponse,
  GatewayConfig,
  GatewayInvokeErrorType,
  GatewayInvokeFailure,
  GatewayInvokeResponse,
  GatewayInvokeSuccess,
  GatewayToolManifest,
  GatewayToolServerConfig,
  GatewayToolsInvokeRequest,
  GatewayTransport,
  GatewayTransportRequest
} from './types.js'

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function matches(manifest: GatewayToolManifest, key: string): boolean {
  return (
    manifest.id === key ||
    manifest.name === key ||
    `${manifest.server}:${manifest.name}` === key
  )
}

function applyAllowDeny(
  manifests: GatewayToolManifest[],
  allow?: string[],
  deny?: string[]
): GatewayToolManifest[] {
  let current = manifests
  if (allow && allow.length > 0) {
    current = current.filter(m => allow.some(key => matches(m, key)))
  }
  if (deny && deny.length > 0) {
    current = current.filter(m => !deny.some(key => matches(m, key)))
  }
  return current
}

function defaultTransportResolver(server: GatewayToolServerConfig): GatewayTransport {
  const mcpTransport = createMCPTransport(server as MCPServerConfig)
  return {
    execute: (targetServer, tool, request) => {
      return mcpTransport.execute(
        targetServer as MCPServerConfig,
        tool,
        request as MCPExecuteRequest
      )
    }
  }
}

interface ResolvedTool {
  manifest: GatewayToolManifest
  deniedByPolicy: boolean
}

export class GatewayToolsService {
  constructor(
    private readonly config: GatewayConfig,
    private readonly transportResolver: (server: GatewayToolServerConfig) => GatewayTransport = defaultTransportResolver
  ) {}

  private resolveServer(id: string): GatewayToolServerConfig | null {
    return this.config.servers.find(s => s.id === id && s.enabled) || null
  }

  private toFailure(
    requestId: string,
    type: GatewayInvokeErrorType,
    message: string
  ): GatewayInvokeFailure {
    return {
      ok: false,
      requestId,
      error: { type, message }
    }
  }

  private runWithTimeout<T>(task: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Gateway tools invocation timed out'))
      }, this.config.timeoutMs)

      task
        .then(result => {
          clearTimeout(timeoutId)
          resolve(result)
        })
        .catch(error => {
          clearTimeout(timeoutId)
          reject(error)
        })
    })
  }

  private applyProfile(manifests: GatewayToolManifest[], provider?: string): GatewayToolManifest[] {
    const policy = this.config.tools
    if (!policy) return manifests

    const profileName = provider
      ? (policy.byProvider?.[provider]?.profile || policy.profile)
      : policy.profile
    if (!profileName) return manifests

    const profileTools = policy.profiles?.[profileName]
    if (!profileTools || profileTools.length === 0) return manifests

    return manifests.filter(manifest => profileTools.some(key => matches(manifest, key)))
  }

  private applyPolicy(manifests: GatewayToolManifest[], request?: GatewayCatalogRequest): GatewayToolManifest[] {
    const policy = this.config.tools
    let current = this.applyProfile(manifests, request?.provider)

    const providerPolicy = request?.provider ? policy?.byProvider?.[request.provider] : undefined

    current = applyAllowDeny(current, policy?.allow, policy?.deny)
    current = applyAllowDeny(current, providerPolicy?.allow, providerPolicy?.deny)

    const agentAllow = request?.agentId
      ? this.config.agents?.[request.agentId]?.tools?.allow
      : undefined
    if (agentAllow && agentAllow.length > 0) {
      current = current.filter(manifest => agentAllow.some(key => matches(manifest, key)))
    }

    const gatewayDeny = this.config.gateway?.tools?.deny
    if (gatewayDeny && gatewayDeny.length > 0) {
      current = current.filter(manifest => !gatewayDeny.some(key => matches(manifest, key)))
    }

    const topK = policy?.topK
    if (typeof topK === 'number' && topK > 0) {
      current = current.slice(0, topK)
    }

    return current
  }

  private resolveTool(toolKey: string, request: GatewayCatalogRequest): ResolvedTool | null {
    const all = buildGatewayToolsCatalog(this.config)
    const raw = all.find(manifest => matches(manifest, toolKey))
    if (!raw) return null

    const filtered = this.applyPolicy(all, request)
    const allowed = filtered.find(manifest => manifest.id === raw.id)
    if (!allowed) {
      return { manifest: raw, deniedByPolicy: true }
    }
    return { manifest: allowed, deniedByPolicy: false }
  }

  private toTransportRequest(request: GatewayToolsInvokeRequest, manifest: GatewayToolManifest): GatewayTransportRequest {
    const args = isObject(request.args) ? request.args : {}
    const input = typeof args.input === 'string'
      ? args.input
      : (request.action ? `Action: ${request.action}` : `Invoke ${manifest.id}`)
    const context = isObject(args.context) ? args.context : undefined
    const argumentsPayload = Object.fromEntries(
      Object.entries(args).filter(([key]) => key !== 'input' && key !== 'context')
    )

    return {
      sessionKey: request.sessionKey || 'default-session',
      agentId: request.agentId || 'default-agent',
      input,
      arguments: argumentsPayload,
      context,
      trace: request.trace
    }
  }

  catalog(request: GatewayCatalogRequest = {}): GatewayCatalogResponse {
    const manifests = buildGatewayToolsCatalog(this.config)
    const filtered = this.applyPolicy(manifests, request)
    return {
      ok: true,
      tools: filtered
    }
  }

  async invoke(request: GatewayToolsInvokeRequest): Promise<GatewayInvokeResponse> {
    const requestId = crypto.randomUUID()
    const startedAt = Date.now()
    const resolved = this.resolveTool(request.tool, {
      provider: request.provider,
      agentId: request.agentId
    })
    if (!resolved) {
      return this.toFailure(requestId, 'TOOL_NOT_FOUND', `Tool "${request.tool}" not found`)
    }
    if (resolved.deniedByPolicy) {
      return this.toFailure(requestId, 'TOOL_DENIED', `Tool "${request.tool}" is denied by policy`)
    }

    const server = this.resolveServer(resolved.manifest.server)
    if (!server) {
      return this.toFailure(
        requestId,
        'TOOL_NOT_FOUND',
        `Server "${resolved.manifest.server}" not found or disabled`
      )
    }

    const transportRequest = this.toTransportRequest(request, resolved.manifest)
    const inputChars = transportRequest.input.length

    try {
      const transport = this.transportResolver(server)
      const rawResult = await this.runWithTimeout(
        transport.execute(server, resolved.manifest.name, transportRequest)
      )
      const operations = mapToOperations(rawResult)
      if (operations.length === 0) {
        return this.toFailure(requestId, 'INVALID_RESULT', 'No valid operations found in gateway tool payload')
      }

      const summary = `Gateway tool invocation succeeded (${operations.length} operation(s)).`
      const success: GatewayInvokeSuccess = {
        ok: true,
        requestId,
        result: {
          tool: resolved.manifest.id,
          action: request.action,
          summary,
          operations,
          meta: {
            server: server.id,
            tool: resolved.manifest.name,
            latencyMs: Date.now() - startedAt,
            inputChars,
            operationsChars: JSON.stringify(operations).length,
            summaryChars: summary.length,
            trace: request.trace
          }
        }
      }
      return success
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      const type: GatewayInvokeErrorType = detail.toLowerCase().includes('timed out')
        ? 'EXECUTION_TIMEOUT'
        : 'EXECUTION_FAILED'
      return this.toFailure(requestId, type, detail)
    }
  }
}
