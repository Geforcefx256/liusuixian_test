import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { AgentLoop } from './agentLoop.js'
import { buildAwaitingInteractionToolSummary } from './interactions.js'
import { SQLiteAgentSessionStore } from './sessionStore.js'
import type { AgentSessionMessage } from './loopTypes.js'
import { createProvider } from './agentLoopTestUtils.js'
import {
  attachRuntimeLogSink,
  resetRuntimeLoggingForTests,
  type RuntimeLogEntry,
  type RuntimeLogSink
} from '../logging/index.js'

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

describe('AgentLoop', () => {
  let tempDir = ''
  let stores: SQLiteAgentSessionStore[] = []
  const USER_ID = 1
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'agent-loop-'))
    stores = []
    resetRuntimeLoggingForTests()
  })
  afterEach(async () => {
    resetRuntimeLoggingForTests()
    for (const store of stores) {
      store.close()
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
    }
  })
  it('executes a tool loop and persists tool history', async () => {
    const store = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'session.db') })
    stores.push(store)
    const invoke = vi.fn(async () => ({
      ok: true as const,
      requestId: 'req-1',
      result: {
        tool: 'local:read_file',
        summary: '{"success":true,"content":"1 | alpha"}',
        operations: [],
        meta: {
          server: 'local',
          tool: 'read_file',
          latencyMs: 2,
          inputChars: 10,
          operationsChars: 0,
          summaryChars: 30
        }
      }
    }))
    const catalog = vi.fn(() => ({
      ok: true as const,
      tools: [{
        id: 'local:read_file',
        server: 'local',
        name: 'read_file',
        description: 'Read a file'
      }]
    }))
    const loop = new AgentLoop({
      providerClient: createProvider([
        {
          text: 'Need to inspect the file first.',
          toolCalls: [{
            id: 'tool-1',
            name: 'local:read_file',
            input: { path: 'notes.txt' }
          }]
        },
        {
          text: 'The file starts with alpha.'
        }
      ]),
      sessionStore: store,
      toolRegistry: { invoke, catalog }
    })
    const result = await loop.run({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-1',
      systemPrompt: 'system',
      userInput: 'summarize notes.txt',
      model: {
        provider: 'openai',
        modelName: 'gpt-test',
        apiKey: 'key'
      },
      loop: {
        maxSteps: 20
      },
      signal: new AbortController().signal,
      trace: {
        runId: 'run-1',
        turnId: 'turn-1'
      }
    })

    expect(result.text).toBe('The file starts with alpha.')
    expect(result.toolMetrics).toHaveLength(1)
    const expectedModelCalls = 2
    const expectedModelLatencyMs = 10
    expect(result.modelMetricsAggregate.calls).toBe(expectedModelCalls)
    expect(result.modelMetricsAggregate.latencyMs).toBe(expectedModelLatencyMs)
    expect(invoke).toHaveBeenCalledWith(expect.objectContaining({
      tool: 'local:read_file',
      args: { path: 'notes.txt' }
    }))

    const messages = await store.listMessages({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-1'
    })
    expect(messages).toHaveLength(3)
    expect(messages[1]?.parts.find(part => part.type === 'tool')).toMatchObject({
      type: 'tool',
      id: 'tool-1',
      status: 'success'
    })
  })

  it('marks intermediate assistant messages with resolved tool display names', async () => {
    const store = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'session-intermediate.db') })
    stores.push(store)
    const loop = new AgentLoop({
      providerClient: createProvider([
        {
          text: '先读取文件并加载技能。',
          toolCalls: [
            {
              id: 'tool-1',
              name: 'local:read_file',
              input: { path: 'notes.txt' }
            },
            {
              id: 'tool-2',
              name: 'skill:skill',
              input: { name: 'mml-cli' }
            }
          ]
        },
        {
          text: '已完成检查。'
        }
      ]),
      sessionStore: store,
      toolRegistry: {
        catalog: () => ({
          ok: true,
          tools: [
            { id: 'local:read_file', server: 'local', name: 'read_file', description: 'Read a file' },
            { id: 'skill:skill', server: 'skill', name: 'skill', description: 'Load a skill' }
          ]
        }),
        invoke: vi.fn(async request => ({
          ok: true as const,
          requestId: `req-${request.tool}`,
          result: {
            tool: request.tool,
            summary: '{"success":true}',
            operations: [],
            meta: {
              server: request.tool.startsWith('skill:') ? 'skill' : 'local',
              tool: request.tool.split(':')[1] || request.tool,
              latencyMs: 1,
              inputChars: 10,
              operationsChars: 0,
              summaryChars: 16
            }
          }
        }))
      }
    }, {
      displayNameResolver: ({ tool, skillName }) => {
        if (tool === 'local:read_file') return '读取工作区文件'
        if (tool === 'skill:skill') return `技能: ${skillName}`
        return tool
      }
    })

    await loop.run({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-intermediate',
      systemPrompt: 'system',
      userInput: '检查 notes.txt',
      model: { provider: 'openai', modelName: 'gpt-test', apiKey: 'key' },
      loop: { maxSteps: 20 },
      signal: new AbortController().signal,
      trace: { runId: 'run-intermediate', turnId: 'turn-1' }
    })

    const messages = await store.listMessages({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-intermediate'
    })

    expect(messages[1]?.attributes).toEqual({
      visibility: 'internal',
      semantic: 'intermediate',
      toolDisplayNames: ['读取工作区文件', '技能: mml-cli']
    })
  })

  it('restores previous session messages on the next request', async () => {
    const store = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'session.db') })
    stores.push(store)
    const seenMessages: AgentSessionMessage[][] = []
    const loop = new AgentLoop({
      providerClient: {
        async completeWithTools(request) {
          seenMessages.push(request.messages)
          return {
            text: `reply-${seenMessages.length}`,
            toolCalls: [],
            metrics: {
              provider: request.model.provider,
              modelName: request.model.modelName,
              latencyMs: 5,
              inputTokens: 10,
              outputTokens: 8,
              totalTokens: 18,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              finishReason: 'stop'
            }
          }
        }
      },
      sessionStore: store,
      toolRegistry: {
        catalog: () => ({ ok: true, tools: [] }),
        invoke: vi.fn()
      }
    })

    await loop.run({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-2',
      systemPrompt: 'system',
      userInput: 'first question',
      model: { provider: 'openai', modelName: 'gpt-test', apiKey: 'key' },
      loop: { maxSteps: 20 },
      signal: new AbortController().signal,
      trace: { runId: 'run-1', turnId: 'turn-1' }
    })
    await loop.run({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-2',
      systemPrompt: 'system',
      userInput: 'second question',
      model: { provider: 'openai', modelName: 'gpt-test', apiKey: 'key' },
      loop: { maxSteps: 20 },
      signal: new AbortController().signal,
      trace: { runId: 'run-2', turnId: 'turn-1' }
    })

    expect(seenMessages).toHaveLength(2)
    expect(seenMessages[1]?.map(message => message.role)).toEqual([
      'user',
      'assistant',
      'user'
    ])
  })

  it('persists hidden skill-context messages after visible tool traces and reuses them on later turns', async () => {
    const store = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'skill-context.db') })
    stores.push(store)
    const seenMessages: AgentSessionMessage[][] = []
    const loop = new AgentLoop({
      providerClient: {
        async completeWithTools(request) {
          seenMessages.push(request.messages)
          if (seenMessages.length === 1) {
            return {
              text: '先加载技能',
              toolCalls: [{
                id: 'tool-skill-1',
                name: 'skill:skill',
                input: { name: 'skill-a' }
              }],
              metrics: {
                provider: request.model.provider,
                modelName: request.model.modelName,
                latencyMs: 5,
                inputTokens: 10,
                outputTokens: 8,
                totalTokens: 18,
                cacheReadTokens: 0,
                cacheWriteTokens: 0,
                finishReason: 'stop'
              }
            }
          }
          return {
            text: '技能上下文已恢复',
            toolCalls: [],
            metrics: {
              provider: request.model.provider,
              modelName: request.model.modelName,
              latencyMs: 5,
              inputTokens: 10,
              outputTokens: 8,
              totalTokens: 18,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              finishReason: 'stop'
            }
          }
        }
      },
      sessionStore: store,
      toolRegistry: {
        catalog: () => ({
          ok: true,
          tools: [{
            id: 'skill:skill',
            server: 'skill',
            name: 'skill',
            description: 'Load skill'
          }]
        }),
        invoke: vi.fn(async () => ({
          ok: true as const,
          requestId: 'req-skill',
          result: {
            tool: 'skill:skill',
            summary: 'Loaded skill "skill-a".',
            operations: [],
            meta: {
              server: 'skill',
              tool: 'skill',
              latencyMs: 1,
              inputChars: 10,
              operationsChars: 0,
              summaryChars: 24
            },
            sideEffects: {
              injectedMessages: [{
                role: 'assistant',
                visibility: 'hidden',
                semantic: 'skill-context',
                skillName: 'skill-a',
                text: '<skill_content name="skill-a">\nbody-a\n</skill_content>'
              }]
            }
          }
        }))
      }
    })

    await loop.run({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-skill',
      systemPrompt: 'system',
      userInput: 'load skill',
      model: { provider: 'openai', modelName: 'gpt-test', apiKey: 'key' },
      loop: { maxSteps: 20 },
      signal: new AbortController().signal,
      trace: { runId: 'run-skill-1', turnId: 'turn-1' }
    })
    await loop.run({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-skill',
      systemPrompt: 'system',
      userInput: 'continue',
      model: { provider: 'openai', modelName: 'gpt-test', apiKey: 'key' },
      loop: { maxSteps: 20 },
      signal: new AbortController().signal,
      trace: { runId: 'run-skill-2', turnId: 'turn-1' }
    })

    const storedMessages = await store.listMessages({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-skill'
    })

    expect(storedMessages.map(message => message.attributes?.semantic ?? 'visible')).toContain('skill-context')
    expect(storedMessages[2]?.attributes).toEqual({
      visibility: 'hidden',
      semantic: 'skill-context',
      skillName: 'skill-a'
    })
    expect(seenMessages[1]?.some(message => message.attributes?.semantic === 'skill-context')).toBe(true)
  })

  it('does not persist hidden skill-context messages when skill loading fails', async () => {
    const store = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'skill-context-failed.db') })
    stores.push(store)
    let calls = 0
    const loop = new AgentLoop({
      providerClient: {
        async completeWithTools() {
          calls += 1
          if (calls === 1) {
            return {
              text: '先尝试加载技能。',
              toolCalls: [{
                id: 'tool-skill-fail',
                name: 'skill:skill',
                input: { name: 'missing-skill' }
              }],
              metrics: {
                provider: 'openai',
                modelName: 'gpt-test',
                latencyMs: 5,
                inputTokens: 10,
                outputTokens: 8,
                totalTokens: 18,
                cacheReadTokens: 0,
                cacheWriteTokens: 0,
                finishReason: 'stop'
              }
            }
          }
          return {
            text: '技能不存在，继续处理。',
            toolCalls: [],
            metrics: {
              provider: 'openai',
              modelName: 'gpt-test',
              latencyMs: 5,
              inputTokens: 10,
              outputTokens: 8,
              totalTokens: 18,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              finishReason: 'stop'
            }
          }
        }
      },
      sessionStore: store,
      toolRegistry: {
        catalog: () => ({
          ok: true,
          tools: [{
            id: 'skill:skill',
            server: 'skill',
            name: 'skill',
            description: 'Load skill'
          }]
        }),
        invoke: vi.fn(async () => ({
          ok: false as const,
          requestId: 'req-skill-fail',
          error: {
            type: 'TOOL_NOT_FOUND',
            message: 'E_SKILL_NOT_FOUND: missing-skill'
          }
        }))
      }
    })

    await loop.run({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-skill-fail',
      systemPrompt: 'system',
      userInput: 'load missing skill',
      model: { provider: 'openai', modelName: 'gpt-test', apiKey: 'key' },
      loop: { maxSteps: 20 },
      signal: new AbortController().signal,
      trace: { runId: 'run-skill-fail', turnId: 'turn-1' }
    })

    const storedMessages = await store.listMessages({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-skill-fail'
    })

    expect(storedMessages.some(message => message.attributes?.semantic === 'skill-context')).toBe(false)
  })

  it('uses the messageProvider when supplied', async () => {
    const store = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'session-provider.db') })
    stores.push(store)
    const seenMessages: AgentSessionMessage[][] = []
    const loop = new AgentLoop({
      providerClient: {
        async completeWithTools(request) {
          seenMessages.push(request.messages)
          return {
            text: 'ok',
            toolCalls: [],
            metrics: {
              provider: request.model.provider,
              modelName: request.model.modelName,
              latencyMs: 5,
              inputTokens: 10,
              outputTokens: 8,
              totalTokens: 18,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              finishReason: 'stop'
            }
          }
        }
      },
      sessionStore: store,
      toolRegistry: {
        catalog: () => ({ ok: true, tools: [] }),
        invoke: vi.fn()
      }
    })

    await loop.run({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-provider',
      systemPrompt: 'system',
      userInput: 'first message',
      model: { provider: 'openai', modelName: 'gpt-test', apiKey: 'key' },
      loop: { maxSteps: 1 },
      signal: new AbortController().signal,
      trace: { runId: 'run-3', turnId: 'turn-1' },
      messageProvider: async (params) => params.messages.slice(-1)
    })

    expect(seenMessages).toHaveLength(1)
    expect(seenMessages[0]).toHaveLength(1)
    expect(seenMessages[0]?.[0]?.role).toBe('user')
  })

  it('fails when the provider keeps requesting tools beyond max steps', async () => {
    const store = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'step-limit.db') })
    stores.push(store)
    const maxSteps = 20
    const providerCalls: number[] = []
    const loop = new AgentLoop({
      providerClient: {
        async completeWithTools(request) {
          providerCalls.push(request.messages.length)
          return {
            text: 'Keep using the tool.',
            toolCalls: [{
              id: `tool-${providerCalls.length}`,
              name: 'local:read_file',
              input: { path: 'notes.txt' }
            }],
            metrics: {
              provider: request.model.provider,
              modelName: request.model.modelName,
              latencyMs: 5,
              inputTokens: 10,
              outputTokens: 8,
              totalTokens: 18,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              finishReason: 'tool_calls'
            }
          }
        }
      },
      sessionStore: store,
      toolRegistry: {
        catalog: () => ({
          ok: true,
          tools: [{
            id: 'local:read_file',
            server: 'local',
            name: 'read_file',
            description: 'Read a file'
          }]
        }),
        invoke: vi.fn(async () => ({
          ok: true as const,
          requestId: 'req-loop-limit',
          result: {
            tool: 'local:read_file',
            summary: '{"success":true,"content":"alpha"}',
            operations: [],
            meta: {
              server: 'local',
              tool: 'read_file',
              latencyMs: 2,
              inputChars: 10,
              operationsChars: 0,
              summaryChars: 30
            }
          }
        }))
      }
    })

    await expect(loop.run({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-limit',
      systemPrompt: 'system',
      userInput: 'loop forever',
      model: { provider: 'openai', modelName: 'gpt-test', apiKey: 'key' },
      loop: { maxSteps },
      signal: new AbortController().signal,
      trace: { runId: 'run-limit', turnId: 'turn-1' }
    })).rejects.toThrow(`Agent loop exceeded max steps: ${maxSteps}.`)

    expect(providerCalls).toHaveLength(maxSteps)
    const messages = await store.listMessages({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-limit'
    })
    expect(messages).toHaveLength(maxSteps + 1)
  })

  it('recovers from invalid local:question payloads and lets the model retry', async () => {
    const store = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'question-retry.db') })
    stores.push(store)
    const interaction = {
      interactionId: 'interaction-question-1',
      runId: 'run-question-retry',
      kind: 'question' as const,
      status: 'pending' as const,
      payload: {
        questionId: 'question-1',
        title: '补充信息',
        prompt: '请输入要抽取的列索引（从 1 开始）',
        required: true,
        fields: [{
          id: 'columnIndex',
          label: '列索引',
          type: 'text' as const,
          placeholder: '例如 1'
        }]
      },
      createdAt: 123,
      resolvedAt: null
    }
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false as const,
        requestId: 'req-question-invalid',
        error: {
          type: 'VALIDATION_ERROR' as const,
          message: 'Question tool options must include at least 2 items.',
          field: 'options',
          expected: 'at least 2 options',
          actual: 'fewer than 2 options',
          fix: 'Add more options.'
        }
      })
      .mockResolvedValueOnce({
        ok: true as const,
        requestId: 'req-question-valid',
        result: {
          tool: 'local:question',
          summary: buildAwaitingInteractionToolSummary(interaction),
          operations: [],
          meta: {
            server: 'local',
            tool: 'question',
            latencyMs: 1,
            inputChars: 10,
            operationsChars: 0,
            summaryChars: 120
          }
        }
      })
    const catalog = vi.fn(() => ({
      ok: true as const,
      tools: [{
        id: 'local:question',
        server: 'local',
        name: 'question',
        description: 'Ask a question'
      }]
    }))
    const providerCalls: AgentSessionMessage[][] = []
    const loop = new AgentLoop({
      providerClient: {
        async completeWithTools(request) {
          providerCalls.push(request.messages)
          if (providerCalls.length === 1) {
            return {
              text: 'Need clarification.',
              toolCalls: [{
                id: 'tool-question-invalid',
                name: 'local:question',
                input: {
                  prompt: '请选择列',
                  options: Array.from({ length: 5 }, (_, idx) => ({
                    label: `第${idx + 1}列`,
                    value: String(idx + 1)
                  }))
                }
              }],
              metrics: {
                provider: request.model.provider,
                modelName: request.model.modelName,
                latencyMs: 5,
                inputTokens: 10,
                outputTokens: 8,
                totalTokens: 18,
                cacheReadTokens: 0,
                cacheWriteTokens: 0,
                finishReason: 'tool_calls'
              }
            }
          }

          const lastToolResult = request.messages.at(-1)?.parts.find(part => part.type === 'tool')
          expect(lastToolResult).toMatchObject({
            type: 'tool',
            id: 'tool-question-invalid',
            status: 'error'
          })
          const payload = JSON.parse((lastToolResult as { output: string }).output) as {
            success: boolean
            code: string
            recoverable: boolean
            retryHint: string
            field?: string
            expected?: string
            actual?: string
            fix?: string
          }
          expect(payload.success).toBe(false)
          expect(payload.code).toBe('question_validation_error')
          expect(payload.recoverable).toBe(true)
          expect(payload.retryHint).toBe('correct_input')
          expect(payload.field).toBe('options')
          expect(payload.expected).toBe('at least 2 options')
          expect(payload.actual).toBe('fewer than 2 options')
          expect(payload.fix).toBe('Add more options.')
          expect(payload).not.toHaveProperty('errorType')
          expect(payload).not.toHaveProperty('toolCallId')
          expect(payload).not.toHaveProperty('toolName')
          expect(payload).not.toHaveProperty('attempt')
          expect(payload).not.toHaveProperty('chainKey')
          expect(payload).not.toHaveProperty('remainingRecoveryBudget')
          expect(payload).not.toHaveProperty('stopReason')

          return {
            text: 'Retry with text input.',
            toolCalls: [{
              id: 'tool-question-valid',
              name: 'local:question',
              input: {
                prompt: '请输入要抽取的列索引（从 1 开始）',
                fields: [{
                  id: 'columnIndex',
                  label: '列索引',
                  type: 'text',
                  placeholder: '例如 1'
                }]
              }
            }],
            metrics: {
              provider: request.model.provider,
              modelName: request.model.modelName,
              latencyMs: 5,
              inputTokens: 10,
              outputTokens: 8,
              totalTokens: 18,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              finishReason: 'tool_calls'
            }
          }
        }
      },
      sessionStore: store,
      toolRegistry: { invoke, catalog }
    })

    const result = await loop.run({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-question-retry',
      systemPrompt: 'system',
      userInput: '帮我抽取列',
      model: { provider: 'openai', modelName: 'gpt-test', apiKey: 'key' },
      loop: { maxSteps: 20 },
      signal: new AbortController().signal,
      trace: { runId: 'run-question-retry', turnId: 'turn-1' }
    })

    expect(providerCalls).toHaveLength(2)
    expect(result.toolMetrics).toEqual([
      expect.objectContaining({
        tool: 'local:question',
        success: false,
        toolCallId: 'tool-question-invalid'
      }),
      expect.objectContaining({
        tool: 'local:question',
        success: true,
        toolCallId: 'tool-question-valid'
      })
    ])
    expect(result.text).toContain('输入')
    expect(result.awaitingInteraction).toMatchObject(interaction)
    expect(result.structuredOutput).toBeUndefined()
    const messages = await store.listMessages({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-question-retry'
    })
    expect(messages).toHaveLength(3)
    expect(messages[2]?.parts).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'tool', id: 'tool-question-valid', status: 'success' }),
      expect.objectContaining({ type: 'text', text: '请输入要抽取的列索引（从 1 开始），填写后我会继续。' })
    ]))
  })

  it('retries eligible idempotent tools inside one invocation before surfacing failure', async () => {
    const store = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'runtime-retry.db') })
    stores.push(store)
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false as const,
        requestId: 'req-timeout',
        error: {
          type: 'EXECUTION_TIMEOUT' as const,
          message: 'temporary timeout'
        }
      })
      .mockResolvedValueOnce({
        ok: true as const,
        requestId: 'req-success',
        result: {
          tool: 'local:read_file',
          summary: '{"success":true,"content":"1 | retried"}',
          operations: [],
          meta: {
            server: 'local',
            tool: 'read_file',
            latencyMs: 1,
            inputChars: 10,
            operationsChars: 0,
            summaryChars: 40
          }
        }
      })
    const providerCalls: AgentSessionMessage[][] = []
    const logs = captureRuntimeLogs()
    const loop = new AgentLoop({
      providerClient: {
        async completeWithTools(request) {
          providerCalls.push(request.messages)
          if (providerCalls.length === 1) {
            return {
              text: 'Read the file first.',
              toolCalls: [{
                id: 'tool-retry-1',
                name: 'local:read_file',
                input: { path: 'notes.txt' }
              }],
              metrics: {
                provider: request.model.provider,
                modelName: request.model.modelName,
                latencyMs: 5,
                inputTokens: 10,
                outputTokens: 8,
                totalTokens: 18,
                cacheReadTokens: 0,
                cacheWriteTokens: 0,
                finishReason: 'tool_calls'
              }
            }
          }
          const lastToolPart = request.messages.at(-1)?.parts.find(part => part.type === 'tool')
          expect(lastToolPart).toMatchObject({
            type: 'tool',
            id: 'tool-retry-1',
            status: 'success'
          })
          return {
            text: 'Retried successfully.',
            toolCalls: [],
            metrics: {
              provider: request.model.provider,
              modelName: request.model.modelName,
              latencyMs: 5,
              inputTokens: 10,
              outputTokens: 8,
              totalTokens: 18,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              finishReason: 'stop'
            }
          }
        }
      },
      sessionStore: store,
      toolRegistry: {
        catalog: () => ({
          ok: true,
          tools: [{
            id: 'local:read_file',
            server: 'local',
            name: 'read_file',
            description: 'Read a file',
            runtimePolicy: {
              idempotent: true,
              supportsRuntimeRetry: true,
              supportsModelRecovery: true
            }
          }]
        }),
        invoke
      }
    }, {
      toolFailurePolicy: {
        runtimeRetry: { maxAttempts: 1 },
        modelRecovery: { maxCorrectionCalls: 1 },
        loopDetection: {
          enabled: true,
          sameFailureThreshold: 2,
          sameOutcomeThreshold: 3
        }
      }
    })

    try {
      const result = await loop.run({
        userId: USER_ID,
        agentId: 'agent-1',
        sessionId: 'session-runtime-retry',
        systemPrompt: 'system',
        userInput: 'read notes',
        model: { provider: 'openai', modelName: 'gpt-test', apiKey: 'key' },
        loop: { maxSteps: 20 },
        signal: new AbortController().signal,
        trace: { runId: 'run-runtime-retry', turnId: 'turn-1' }
      })

      expect(result.text).toBe('Retried successfully.')
      expect(invoke).toHaveBeenCalledTimes(2)
      expect(providerCalls).toHaveLength(2)
      expect(result.toolMetrics).toEqual([
        expect.objectContaining({
          tool: 'local:read_file',
          success: true,
          toolCallId: 'tool-retry-1'
        })
      ])
      expect(logs.some(entry => (
        entry.component === 'runtime_retry'
        && entry.message === 'runtime retry state changed'
        && entry.data?.outcome === 'retrying'
      ))).toBe(true)
    } finally {
      resetRuntimeLoggingForTests()
    }
  })

  it('degrades exhausted local:question validation loops into pending question interactions and clears recovery artifacts', async () => {
    const store = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'question-degrade.db') })
    stores.push(store)
    const logs = captureRuntimeLogs()
    const providerCalls: AgentSessionMessage[][] = []
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false as const,
        requestId: 'req-question-invalid-1',
        error: {
          type: 'VALIDATION_ERROR' as const,
          message: 'Invalid local:question payload: at least 2 options required.',
          field: 'options',
          expected: 'at least 2 options',
          actual: 'fewer than 2 options',
          fix: 'Add more options.'
        }
      })
      .mockResolvedValueOnce({
        ok: false as const,
        requestId: 'req-question-invalid-2',
        error: {
          type: 'VALIDATION_ERROR' as const,
          message: 'Invalid local:question payload: at least 2 options required.',
          field: 'options',
          expected: 'at least 2 options',
          actual: 'fewer than 2 options',
          fix: 'Add more options.'
        }
      })
    const loop = new AgentLoop({
      providerClient: {
        async completeWithTools(request) {
          providerCalls.push(request.messages)
          if (providerCalls.length === 1) {
            return {
              text: '需要更多信息。',
              toolCalls: [{
                id: 'tool-question-degrade-1',
                name: 'local:question',
                input: {
                  prompt: '请选择列',
                  options: [{ label: '第一列', value: '1' }]
                }
              }],
              metrics: {
                provider: request.model.provider,
                modelName: request.model.modelName,
                latencyMs: 5,
                inputTokens: 10,
                outputTokens: 8,
                totalTokens: 18,
                cacheReadTokens: 0,
                cacheWriteTokens: 0,
                finishReason: 'tool_calls'
              }
            }
          }

          const lastToolResult = providerCalls.at(-1)?.at(-1)?.parts.find(part => part.type === 'tool')
          expect(lastToolResult).toMatchObject({
            type: 'tool',
            id: 'tool-question-degrade-1',
            status: 'error'
          })
          return {
            text: '继续修正提问。',
            toolCalls: [{
              id: 'tool-question-degrade-2',
              name: 'local:question',
              input: {
                prompt: '请选择列',
                options: [{ label: '第一列', value: '1' }]
              }
            }],
            metrics: {
              provider: request.model.provider,
              modelName: request.model.modelName,
              latencyMs: 5,
              inputTokens: 10,
              outputTokens: 8,
              totalTokens: 18,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              finishReason: 'tool_calls'
            }
          }
        }
      },
      sessionStore: store,
      toolRegistry: {
        catalog: () => ({
          ok: true,
          tools: [{
            id: 'local:question',
            server: 'local',
            name: 'question',
            description: 'Ask a question',
            runtimePolicy: {
              idempotent: false,
              supportsRuntimeRetry: false,
              supportsModelRecovery: true
            }
          }]
        }),
        invoke
      }
    }, {
      toolFailurePolicy: {
        runtimeRetry: { maxAttempts: 0 },
        modelRecovery: { maxCorrectionCalls: 1 },
        loopDetection: {
          enabled: false,
          sameFailureThreshold: 0,
          sameOutcomeThreshold: 0
        }
      }
    })

    const result = await loop.run({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-question-degrade',
      systemPrompt: 'system',
      userInput: '帮我抽取列',
      model: { provider: 'openai', modelName: 'gpt-test', apiKey: 'key' },
      loop: { maxSteps: 20 },
      signal: new AbortController().signal,
      trace: { runId: 'run-question-degrade', turnId: 'turn-1' }
    })

    expect(providerCalls).toHaveLength(2)
    expect(result.text).toBe('请选择列，填写后我会继续。')
    expect(result.awaitingInteraction).toMatchObject({
      kind: 'question',
      status: 'pending',
      payload: {
        prompt: '请选择列',
        degraded: {
          reason: expect.stringContaining('结构化问题收集失败'),
          referenceOptions: ['第一列']
        },
        fields: [
          expect.objectContaining({ id: 'answer', type: 'text', required: true }),
          expect.objectContaining({ id: 'notes', type: 'text', required: false })
        ]
      }
    })
    expect(result.structuredOutput).toBeUndefined()
    expect(result.finalOutputMeta).toEqual({
      source: 'tool',
      toolName: 'local:question',
      toolCallId: 'tool-question-degrade-2',
      structuredHint: 'awaiting-interaction'
    })

    const messages = await store.listMessages({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-question-degrade'
    })
    expect(messages).toHaveLength(2)
    expect(messages[1]?.parts[0]).toEqual({ type: 'text', text: '请选择列，填写后我会继续。' })
    expect(messages[1]?.parts[1]).toMatchObject({
      type: 'tool',
      id: 'tool-question-degrade-2',
      name: 'local:question',
      status: 'error'
    })
    const pendingInteractions = await store.listInteractions({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-question-degrade',
      statuses: ['pending']
    })
    expect(pendingInteractions).toHaveLength(1)
    expect(logs.some(entry => (
      entry.component === 'tool_failure_policy'
      && entry.data?.normalizedCode === 'question_validation_error'
      && entry.data?.stopReason === 'model_recovery_exhausted'
    ))).toBe(true)
  })

  it('keeps ordinary structured tool outputs non-terminal until the model finishes explicitly', async () => {
    const store = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'ordinary-tool-non-terminal.db') })
    stores.push(store)
    const invoke = vi.fn(async () => ({
      ok: true as const,
      requestId: 'req-write',
      result: {
        tool: 'local:write',
        summary: JSON.stringify({
          kind: 'artifact_ref',
          data: { fileId: 'artifact-1', fileName: 'result.txt' }
        }),
        operations: [],
        meta: {
          server: 'local',
          tool: 'write',
          latencyMs: 1,
          inputChars: 10,
          operationsChars: 0,
          summaryChars: 60
        }
      }
    }))
    const loop = new AgentLoop({
      providerClient: createProvider([
        {
          text: '先写文件。',
          toolCalls: [{
            id: 'tool-write-1',
            name: 'local:write',
            input: { path: 'result.txt', content: 'hello' }
          }]
        },
        {
          text: '文件已写入，接下来请继续检查。'
        }
      ]),
      sessionStore: store,
      toolRegistry: {
        invoke,
        catalog: () => ({
          ok: true as const,
          tools: [{
            id: 'local:write',
            server: 'local',
            name: 'write',
            description: 'Write a file'
          }]
        })
      }
    })

    const result = await loop.run({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-ordinary-tool',
      systemPrompt: 'system',
      userInput: '写一个文件然后继续',
      model: { provider: 'openai', modelName: 'gpt-test', apiKey: 'key' },
      loop: { maxSteps: 20 },
      signal: new AbortController().signal,
      trace: { runId: 'run-ordinary-tool', turnId: 'turn-1' }
    })

    expect(result.text).toBe('文件已写入，接下来请继续检查。')
    expect(result.structuredOutput).toBeUndefined()
    expect(invoke).toHaveBeenCalledTimes(1)
  })

  it('does not auto-retry non-idempotent tools even when runtime retry is enabled', async () => {
    const store = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'no-retry-skill-exec.db') })
    stores.push(store)
    const invoke = vi.fn(async () => ({
      ok: false as const,
      requestId: 'req-run-command-timeout',
      error: {
        type: 'EXECUTION_TIMEOUT' as const,
        message: 'command timeout'
      }
    }))
    const loop = new AgentLoop({
      providerClient: createProvider([{
        text: 'Run the governed script.',
        toolCalls: [{
          id: 'tool-exec-1',
          name: 'skill:exec',
          input: {
            skillName: 'demo-skill',
            templateId: 'run',
            args: {}
          }
        }]
      }]),
      sessionStore: store,
      toolRegistry: {
        catalog: () => ({
          ok: true,
          tools: [{
            id: 'skill:exec',
            server: 'skill',
            name: 'exec',
            description: 'Run a governed script',
            runtimePolicy: {
              idempotent: false,
              supportsRuntimeRetry: false,
              supportsModelRecovery: true
            }
          }]
        }),
        invoke
      }
    }, {
      toolFailurePolicy: {
        runtimeRetry: { maxAttempts: 2 },
        modelRecovery: { maxCorrectionCalls: 1 },
        loopDetection: {
          enabled: true,
          sameFailureThreshold: 2,
          sameOutcomeThreshold: 3
        }
      }
    })

    await expect(loop.run({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-no-retry-skill-exec',
      systemPrompt: 'system',
      userInput: 'run tests',
      model: { provider: 'openai', modelName: 'gpt-test', apiKey: 'key' },
      loop: { maxSteps: 20 },
      signal: new AbortController().signal,
      trace: { runId: 'run-no-retry-run-command', turnId: 'turn-1' }
    })).rejects.toMatchObject({
      toolCallId: 'tool-exec-1',
      normalizedCode: 'execution_timeout',
      stopReason: 'tool_terminal'
    })

    expect(invoke).toHaveBeenCalledTimes(1)
  })

  it('tracks same-tool recovery chains and exhausts correction-call budget per chain', async () => {
    const store = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'chain-budget.db') })
    stores.push(store)
    const logs = captureRuntimeLogs()
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false as const,
        requestId: 'req-chain-1',
        error: {
          type: 'EXECUTION_FAILED' as const,
          message: 'File not found: missing-a.txt'
        }
      })
      .mockResolvedValueOnce({
        ok: false as const,
        requestId: 'req-chain-2',
        error: {
          type: 'EXECUTION_FAILED' as const,
          message: 'File not found: missing-b.txt'
        }
      })
    const providerCalls: AgentSessionMessage[][] = []
    const loop = new AgentLoop({
      providerClient: {
        async completeWithTools(request) {
          providerCalls.push(request.messages)
          if (providerCalls.length === 1) {
            return {
              text: 'Try reading the file.',
              toolCalls: [{
                id: 'tool-chain-1',
                name: 'local:read_file',
                input: { path: 'missing-a.txt' }
              }],
              metrics: {
                provider: request.model.provider,
                modelName: request.model.modelName,
                latencyMs: 5,
                inputTokens: 10,
                outputTokens: 8,
                totalTokens: 18,
                cacheReadTokens: 0,
                cacheWriteTokens: 0,
                finishReason: 'tool_calls'
              }
            }
          }
          const payload = JSON.parse((request.messages.at(-1)?.parts.find(part => part.type === 'tool') as { output: string }).output)
          expect(payload).toMatchObject({
            code: 'path_not_found',
            recoverable: true,
            retryHint: 'correct_input'
          })
          expect(payload).not.toHaveProperty('attempt')
          expect(payload).not.toHaveProperty('chainKey')
          expect(payload).not.toHaveProperty('remainingRecoveryBudget')
          expect(payload).not.toHaveProperty('runtimeRetryCount')
          expect(payload).not.toHaveProperty('stopReason')
          return {
            text: 'Retry with another path.',
            toolCalls: [{
              id: 'tool-chain-2',
              name: 'local:read_file',
              input: { path: 'missing-b.txt' }
            }],
            metrics: {
              provider: request.model.provider,
              modelName: request.model.modelName,
              latencyMs: 5,
              inputTokens: 10,
              outputTokens: 8,
              totalTokens: 18,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              finishReason: 'tool_calls'
            }
          }
        }
      },
      sessionStore: store,
      toolRegistry: {
        catalog: () => ({
          ok: true,
          tools: [{
            id: 'local:read_file',
            server: 'local',
            name: 'read_file',
            description: 'Read a file',
            runtimePolicy: {
              idempotent: true,
              supportsRuntimeRetry: true,
              supportsModelRecovery: true
            }
          }]
        }),
        invoke
      }
    }, {
      toolFailurePolicy: {
        runtimeRetry: { maxAttempts: 0 },
        modelRecovery: { maxCorrectionCalls: 1 },
        loopDetection: {
          enabled: false,
          sameFailureThreshold: 0,
          sameOutcomeThreshold: 0
        }
      }
    })

    try {
      await expect(loop.run({
        userId: USER_ID,
        agentId: 'agent-1',
        sessionId: 'session-chain-budget',
        systemPrompt: 'system',
        userInput: 'read missing file',
        model: { provider: 'openai', modelName: 'gpt-test', apiKey: 'key' },
        loop: { maxSteps: 20 },
        signal: new AbortController().signal,
        trace: { runId: 'run-chain-budget', turnId: 'turn-1' }
      })).rejects.toMatchObject({
        toolCallId: 'tool-chain-2',
        normalizedCode: 'path_not_found',
        stopReason: 'model_recovery_exhausted',
        attempt: 1,
        remainingRecoveryBudget: 0,
        runtimeRetryCount: 0,
        threshold: 1
      })

      expect(providerCalls).toHaveLength(2)
      const messages = await store.listMessages({
        userId: USER_ID,
        agentId: 'agent-1',
        sessionId: 'session-chain-budget'
      })
      const lastToolPart = messages.at(-1)?.parts.find(part => part.type === 'tool')
      const lastPayload = JSON.parse((lastToolPart as { output: string }).output) as {
        recoverable: boolean
        code: string
        retryHint: string
      }
      expect(lastPayload).toMatchObject({
        recoverable: false,
        code: 'path_not_found',
        retryHint: 'correct_input'
      })
      expect(lastPayload).not.toHaveProperty('chainKey')
      expect(lastPayload).not.toHaveProperty('stopReason')
      expect(lastPayload).not.toHaveProperty('attempt')
      expect(lastPayload).not.toHaveProperty('remainingRecoveryBudget')
      expect(logs.some(entry => (
        entry.component === 'tool_failure_policy'
        && entry.data?.normalizedCode === 'path_not_found'
      ))).toBe(true)
      expect(logs.some(entry => (
        entry.component === 'tool_failure_policy'
        && entry.data?.stopReason === 'model_recovery_exhausted'
      ))).toBe(true)
      expect(logs.some(entry => (
        entry.component === 'tool_failure_policy'
        && entry.data?.chainKey === 'local:read_file:tool-chain-1'
      ))).toBe(true)
    } finally {
      resetRuntimeLoggingForTests()
    }
  })

  it('stops a tool-call chain when repeated failures show no progress', async () => {
    const store = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'no-progress.db') })
    stores.push(store)
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false as const,
        requestId: 'req-progress-1',
        error: {
          type: 'EXECUTION_FAILED' as const,
          message: 'File not found: missing.txt'
        }
      })
      .mockResolvedValueOnce({
        ok: false as const,
        requestId: 'req-progress-2',
        error: {
          type: 'EXECUTION_FAILED' as const,
          message: 'File not found: missing.txt'
        }
      })
    const loop = new AgentLoop({
      providerClient: createProvider([
        {
          text: 'Read the file.',
          toolCalls: [{
            id: 'tool-progress-1',
            name: 'local:read_file',
            input: { path: 'missing.txt' }
          }]
        },
        {
          text: 'Retry the same file.',
          toolCalls: [{
            id: 'tool-progress-2',
            name: 'local:read_file',
            input: { path: 'missing.txt' }
          }]
        }
      ]),
      sessionStore: store,
      toolRegistry: {
        catalog: () => ({
          ok: true,
          tools: [{
            id: 'local:read_file',
            server: 'local',
            name: 'read_file',
            description: 'Read a file',
            runtimePolicy: {
              idempotent: true,
              supportsRuntimeRetry: true,
              supportsModelRecovery: true
            }
          }]
        }),
        invoke
      }
    }, {
      toolFailurePolicy: {
        runtimeRetry: { maxAttempts: 0 },
        modelRecovery: { maxCorrectionCalls: 3 },
        loopDetection: {
          enabled: true,
          sameFailureThreshold: 1,
          sameOutcomeThreshold: 2
        }
      }
    })

    await expect(loop.run({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-no-progress',
      systemPrompt: 'system',
      userInput: 'read missing file',
      model: { provider: 'openai', modelName: 'gpt-test', apiKey: 'key' },
      loop: { maxSteps: 20 },
      signal: new AbortController().signal,
      trace: { runId: 'run-no-progress', turnId: 'turn-1' }
    })).rejects.toMatchObject({
      toolCallId: 'tool-progress-2',
      normalizedCode: 'path_not_found',
      stopReason: 'no_progress_same_failure',
      threshold: 1
    })

    const messages = await store.listMessages({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-no-progress'
    })
    const lastToolPart = messages.at(-1)?.parts.find(part => part.type === 'tool')
    const lastPayload = JSON.parse((lastToolPart as { output: string }).output) as {
      code: string
      recoverable: boolean
      retryHint: string
    }
    expect(lastPayload).toMatchObject({
      code: 'path_not_found',
      recoverable: false,
      retryHint: 'correct_input'
    })
    expect(lastPayload).not.toHaveProperty('stopReason')
    expect(lastPayload).not.toHaveProperty('threshold')
    expect(lastPayload).not.toHaveProperty('field')
  })

  it('logs terminal deny metadata with explicit stop reason', async () => {
    const store = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'deny.db') })
    stores.push(store)
    const logs = captureRuntimeLogs()
    const loop = new AgentLoop({
      providerClient: createProvider([{
        text: 'Use the secret skill.',
        toolCalls: [{
          id: 'tool-deny-1',
          name: 'skill:secret',
          input: {}
        }]
      }]),
      sessionStore: store,
      toolRegistry: {
        catalog: () => ({
          ok: true,
          tools: [{
            id: 'skill:secret',
            server: 'skill',
            name: 'secret',
            description: 'Secret skill'
          }]
        }),
        invoke: vi.fn(async () => ({
          ok: false as const,
          requestId: 'req-deny',
          error: {
            type: 'TOOL_DENIED' as const,
            message: 'E_SKILL_NOT_APPROVED: secret'
          }
        }))
      }
    })

    try {
      await expect(loop.run({
        userId: USER_ID,
        agentId: 'agent-1',
        sessionId: 'session-deny',
        systemPrompt: 'system',
        userInput: 'run secret skill',
        model: { provider: 'openai', modelName: 'gpt-test', apiKey: 'key' },
        loop: { maxSteps: 20 },
        signal: new AbortController().signal,
        trace: { runId: 'run-deny', turnId: 'turn-1' }
      })).rejects.toMatchObject({
        toolCallId: 'tool-deny-1',
        normalizedCode: 'tool_denied',
        stopReason: 'tool_denied',
        denyOrigin: 'skill'
      })

      expect(logs.some(entry => (
        entry.component === 'tool_failure_policy'
        && entry.data?.stopReason === 'tool_denied'
      ))).toBe(true)
      expect(logs.some(entry => (
        entry.component === 'tool_failure_policy'
        && entry.data?.denyOrigin === 'skill'
      ))).toBe(true)
    } finally {
      resetRuntimeLoggingForTests()
    }
  })
})
