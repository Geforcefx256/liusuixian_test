import { ToolInvocationError } from '../toolInvocationError.js'
import { AgentExecutionError } from '../executionErrors.js'
import {
  addModelMetricsAggregate,
  assertStepWithinLimit,
  createModelMetricsAggregate
} from '../agentLoopUtils.js'
import type {
  AgentLoopResult,
  AgentLoopToolCall,
  AgentSessionMessage,
  AgentSessionPart,
  ProviderClientWithTools,
  ToolFailureSignal,
  ToolInvocationSignal,
  ToolRegistryLike
} from '../loopTypes.js'
import { toLoopTools } from '../loopTypes.js'
import { isModelRequestError } from '../modelRequestError.js'
import type { AgentSessionStore } from '../sessionStore.js'
import { createToolPart } from '../sessionParts.js'
import type { AgentSessionInteractionView } from '../interactions.js'
import { parseAwaitingInteractionToolSummary } from '../interactions.js'
import { filterReplayMessages } from '../interactionReplay.js'
import {
  resolveToolFailureOutcome,
  TOOL_ERROR_CODE
} from '../toolFailureRetry.js'
import type { AgentRunRequest, ToolCallMetrics } from '../types.js'
import {
  buildToolInvocationSignal,
  resolveTriggeredSkillDisplayName,
  type ToolDisplayNameResolver
} from '../toolInvocationSignal.js'
import { buildToolFailureStatus, resolvePlannerToolStopReason } from '../toolFailureProgress.js'
import { createLogger } from '../../logging/index.js'

const TOOL_ERROR_MESSAGE = 'Tool execution failed.'
const plannerLoopLogger = createLogger({
  category: 'tool',
  component: 'planner_loop'
})

type PlannerLoopMetrics = Pick<AgentLoopResult, 'modelMetrics' | 'modelMetricsAggregate' | 'toolMetrics'>

export interface PlannerLoopDraftResult extends PlannerLoopMetrics {
  kind: 'draft'
  text: string
  skillTriggered?: string
}

export interface PlannerLoopQuestionResult extends PlannerLoopMetrics {
  kind: 'question'
  text: string
  interaction: AgentSessionInteractionView
  assistantMessageId: number
  skillTriggered?: string
}

export type PlannerLoopResult = PlannerLoopDraftResult | PlannerLoopQuestionResult

type ToolExecutionResult =
  | {
      kind: 'continue'
      toolMetrics: ToolCallMetrics[]
      toolParts: AgentSessionPart[]
      recoveryTriggered: boolean
      toolError?: ToolInvocationError
      skillTriggered?: string
    }
  | {
      kind: 'question'
      text: string
      interaction: AgentSessionInteractionView
      parts: AgentSessionPart[]
      toolMetrics: ToolCallMetrics[]
      toolParts: AgentSessionPart[]
      skillTriggered?: string
    }

export async function runPlannerLoop(params: {
  providerClient: ProviderClientWithTools
  sessionStore: AgentSessionStore
  toolRegistry: ToolRegistryLike
  request: AgentRunRequest
  systemPrompt: string
  userInput: string
  signal: AbortSignal
  trace: { runId: string; turnId: string }
  maxSteps: number
  onToolStarted?: (signal: ToolInvocationSignal) => void
  onToolFailed?: (signal: ToolFailureSignal) => void
  displayNameResolver?: ToolDisplayNameResolver
}): Promise<PlannerLoopResult> {
  await appendMessage(params.sessionStore, params.request, 'user', [{
    type: 'text',
    text: params.userInput
  }])
  const toolDefinitions = toLoopTools(
    params.toolRegistry.catalog({ agentId: params.request.agentId }).tools
  )
  const toolMetrics: ToolCallMetrics[] = []
  let modelMetrics
    = undefined as AgentLoopResult['modelMetrics'] | undefined
  let modelMetricsAggregate = createModelMetricsAggregate()
  let toolRecoveryActive = false
  let skillTriggered: string | undefined
  let stepCount = 0

  while (true) {
    stepCount += 1
    assertStepWithinLimit(stepCount, params.maxSteps)
    const messages = await loadMessages(params.sessionStore, params.request)
    const response = await completePlannerModelStep({
      providerClient: params.providerClient,
      systemPrompt: params.systemPrompt,
      messages,
      tools: toolDefinitions,
      model: requireModel(params.request),
      signal: params.signal,
      trace: params.trace,
      modelMetricsAggregate
    })
    modelMetrics = response.metrics
    modelMetricsAggregate = addModelMetricsAggregate(modelMetricsAggregate, response.metrics)

    if (response.toolCalls.length === 0) {
      return {
        kind: 'draft',
        text: response.text,
        modelMetrics,
        modelMetricsAggregate,
        toolMetrics,
        skillTriggered
      }
    }

    const toolResult = await invokeTools({
      sessionStore: params.sessionStore,
      toolRegistry: params.toolRegistry,
      request: params.request,
      toolCalls: response.toolCalls,
      trace: params.trace,
      recoveryActive: toolRecoveryActive,
      onToolStarted: params.onToolStarted,
      onToolFailed: params.onToolFailed,
      displayNameResolver: params.displayNameResolver
    })
    if (toolResult.skillTriggered) {
      skillTriggered = toolResult.skillTriggered
    }
    toolMetrics.push(...toolResult.toolMetrics)
    if (toolResult.kind === 'question') {
      const assistantMessageId = await appendMessage(
        params.sessionStore,
        params.request,
        'assistant',
        toolResult.parts
      )
      return {
        kind: 'question',
        text: toolResult.text,
        interaction: toolResult.interaction,
        assistantMessageId,
        modelMetrics,
        modelMetricsAggregate,
        toolMetrics,
        skillTriggered
      }
    }
    await appendMessage(params.sessionStore, params.request, 'assistant', [
      ...toTextParts(response.text),
      ...toolResult.toolParts
    ])
    if (toolResult.kind === 'continue' && toolResult.toolError) {
      throw toolResult.toolError
    }
    toolRecoveryActive = toolResult.recoveryTriggered
  }
}

async function completePlannerModelStep(params: {
  providerClient: ProviderClientWithTools
  systemPrompt: string
  messages: AgentSessionMessage[]
  tools: ReturnType<typeof toLoopTools>
  model: NonNullable<AgentRunRequest['model']>
  signal: AbortSignal
  trace: { runId: string; turnId: string }
  modelMetricsAggregate: AgentLoopResult['modelMetricsAggregate']
}) {
  try {
    return await params.providerClient.completeWithTools({
      systemPrompt: params.systemPrompt,
      messages: params.messages,
      tools: params.tools,
      model: params.model,
      signal: params.signal,
      trace: params.trace
    })
  } catch (error) {
    if (!isModelRequestError(error)) throw error
    throw new AgentExecutionError({
      cause: error,
      modelMetricsAggregate: addModelMetricsAggregate(params.modelMetricsAggregate, error.metrics)
    })
  }
}

async function loadMessages(
  sessionStore: AgentSessionStore,
  request: AgentRunRequest
): Promise<AgentSessionMessage[]> {
  const messages = await sessionStore.listMessages({
    userId: request.userId,
    agentId: request.agentId,
    sessionId: request.sessionId
  })
  return filterReplayMessages(messages)
}

async function invokeTools(params: {
  sessionStore: AgentSessionStore
  toolRegistry: ToolRegistryLike
  request: AgentRunRequest
  toolCalls: AgentLoopToolCall[]
  trace: { runId: string; turnId: string }
  recoveryActive: boolean
  onToolStarted?: (signal: ToolInvocationSignal) => void
  onToolFailed?: (signal: ToolFailureSignal) => void
  displayNameResolver?: ToolDisplayNameResolver
}): Promise<ToolExecutionResult> {
  const toolMetrics: ToolCallMetrics[] = []
  const toolParts: AgentSessionPart[] = []
  let skillTriggered: string | undefined

  for (const toolCall of params.toolCalls) {
    const startedAt = Date.now()
    const toolSignal = buildToolInvocationSignal(
      toolCall,
      startedAt,
      params.displayNameResolver,
      params.request.agentId
    )
    params.onToolStarted?.(toolSignal)
    const response = await params.toolRegistry.invoke({
      tool: toolCall.name,
      args: toolCall.input,
      agentId: params.request.agentId,
      sessionKey: params.request.sessionId,
      workspaceScope: {
        userId: params.request.userId,
        agentId: params.request.agentId
      },
      trace: {
        ...params.trace,
        toolCallId: toolCall.id
      }
    })
    if (!response.ok) {
      const failureOutcome = resolveToolFailureOutcome(
        toolCall,
        response.error.type,
        params.recoveryActive
      )
      toolParts.push(buildToolErrorPart(toolCall, response.error.message, {
        code: failureOutcome.code,
        errorType: response.error.type,
        recoverable: failureOutcome.recoverable
      }))
      toolMetrics.push(buildFailedToolMetric(toolCall, startedAt))
      plannerLoopLogger.warn({
        message: 'planner loop tool error',
        context: {
          runId: params.trace.runId,
          turnId: params.trace.turnId
        },
        data: {
          tool: toolCall.name,
          toolCallId: toolCall.id,
          error: response.error.message,
          errorType: response.error.type,
          recoverable: failureOutcome.recoverable
        }
      })
      if (failureOutcome.recoverable) {
        const status = buildToolFailureStatus({
          displayName: toolSignal.displayName,
          toolKind: toolSignal.toolKind
        })
        params.onToolFailed?.({
          ...toolSignal,
          failedAt: Date.now(),
          statusMessage: status.statusMessage,
          recoveryMode: status.recoveryMode,
          normalizedCode: failureOutcome.code
        })
      }
      const toolError = new ToolInvocationError({
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        message: response.error.message,
        metadata: {
          errorType: response.error.type,
          normalizedCode: failureOutcome.code,
          stopReason: resolvePlannerToolStopReason(params.recoveryActive)
        }
      })
      return {
        kind: 'continue',
        toolMetrics,
        toolParts,
        recoveryTriggered: failureOutcome.recoverable,
        toolError: failureOutcome.recoverable ? undefined : toolError,
        skillTriggered
      }
    }

    const resolvedSkill = resolveTriggeredSkillDisplayName(
      toolCall,
      params.displayNameResolver,
      params.request.agentId
    )
    if (resolvedSkill) {
      skillTriggered = resolvedSkill
    }
    toolParts.push(createToolPart({
      id: toolCall.id,
      name: toolCall.name,
      input: toolCall.input,
      status: 'success',
      output: response.result.summary
    }))
    toolMetrics.push({
      provider: response.result.meta.server,
      tool: response.result.tool,
      latencyMs: response.result.meta.latencyMs || Date.now() - startedAt,
      success: true,
      toolCallId: toolCall.id
    })
    const awaiting = parseAwaitingInteractionToolSummary(response.result.summary)
    if (!awaiting) {
      continue
    }
    return {
      kind: 'question',
      text: awaiting.text,
      interaction: awaiting.interaction,
      parts: buildAwaitingInteractionParts(awaiting.text, toolParts),
      toolMetrics,
      toolParts,
      skillTriggered
    }
  }

  return { kind: 'continue', toolMetrics, toolParts, recoveryTriggered: false, skillTriggered }
}

function buildFailedToolMetric(toolCall: AgentLoopToolCall, startedAt: number): ToolCallMetrics {
  return {
    provider: toolCall.name.split(':')[0] || 'unknown',
    tool: toolCall.name,
    latencyMs: Date.now() - startedAt,
    success: false,
    toolCallId: toolCall.id
  }
}

async function appendMessage(
  sessionStore: AgentSessionStore,
  request: AgentRunRequest,
  role: AgentSessionMessage['role'],
  parts: AgentSessionPart[]
): Promise<number> {
  return sessionStore.appendMessage({
    userId: request.userId,
    agentId: request.agentId,
    sessionId: request.sessionId,
    message: {
      role,
      parts,
      createdAt: Date.now()
    }
  })
}

function requireModel(request: AgentRunRequest): NonNullable<AgentRunRequest['model']> {
  if (!request.model) {
    throw new Error('Missing model configuration')
  }
  return request.model
}

function toTextParts(text: string): Array<{ type: 'text'; text: string }> {
  if (!text.trim()) {
    return []
  }
  return [{ type: 'text', text }]
}

function buildToolErrorPart(
  toolCall: AgentLoopToolCall,
  errorMessage: string,
  errorDetails: {
    code: string
    errorType: string
    recoverable: boolean
  }
): AgentSessionPart {
  return createToolPart({
    id: toolCall.id,
    name: toolCall.name,
    input: toolCall.input,
    status: 'error',
    output: JSON.stringify({
      success: false,
      error: errorMessage || TOOL_ERROR_MESSAGE,
      code: errorDetails.code || TOOL_ERROR_CODE,
      errorType: errorDetails.errorType,
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      recoverable: errorDetails.recoverable,
      synthetic: false
    })
  })
}

function buildAwaitingInteractionParts(text: string, toolParts: AgentSessionPart[]): AgentSessionPart[] {
  const parts: AgentSessionPart[] = []
  if (text.trim()) {
    parts.push({ type: 'text', text })
  }
  parts.push(...toolParts)
  return parts
}
