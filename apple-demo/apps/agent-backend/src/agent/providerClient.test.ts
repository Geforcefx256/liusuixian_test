import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProviderClient } from './providerClient.js'
import { ModelRequestError } from './modelRequestError.js'
import type { AgentModelConfig } from './types.js'
import type { AgentSessionMessage } from './loopTypes.js'
import {
  attachRuntimeLogSink,
  resetRuntimeLoggingForTests,
  type RuntimeLogEntry,
  type RuntimeLogSink
} from '../logging/index.js'

const model: AgentModelConfig = {
  provider: 'openai',
  modelName: 'gpt-4o-mini',
  apiKey: 'test-key'
}

function createMessages(): AgentSessionMessage[] {
  return [{
    role: 'user',
    createdAt: 1,
    parts: [{ type: 'text', text: 'Read notes.txt' }]
  }]
}

function createSseResponse(events: unknown[]): Response {
  const payload = events.map(event => `data: ${typeof event === 'string' ? event : JSON.stringify(event)}\n\n`).join('')
  return {
    ok: true,
    status: 200,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(payload))
        controller.close()
      }
    })
  } as Response
}

function createJsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload
  } as Response
}

function createDelayedSseResponse(chunks: Array<{ afterMs: number; event: unknown }>): Response {
  return {
    ok: true,
    status: 200,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          setTimeout(() => {
            controller.enqueue(new TextEncoder().encode(
              `data: ${typeof chunk.event === 'string' ? chunk.event : JSON.stringify(chunk.event)}\n\n`
            ))
          }, chunk.afterMs)
        }
        const lastDelay = chunks.at(-1)?.afterMs ?? 0
        setTimeout(() => controller.close(), lastDelay + 5)
      }
    })
  } as Response
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

function parseTimingLog(entries: RuntimeLogEntry[]): Record<string, unknown> {
  const entry = entries.find(item => (
    item.component === 'provider_client'
    && item.level === 'error'
    && (item.message === 'model request transport failure' || item.message === 'model request response failure')
  ))
  expect(entry?.data).toBeTruthy()
  return entry?.data ?? {}
}

describe('ProviderClient.completeWithTools', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    resetRuntimeLoggingForTests()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    resetRuntimeLoggingForTests()
    global.fetch = originalFetch
    vi.useRealTimers()
  })

  it('assembles text responses from upstream stream chunks', async () => {
    global.fetch = vi.fn(async () => createSseResponse([
      { choices: [{ delta: { content: 'Need to ' } }] },
      { choices: [{ delta: { content: 'inspect the file first.' } }] },
      {
        choices: [{ finish_reason: 'stop' }],
        usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 }
      },
      '[DONE]'
    ])) as unknown as typeof fetch

    const client = new ProviderClient()
    const response = await client.completeWithTools({
      systemPrompt: 'system',
      messages: createMessages(),
      tools: [],
      model,
      signal: new AbortController().signal,
      trace: { runId: 'run-1', turnId: 'turn-1' }
    })

    expect(response.text).toBe('Need to inspect the file first.')
    expect(response.toolCalls).toEqual([])
    expect(response.metrics.finishReason).toBe('stop')
    expect(response.metrics.totalTokens).toBe(20)
  })

  it('assembles tool call deltas and restores internal tool names', async () => {
    global.fetch = vi.fn(async (_input, init) => {
      const requestBody = JSON.parse(String(init?.body)) as {
        stream?: boolean
        stream_options?: { include_usage?: boolean }
        tools?: Array<{ function?: { name?: string } }>
      }
      expect(requestBody.stream).toBe(true)
      expect(requestBody.stream_options?.include_usage).toBe(true)
      expect(requestBody.tools?.[0]?.function?.name).toBe('local_read_file')

      return createSseResponse([
        {
          choices: [{
            delta: {
              content: 'Need to inspect.',
              tool_calls: [{
                index: 0,
                id: 'call-1',
                function: { name: 'local_read_file', arguments: '{"path":"' }
              }]
            }
          }]
        },
        {
          choices: [{
            delta: {
              tool_calls: [{
                index: 0,
                function: { arguments: 'notes.txt"}' }
              }]
            }
          }]
        },
        {
          choices: [{ finish_reason: 'tool_calls' }],
          usage: { prompt_tokens: 14, completion_tokens: 6, total_tokens: 20 }
        },
        '[DONE]'
      ])
    }) as unknown as typeof fetch

    const client = new ProviderClient()
    const response = await client.completeWithTools({
      systemPrompt: 'system',
      messages: createMessages(),
      tools: [{
        id: 'local:read_file',
        name: 'local:read_file',
        description: 'Read a file',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: { path: { type: 'string' } },
          required: ['path']
        }
      }],
      model: {
        ...model,
        provider: 'deepseek',
        modelName: 'deepseek-chat'
      },
      signal: new AbortController().signal,
      trace: { runId: 'run-2', turnId: 'turn-2' }
    })

    expect(response.text).toBe('Need to inspect.')
    expect(response.toolCalls).toEqual([{
      id: 'call-1',
      name: 'local:read_file',
      input: { path: 'notes.txt' }
    }])
    expect(response.metrics.finishReason).toBe('tool_calls')
  })

  it('uses non-stream JSON completions when the resolved model disables streaming', async () => {
    global.fetch = vi.fn(async (_input, init) => {
      const requestBody = JSON.parse(String(init?.body)) as {
        stream?: boolean
        stream_options?: { include_usage?: boolean }
      }
      expect(requestBody.stream).toBe(false)
      expect(requestBody.stream_options).toBeUndefined()

      return createJsonResponse({
        choices: [{
          finish_reason: 'tool_calls',
          message: {
            content: 'Need to inspect.',
            tool_calls: [{
              id: 'call-1',
              function: {
                name: 'local_read_file',
                arguments: '{"path":"notes.txt"}'
              }
            }]
          }
        }],
        usage: { prompt_tokens: 14, completion_tokens: 6, total_tokens: 20 }
      })
    }) as unknown as typeof fetch

    const client = new ProviderClient()
    const response = await client.completeWithTools({
      systemPrompt: 'system',
      messages: createMessages(),
      tools: [{
        id: 'local:read_file',
        name: 'local:read_file',
        description: 'Read a file',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: { path: { type: 'string' } },
          required: ['path']
        }
      }],
      model: {
        ...model,
        provider: 'deepseek',
        modelName: 'deepseek-chat',
        stream: false
      },
      signal: new AbortController().signal,
      trace: { runId: 'run-2b', turnId: 'turn-2b' }
    })

    expect(response.text).toBe('Need to inspect.')
    expect(response.toolCalls).toEqual([{
      id: 'call-1',
      name: 'local:read_file',
      input: { path: 'notes.txt' }
    }])
    expect(response.metrics.finishReason).toBe('tool_calls')
    expect(response.metrics.totalTokens).toBe(20)
  })

  it('uses ark coding chat completions path for volcengine coding endpoints', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toBe('https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions')
      return createSseResponse([
        { choices: [{ delta: { content: 'Done.' } }] },
        { choices: [{ finish_reason: 'stop' }], usage: { prompt_tokens: 6, completion_tokens: 2, total_tokens: 8 } },
        '[DONE]'
      ])
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const client = new ProviderClient()
    const response = await client.completeWithTools({
      systemPrompt: 'system',
      messages: createMessages(),
      tools: [],
      model: {
        provider: 'openai',
        modelName: 'ark-code-latest',
        apiKey: 'test-key',
        apiEndpoint: 'https://ark.cn-beijing.volces.com/api/coding/v3'
      },
      signal: new AbortController().signal,
      trace: { runId: 'run-3', turnId: 'turn-3' }
    })

    expect(response.text).toBe('Done.')
  })

  it('throws when the stream finishes without usage payload', async () => {
    global.fetch = vi.fn(async () => createSseResponse([
      { choices: [{ delta: { content: 'Done.' } }] },
      { choices: [{ finish_reason: 'stop' }] },
      '[DONE]'
    ])) as unknown as typeof fetch

    const client = new ProviderClient()
    await expect(client.completeWithTools({
      systemPrompt: 'system',
      messages: createMessages(),
      tools: [],
      model,
      signal: new AbortController().signal,
      trace: { runId: 'run-4', turnId: 'turn-4' }
    })).rejects.toMatchObject({
      failureKind: 'protocol',
      retryable: false
    } satisfies Partial<ModelRequestError>)
  })

  it('throws when a non-stream response omits usage payload', async () => {
    global.fetch = vi.fn(async () => createJsonResponse({
      choices: [{
        finish_reason: 'stop',
        message: {
          content: 'Done.'
        }
      }]
    })) as unknown as typeof fetch

    const client = new ProviderClient()
    await expect(client.completeWithTools({
      systemPrompt: 'system',
      messages: createMessages(),
      tools: [],
      model: {
        ...model,
        stream: false
      },
      signal: new AbortController().signal,
      trace: { runId: 'run-4b', turnId: 'turn-4b' }
    })).rejects.toMatchObject({
      failureKind: 'protocol',
      retryable: false
    } satisfies Partial<ModelRequestError>)
  })

  it('throws when the provider truncates text with finish_reason length', async () => {
    global.fetch = vi.fn(async () => createSseResponse([
      { choices: [{ delta: { content: '{"version":"1.0","components":[' } }] },
      { choices: [{ finish_reason: 'length' }] },
      '[DONE]'
    ])) as unknown as typeof fetch

    const client = new ProviderClient()
    await expect(client.completeWithTools({
      systemPrompt: 'system',
      messages: createMessages(),
      tools: [],
      model,
      signal: new AbortController().signal,
      trace: { runId: 'run-5', turnId: 'turn-5' }
    })).rejects.toThrow(/finish_reason=length/)
  })

  it('wraps transport failures as retryable model request errors', async () => {
    const logs = captureRuntimeLogs()
    const socketError = Object.assign(new Error('socket hang up'), {
      code: 'ECONNRESET',
      errno: 'ECONNRESET',
      syscall: 'read',
      address: '10.0.0.8',
      port: 443
    })
    global.fetch = vi.fn(async () => {
      throw new TypeError('fetch failed', { cause: socketError })
    }) as unknown as typeof fetch

    const client = new ProviderClient()
    await expect(client.completeWithTools({
      systemPrompt: 'system',
      messages: createMessages(),
      tools: [],
      model,
      signal: new AbortController().signal,
      trace: { runId: 'run-6', turnId: 'turn-6' }
    })).rejects.toMatchObject({
      failureKind: 'transport',
      retryable: true,
      diagnostics: expect.objectContaining({
        requestStage: 'request_pre_response',
        responseStarted: false
      })
    } satisfies Partial<ModelRequestError>)
    const payload = parseTimingLog(logs)
    expect(payload.requestStage).toBe('request_pre_response')
    expect(payload.responseStarted).toBe(false)
    expect(payload.causeChain).toEqual([
      expect.objectContaining({ depth: 0, name: 'TypeError', message: 'fetch failed' }),
      expect.objectContaining({
        depth: 1,
        message: 'socket hang up',
        code: 'ECONNRESET',
        address: '10.0.0.8',
        port: 443
      })
    ])
  })

  it('fails with first-byte timeout when no valid chunk arrives in time', async () => {
    vi.useFakeTimers()
    global.fetch = vi.fn(async () => createDelayedSseResponse([
      { afterMs: 50, event: { choices: [{ delta: { content: 'late' } }] } }
    ])) as unknown as typeof fetch

    const client = new ProviderClient()
    const pending = client.completeWithTools({
      systemPrompt: 'system',
      messages: createMessages(),
      tools: [],
      model: {
        ...model,
        streamFirstByteTimeoutMs: 25,
        streamIdleTimeoutMs: 100
      },
      signal: new AbortController().signal,
      trace: { runId: 'run-7', turnId: 'turn-7' }
    })
    const expectation = expect(pending).rejects.toMatchObject({
      failureKind: 'timeout_first_byte',
      retryable: true
    } satisfies Partial<ModelRequestError>)

    await vi.advanceTimersByTimeAsync(30)
    await expectation
  })

  it('fails with idle timeout when the stream stalls without progress', async () => {
    vi.useFakeTimers()
    const logs = captureRuntimeLogs()
    global.fetch = vi.fn(async () => createDelayedSseResponse([
      { afterMs: 5, event: { choices: [{ delta: { content: 'hello' } }] } },
      { afterMs: 80, event: { choices: [{ finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } } }
    ])) as unknown as typeof fetch

    const client = new ProviderClient()
    const pending = client.completeWithTools({
      systemPrompt: 'system',
      messages: createMessages(),
      tools: [],
      model: {
        ...model,
        streamFirstByteTimeoutMs: 25,
        streamIdleTimeoutMs: 30
      },
      signal: new AbortController().signal,
      trace: { runId: 'run-8', turnId: 'turn-8' }
    })
    const expectation = expect(pending).rejects.toMatchObject({
      failureKind: 'timeout_idle',
      retryable: true,
      diagnostics: expect.objectContaining({
        requestStage: 'response_stream',
        responseStarted: true,
        status: 200,
        streamStage: 'watchdog_idle'
      })
    } satisfies Partial<ModelRequestError>)

    await vi.advanceTimersByTimeAsync(40)
    await expectation
    const payload = parseTimingLog(logs)
    expect(payload.requestStage).toBe('response_stream')
    expect(payload.responseStarted).toBe(true)
    expect(payload.status).toBe(200)
    expect(payload.streamStage).toBe('watchdog_idle')
    expect(payload.failureKind).toBe('timeout_idle')
  })

  it('uses custom headers without authorization when present', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.headers).toEqual({
        'Content-Type': 'application/json',
        'X-Token': 'test-token',
        HWID: 'device-1'
      })
      return createSseResponse([
        { choices: [{ delta: { content: 'Done.' } }] },
        { choices: [{ finish_reason: 'stop' }], usage: { prompt_tokens: 6, completion_tokens: 2, total_tokens: 8 } },
        '[DONE]'
      ])
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const client = new ProviderClient()
    const response = await client.completeWithTools({
      systemPrompt: 'system',
      messages: createMessages(),
      tools: [],
      model: {
        provider: 'huaweiHisApi',
        modelName: 'deepseek-chat',
        custom: {
          headers: {
            'X-Token': 'test-token',
            HWID: 'device-1'
          }
        }
      },
      signal: new AbortController().signal,
      trace: { runId: 'run-9', turnId: 'turn-9' }
    })

    expect(response.text).toBe('Done.')
  })

  it('merges custom body parameters into the streaming request payload', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        stream?: boolean
        stream_options?: { include_usage?: boolean; foo?: string }
        chat_template_kwargs?: { enable_thinking?: boolean }
      }
      expect(body.chat_template_kwargs).toEqual({ enable_thinking: false })
      expect(body.stream).toBe(true)
      expect(body.stream_options).toEqual({
        foo: 'bar',
        include_usage: true
      })
      return createSseResponse([
        { choices: [{ delta: { content: 'Done.' } }] },
        { choices: [{ finish_reason: 'stop' }], usage: { prompt_tokens: 6, completion_tokens: 2, total_tokens: 8 } },
        '[DONE]'
      ])
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const client = new ProviderClient()
    await client.completeWithTools({
      systemPrompt: 'system',
      messages: createMessages(),
      tools: [],
      model: {
        ...model,
        custom: {
          body: {
            chat_template_kwargs: {
              enable_thinking: false
            },
            stream_options: {
              foo: 'bar'
            }
          }
        }
      },
      signal: new AbortController().signal,
      trace: { runId: 'run-10', turnId: 'turn-10' }
    })

    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
