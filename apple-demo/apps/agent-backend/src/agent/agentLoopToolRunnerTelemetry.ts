import type { AgentLoopToolCall } from './loopTypes.js'
import type { ToolCallMetrics, TraceContext } from './types.js'
import type { GatewayInvokeFailure, GatewayInvokeResponse } from '../gateway/tools/types.js'
import type { ResolvedFailureOutcome } from './agentLoopToolRunnerSupport.js'
import { createLogger } from '../logging/index.js'

const toolFailureLogger = createLogger({
  category: 'tool',
  component: 'tool_failure_policy'
})

const runtimeRetryLogger = createLogger({
  category: 'tool',
  component: 'runtime_retry'
})

export function buildSuccessMetric(
  response: Extract<GatewayInvokeResponse, { ok: true }>,
  toolCall: AgentLoopToolCall,
  startedAt: number
): ToolCallMetrics {
  return {
    provider: response.result.meta.server,
    tool: response.result.tool,
    latencyMs: response.result.meta.latencyMs || Date.now() - startedAt,
    success: true,
    toolCallId: toolCall.id
  }
}

export function buildFailureMetric(
  toolCall: AgentLoopToolCall,
  startedAt: number
): ToolCallMetrics {
  return {
    provider: toolCall.name.split(':')[0] || 'unknown',
    tool: toolCall.name,
    latencyMs: Date.now() - startedAt,
    success: false,
    toolCallId: toolCall.id
  }
}

export function logFailure(
  trace: TraceContext,
  toolCall: AgentLoopToolCall,
  error: GatewayInvokeFailure['error'],
  runtimeRetryCount: number,
  outcome: ResolvedFailureOutcome
): void {
  toolFailureLogger.warn({
    message: 'tool failure policy applied',
    context: {
      runId: trace.runId,
      turnId: trace.turnId
    },
    data: {
      tool: toolCall.name,
      toolCallId: toolCall.id,
      error: error.message,
      errorType: error.type,
      normalizedCode: outcome.normalizedCode,
      category: outcome.category,
      runtimeRetryCount,
      recoverable: outcome.recoverable,
      stopReason: outcome.stopReason,
      chainKey: outcome.chainKey,
      attempt: outcome.attempt,
      remainingRecoveryBudget: outcome.remainingRecoveryBudget,
      threshold: outcome.threshold,
      denyOrigin: outcome.denyOrigin
    }
  })
}

export function logRuntimeRetry(
  trace: TraceContext,
  toolCall: AgentLoopToolCall,
  runtimeRetryCount: number,
  outcome: 'retrying' | 'success' | 'failed'
): void {
  runtimeRetryLogger.info({
    message: 'runtime retry state changed',
    context: {
      runId: trace.runId,
      turnId: trace.turnId
    },
    data: {
      tool: toolCall.name,
      toolCallId: toolCall.id,
      runtimeRetryCount,
      outcome
    }
  })
}
