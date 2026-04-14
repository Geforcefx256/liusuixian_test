export type MCPErrorCode =
  | 'MCP_VALIDATION_ERROR'
  | 'MCP_TIMEOUT'
  | 'MCP_DENIED'
  | 'MCP_NOT_FOUND'
  | 'MCP_EXEC_FAILED'
  | 'MCP_INVALID_OUTPUT'

export type MCPOperationType = 'insert' | 'update' | 'delete' | 'batch'
export type MCPTransportType = 'http' | 'stdio'

export interface MCPOperation {
  type: MCPOperationType
  sheetName: string
  rows?: Array<Record<string, unknown>>
  rowIds?: string[]
  match?: Record<string, unknown>
  set?: Record<string, unknown>
  operations?: Array<{
    action: 'insert' | 'update' | 'delete'
    rowId?: string
    data?: Record<string, unknown>
    match?: Record<string, unknown>
  }>
}

export interface MCPExecuteRequest {
  sessionKey: string
  agentId: string
  input: string
  server?: string
  tool?: string
  arguments?: Record<string, unknown>
  context?: Record<string, unknown>
}

export interface MCPExecuteResponse {
  requestId: string
  success: boolean
  message: string
  operations: MCPOperation[]
  meta?: {
    server: string
    tool: string
    latencyMs: number
    inputChars?: number
    operationsChars?: number
    summaryChars?: number
  }
  error?: {
    code: MCPErrorCode
    detail: string
  }
}

export interface MCPToolManifest {
  id: string
  server: string
  name: string
  description: string
  tags?: string[]
  schemaHash?: string
}

export interface MCPResultHandle {
  id: string
  createdAt: number
}

export interface MCPInvokeResponse {
  requestId: string
  success: boolean
  summary: string
  operations: MCPOperation[]
  truncated?: boolean
  handleId?: string
  meta?: {
    server: string
    tool: string
    latencyMs: number
    inputChars?: number
    operationsChars?: number
    summaryChars?: number
  }
  error?: {
    code: MCPErrorCode
    detail: string
  }
}

export interface MCPServerConfig {
  id: string
  enabled: boolean
  transport: MCPTransportType
  tools: string[]
  endpoint?: string
  headers?: Record<string, string>
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
}

export interface MCPConfig {
  timeoutMs: number
  defaultServer: string
  servers: MCPServerConfig[]
}
