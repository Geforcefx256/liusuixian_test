import type { AgentStreamEvent } from '../agent/types.js'
import { getLogContext } from './context.js'
import { appendRuntimeLog } from './logger.js'
import type { RuntimeLogContext, RuntimeLogLevel } from './types.js'

const RUNTIME_CATEGORY = 'runtime' as const

export function recordTimelineEvent(event: AgentStreamEvent): void {
  const record = buildTimelineRecord(event)
  if (!record) {
    return
  }
  appendRuntimeLog(record)
}

function buildTimelineRecord(event: AgentStreamEvent): {
  level: RuntimeLogLevel
  category: 'runtime'
  component: string
  message: string
  data?: Record<string, unknown>
  context?: RuntimeLogContext
} | null {
  switch (event.type) {
    case 'lifecycle.start':
      return createTimelineRecord(event, 'info', 'run.lifecycle', '开始执行请求。', { startedAt: event.startedAt })
    case 'lifecycle.queued':
      return createTimelineRecord(event, 'warn', 'run.queue', event.message || '请求进入排队状态。', { queuedAt: event.queuedAt })
    case 'tool.started':
      return createTimelineRecord(event, 'info', 'run.tool', buildToolStartedMessage(event), {
        tool: event.tool,
        toolCallId: event.toolCallId,
        displayName: event.displayName,
        toolKind: event.toolKind
      })
    case 'tool.failed':
      return createTimelineRecord(event, 'warn', 'run.tool', event.statusMessage, {
        tool: event.tool,
        toolCallId: event.toolCallId,
        displayName: event.displayName,
        toolKind: event.toolKind,
        recoveryMode: event.recoveryMode,
        normalizedCode: event.normalizedCode,
        stopReason: event.stopReason,
        retryHint: event.retryHint,
        chainKey: event.chainKey,
        attempt: event.attempt,
        remainingRecoveryBudget: event.remainingRecoveryBudget,
        runtimeRetryCount: event.runtimeRetryCount,
        threshold: event.threshold
      })
    case 'context.log':
      return createTimelineRecord(event, event.level, 'run.context', event.message, event.data)
    case 'plan.snapshot':
      return createTimelineRecord(event, 'info', 'run.plan', `生成计划：${event.plan.title}`, { plan: event.plan })
    case 'plan.awaiting_decision':
      return createTimelineRecord(event, 'warn', 'run.plan', `等待计划决策：v${event.version}`, {
        planId: event.planId,
        version: event.version
      })
    case 'plan.delegation':
      return createTimelineRecord(event, 'info', 'run.plan', `子代理 ${event.subagent} 已完成。`, event.data)
    case 'agent.handoff':
      return createTimelineRecord(event, 'info', 'run.agent', `主代理切换：${event.from} -> ${event.to}`, {
        reason: event.reason,
        plan: event.plan
      })
    case 'metrics.run':
      return createTimelineRecord(event, 'info', 'run.metrics', '本次执行指标已生成。', {
        totalLatencyMs: event.metrics.totalLatencyMs,
        toolCalls: event.metrics.tools.length,
        failures: event.metrics.failures
      })
    case 'lifecycle.error':
      return createTimelineRecord(event, 'error', 'run.lifecycle', event.runtimeError?.userMessage || event.error, {
        runtimeError: event.runtimeError,
        endedAt: event.endedAt
      })
    case 'run.completed':
      return createTimelineRecord(event, resolveCompletionLevel(event.status), 'run.result', buildCompletionMessage(event), {
        status: event.status,
        result: event.result,
        error: event.error,
        endedAt: event.endedAt
      })
    default:
      return null
  }
}

function createTimelineRecord(
  event: Extract<AgentStreamEvent, { runId: string }>,
  level: RuntimeLogLevel,
  component: string,
  message: string,
  data?: Record<string, unknown>
) {
  const context = resolveEntryScope(event)
  if (!context.agentId || !context.sessionId) {
    return null
  }
  return {
    level,
    category: RUNTIME_CATEGORY,
    component,
    message,
    data,
    context: {
      ...context,
      runId: event.runId
    }
  }
}

function resolveEntryScope(event: Extract<AgentStreamEvent, { runId: string }>): RuntimeLogContext {
  if ('agentId' in event && 'sessionId' in event) {
    return { agentId: event.agentId, sessionId: event.sessionId }
  }
  if ('result' in event) {
    return { agentId: event.result.agentId, sessionId: event.result.sessionId }
  }
  return getLogContext()
}

function buildCompletionMessage(event: Extract<AgentStreamEvent, { type: 'run.completed' }>): string {
  if (event.status === 'success') {
    return '执行完成。'
  }
  if (event.status === 'awaiting-interaction') {
    return '执行暂停，等待用户输入。'
  }
  if (event.status === 'cancelled') {
    return '执行已取消。'
  }
  return event.error?.message || event.result.runtimeError?.userMessage || event.result.error || '执行失败。'
}

function resolveCompletionLevel(status: Extract<AgentStreamEvent, { type: 'run.completed' }>['status']): RuntimeLogLevel {
  if (status === 'success') {
    return 'info'
  }
  if (status === 'awaiting-interaction' || status === 'cancelled') {
    return 'warn'
  }
  return 'error'
}

function buildToolStartedMessage(event: Extract<AgentStreamEvent, { type: 'tool.started' }>): string {
  const label = event.toolKind === 'skill' ? 'Skill' : 'Tool'
  return `开始调用 ${label}: ${event.displayName}`
}
