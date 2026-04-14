import { buildMCPToolCatalog } from '../../../mcp/catalog.js'
import { loadMCPConfigWithSource } from '../../../mcp/config.js'
import { MCPGateway } from '../../../mcp/gateway.js'
import type { MCPConfig, MCPToolManifest } from '../../../mcp/types.js'
import type {
  GatewayOperation,
  GatewayInvokeErrorType,
  GatewayInvokeResponse,
  GatewayToolManifest,
  GatewayToolsInvokeRequest
} from '../../../gateway/tools/types.js'
import type { ToolProvider, ToolProviderCatalogRequest, ToolProviderRefreshResult } from '../types.js'

function toGatewayManifest(item: MCPToolManifest): GatewayToolManifest {
  return {
    id: item.id,
    server: item.server,
    name: item.name,
    description: item.description,
    tags: item.tags,
    schemaHash: item.schemaHash
  }
}

function mapMCPErrorType(code?: string): GatewayInvokeErrorType {
  if (code === 'MCP_VALIDATION_ERROR') return 'VALIDATION_ERROR'
  if (code === 'MCP_TIMEOUT') return 'EXECUTION_TIMEOUT'
  if (code === 'MCP_NOT_FOUND') return 'TOOL_NOT_FOUND'
  if (code === 'MCP_DENIED') return 'TOOL_DENIED'
  if (code === 'MCP_INVALID_OUTPUT') return 'INVALID_RESULT'
  return 'EXECUTION_FAILED'
}

function splitServerTool(tool: string): { server?: string; name: string } {
  const idx = tool.indexOf(':')
  if (idx <= 0 || idx >= tool.length - 1) {
    return { name: tool }
  }
  return {
    server: tool.slice(0, idx),
    name: tool.slice(idx + 1)
  }
}

export class MCPToolProvider implements ToolProvider {
  readonly id = 'mcp'
  private config: MCPConfig
  private source: string
  private gateway: MCPGateway

  constructor(config?: MCPConfig, source = 'runtime') {
    this.config = config || loadMCPConfigWithSource().config
    this.source = source
    this.gateway = new MCPGateway(this.config)
  }

  catalog(_request: ToolProviderCatalogRequest = {}): GatewayToolManifest[] {
    return buildMCPToolCatalog(this.config).map(toGatewayManifest)
  }

  async invoke(request: GatewayToolsInvokeRequest): Promise<GatewayInvokeResponse> {
    const requestId = crypto.randomUUID()
    const parsed = splitServerTool(request.tool)
    const args = request.args || {}
    const input = typeof args.input === 'string'
      ? args.input
      : (request.action ? `Action: ${request.action}` : `Invoke ${request.tool}`)

    const response = await this.gateway.invoke({
      sessionKey: request.sessionKey || 'default-session',
      agentId: request.agentId || 'default-agent',
      input,
      server: parsed.server,
      tool: parsed.name,
      arguments: typeof args === 'object' ? args : undefined
    })

    if (!response.success) {
      return {
        ok: false,
        requestId,
        error: {
          type: mapMCPErrorType(response.error?.code),
          message: response.error?.detail || response.summary || 'MCP invoke failed'
        }
      }
    }

    return {
      ok: true,
      requestId,
      result: {
        tool: parsed.server ? `${parsed.server}:${parsed.name}` : parsed.name,
        action: request.action,
        summary: response.summary,
        operations: response.operations as unknown as GatewayOperation[],
        meta: {
          server: response.meta?.server || parsed.server || this.config.defaultServer,
          tool: response.meta?.tool || parsed.name,
          latencyMs: response.meta?.latencyMs || 0,
          inputChars: response.meta?.inputChars || input.length,
          operationsChars: response.meta?.operationsChars || JSON.stringify(response.operations || []).length,
          summaryChars: response.meta?.summaryChars || response.summary.length,
          trace: request.trace
        }
      }
    }
  }

  refresh(): ToolProviderRefreshResult {
    const loaded = loadMCPConfigWithSource()
    this.config = loaded.config
    this.source = loaded.source
    this.gateway = new MCPGateway(this.config)
    return {
      source: this.source
    }
  }
}
