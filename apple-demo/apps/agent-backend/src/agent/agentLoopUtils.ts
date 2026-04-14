import type { AgentLoopResult } from './loopTypes.js'

const MIN_STEPS = 1
const ZERO = 0
const ONE = 1

export function assertStepWithinLimit(stepCount: number, maxSteps: number): void {
  if (maxSteps < MIN_STEPS) {
    throw new Error(`Agent loop maxSteps must be at least ${MIN_STEPS}.`)
  }
  if (stepCount > maxSteps) {
    throw new Error(`Agent loop exceeded max steps: ${maxSteps}.`)
  }
}

export function createModelMetricsAggregate(): AgentLoopResult['modelMetricsAggregate'] {
  return {
    calls: ZERO,
    latencyMs: ZERO,
    inputTokens: ZERO,
    outputTokens: ZERO,
    totalTokens: ZERO
  }
}

export function addModelMetricsAggregate(
  current: AgentLoopResult['modelMetricsAggregate'],
  next: AgentLoopResult['modelMetrics']
): AgentLoopResult['modelMetricsAggregate'] {
  return {
    calls: current.calls + ONE,
    latencyMs: current.latencyMs + Math.max(ZERO, next.latencyMs),
    inputTokens: current.inputTokens + Math.max(ZERO, next.inputTokens),
    outputTokens: current.outputTokens + Math.max(ZERO, next.outputTokens),
    totalTokens: current.totalTokens + Math.max(ZERO, next.totalTokens)
  }
}
