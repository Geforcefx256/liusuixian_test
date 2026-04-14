import type {
  WorkspacePlanRecord,
  WorkspacePlanSnapshot,
  WorkspacePlanSubagent
} from './workspace/types.js'
import type { AgentSessionInteractionView } from './interactions.js'
import type { ToolRetryHint, ToolStopReason } from './toolFailurePolicy.js'
import type { SkillMetadataMirror } from '../skills/metadata.js'
import type { ManagedSkillIntentGroup } from '../skills/managedIntentGroup.js'

export interface AgentSkill extends SkillMetadataMirror {
  id: string
  name: string
  description: string
  instructions: string
  sourcePath?: string
  lifecycle?: 'draft' | 'published'
  intentGroup?: ManagedSkillIntentGroup
  starterEnabled?: boolean
  starterPriority?: number
}

export interface AgentDefinition {
  id: string
  name: string
  description: string
  version: string
  instructions: string
  contextTemplate?: string
  memory?: string
}

export interface AgentModelConfigCustom {
  headers?: Record<string, string>
  body?: Record<string, unknown>
}

export interface AgentModelConfigThinking {
  enabled: boolean
  budgetTokens?: number
}

export interface AgentModelConfig {
  provider: string
  apiKey?: string
  apiEndpoint?: string
  modelName: string
  maxTokens?: number
  temperature?: number
  topP?: number
  topK?: number
  stream?: boolean
  streamFirstByteTimeoutMs?: number
  streamIdleTimeoutMs?: number
  contextWindow?: number
  inputLimit?: number
  thinking?: AgentModelConfigThinking
  custom?: AgentModelConfigCustom
}

export interface AgentInvocationContext {
  selection?: {
    rows: Array<Record<string, string>>
    columns: string[]
  }
  activeSheet?: {
    sheetName?: string
    columnName?: string
  }
  activeFile?: FileAsset
}

export interface FileAsset {
  path: string
  fileName: string
  source: 'upload' | 'project'
  writable: boolean
}

export interface AgentRunEditContext {
  messageId: number
}

export interface AgentRunRequest {
  runId: string
  userId: number
  agentId: string
  sessionId: string
  input: string
  executionPhase?: 'executor'
  editContext?: AgentRunEditContext
  continuation?: {
    interactionId: string
  }
  availableSkills?: AgentSkill[]
  allowedSkillIds?: string[]
  invocationContext?: AgentInvocationContext
  agentDefinition?: AgentDefinition
  model?: AgentModelConfig
}

export type AgentSkillBypassReason =
  | 'forced_not_found'
  | 'implicit_no_match'
  | 'no_skills'
  | 'low_confidence'

export interface AgentRunOutput {
  kind: 'text' | 'protocol' | 'domain-result' | 'awaiting-interaction'
  text: string
  protocol?: Record<string, unknown>
  domainResult?: SkillExecutionOutput
  interaction?: AgentSessionInteractionView
}

export interface NoticeSkillExecutionOutput {
  kind: 'notice'
  data: {
    message: string
  }
}

export interface RowsResultSkillExecutionOutput {
  kind: 'rows_result'
  data: {
    columns: string[]
    rows: Array<Record<string, unknown>>
  }
}

export interface SheetSnapshotSkillExecutionOutput {
  kind: 'sheet_snapshot'
  data: {
    sheetName: string
    columns: string[]
    rows: Array<Record<string, unknown>>
  }
}

export interface ArtifactRefSkillExecutionOutput {
  kind: 'artifact_ref'
  data: Record<string, unknown>
}

export type SkillExecutionOutput =
  | NoticeSkillExecutionOutput
  | RowsResultSkillExecutionOutput
  | SheetSnapshotSkillExecutionOutput
  | ArtifactRefSkillExecutionOutput

export interface TraceContext {
  runId: string
  turnId: string
  toolCallId?: string
}

export interface ModelCallMetrics {
  provider: AgentModelConfig['provider']
  modelName: string
  latencyMs: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  finishReason: string | null
}

export interface ToolCallMetrics {
  provider: string
  tool: string
  latencyMs: number
  success: boolean
  toolCallId?: string
}

export interface RunMetrics {
  model?: ModelCallMetrics
  tools: ToolCallMetrics[]
  totalLatencyMs: number
  failures: Array<{
    stage: RuntimeErrorStage
    provider?: string
    toolCallId?: string
    message: string
  }>
}

export interface AgentRunResult {
  runId: string
  sessionId: string
  agentId: string
  assistantMessageId?: number
  output: AgentRunOutput
  text: string
  continuationOfInteractionId?: string
  skillTriggered?: string
  skillMode?: 'forced' | 'implicit' | 'none'
  skillExecutionMode?: 'script' | 'llm'
  error?: string
  runtimeError?: RuntimeError
  metrics?: RunMetrics
  completedAt: number
}

export type RuntimeErrorCode = 'MODEL' | 'CANCELLED' | 'INTERNAL'
export type RuntimeErrorStage = 'prepare' | 'model' | 'tool' | 'persist' | 'finalize'

export interface RuntimeError {
  code: RuntimeErrorCode
  stage: RuntimeErrorStage
  retryable: boolean
  userMessage: string
  runId?: string
  detail?: string
  failureKind?: 'transport' | 'http' | 'timeout' | 'timeout_first_byte' | 'timeout_idle' | 'protocol' | 'stream_interrupted'
  provider?: string
  requestUrl?: string
  modelDiagnostics?: object
  status?: number
  toolCallId?: string
  turnId?: string
  toolName?: string
  stopReason?: ToolStopReason
  normalizedCode?: string
  chainKey?: string
  attempt?: number
  remainingRecoveryBudget?: number
  runtimeRetryCount?: number
  threshold?: number
  denyOrigin?: string
}

export interface AgentTerminalEvent {
  type: 'run.completed'
  runId: string
  status: 'success' | 'awaiting-interaction' | 'error' | 'cancelled'
  result: AgentRunResult
  error?: {
    code: RuntimeErrorCode
    message: string
    runtimeError?: RuntimeError
  }
  endedAt: number
}

export interface ToolStartedStreamEvent {
  type: 'tool.started'
  runId: string
  agentId: string
  sessionId: string
  toolCallId: string
  tool: string
  displayName: string
  toolKind: 'skill' | 'tool'
  startedAt: number
}

export interface ToolFailedStreamEvent {
  type: 'tool.failed'
  runId: string
  agentId: string
  sessionId: string
  toolCallId: string
  tool: string
  displayName: string
  toolKind: 'skill' | 'tool'
  startedAt: number
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

export type AgentStreamEvent =
  | { type: 'lifecycle.start'; runId: string; agentId: string; sessionId: string; startedAt: number }
  | { type: 'lifecycle.queued'; runId: string; agentId: string; sessionId: string; queuedAt: number; message?: string }
  | { type: 'lifecycle.end'; runId: string; endedAt: number }
  | { type: 'lifecycle.error'; runId: string; endedAt: number; error: string; runtimeError?: RuntimeError }
  | { type: 'assistant.delta'; runId: string; delta: string }
  | { type: 'assistant.final'; runId: string; text: string }
  | { type: 'metrics.run'; runId: string; metrics: RunMetrics }
  | ToolStartedStreamEvent
  | ToolFailedStreamEvent
  | { type: 'context.log'; runId: string; agentId: string; sessionId: string; loggedAt: number; level: 'info' | 'warn' | 'error'; message: string; data?: Record<string, unknown> }
  | { type: 'plan.snapshot'; runId: string; agentId: string; sessionId: string; plan: WorkspacePlanRecord }
  | { type: 'plan.awaiting_decision'; runId: string; agentId: string; sessionId: string; planId: string; version: number }
  | {
      type: 'plan.delegation'
      runId: string
      agentId: string
      sessionId: string
      subagent: WorkspacePlanSubagent
      status: 'completed'
      data?: Record<string, unknown>
    }
  | {
      type: 'agent.handoff'
      runId: string
      agentId: string
      sessionId: string
      from: 'plan' | 'build'
      to: 'plan' | 'build'
      reason: string
      plan?: WorkspacePlanSnapshot | null
    }
  | AgentTerminalEvent
