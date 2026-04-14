import type { AgentModelConfig, ModelCallMetrics } from './types.js'

export type ModelRequestFailureKind =
  | 'transport'
  | 'http'
  | 'timeout'
  | 'timeout_first_byte'
  | 'timeout_idle'
  | 'protocol'
  | 'stream_interrupted'

export type ModelRequestStage = 'request_pre_response' | 'response_stream'
export type ModelRequestStreamStage = 'stream_read' | 'protocol' | 'watchdog_first_byte' | 'watchdog_idle'

export interface ModelRequestCauseDiagnostic {
  depth: number
  name?: string
  message?: string
  code?: string | number
  errno?: string | number
  syscall?: string
  address?: string
  port?: string | number
}

export interface ModelRequestDiagnostics {
  requestStage: ModelRequestStage
  responseStarted: boolean
  latencyMs: number
  status?: number
  streamStage?: ModelRequestStreamStage
  causeChain?: ModelRequestCauseDiagnostic[]
}

export interface FailedModelCallMetrics extends ModelCallMetrics {
  requestUrl: string
}

export class ModelRequestError extends Error {
  readonly failureKind: ModelRequestFailureKind
  readonly metrics: FailedModelCallMetrics
  readonly detail: string
  readonly retryable: boolean
  readonly status?: number
  readonly diagnostics?: ModelRequestDiagnostics
  override readonly cause?: unknown

  constructor(params: {
    message: string
    failureKind: ModelRequestFailureKind
    metrics: FailedModelCallMetrics
    detail: string
    retryable: boolean
    status?: number
    diagnostics?: ModelRequestDiagnostics
    cause?: unknown
  }) {
    super(params.message, params.cause === undefined ? undefined : { cause: params.cause })
    this.name = 'ModelRequestError'
    this.failureKind = params.failureKind
    this.metrics = params.metrics
    this.detail = params.detail
    this.retryable = params.retryable
    this.status = params.status
    this.diagnostics = params.diagnostics
    this.cause = params.cause
  }
}

export function isModelRequestError(error: unknown): error is ModelRequestError {
  return error instanceof ModelRequestError
}

export function buildFailedModelCallMetrics(params: {
  model: AgentModelConfig
  latencyMs: number
  requestUrl: string
  finishReason?: string | null
}): FailedModelCallMetrics {
  return {
    provider: params.model.provider,
    modelName: params.model.modelName,
    latencyMs: params.latencyMs,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    finishReason: params.finishReason ?? null,
    requestUrl: params.requestUrl
  }
}

export function buildModelRequestError(params: {
  message: string
  failureKind: ModelRequestFailureKind
  metrics: FailedModelCallMetrics
  detail: string
  retryable: boolean
  status?: number
  diagnostics?: ModelRequestDiagnostics
  cause?: unknown
}): ModelRequestError {
  return new ModelRequestError(params)
}
