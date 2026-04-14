import { mapToOperations } from './mapper.js'
import { createTransport } from './transport/factory.js'
import type {
  MCPConfig,
  MCPErrorCode,
  MCPExecuteRequest,
  MCPExecuteResponse,
  MCPInvokeResponse,
  MCPServerConfig
} from './types.js'
import type { MCPTransport } from './transport/types.js'
import { MCPResultStore } from './resultStore.js'

interface GatewayFailure {
  code: MCPErrorCode
  detail: string
}

export class MCPGateway {
  private readonly resultStore: MCPResultStore

  constructor(
    private readonly config: MCPConfig,
    private readonly transportResolver: (server: MCPServerConfig) => MCPTransport = createTransport,
    resultStore?: MCPResultStore
  ) {
    this.resultStore = resultStore || new MCPResultStore()
  }

  private resolveServer(id: string): MCPServerConfig | null {
    return this.config.servers.find(s => s.id === id && s.enabled) || null
  }

  private toFailure(code: MCPErrorCode, detail: string): GatewayFailure {
    return { code, detail }
  }

  private buildMeta(serverId: string, tool: string, startedAt: number, inputChars: number, operationsChars: number) {
    return {
      server: serverId,
      tool,
      latencyMs: Date.now() - startedAt,
      inputChars,
      operationsChars
    }
  }

  private validationFailure(requestId: string, detail: string): MCPExecuteResponse {
    return {
      requestId,
      success: false,
      message: 'MCP request validation failed.',
      operations: [],
      error: this.toFailure('MCP_VALIDATION_ERROR', detail)
    }
  }

  private isToolAllowed(server: MCPServerConfig, tool: string): boolean {
    return server.tools.includes(tool)
  }

  private async runWithTimeout<T>(task: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('MCP invocation timed out'))
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

  async execute(request: MCPExecuteRequest): Promise<MCPExecuteResponse> {
    const requestId = crypto.randomUUID()
    const startedAt = Date.now()
    const serverId = request.server || this.config.defaultServer
    const tool = request.tool?.trim() || ''
    const inputChars = request.input.length
    if (!tool) {
      return this.validationFailure(
        requestId,
        'Missing required field "tool". Explicit MCP tool identifier is required.'
      )
    }

    const server = this.resolveServer(serverId)

    if (!server) {
      return {
        requestId,
        success: false,
        message: 'MCP server not found or disabled.',
        operations: [],
        error: this.toFailure('MCP_NOT_FOUND', `Server "${serverId}" not found`)
      }
    }

    if (!this.isToolAllowed(server, tool)) {
      return {
        requestId,
        success: false,
        message: 'MCP tool is denied by policy.',
        operations: [],
        error: this.toFailure('MCP_DENIED', `Tool "${tool}" is not allowed on server "${server.id}"`)
      }
    }

    try {
      const transport = this.transportResolver(server)
      const rawResult = await this.runWithTimeout(transport.execute(server, tool, request))
      const operations = mapToOperations(rawResult)
      if (operations.length === 0) {
        return {
          requestId,
          success: false,
          message: 'MCP result could not be converted to operations.',
          operations: [],
          meta: this.buildMeta(server.id, tool, startedAt, inputChars, 0),
          error: this.toFailure('MCP_INVALID_OUTPUT', 'No valid operations found in MCP payload')
        }
      }

      return {
        requestId,
        success: true,
        message: `MCP execution succeeded (${operations.length} operation(s)).`,
        operations,
        meta: this.buildMeta(server.id, tool, startedAt, inputChars, JSON.stringify(operations).length)
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      const code: MCPErrorCode = detail.toLowerCase().includes('timed out')
        ? 'MCP_TIMEOUT'
        : 'MCP_EXEC_FAILED'

      return {
        requestId,
        success: false,
        message: 'MCP execution failed.',
        operations: [],
        meta: this.buildMeta(server.id, tool, startedAt, inputChars, 0),
        error: this.toFailure(code, detail)
      }
    }
  }

  async invoke(request: MCPExecuteRequest): Promise<MCPInvokeResponse> {
    const response = await this.execute(request)

    if (!response.success) {
      return {
        requestId: response.requestId,
        success: false,
        summary: response.message,
        operations: [],
        meta: response.meta
          ? {
              ...response.meta,
              summaryChars: response.message.length
            }
          : undefined,
        error: response.error
      }
    }

    const maxOperationsInline = 10
    if (response.operations.length > maxOperationsInline) {
      const entry = this.resultStore.put({
        request,
        operations: response.operations,
        meta: response.meta
      })
      return {
        requestId: response.requestId,
        success: true,
        summary: `MCP invocation produced ${response.operations.length} operation(s). First ${maxOperationsInline} returned inline.`,
        operations: response.operations.slice(0, maxOperationsInline),
        truncated: true,
        handleId: entry.id,
        meta: response.meta
          ? {
              ...response.meta,
              summaryChars: `MCP invocation produced ${response.operations.length} operation(s). First ${maxOperationsInline} returned inline.`.length
            }
          : undefined
      }
    }

    return {
      requestId: response.requestId,
      success: true,
      summary: response.message,
      operations: response.operations,
      truncated: false,
      meta: response.meta
        ? {
            ...response.meta,
            summaryChars: response.message.length
          }
        : undefined
    }
  }

  getResult(handleId: string): ReturnType<MCPResultStore['get']> {
    return this.resultStore.get(handleId)
  }
}
