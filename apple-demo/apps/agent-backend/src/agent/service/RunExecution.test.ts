import { afterEach, describe, expect, it, vi } from 'vitest'
import { RunExecution } from './RunExecution.js'
import { AgentExecutionError } from '../executionErrors.js'
import { buildFailedModelCallMetrics, buildModelRequestError } from '../modelRequestError.js'
import type { AgentRunRequest } from '../types.js'
import {
  attachRuntimeLogSink,
  resetRuntimeLoggingForTests,
  type RuntimeLogEntry,
  type RuntimeLogSink
} from '../../logging/index.js'

function createRequest(): AgentRunRequest {
  return {
    runId: 'run-1',
    userId: 1,
    agentId: 'agent-1',
    sessionId: 'session-1',
    input: 'debug failure',
    model: {
      provider: 'openai',
      modelName: 'gpt-4o-mini'
    }
  }
}

function createRunExecution(): RunExecution {
  return new RunExecution({
    catalogService: {} as any,
    chatOrchestrator: {} as any,
    sessionStore: {} as any,
    providerClient: {} as any,
    toolRegistry: {} as any,
    workspaceDir: '/tmp',
    runs: new Map(),
    results: new Map()
  })
}

class CollectingSink implements RuntimeLogSink {
  readonly entries: RuntimeLogEntry[] = []

  append(entry: RuntimeLogEntry): void {
    this.entries.push(entry)
  }
}

function captureRuntimeLogs(): RuntimeLogEntry[] {
  const sink = new CollectingSink()
  attachRuntimeLogSink(sink)
  return sink.entries
}

function parseRunTiming(entries: RuntimeLogEntry[]): Record<string, unknown> {
  const entry = entries.find(item => item.component === 'run_timing')
  expect(entry?.data).toBeTruthy()
  return entry?.data ?? {}
}

describe('RunExecution.handleRunError', () => {
  afterEach(() => {
    resetRuntimeLoggingForTests()
    vi.restoreAllMocks()
  })

  it('preserves failed model aggregate for run timing and runtime errors', () => {
    vi.spyOn(Date, 'now').mockReturnValue(4200)
    const logs = captureRuntimeLogs()
    const execution = createRunExecution()
    const request = createRequest()
    const emit = vi.fn()
    const modelError = buildModelRequestError({
      message: 'Model transport failed; provider=openai; model=gpt-4o-mini; requestUrl=https://api.openai.com/v1/chat/completions; detail=fetch failed',
      failureKind: 'transport',
      metrics: buildFailedModelCallMetrics({
        model: request.model!,
        latencyMs: 3200,
        requestUrl: 'https://api.openai.com/v1/chat/completions'
      }),
      detail: 'Model transport failed; requestStage=request_pre_response',
      diagnostics: {
        requestStage: 'request_pre_response',
        responseStarted: false,
        latencyMs: 3200,
        causeChain: [
          { depth: 0, name: 'TypeError', message: 'fetch failed' }
        ]
      },
      retryable: true
    })
    const error = new AgentExecutionError({
      cause: modelError,
      modelMetricsAggregate: {
        calls: 1,
        latencyMs: 3200,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0
      }
    })

    const result = (execution as any).handleRunError({
      request,
      error,
      startedAt: 1000,
      emit,
      turnId: 'session-1:turn-1'
    })

    expect(result.status).toBe('error')
    expect(result.error?.runtimeError).toMatchObject({
      runId: 'run-1',
      failureKind: 'transport',
      modelDiagnostics: {
        requestStage: 'request_pre_response',
        responseStarted: false,
        latencyMs: 3200
      }
    })
    expect(parseRunTiming(logs)).toEqual({
      modelCostTime: '3.200s',
      toolCostTime: '0.000s',
      otherCostTime: '0.000s',
      costAllTime: '3.200s'
    })
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'lifecycle.error',
      runId: 'run-1',
      runtimeError: expect.objectContaining({
        runId: 'run-1',
        modelDiagnostics: expect.objectContaining({
          requestStage: 'request_pre_response'
        })
      })
    }))
  })

  it('emits structured tool recovery progress events', () => {
    const execution = createRunExecution()
    const request = createRequest()
    const emit = vi.fn()

    ;(execution as any).emitToolFailed({
      toolCallId: 'tool-1',
      tool: 'local:read_file',
      displayName: 'read_file',
      toolKind: 'tool',
      startedAt: 1000,
      failedAt: 1200,
      statusMessage: '工具 read_file 执行失败，正在修正后重试。',
      recoveryMode: 'recovering',
      normalizedCode: 'path_not_found',
      retryHint: 'correct_input',
      attempt: 1,
      remainingRecoveryBudget: 0,
      runtimeRetryCount: 0
    }, request, emit)

    expect(emit).toHaveBeenCalledWith({
      type: 'tool.failed',
      runId: 'run-1',
      agentId: 'agent-1',
      sessionId: 'session-1',
      toolCallId: 'tool-1',
      tool: 'local:read_file',
      displayName: 'read_file',
      toolKind: 'tool',
      startedAt: 1000,
      failedAt: 1200,
      statusMessage: '工具 read_file 执行失败，正在修正后重试。',
      recoveryMode: 'recovering',
      normalizedCode: 'path_not_found',
      retryHint: 'correct_input',
      attempt: 1,
      remainingRecoveryBudget: 0,
      runtimeRetryCount: 0
    })
  })
})
