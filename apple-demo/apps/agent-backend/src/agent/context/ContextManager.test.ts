import { describe, expect, it, vi } from 'vitest'
import type { ProviderClient } from '../providerClient.js'
import type {
  AgentSessionMessage,
  AgentSessionMessageRef,
  AgentSessionStore
} from '../sessionStoreTypes.js'
import type { AgentModelConfig, ModelCallMetrics } from '../types.js'
import type { ContextLogEntry, SummaryRecord } from './types.js'
import { ContextManager } from './ContextManager.js'

const MODEL: AgentModelConfig = {
  provider: 'openai',
  modelName: 'test-model',
  maxTokens: 20,
  contextWindow: 100
}

const BASE_REF: AgentSessionMessageRef = {
  userId: 1,
  agentId: 'agent-1',
  sessionId: 'session-1'
}

const DEFAULT_METRICS: ModelCallMetrics = {
  provider: 'openai',
  modelName: 'test-model',
  latencyMs: 1,
  inputTokens: 90,
  outputTokens: 5,
  totalTokens: 95,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  finishReason: 'stop'
}

function createTextMessage(
  role: AgentSessionMessage['role'],
  text: string,
  createdAt: number
): AgentSessionMessage {
  return {
    role,
    createdAt,
    parts: [{ type: 'text', text }]
  }
}

function createSessionStore(initialMessages: AgentSessionMessage[], summary: SummaryRecord | null = null) {
  let currentSummary = summary
  let currentMessages = [...initialMessages]

  return {
    listMessages: vi.fn(async () => currentMessages),
    getSummary: vi.fn(async () => currentSummary),
    upsertSummary: vi.fn(async (params: AgentSessionMessageRef & { summary: string; coveredUntil: number }) => {
      currentSummary = {
        summary: params.summary,
        coveredUntil: params.coveredUntil
      }
    }),
    updateMessageMeta: vi.fn(async () => undefined),
    setMessages(nextMessages: AgentSessionMessage[]) {
      currentMessages = [...nextMessages]
    }
  } as unknown as AgentSessionStore & {
    listMessages: ReturnType<typeof vi.fn>
    getSummary: ReturnType<typeof vi.fn>
    upsertSummary: ReturnType<typeof vi.fn>
    updateMessageMeta: ReturnType<typeof vi.fn>
    setMessages: (messages: AgentSessionMessage[]) => void
  }
}

function createProviderClient(text: string) {
  return {
    complete: vi.fn(async () => ({
      text,
      toolCalls: [],
      metrics: {
        provider: 'openai',
        modelName: 'test-model',
        latencyMs: 1,
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        finishReason: 'stop'
      }
    }))
  } as unknown as ProviderClient & {
    complete: ReturnType<typeof vi.fn>
  }
}

function createManager(params?: {
  messages?: AgentSessionMessage[]
  summary?: SummaryRecord | null
  summaryText?: string
  logDetail?: boolean
  contextWindow?: number
  auto?: boolean
  prune?: boolean
}) {
  const logs: ContextLogEntry[] = []
  const sessionStore = createSessionStore(params?.messages ?? [], params?.summary ?? null)
  const providerClient = createProviderClient(params?.summaryText ?? '## Goal\n压缩摘要')
  const manager = new ContextManager(
    {
      countTokens: text => text.length
    },
    sessionStore,
    providerClient,
    {
      contextWindow: params?.contextWindow ?? 60,
      auto: params?.auto ?? true,
      prune: params?.prune ?? true,
      summaryMaxTokens: 64,
      logDetail: params?.logDetail ?? false
    },
    entry => logs.push(entry)
  )

  return { manager, logs, sessionStore, providerClient }
}

describe('ContextManager', () => {
  it('returns original messages without summarizing when no session summary exists', async () => {
    const messages = [
      createTextMessage('user', 'abc', 1),
      createTextMessage('assistant', 'def', 2)
    ]
    const { manager, logs } = createManager({ messages, contextWindow: 30 })

    const result = await manager.build({
      ...BASE_REF,
      systemPrompt: 'sys',
      messages,
      model: MODEL
    })

    expect(result.messages).toEqual(messages)
    expect(result.summaryUpdated).toBe(false)
    expect(result.budget).toBe(7)
    expect(result.estimatedTokens).toBe(6)
    expect(logs.map(entry => entry.message)).toEqual([
      'context.budget',
      'skill.retention.skipped',
      'context.selection'
    ])
  })

  it('prepends the saved summary and keeps only the active tail', async () => {
    const messages = [
      createTextMessage('user', 'old user', 1),
      createTextMessage('assistant', 'old assistant', 2),
      createTextMessage('user', 'active user', 3),
      createTextMessage('assistant', 'active assistant', 4)
    ]
    const { manager } = createManager({
      messages,
      summary: {
        summary: '旧摘要',
        coveredUntil: 2
      },
      contextWindow: 80
    })

    const result = await manager.build({
      ...BASE_REF,
      systemPrompt: 'sys',
      messages,
      model: MODEL
    })

    expect(result.messages[0]).toMatchObject({
      role: 'assistant',
      parts: [{ type: 'text', text: '【会话摘要】\n旧摘要' }]
    })
    expect(result.messages.slice(1)).toEqual([messages[2], messages[3]])
  })

  it('keeps the first user message and only unsummarized tail for single-turn summaries', async () => {
    const messages = [
      createTextMessage('user', 'single request', 1),
      createTextMessage('assistant', 'older tool result', 2),
      createTextMessage('assistant', 'latest tool result', 3)
    ]
    const { manager } = createManager({
      messages,
      summary: {
        summary: '## Goal\n旧工具进展',
        coveredUntil: 2
      },
      contextWindow: 80
    })

    const result = await manager.build({
      ...BASE_REF,
      systemPrompt: 'sys',
      messages,
      model: MODEL
    })

    expect(result.messages).toEqual([
      {
        role: 'assistant',
        createdAt: 3,
        parts: [{ type: 'text', text: '【会话摘要】\n## Goal\n旧工具进展' }]
      },
      messages[0],
      messages[2]
    ])
  })

  it('throws when the reserved output budget leaves no room for the summary', async () => {
    const messages = [
      createTextMessage('user', 'old user', 1),
      createTextMessage('assistant', 'old assistant', 2),
      createTextMessage('user', 'tail-1', 3),
      createTextMessage('assistant', 'tail-2-long', 4)
    ]
    const { manager } = createManager({
      messages,
      summary: {
        summary: '摘要',
        coveredUntil: 2
      },
      contextWindow: 18
    })

    await expect(manager.build({
      ...BASE_REF,
      systemPrompt: 'sys',
      messages,
      model: MODEL
    })).rejects.toThrow('Context budget too small to include summary message.')
  })

  it('throws when the budget is too small to include the summary', async () => {
    const messages = [
      createTextMessage('user', 'old user', 1),
      createTextMessage('assistant', 'old assistant', 2)
    ]
    const { manager } = createManager({
      messages,
      summary: {
        summary: '非常长的摘要内容',
        coveredUntil: 2
      },
      contextWindow: 6
    })

    await expect(manager.build({
      ...BASE_REF,
      systemPrompt: 'sys',
      messages,
      model: MODEL
    })).rejects.toThrow('Context budget too small to include summary message.')
  })

  it('persists message meta and summary when an assistant step overflows', async () => {
    const messages = [
      createTextMessage('user', 'old user', 1),
      createTextMessage('assistant', 'old assistant', 2),
      createTextMessage('user', 'active user', 3),
      createTextMessage('assistant', 'active assistant', 4)
    ]
    const { manager, sessionStore, providerClient } = createManager({
      messages,
      summaryText: '## Goal\n压缩摘要',
      logDetail: true
    })

    await manager.handleAssistantStep({
      ...BASE_REF,
      assistantMessageId: 42,
      model: MODEL,
      metrics: DEFAULT_METRICS
    })

    expect(sessionStore.updateMessageMeta).toHaveBeenCalledTimes(2)
    expect(sessionStore.upsertSummary).toHaveBeenCalledWith({
      ...BASE_REF,
      summary: '## Goal\n压缩摘要',
      coveredUntil: 2
    })
    expect(providerClient.complete).toHaveBeenCalledTimes(1)
  })

  it('does not compact when overflow does not occur or auto is disabled', async () => {
    const messages = [
      createTextMessage('user', 'old user', 1),
      createTextMessage('assistant', 'old assistant', 2)
    ]
    const { manager, sessionStore, providerClient } = createManager({
      messages,
      auto: false
    })

    await manager.handleAssistantStep({
      ...BASE_REF,
      assistantMessageId: 7,
      model: MODEL,
      metrics: {
        ...DEFAULT_METRICS,
        totalTokens: 10,
        inputTokens: 8,
        outputTokens: 2
      }
    })

    expect(sessionStore.updateMessageMeta).toHaveBeenCalledTimes(1)
    expect(sessionStore.upsertSummary).not.toHaveBeenCalled()
    expect(providerClient.complete).not.toHaveBeenCalled()
  })

  it('does not compact when only output tokens are large', async () => {
    const messages = [
      createTextMessage('user', 'old user', 1),
      createTextMessage('assistant', 'old assistant', 2)
    ]
    const { manager, sessionStore, providerClient } = createManager({ messages })

    await manager.handleAssistantStep({
      ...BASE_REF,
      assistantMessageId: 9,
      model: MODEL,
      metrics: {
        ...DEFAULT_METRICS,
        inputTokens: 39,
        outputTokens: 60,
        totalTokens: 99
      }
    })

    expect(sessionStore.updateMessageMeta).toHaveBeenCalledTimes(1)
    expect(sessionStore.upsertSummary).not.toHaveBeenCalled()
    expect(providerClient.complete).not.toHaveBeenCalled()
  })
})
