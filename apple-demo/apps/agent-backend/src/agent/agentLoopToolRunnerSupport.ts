import { createToolPart } from './sessionParts.js'
import { classifyToolFailure } from './toolFailureClassifier.js'
import {
  cloneRuntimeToolPolicy,
  DEFAULT_RUNTIME_TOOL_POLICY,
  type RuntimeToolPolicy,
  type ToolCallChainState,
  type ToolFailurePolicyConfig,
  type ToolRetryHint,
  type ToolStopReason
} from './toolFailurePolicy.js'
import type { AgentLoopToolCall, AgentSessionPart } from './loopTypes.js'
import type { GatewayInvokeFailure, GatewayInvokeResponse } from '../gateway/tools/types.js'

const TOOL_ERROR_MESSAGE = 'Tool execution failed.'

interface MachineFacingToolErrorPayload {
  success: false
  code: string
  recoverable: boolean
  retryHint: ToolRetryHint
  error: string
  field?: string
  expected?: string
  actual?: string
  fix?: string
}

export interface ResolvedFailureOutcome {
  recoverable: boolean
  nextChain: ToolCallChainState | null
  errorType: string
  normalizedCode: string
  category: string
  retryHint: ToolRetryHint
  safeToRepeat: boolean
  chainKey?: string
  attempt: number
  remainingRecoveryBudget: number
  runtimeRetryCount: number
  stopReason?: ToolStopReason
  threshold?: number
  denyOrigin?: string
}

export function resolveFailureOutcome(params: {
  toolCall: AgentLoopToolCall
  failure: GatewayInvokeFailure
  activeChain: ToolCallChainState | null
  classification: ReturnType<typeof classifyToolFailure>
  runtimeRetryCount: number
  toolPolicy: RuntimeToolPolicy
  policy: ToolFailurePolicyConfig
}): ResolvedFailureOutcome {
  if (params.classification.category !== 'model_recoverable' || !params.toolPolicy.supportsModelRecovery) {
    return buildTerminalOutcome(params, 'tool_terminal')
  }

  const priorChain = params.activeChain?.toolName === params.toolCall.name ? params.activeChain : null
  const attempt = priorChain ? priorChain.correctionCallsUsed + 1 : 0
  const remainingRecoveryBudget = params.policy.modelRecovery.maxCorrectionCalls - attempt
  const signature = buildFailureSignature(params.toolCall.input, params.classification.normalizedCode)
  const outcome = params.classification.normalizedCode
  const chainKey = priorChain?.chainKey || createChainKey(params.toolCall)
  const nextChain = buildNextChain(priorChain, params.toolCall, attempt, signature, outcome, chainKey)
  const noProgress = resolveNoProgressStopReason(priorChain, nextChain, params.policy)
  if (noProgress) {
    return {
      recoverable: false,
      nextChain: null,
      errorType: params.failure.error.type,
      normalizedCode: params.classification.normalizedCode,
      category: params.classification.category,
      retryHint: params.classification.retryHint,
      safeToRepeat: params.classification.safeToRepeat,
      chainKey,
      attempt,
      remainingRecoveryBudget,
      runtimeRetryCount: params.runtimeRetryCount,
      stopReason: noProgress.stopReason,
      threshold: noProgress.threshold,
      denyOrigin: params.classification.denyOrigin
    }
  }
  if (remainingRecoveryBudget <= 0) {
    return {
      recoverable: false,
      nextChain: null,
      errorType: params.failure.error.type,
      normalizedCode: params.classification.normalizedCode,
      category: params.classification.category,
      retryHint: params.classification.retryHint,
      safeToRepeat: params.classification.safeToRepeat,
      chainKey,
      attempt,
      remainingRecoveryBudget: 0,
      runtimeRetryCount: params.runtimeRetryCount,
      stopReason: 'model_recovery_exhausted',
      threshold: params.policy.modelRecovery.maxCorrectionCalls,
      denyOrigin: params.classification.denyOrigin
    }
  }
  return {
    recoverable: true,
    nextChain,
    errorType: params.failure.error.type,
    normalizedCode: params.classification.normalizedCode,
    category: params.classification.category,
    retryHint: params.classification.retryHint,
    safeToRepeat: params.classification.safeToRepeat,
    chainKey,
    attempt,
    remainingRecoveryBudget,
    runtimeRetryCount: params.runtimeRetryCount,
    denyOrigin: params.classification.denyOrigin
  }
}

export function buildToolErrorPart(
  toolCall: AgentLoopToolCall,
  failure: GatewayInvokeFailure['error'],
  outcome: ResolvedFailureOutcome
): AgentSessionPart {
  return createToolPart({
    id: toolCall.id,
    name: toolCall.name,
    input: toolCall.input,
    status: 'error',
    output: JSON.stringify(buildMachineFacingToolErrorPayload(failure, outcome))
  })
}

export function closeChainOnToolSwitch(
  activeChain: ToolCallChainState | null,
  nextToolName: string
): ToolCallChainState | null {
  if (!activeChain || activeChain.toolName === nextToolName) {
    return activeChain
  }
  return null
}

export function shouldRuntimeRetry(
  category: string,
  toolPolicy: RuntimeToolPolicy,
  runtimeRetryCount: number,
  policy: ToolFailurePolicyConfig
): boolean {
  return category === 'transient_retryable'
    && toolPolicy.idempotent
    && toolPolicy.supportsRuntimeRetry
    && runtimeRetryCount < policy.runtimeRetry.maxAttempts
}

export function resolveRuntimeToolPolicy(policy?: RuntimeToolPolicy): RuntimeToolPolicy {
  if (!policy) {
    return cloneRuntimeToolPolicy(DEFAULT_RUNTIME_TOOL_POLICY)
  }
  return cloneRuntimeToolPolicy(policy)
}

function buildTerminalOutcome(
  params: Pick<
    Parameters<typeof resolveFailureOutcome>[0],
    'classification' | 'failure' | 'runtimeRetryCount'
  >,
  defaultStopReason: ToolStopReason
): ResolvedFailureOutcome {
  const stopReason = params.classification.normalizedCode === 'tool_denied'
    ? 'tool_denied'
    : defaultStopReason
  return {
    recoverable: false,
    nextChain: null,
    errorType: params.failure.error.type,
    normalizedCode: params.classification.normalizedCode,
    category: params.classification.category,
    retryHint: params.classification.retryHint,
    safeToRepeat: params.classification.safeToRepeat,
    attempt: 0,
    remainingRecoveryBudget: 0,
    runtimeRetryCount: params.runtimeRetryCount,
    stopReason,
    denyOrigin: params.classification.denyOrigin
  }
}

function buildNextChain(
  priorChain: ToolCallChainState | null,
  toolCall: AgentLoopToolCall,
  attempt: number,
  signature: string,
  outcome: string,
  chainKey: string
): ToolCallChainState {
  const repeatedSameFailureCount = priorChain && signature === priorChain.lastFailureSignature
    ? priorChain.repeatedSameFailureCount + 1
    : 0
  const repeatedSameOutcomeCount = priorChain && outcome === priorChain.lastFailureOutcome
    ? priorChain.repeatedSameOutcomeCount + 1
    : 0
  return {
    chainKey,
    toolName: toolCall.name,
    openedByToolCallId: priorChain?.openedByToolCallId || toolCall.id,
    assistantMessageIds: priorChain?.assistantMessageIds || [],
    correctionCallsUsed: attempt,
    lastFailureSignature: signature,
    lastFailureOutcome: outcome,
    repeatedSameFailureCount,
    repeatedSameOutcomeCount
  }
}

function resolveNoProgressStopReason(
  priorChain: ToolCallChainState | null,
  nextChain: ToolCallChainState,
  policy: ToolFailurePolicyConfig
): { stopReason: ToolStopReason; threshold: number } | null {
  if (!policy.loopDetection.enabled || !priorChain) {
    return null
  }
  if (
    policy.loopDetection.sameFailureThreshold > 0
    && nextChain.repeatedSameFailureCount >= policy.loopDetection.sameFailureThreshold
  ) {
    return {
      stopReason: 'no_progress_same_failure',
      threshold: policy.loopDetection.sameFailureThreshold
    }
  }
  if (
    policy.loopDetection.sameOutcomeThreshold > 0
    && nextChain.repeatedSameOutcomeCount >= policy.loopDetection.sameOutcomeThreshold
  ) {
    return {
      stopReason: 'no_progress_same_outcome',
      threshold: policy.loopDetection.sameOutcomeThreshold
    }
  }
  return null
}

function buildFailureSignature(input: Record<string, unknown>, normalizedCode: string): string {
  return `${normalizedCode}:${stableStringify(input)}`
}

function buildMachineFacingToolErrorPayload(
  failure: GatewayInvokeFailure['error'],
  outcome: ResolvedFailureOutcome
): MachineFacingToolErrorPayload {
  return {
    success: false,
    code: outcome.normalizedCode,
    recoverable: outcome.recoverable,
    retryHint: outcome.retryHint,
    error: failure.message || TOOL_ERROR_MESSAGE,
    ...(failure.field ? { field: failure.field } : {}),
    ...(failure.expected ? { expected: failure.expected } : {}),
    ...(failure.actual ? { actual: failure.actual } : {}),
    ...(failure.fix ? { fix: failure.fix } : {})
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(',')}]`
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
}

function createChainKey(toolCall: AgentLoopToolCall): string {
  return `${toolCall.name}:${toolCall.id}`
}
