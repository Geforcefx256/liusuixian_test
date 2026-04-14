import { createToolPart } from './sessionParts.js'
import { buildQuestionDegradation, shouldDegradeQuestionFailure } from './questionToolDegradation.js'
import {
  buildStructuredAssistantParts,
  detectStructuredToolOutput,
  type StructuredOutput
} from './structuredOutput.js'
import type { AgentSessionInteractionView } from './interactions.js'
import {
  buildAwaitingInteractionToolSummary,
  buildDegradedQuestionInteractionPayload,
  parseAwaitingInteractionToolSummary,
  toInteractionView
} from './interactions.js'
import { buildPendingQuestionSummary } from './questionSummary.js'
import { classifyToolFailure } from './toolFailureClassifier.js'
import { ToolInvocationError } from './toolInvocationError.js'
import { cloneToolFailurePolicy, type RuntimeToolPolicy, type ToolCallChainState, type ToolFailurePolicyConfig } from './toolFailurePolicy.js'
import {
  buildToolErrorPart,
  closeChainOnToolSwitch,
  resolveFailureOutcome,
  resolveRuntimeToolPolicy,
  shouldRuntimeRetry,
  type ResolvedFailureOutcome
} from './agentLoopToolRunnerSupport.js'
import { buildFailureMetric, buildSuccessMetric, logFailure, logRuntimeRetry } from './agentLoopToolRunnerTelemetry.js'
import type {
  AgentFinalOutputMeta,
  AgentLoopToolCall,
  AgentLoopToolDefinition,
  AgentSessionMessage,
  AgentSessionPart,
  ToolFailureSignal,
  ToolInvocationSignal,
  ToolRegistryLike
} from './loopTypes.js'
import type { ToolCallMetrics, TraceContext } from './types.js'
import { buildLogPreview } from '../support/logPreview.js'
import type {
  GatewayInjectedSkillContextMessage,
  GatewayInvokeResponse
} from '../gateway/tools/types.js'
import {
  buildToolInvocationSignal,
  resolveTriggeredSkillDisplayName,
  type ToolDisplayNameResolver
} from './toolInvocationSignal.js'
import { buildToolFailureStatus } from './toolFailureProgress.js'
import { createLogger } from '../logging/index.js'
import type { AgentSessionStore } from './sessionStore.js'
import { createSkillContextMessage } from './sessionMessages.js'

const agentLoopToolLogger = createLogger({
  category: 'tool',
  component: 'agent_loop'
})

export interface AgentLoopRecoveryState {
  activeChain: ToolCallChainState | null
}

interface ShortCircuitResult {
  text: string
  parts: AgentSessionPart[]
  structuredOutput?: StructuredOutput
  awaitingInteraction?: AgentSessionInteractionView
  supersededAssistantMessageIds?: number[]
  finalOutputMeta: AgentFinalOutputMeta
}

interface ToolRunnerRequest {
  userId: number
  agentId: string
  sessionId: string
  allowedSkillIds?: string[]
  toolCalls: AgentLoopToolCall[]
  toolDefinitions: Map<string, AgentLoopToolDefinition>
  trace: TraceContext
  recoveryState: AgentLoopRecoveryState
  onToolStarted?: (signal: ToolInvocationSignal) => void
}

interface ToolRunnerResult {
  metrics: ToolCallMetrics[]
  toolParts: AgentSessionPart[]
  injectedMessages: AgentSessionMessage[]
  recoveryState: AgentLoopRecoveryState
  shortCircuit?: ShortCircuitResult
  toolError?: ToolInvocationError
  toolFailureSignal?: ToolFailureSignal
  skillTriggered?: string
}

export class AgentLoopToolRunner {
  private readonly policy: ToolFailurePolicyConfig

  constructor(
    private readonly toolRegistry: ToolRegistryLike,
    private readonly sessionStore: AgentSessionStore,
    private readonly options: {
      logDetail?: boolean
      policy?: ToolFailurePolicyConfig
      displayNameResolver?: ToolDisplayNameResolver
    }
  ) {
    this.policy = cloneToolFailurePolicy(options.policy)
  }

  async run(params: ToolRunnerRequest): Promise<ToolRunnerResult> {
    const metrics: ToolCallMetrics[] = []
    const toolParts: AgentSessionPart[] = []
    const injectedMessages: AgentSessionMessage[] = []
    let skillTriggered: string | undefined
    let activeChain = params.recoveryState.activeChain

    for (const toolCall of params.toolCalls) {
      activeChain = closeChainOnToolSwitch(activeChain, toolCall.name)
      const startedAt = Date.now()
      params.onToolStarted?.(buildToolInvocationSignal(
        toolCall,
        startedAt,
        this.options.displayNameResolver,
        params.agentId
      ))
      const toolPolicy = resolveRuntimeToolPolicy(params.toolDefinitions.get(toolCall.name)?.runtimePolicy)
      const invocation = await this.invokeWithRuntimeRetry({ ...params, toolCall, toolPolicy })
      if (invocation.response.ok) {
        activeChain = null
        const triggeredSkill = resolveTriggeredSkillDisplayName(
          toolCall,
          this.options.displayNameResolver,
          params.agentId
        )
        if (triggeredSkill) {
          skillTriggered = triggeredSkill
        }
        metrics.push(buildSuccessMetric(invocation.response, toolCall, startedAt))
        toolParts.push(createToolPart({
          id: toolCall.id,
          name: toolCall.name,
          input: toolCall.input,
          status: 'success',
          output: invocation.response.result.summary
        }))
        injectedMessages.push(
          ...toInjectedSessionMessages(invocation.response.result.sideEffects?.injectedMessages)
        )
        const shortCircuit = this.resolveShortCircuit(
          toolCall,
          invocation.response.result.summary,
          toolParts
        )
        if (shortCircuit) {
          return {
            metrics,
            toolParts,
            injectedMessages,
            recoveryState: { activeChain },
            shortCircuit,
            skillTriggered
          }
        }
        continue
      }

      metrics.push(buildFailureMetric(toolCall, startedAt))
      const failureInvocation = {
        response: invocation.response,
        classification: invocation.classification,
        runtimeRetryCount: invocation.runtimeRetryCount
      } satisfies {
        response: Extract<GatewayInvokeResponse, { ok: false }>
        classification?: ReturnType<typeof classifyToolFailure>
        runtimeRetryCount: number
      }
      const resolved = resolveResolvedFailure(failureInvocation, toolCall, activeChain, toolPolicy, this.policy)
      logFailure(params.trace, toolCall, failureInvocation.response.error, invocation.runtimeRetryCount, resolved)
      const degradedQuestionResult = await buildQuestionDegradedShortCircuit({
        sessionStore: this.sessionStore,
        request: params,
        toolCall,
        resolved,
        failure: failureInvocation.response.error,
        toolParts,
        priorChain: activeChain
      })
      if (degradedQuestionResult) {
        return {
          metrics,
          toolParts,
          injectedMessages,
          recoveryState: { activeChain: null },
          shortCircuit: degradedQuestionResult,
          skillTriggered
        }
      }
      toolParts.push(buildToolErrorPart(toolCall, failureInvocation.response.error, resolved))
      if (resolved.recoverable) {
        return {
          metrics,
          toolParts,
          injectedMessages,
          recoveryState: { activeChain: resolved.nextChain },
          toolFailureSignal: buildRecoveringToolFailureSignal({
            toolCall,
            failedAt: Date.now(),
            agentId: params.agentId,
            displayNameResolver: this.options.displayNameResolver,
            resolved
          }),
          skillTriggered
        }
      }
      return {
        metrics,
        toolParts,
        injectedMessages,
        recoveryState: { activeChain: null },
        toolError: buildToolInvocationError(toolCall, failureInvocation.response.error.message, resolved),
        skillTriggered
      }
    }

    return { metrics, toolParts, injectedMessages, recoveryState: { activeChain }, skillTriggered }
  }

  private async invokeWithRuntimeRetry(params: {
    userId: number
    agentId: string
    sessionId: string
    allowedSkillIds?: string[]
    trace: TraceContext
    toolCall: AgentLoopToolCall
    toolPolicy: RuntimeToolPolicy
  }): Promise<{
    response: GatewayInvokeResponse
    classification?: ReturnType<typeof classifyToolFailure>
    runtimeRetryCount: number
  }> {
    let runtimeRetryCount = 0
    while (true) {
      const response = await this.toolRegistry.invoke({
        tool: params.toolCall.name,
        args: params.toolCall.input,
        agentId: params.agentId,
        allowedSkillIds: params.allowedSkillIds,
        sessionKey: params.sessionId,
        workspaceScope: {
          userId: params.userId,
          agentId: params.agentId
        },
        trace: {
          ...params.trace,
          toolCallId: params.toolCall.id
        }
      })
      if (response.ok) {
        if (runtimeRetryCount > 0) {
          logRuntimeRetry(params.trace, params.toolCall, runtimeRetryCount, 'success')
        }
        logToolSuccess(params.trace, params.toolCall, response, runtimeRetryCount, Boolean(this.options.logDetail))
        return { response, runtimeRetryCount }
      }

      const classification = classifyToolFailure({
        toolName: params.toolCall.name,
        errorType: response.error.type,
        message: response.error.message,
        toolPolicy: params.toolPolicy
      })
      if (!shouldRuntimeRetry(classification.category, params.toolPolicy, runtimeRetryCount, this.policy)) {
        if (runtimeRetryCount > 0) {
          logRuntimeRetry(params.trace, params.toolCall, runtimeRetryCount, 'failed')
        }
        return { response, classification, runtimeRetryCount }
      }
      runtimeRetryCount += 1
      logRuntimeRetry(params.trace, params.toolCall, runtimeRetryCount, 'retrying')
    }
  }

  private resolveShortCircuit(
    toolCall: AgentLoopToolCall,
    summary: string,
    toolParts: AgentSessionPart[]
  ): ShortCircuitResult | null {
    const awaiting = parseAwaitingInteractionToolSummary(summary)
    if (awaiting) {
      return {
        text: awaiting.text,
        parts: buildAwaitingInteractionParts(awaiting.text, toolParts),
        awaitingInteraction: awaiting.interaction,
        finalOutputMeta: {
          source: 'tool',
          toolName: toolCall.name,
          toolCallId: toolCall.id,
          structuredHint: 'awaiting-interaction'
        }
      }
    }
    const structuredOutput = detectStructuredToolOutput({
      toolName: toolCall.name,
      summary
    })
    if (!structuredOutput) {
      return null
    }
    return buildShortCircuitResult(toolCall, structuredOutput, toolParts)
  }
}

function buildRecoveringToolFailureSignal(params: {
  toolCall: AgentLoopToolCall
  failedAt: number
  agentId: string
  displayNameResolver?: ToolDisplayNameResolver
  resolved: ResolvedFailureOutcome
}): ToolFailureSignal {
  const toolSignal = buildToolInvocationSignal(
    params.toolCall,
    params.failedAt,
    params.displayNameResolver,
    params.agentId
  )
  const status = buildToolFailureStatus({
    displayName: toolSignal.displayName,
    toolKind: toolSignal.toolKind,
    retryHint: params.resolved.retryHint
  })
  return {
    ...toolSignal,
    failedAt: params.failedAt,
    statusMessage: status.statusMessage,
    recoveryMode: status.recoveryMode,
    normalizedCode: params.resolved.normalizedCode,
    stopReason: params.resolved.stopReason,
    retryHint: params.resolved.retryHint,
    chainKey: params.resolved.chainKey,
    attempt: params.resolved.attempt,
    remainingRecoveryBudget: params.resolved.remainingRecoveryBudget,
    runtimeRetryCount: params.resolved.runtimeRetryCount,
    threshold: params.resolved.threshold
  }
}

function buildAwaitingInteractionParts(text: string, toolParts: AgentSessionPart[]): AgentSessionPart[] {
  const parts: AgentSessionPart[] = []
  if (text.trim()) {
    parts.push({ type: 'text', text })
  }
  parts.push(...toolParts)
  return parts
}

function resolveResolvedFailure(
  invocation: {
    response: Extract<GatewayInvokeResponse, { ok: false }>
    classification?: ReturnType<typeof classifyToolFailure>
    runtimeRetryCount: number
  },
  toolCall: AgentLoopToolCall,
  activeChain: ToolCallChainState | null,
  toolPolicy: RuntimeToolPolicy,
  policy: ToolFailurePolicyConfig
): ResolvedFailureOutcome {
  if (!invocation.classification) {
    throw new Error('Missing failure classification for tool error.')
  }
  return resolveFailureOutcome({
    toolCall,
    failure: invocation.response,
    activeChain,
    classification: invocation.classification,
    runtimeRetryCount: invocation.runtimeRetryCount,
    toolPolicy,
    policy
  })
}

function buildToolInvocationError(
  toolCall: AgentLoopToolCall,
  message: string,
  resolved: ResolvedFailureOutcome
): ToolInvocationError {
  return new ToolInvocationError({
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    message,
    metadata: {
      errorType: resolved.errorType,
      normalizedCode: resolved.normalizedCode,
      stopReason: resolved.stopReason,
      chainKey: resolved.chainKey,
      attempt: resolved.attempt,
      remainingRecoveryBudget: resolved.remainingRecoveryBudget,
      runtimeRetryCount: resolved.runtimeRetryCount,
      threshold: resolved.threshold,
      denyOrigin: resolved.denyOrigin
    }
  })
}

function buildShortCircuitResult(
  toolCall: AgentLoopToolCall,
  structuredOutput: StructuredOutput,
  toolParts: AgentSessionPart[]
): ShortCircuitResult {
  return {
    text: buildShortCircuitText(structuredOutput),
    parts: buildStructuredAssistantParts({
      toolParts,
      output: structuredOutput
    }),
    structuredOutput,
    finalOutputMeta: {
      source: 'tool',
      toolName: toolCall.name,
      toolCallId: toolCall.id,
      structuredHint: structuredOutput.kind
    }
  }
}

async function buildQuestionDegradedShortCircuit(params: {
  sessionStore: AgentSessionStore
  request: Pick<ToolRunnerRequest, 'userId' | 'agentId' | 'sessionId' | 'trace'>
  toolCall: AgentLoopToolCall
  resolved: ResolvedFailureOutcome
  failure: Extract<GatewayInvokeResponse, { ok: false }>['error']
  toolParts: AgentSessionPart[]
  priorChain: ToolCallChainState | null
}): Promise<ShortCircuitResult | null> {
  if (!shouldDegradeQuestionFailure({
    toolName: params.toolCall.name,
    normalizedCode: params.resolved.normalizedCode,
    stopReason: params.resolved.stopReason
  })) {
    return null
  }

  const degradation = buildQuestionDegradation({
    toolInput: params.toolCall.input
  })
  const interaction = await params.sessionStore.createInteraction({
    userId: params.request.userId,
    agentId: params.request.agentId,
    sessionId: params.request.sessionId,
    runId: params.request.trace.runId,
    kind: 'question',
    payload: buildDegradedQuestionInteractionPayload(degradation)
  })
  const interactionView = toInteractionView(interaction)
  const text = buildPendingQuestionSummary(interactionView.payload)
  params.toolParts.push(createToolPart({
    id: params.toolCall.id,
    name: params.toolCall.name,
    input: params.toolCall.input,
    status: 'error',
    output: buildAwaitingInteractionToolSummary(interactionView, {
      degradedFrom: {
        normalizedCode: params.resolved.normalizedCode,
        retryHint: params.resolved.retryHint,
        error: params.failure.message,
        ...(params.failure.field ? { field: params.failure.field } : {}),
        ...(params.failure.expected ? { expected: params.failure.expected } : {}),
        ...(params.failure.actual ? { actual: params.failure.actual } : {}),
        ...(params.failure.fix ? { fix: params.failure.fix } : {})
      }
    })
  }))

  return {
    text,
    parts: buildAwaitingInteractionParts(text, params.toolParts),
    awaitingInteraction: interactionView,
    supersededAssistantMessageIds: params.priorChain?.assistantMessageIds,
    finalOutputMeta: {
      source: 'tool',
      toolName: params.toolCall.name,
      toolCallId: params.toolCall.id,
      structuredHint: 'awaiting-interaction'
    }
  }
}

function buildShortCircuitText(output: StructuredOutput): string {
  const parts = buildStructuredAssistantParts({
    toolParts: [],
    output
  })
  const summary = parts[0]
  return summary?.type === 'text' ? summary.text : ''
}

function logToolSuccess(
  trace: TraceContext,
  toolCall: AgentLoopToolCall,
  response: Extract<GatewayInvokeResponse, { ok: true }>,
  runtimeRetryCount: number,
  logDetail: boolean
): void {
  const payload: Record<string, unknown> = {
    tool: toolCall.name,
    toolCallId: toolCall.id,
    requestId: response.requestId,
    runtimeRetryCount,
    outputChars: response.result.summary.length,
    runId: trace.runId,
    turnId: trace.turnId
  }
  if (toolCall.name !== 'local:write') {
    payload.outputPreview = buildLogPreview(response.result.summary, {
      disableTruncation: logDetail
    })
  }
  agentLoopToolLogger.info({
    message: 'tool result recorded',
    context: {
      runId: trace.runId,
      turnId: trace.turnId
    },
    data: payload
  })
}

function toInjectedSessionMessages(
  injectedMessages: GatewayInjectedSkillContextMessage[] | undefined
): AgentSessionMessage[] {
  if (!injectedMessages?.length) {
    return []
  }
  return injectedMessages.map((message, index) => createSkillContextMessage({
    skillName: message.skillName,
    text: message.text,
    createdAt: Date.now() + index
  }))
}
