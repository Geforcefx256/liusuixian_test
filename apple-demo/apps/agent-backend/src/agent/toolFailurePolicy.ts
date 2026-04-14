export type ToolFailureCategory = 'transient_retryable' | 'model_recoverable' | 'terminal'

export type ToolRetryHint = 'retry' | 'correct_input' | 'do_not_retry'

export type ToolStopReason =
  | 'tool_terminal'
  | 'model_recovery_exhausted'
  | 'no_progress_same_failure'
  | 'no_progress_same_outcome'
  | 'tool_denied'

export interface RuntimeRetryPolicy {
  maxAttempts: number
}

export interface ModelRecoveryPolicy {
  maxCorrectionCalls: number
}

export interface LoopDetectionPolicy {
  enabled: boolean
  sameFailureThreshold: number
  sameOutcomeThreshold: number
}

export interface ToolFailurePolicyConfig {
  runtimeRetry: RuntimeRetryPolicy
  modelRecovery: ModelRecoveryPolicy
  loopDetection: LoopDetectionPolicy
}

export interface RuntimeToolPolicy {
  idempotent: boolean
  supportsRuntimeRetry: boolean
  supportsModelRecovery: boolean
}

export interface ToolFailureClassification {
  normalizedCode: string
  category: ToolFailureCategory
  retryHint: ToolRetryHint
  safeToRepeat: boolean
  denyOrigin?: string
}

export interface ToolCallChainState {
  chainKey: string
  toolName: string
  openedByToolCallId: string
  assistantMessageIds?: number[]
  correctionCallsUsed: number
  lastFailureSignature: string
  lastFailureOutcome: string
  repeatedSameFailureCount: number
  repeatedSameOutcomeCount: number
}

export const DEFAULT_RUNTIME_RETRY_POLICY: RuntimeRetryPolicy = Object.freeze({
  maxAttempts: 0
})

export const DEFAULT_MODEL_RECOVERY_POLICY: ModelRecoveryPolicy = Object.freeze({
  maxCorrectionCalls: 1
})

export const DEFAULT_LOOP_DETECTION_POLICY: LoopDetectionPolicy = Object.freeze({
  enabled: true,
  sameFailureThreshold: 2,
  sameOutcomeThreshold: 3
})

export const DEFAULT_TOOL_FAILURE_POLICY: ToolFailurePolicyConfig = Object.freeze({
  runtimeRetry: DEFAULT_RUNTIME_RETRY_POLICY,
  modelRecovery: DEFAULT_MODEL_RECOVERY_POLICY,
  loopDetection: DEFAULT_LOOP_DETECTION_POLICY
})

export const DEFAULT_RUNTIME_TOOL_POLICY: RuntimeToolPolicy = Object.freeze({
  idempotent: false,
  supportsRuntimeRetry: false,
  supportsModelRecovery: true
})

export function cloneToolFailurePolicy(
  config: ToolFailurePolicyConfig = DEFAULT_TOOL_FAILURE_POLICY
): ToolFailurePolicyConfig {
  return {
    runtimeRetry: {
      maxAttempts: config.runtimeRetry.maxAttempts
    },
    modelRecovery: {
      maxCorrectionCalls: config.modelRecovery.maxCorrectionCalls
    },
    loopDetection: {
      enabled: config.loopDetection.enabled,
      sameFailureThreshold: config.loopDetection.sameFailureThreshold,
      sameOutcomeThreshold: config.loopDetection.sameOutcomeThreshold
    }
  }
}

export function cloneRuntimeToolPolicy(
  policy: RuntimeToolPolicy = DEFAULT_RUNTIME_TOOL_POLICY
): RuntimeToolPolicy {
  return {
    idempotent: policy.idempotent,
    supportsRuntimeRetry: policy.supportsRuntimeRetry,
    supportsModelRecovery: policy.supportsModelRecovery
  }
}
