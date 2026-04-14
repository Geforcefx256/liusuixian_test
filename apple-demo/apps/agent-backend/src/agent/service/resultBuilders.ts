import type { AgentRunOutput, AgentRunRequest, AgentRunResult, RunMetrics, RuntimeError } from '../types.js'
import type { ChatOrchestrator } from '../chatOrchestrator.js'
import {
  parseSkillExecutionOutput,
  type SkillOutputSourceContext
} from '../skillResult.js'
import type { StructuredOutput } from '../structuredOutput.js'
import { buildRunTimingSummary, logRunTimingSummary } from './runTiming.js'

type ChatExecution = Awaited<ReturnType<ChatOrchestrator['execute']>>

interface FinalOutputMeta {
  source?: 'assistant' | 'tool'
  toolName?: string
  toolCallId?: string
  structuredHint?: 'none' | 'protocol' | 'domain-result' | 'awaiting-interaction'
}

export function buildQueuedDiscardResult(params: {
  request: AgentRunRequest
  message: string
}): AgentRunResult {
  const runtimeError = buildDiscardRuntimeError(params.request, params.message)
  const completedAt = Date.now()
  return {
    runId: params.request.runId,
    sessionId: params.request.sessionId,
    agentId: params.request.agentId,
    output: { kind: 'text', text: params.message },
    text: params.message,
    error: params.message,
    runtimeError,
    metrics: buildDiscardMetrics(params.request, params.message),
    completedAt
  }
}

export function buildSuccessResult(params: {
  request: AgentRunRequest
  execution: ChatExecution
  startedAt: number
}): { result: AgentRunResult; metrics: RunMetrics; completedAt: number } {
  const metrics = buildSuccessMetrics(params.execution, params.startedAt)
  const completedAt = Date.now()
  const finalOutputMeta = resolveFinalOutputMeta(params.execution)
  const skillTriggered = resolveSkillTriggered(params.execution)
  const domainResult = resolveDomainResult({
    text: params.execution.text,
    protocol: params.execution.protocol,
    structuredOutput: params.execution.structuredOutput,
    finalOutputMeta
  })
  const output: AgentRunOutput = params.execution.protocol
    ? { kind: 'protocol', text: params.execution.text, protocol: params.execution.protocol }
    : (params.execution.awaitingInteraction
      ? {
          kind: 'awaiting-interaction',
          text: params.execution.text,
          interaction: params.execution.awaitingInteraction
        }
    : (domainResult
      ? { kind: 'domain-result', text: params.execution.text, domainResult }
      : { kind: 'text', text: params.execution.text }))

  return {
    result: {
      runId: params.request.runId,
      sessionId: params.request.sessionId,
      agentId: params.request.agentId,
      assistantMessageId: params.execution.assistantMessageId,
      output,
      text: params.execution.text,
      continuationOfInteractionId: params.execution.continuationOfInteractionId,
      skillTriggered,
      skillMode: skillTriggered ? 'implicit' : undefined,
      skillExecutionMode: params.execution.mode,
      metrics,
      completedAt
    },
    metrics,
    completedAt
  }
}

export function buildErrorResult(params: {
  request: AgentRunRequest
  runtimeError: RuntimeError
  message: string
  startedAt: number
}): { result: AgentRunResult; metrics: RunMetrics; completedAt: number } {
  const metrics = buildErrorMetrics(params.runtimeError, params.message, params.startedAt)
  const completedAt = Date.now()
  return {
    result: {
      runId: params.request.runId,
      sessionId: params.request.sessionId,
      agentId: params.request.agentId,
      output: { kind: 'text', text: params.message },
      text: params.message,
      error: params.message,
      runtimeError: params.runtimeError,
      metrics,
      completedAt
    },
    metrics,
    completedAt
  }
}

export function emitRunTiming(params: {
  startedAt: number
  endedAt: number
  modelAggregate: { calls: number; latencyMs: number } | null | undefined
  toolMetrics: RunMetrics['tools']
}): void {
  logRunTimingSummary(buildRunTimingSummary({
    startedAt: params.startedAt,
    endedAt: params.endedAt,
    modelAggregate: params.modelAggregate,
    toolMetrics: params.toolMetrics
  }))
}

function buildSuccessMetrics(
  execution: ChatExecution,
  startedAt: number
): RunMetrics {
  return {
    model: execution.modelMetrics,
    tools: execution.toolMetrics || [],
    totalLatencyMs: Date.now() - startedAt,
    failures: []
  }
}

function buildErrorMetrics(
  runtimeError: RuntimeError,
  message: string,
  startedAt: number
): RunMetrics {
  return {
    tools: [],
    totalLatencyMs: Date.now() - startedAt,
    failures: [{
      stage: runtimeError?.stage,
      provider: runtimeError?.provider,
      toolCallId: runtimeError?.toolCallId,
      message
    }]
  }
}

function buildDiscardMetrics(request: AgentRunRequest, message: string): RunMetrics {
  return {
    tools: [],
    totalLatencyMs: 0,
    failures: [{
      stage: 'prepare',
      provider: request.model?.provider,
      message
    }]
  }
}

function buildDiscardRuntimeError(request: AgentRunRequest, message: string): RuntimeError {
  return {
    code: 'INTERNAL',
    stage: 'prepare',
    retryable: false,
    userMessage: message,
    detail: message,
    provider: request.model?.provider,
    turnId: `${request.sessionId}:turn-1`
  }
}

function resolveDomainResult(
  params: {
    text: string
    protocol: ChatExecution['protocol']
    structuredOutput: StructuredOutput | undefined
    finalOutputMeta: FinalOutputMeta | null
  }
) {
  if (params.protocol) return null
  if (params.structuredOutput?.kind === 'domain-result') {
    return params.structuredOutput.domainResult
  }

  const sourceContext = buildSkillOutputSourceContext(params.finalOutputMeta)
  if (params.finalOutputMeta?.structuredHint === 'domain-result') {
    return parseSkillExecutionOutput(params.text, sourceContext)
  }

  if (!shouldAttemptCompatibilityParse(params.finalOutputMeta)) return null
  return parseSkillExecutionOutputCompat(params.text, sourceContext)
}

function parseSkillExecutionOutputCompat(
  text: string,
  sourceContext: SkillOutputSourceContext
) {
  if (!looksLikeStructuredText(text)) return null
  try {
    return parseSkillExecutionOutput(text, sourceContext)
  } catch {
    return null
  }
}

function shouldAttemptCompatibilityParse(finalOutputMeta: FinalOutputMeta | null): boolean {
  if (!finalOutputMeta) return true
  return finalOutputMeta.source === 'assistant'
}

function buildSkillOutputSourceContext(finalOutputMeta: FinalOutputMeta | null): SkillOutputSourceContext {
  const toolName = finalOutputMeta?.toolName?.trim()
  if (toolName) {
    return { label: `tool ${toolName}` }
  }
  return { label: 'assistant response' }
}

function resolveFinalOutputMeta(execution: ChatExecution): FinalOutputMeta | null {
  const candidate = (execution as { finalOutputMeta?: unknown }).finalOutputMeta
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null

  const meta = candidate as {
    source?: unknown
    toolName?: unknown
    toolCallId?: unknown
    structuredHint?: unknown
  }

  const source = meta.source === 'assistant' || meta.source === 'tool'
    ? meta.source
    : undefined
  const structuredHint = meta.structuredHint === 'none'
    || meta.structuredHint === 'protocol'
    || meta.structuredHint === 'domain-result'
    || meta.structuredHint === 'awaiting-interaction'
    ? meta.structuredHint
    : undefined

  return {
    source,
    toolName: typeof meta.toolName === 'string' ? meta.toolName : undefined,
    toolCallId: typeof meta.toolCallId === 'string' ? meta.toolCallId : undefined,
    structuredHint
  }
}

function looksLikeStructuredText(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  const first = trimmed[0]
  return first === '{' || first === '['
}

function resolveSkillTriggered(execution: ChatExecution): string | undefined {
  const skillTriggered = typeof execution.skillTriggered === 'string'
    ? execution.skillTriggered.trim()
    : ''
  return skillTriggered || undefined
}
