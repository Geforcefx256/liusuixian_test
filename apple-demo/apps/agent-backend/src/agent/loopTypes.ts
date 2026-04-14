import type {
  AgentModelConfig,
  ModelCallMetrics,
  ToolCallMetrics,
  TraceContext
} from './types.js'
import type { RuntimeToolPolicy, ToolRetryHint, ToolStopReason } from './toolFailurePolicy.js'
import type { StructuredOutput } from './structuredOutput.js'
import type { AgentSessionInteractionView } from './interactions.js'
import type {
  GatewayCatalogRequest,
  GatewayCatalogResponse,
  GatewayInvokeResponse,
  GatewayToolManifest,
  GatewayToolsInvokeRequest
} from '../gateway/tools/types.js'
import type {
  AgentSessionMessage,
  AgentSessionPart,
  AgentSessionStore
} from './sessionStore.js'

export type { AgentSessionMessage, AgentSessionPart } from './sessionStore.js'

export interface AgentLoopToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface AgentLoopToolDefinition {
  id: string
  name: string
  description: string
  inputSchema?: Record<string, unknown>
  runtimePolicy?: RuntimeToolPolicy
}

export interface ToolInvocationSignal {
  toolCallId: string
  tool: string
  displayName: string
  toolKind: 'skill' | 'tool'
  startedAt: number
}

export interface ToolFailureSignal extends ToolInvocationSignal {
  failedAt: number
  statusMessage: string
  recoveryMode: 'retrying' | 'recovering'
  normalizedCode?: string
  stopReason?: ToolStopReason
  retryHint?: ToolRetryHint
  chainKey?: string
  attempt?: number
  remainingRecoveryBudget?: number
  runtimeRetryCount?: number
  threshold?: number
}

export interface CompleteWithToolsRequest {
  systemPrompt: string
  messages: AgentSessionMessage[]
  tools: AgentLoopToolDefinition[]
  model: AgentModelConfig
  signal: AbortSignal
  trace: TraceContext
}

export interface CompleteWithToolsResponse {
  text: string
  reasoning: string
  toolCalls: AgentLoopToolCall[]
  metrics: ModelCallMetrics
}

export interface ProviderClientWithTools {
  completeWithTools(request: CompleteWithToolsRequest): Promise<CompleteWithToolsResponse>
}

export interface ToolRegistryLike {
  catalog(request?: GatewayCatalogRequest): GatewayCatalogResponse
  invoke(request: GatewayToolsInvokeRequest): Promise<GatewayInvokeResponse>
}

export interface AgentLoopDependencies {
  providerClient: ProviderClientWithTools
  sessionStore: AgentSessionStore
  toolRegistry: ToolRegistryLike
}

export interface AgentLoopRunParams {
  userId: number
  agentId: string
  sessionId: string
  userInput: string
  systemPrompt: string
  fileContextMessage?: AgentSessionMessage | null
  allowedSkillIds?: string[]
  messageProvider?: (params: {
    userId: number
    agentId: string
    sessionId: string
    systemPrompt: string
    model: AgentModelConfig
    messages: AgentSessionMessage[]
    fileContextMessage?: AgentSessionMessage | null
  }) => Promise<AgentSessionMessage[]>
  onAssistantStepComplete?: (params: {
    assistantMessageId: number
    metrics: ModelCallMetrics
  }) => Promise<void>
  onToolStarted?: (signal: ToolInvocationSignal) => void
  onToolFailed?: (signal: ToolFailureSignal) => void
  model: AgentModelConfig
  loop: {
    maxSteps: number
  }
  signal: AbortSignal
  trace: TraceContext
}

export interface AgentLoopResult {
  text: string
  assistantMessageId: number
  structuredOutput?: StructuredOutput
  awaitingInteraction?: AgentSessionInteractionView
  modelMetrics: ModelCallMetrics
  modelMetricsAggregate: {
    calls: number
    latencyMs: number
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  toolMetrics: ToolCallMetrics[]
  finalOutputMeta?: AgentFinalOutputMeta
  skillTriggered?: string
}

export interface AgentFinalOutputMeta {
  source: 'assistant' | 'tool'
  toolName?: string
  toolCallId?: string
  structuredHint: 'none' | 'protocol' | 'domain-result' | 'awaiting-interaction'
}

export function toLoopTools(tools: GatewayToolManifest[]): AgentLoopToolDefinition[] {
  return tools.map(tool => ({
    id: tool.id,
    name: tool.id,
    description: tool.description,
    inputSchema: tool.inputSchema,
    runtimePolicy: tool.runtimePolicy
  }))
}
