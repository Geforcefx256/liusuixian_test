import type { RuntimeToolPolicy } from '../../agent/toolFailurePolicy.js'

export type GatewayOperationType = 'insert' | 'update' | 'delete' | 'batch'
export type GatewayTransportType = 'http' | 'stdio'

export interface GatewayOperation {
  type: GatewayOperationType
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

export interface GatewayToolManifest {
  id: string
  server: string
  name: string
  description: string
  inputSchema?: Record<string, unknown>
  tags?: string[]
  schemaHash?: string
  runtimePolicy?: RuntimeToolPolicy
}

export interface GatewayToolServerConfig {
  id: string
  enabled: boolean
  transport: GatewayTransportType
  tools: string[]
  endpoint?: string
  headers?: Record<string, string>
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
}

export interface GatewayToolProviderPolicy {
  profile?: string
  allow?: string[]
  deny?: string[]
}

export interface GatewayToolPolicyConfig {
  profile?: string
  profiles?: Record<string, string[]>
  byProvider?: Record<string, GatewayToolProviderPolicy>
  allow?: string[]
  deny?: string[]
  topK?: number
}

export interface GatewayConfig {
  timeoutMs: number
  defaultServer: string
  servers: GatewayToolServerConfig[]
  tools?: GatewayToolPolicyConfig
  agents?: Record<string, { tools?: { allow?: string[] } }>
  gateway?: {
    tools?: {
      deny?: string[]
    }
  }
}

export interface GatewayCatalogRequest {
  provider?: string
  agentId?: string
  allowedSkillIds?: string[]
}

export interface GatewayWorkspaceScope {
  userId: number
  agentId: string
}

export interface GatewayCatalogResponse {
  ok: true
  tools: GatewayToolManifest[]
}

export interface GatewayToolsInvokeRequest {
  tool: string
  action?: string
  args?: Record<string, unknown>
  sessionKey?: string
  dryRun?: boolean
  provider?: string
  agentId?: string
  allowedSkillIds?: string[]
  workspaceScope?: GatewayWorkspaceScope
  trace?: GatewayTraceContext
}

export interface GatewayTraceContext {
  runId?: string
  turnId?: string
  toolCallId?: string
}

export type GatewayInvokeErrorType =
  | 'VALIDATION_ERROR'
  | 'TOOL_NOT_FOUND'
  | 'TOOL_DENIED'
  | 'EXECUTION_TIMEOUT'
  | 'EXECUTION_FAILED'
  | 'INVALID_RESULT'

export interface GatewayInvokeError {
  type: GatewayInvokeErrorType
  message: string
  field?: string
  expected?: string
  actual?: string
  fix?: string
}

export interface GatewayInjectedSkillContextMessage {
  role: 'assistant'
  visibility: 'hidden'
  semantic: 'skill-context'
  skillName: string
  text: string
}

export interface GatewayInvokeSideEffects {
  injectedMessages: GatewayInjectedSkillContextMessage[]
}

export interface GatewayInvokeSuccess {
  ok: true
  requestId: string
  result: {
    tool: string
    action?: string
    summary: string
    operations: GatewayOperation[]
    meta: {
      server: string
      tool: string
      latencyMs: number
      inputChars: number
      operationsChars: number
      summaryChars: number
      trace?: GatewayTraceContext
    }
    sideEffects?: GatewayInvokeSideEffects
  }
}

export interface GatewayInvokeFailure {
  ok: false
  requestId: string
  error: GatewayInvokeError
}

export type GatewayInvokeResponse = GatewayInvokeSuccess | GatewayInvokeFailure

export interface GatewayTransportRequest {
  sessionKey: string
  agentId: string
  input: string
  arguments?: Record<string, unknown>
  context?: Record<string, unknown>
  trace?: GatewayTraceContext
}

export interface GatewayTransport {
  execute(
    server: GatewayToolServerConfig,
    tool: string,
    request: GatewayTransportRequest
  ): Promise<unknown>
}
