import type { ToolStopReason } from './toolFailurePolicy.js'

export interface ToolInvocationErrorMetadata {
  errorType?: string
  normalizedCode?: string
  stopReason?: ToolStopReason
  chainKey?: string
  attempt?: number
  remainingRecoveryBudget?: number
  runtimeRetryCount?: number
  threshold?: number
  denyOrigin?: string
}

export class ToolInvocationError extends Error {
  readonly toolCallId: string
  readonly toolName: string
  readonly errorType?: string
  readonly normalizedCode?: string
  readonly stopReason?: ToolStopReason
  readonly chainKey?: string
  readonly attempt?: number
  readonly remainingRecoveryBudget?: number
  readonly runtimeRetryCount?: number
  readonly threshold?: number
  readonly denyOrigin?: string

  constructor(params: {
    toolCallId: string
    toolName: string
    message: string
    metadata?: ToolInvocationErrorMetadata
  }) {
    super(params.message)
    this.name = 'ToolInvocationError'
    this.toolCallId = params.toolCallId
    this.toolName = params.toolName
    this.errorType = params.metadata?.errorType
    this.normalizedCode = params.metadata?.normalizedCode
    this.stopReason = params.metadata?.stopReason
    this.chainKey = params.metadata?.chainKey
    this.attempt = params.metadata?.attempt
    this.remainingRecoveryBudget = params.metadata?.remainingRecoveryBudget
    this.runtimeRetryCount = params.metadata?.runtimeRetryCount
    this.threshold = params.metadata?.threshold
    this.denyOrigin = params.metadata?.denyOrigin
  }
}
