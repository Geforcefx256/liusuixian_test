import type { AgentLoopResult } from './loopTypes.js'

export type ModelMetricsAggregate = AgentLoopResult['modelMetricsAggregate']

export class AgentExecutionError extends Error {
  readonly modelMetricsAggregate: ModelMetricsAggregate | null
  override readonly cause?: unknown

  constructor(params: { cause: unknown; modelMetricsAggregate: ModelMetricsAggregate | null }) {
    const message = params.cause instanceof Error ? params.cause.message : String(params.cause)
    super(message, { cause: params.cause })
    this.name = 'AgentExecutionError'
    this.modelMetricsAggregate = params.modelMetricsAggregate
    this.cause = params.cause
  }
}

export function isAgentExecutionError(error: unknown): error is AgentExecutionError {
  return error instanceof AgentExecutionError
}
