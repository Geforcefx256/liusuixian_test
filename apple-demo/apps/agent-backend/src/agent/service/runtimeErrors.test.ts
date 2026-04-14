import { describe, expect, it } from 'vitest'
import { buildFailedModelCallMetrics, buildModelRequestError } from '../modelRequestError.js'
import { ToolInvocationError } from '../toolInvocationError.js'
import { buildRuntimeError, buildRuntimeErrorFromUnknown } from './runtimeErrors.js'

describe('buildRuntimeError', () => {
  it('classifies truncated model output as a retryable model error', () => {
    const runtimeError = buildRuntimeError({
      message: 'Model output truncated: finish_reason=length; provider=openai; model=gpt-4o-mini',
      cancelled: false,
      provider: 'openai',
      turnId: 'session-1:turn-1'
    })

    expect(runtimeError.code).toBe('MODEL')
    expect(runtimeError.stage).toBe('model')
    expect(runtimeError.retryable).toBe(true)
    expect(runtimeError.userMessage).toBe('模型输出因长度限制被截断，请重试，或调大 maxTokens / 缩短上下文。')
    expect(runtimeError.detail).toContain('finish_reason=length')
  })

  it('treats unsupported finish_reason as a model error', () => {
    const runtimeError = buildRuntimeError({
      message: 'Model returned unsupported finish_reason: finish_reason=content_filter; provider=openai; model=gpt-4o-mini',
      cancelled: false,
      provider: 'openai',
      turnId: 'session-1:turn-2'
    })

    expect(runtimeError.code).toBe('MODEL')
    expect(runtimeError.stage).toBe('model')
    expect(runtimeError.retryable).toBe(false)
    expect(runtimeError.userMessage).toBe('模型请求失败，请稍后重试。')
  })

  it('maps cancellations into a user-safe summary', () => {
    const runtimeError = buildRuntimeError({
      message: 'Request cancelled by client.',
      cancelled: true,
      provider: 'openai',
      turnId: 'session-1:turn-cancelled'
    })

    expect(runtimeError.code).toBe('CANCELLED')
    expect(runtimeError.userMessage).toBe('请求已取消。')
    expect(runtimeError.retryable).toBe(false)
  })

  it('preserves semantic planner parse errors for the user', () => {
    const runtimeError = buildRuntimeError({
      message: '规划器返回了非法 JSON：Expected double-quoted property name in JSON at position 12',
      cancelled: false,
      provider: 'openai',
      turnId: 'session-1:turn-3'
    })

    expect(runtimeError.code).toBe('INTERNAL')
    expect(runtimeError.stage).toBe('finalize')
    expect(runtimeError.userMessage).toBe(
      '规划器返回了非法 JSON：Expected double-quoted property name in JSON at position 12'
    )
  })

  it('maps first-byte timeout failures into structured runtime errors', () => {
    const modelError = buildModelRequestError({
      message: 'Model stream first byte timeout; provider=openai; model=gpt-4o-mini; requestUrl=https://api.openai.com/v1/chat/completions',
      failureKind: 'timeout_first_byte',
      metrics: buildFailedModelCallMetrics({
        model: {
          provider: 'openai',
          modelName: 'gpt-4o-mini'
        },
        latencyMs: 25,
        requestUrl: 'https://api.openai.com/v1/chat/completions'
      }),
      detail: 'request aborted',
      retryable: true
    })

    const runtimeError = buildRuntimeErrorFromUnknown({
      error: modelError,
      cancelled: false,
      provider: 'openai',
      turnId: 'session-1:turn-4'
    })

    expect(runtimeError.code).toBe('MODEL')
    expect(runtimeError.stage).toBe('model')
    expect(runtimeError.failureKind).toBe('timeout_first_byte')
    expect(runtimeError.requestUrl).toBe('https://api.openai.com/v1/chat/completions')
    expect(runtimeError.retryable).toBe(true)
    expect(runtimeError.userMessage).toBe('模型首包超时，请重试。')
  })

  it('maps idle timeout failures into structured runtime errors', () => {
    const modelError = buildModelRequestError({
      message: 'Model stream idle timeout; provider=openai; model=gpt-4o-mini; requestUrl=https://api.openai.com/v1/chat/completions',
      failureKind: 'timeout_idle',
      metrics: buildFailedModelCallMetrics({
        model: {
          provider: 'openai',
          modelName: 'gpt-4o-mini'
        },
        latencyMs: 25,
        requestUrl: 'https://api.openai.com/v1/chat/completions'
      }),
      detail: 'idle timeout; requestStage=response_stream',
      diagnostics: {
        requestStage: 'response_stream',
        responseStarted: true,
        latencyMs: 25,
        status: 200,
        streamStage: 'watchdog_idle',
        causeChain: [
          { depth: 0, name: 'Error', message: 'idle timeout' }
        ]
      },
      retryable: true
    })

    const runtimeError = buildRuntimeErrorFromUnknown({
      error: modelError,
      cancelled: false,
      runId: 'run-4b',
      provider: 'openai',
      turnId: 'session-1:turn-4b'
    })

    expect(runtimeError.failureKind).toBe('timeout_idle')
    expect(runtimeError.userMessage).toBe('模型流式响应空闲超时，请重试。')
    expect(runtimeError.runId).toBe('run-4b')
    expect(runtimeError.modelDiagnostics).toEqual({
      requestStage: 'response_stream',
      responseStarted: true,
      latencyMs: 25,
      status: 200,
      streamStage: 'watchdog_idle',
      causeChain: [
        { depth: 0, name: 'Error', message: 'idle timeout' }
      ]
    })
    expect(runtimeError.detail).toContain('requestStage=response_stream')
  })

  it('maps stream interruption failures into structured runtime errors', () => {
    const modelError = buildModelRequestError({
      message: 'Model stream interrupted before completion; provider=openai; model=gpt-4o-mini',
      failureKind: 'stream_interrupted',
      metrics: buildFailedModelCallMetrics({
        model: {
          provider: 'openai',
          modelName: 'gpt-4o-mini'
        },
        latencyMs: 25,
        requestUrl: 'https://api.openai.com/v1/chat/completions'
      }),
      detail: 'stream interrupted',
      retryable: true
    })

    const runtimeError = buildRuntimeErrorFromUnknown({
      error: modelError,
      cancelled: false,
      provider: 'openai',
      turnId: 'session-1:turn-4c'
    })

    expect(runtimeError.failureKind).toBe('stream_interrupted')
    expect(runtimeError.userMessage).toBe('模型流式响应中断，请重试。')
  })

  it('preserves terminal tool metadata separately from machine-facing payloads', () => {
    const toolError = new ToolInvocationError({
      toolCallId: 'tool-1',
      toolName: 'local:read_file',
      message: 'File not found: missing.txt',
      metadata: {
        errorType: 'EXECUTION_FAILED',
        normalizedCode: 'path_not_found',
        stopReason: 'no_progress_same_failure',
        chainKey: 'local:read_file:tool-0',
        attempt: 1,
        remainingRecoveryBudget: 0,
        runtimeRetryCount: 2,
        threshold: 1
      }
    })

    const runtimeError = buildRuntimeErrorFromUnknown({
      error: toolError,
      cancelled: false,
      provider: 'openai',
      turnId: 'session-1:turn-5',
      isToolError: true
    })

    expect(runtimeError.stage).toBe('tool')
    expect(runtimeError.toolCallId).toBe('tool-1')
    expect(runtimeError.toolName).toBe('local:read_file')
    expect(runtimeError.normalizedCode).toBe('path_not_found')
    expect(runtimeError.stopReason).toBe('no_progress_same_failure')
    expect(runtimeError.chainKey).toBe('local:read_file:tool-0')
    expect(runtimeError.attempt).toBe(1)
    expect(runtimeError.remainingRecoveryBudget).toBe(0)
    expect(runtimeError.runtimeRetryCount).toBe(2)
    expect(runtimeError.threshold).toBe(1)
    expect(runtimeError.userMessage).toBe('工具 local:read_file 连续失败且没有进展，当前运行已停止。')
  })
})
