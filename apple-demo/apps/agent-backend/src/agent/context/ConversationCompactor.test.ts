import { describe, expect, it, vi } from 'vitest'
import type { ProviderClient } from '../providerClient.js'
import type { AgentSessionMessage } from '../sessionStoreTypes.js'
import type { AgentModelConfig } from '../types.js'
import type { SummaryRecord } from './types.js'
import { ConversationCompactor } from './ConversationCompactor.js'

const MODEL: AgentModelConfig = {
  provider: 'openai',
  modelName: 'test-model'
}

function createMessage(
  role: AgentSessionMessage['role'],
  createdAt: number,
  parts: AgentSessionMessage['parts']
): AgentSessionMessage {
  return { role, createdAt, parts }
}

function createProviderClient(responseText: string | Error) {
  return {
    complete: vi.fn(async () => {
      if (responseText instanceof Error) {
        throw responseText
      }
      return {
        text: responseText,
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
      }
    })
  } as unknown as ProviderClient & {
    complete: ReturnType<typeof vi.fn>
  }
}

describe('ConversationCompactor', () => {
  it('does not summarize when there is no history before the last user message', async () => {
    const providerClient = createProviderClient('unused')
    const compactor = new ConversationCompactor(providerClient)

    const result = await compactor.compact({
      messages: [
        createMessage('user', 1, [{ type: 'text', text: 'one' }]),
        createMessage('assistant', 2, [{ type: 'text', text: 'two' }])
      ],
      existingSummary: null,
      model: MODEL,
      summaryMaxTokens: 128
    })

    expect(result.updated).toBe(false)
    expect(result.summary).toBeNull()
    expect(providerClient.complete).not.toHaveBeenCalled()
  })

  it('summarizes only messages before the last user message', async () => {
    const providerClient = createProviderClient('## Goal\n完成任务')
    const compactor = new ConversationCompactor(providerClient)
    const result = await compactor.compact({
      messages: [
        createMessage('user', 1, [{ type: 'text', text: '第一轮需求' }]),
        createMessage('assistant', 2, [{ type: 'text', text: '已完成一部分' }]),
        createMessage('user', 3, [{ type: 'text', text: '继续下一步' }]),
        createMessage('assistant', 4, [{ type: 'text', text: '处理中' }])
      ],
      existingSummary: null,
      model: MODEL,
      summaryMaxTokens: 128
    })

    expect(result.updated).toBe(true)
    expect(result.summary).toEqual({
      summary: '## Goal\n完成任务',
      coveredUntil: 2
    })
    const input = providerClient.complete.mock.calls[0]?.[0].input
    expect(input).toContain('## Goal')
    expect(input).toContain('## Instructions')
    expect(input).toContain('第一轮需求')
    expect(input).not.toContain('继续下一步')
  })

  it('summarizes long single-turn tool loops while keeping the latest message out of the summary', async () => {
    const providerClient = createProviderClient('## Goal\n保留单轮任务')
    const compactor = new ConversationCompactor(providerClient)
    const result = await compactor.compact({
      messages: [
        createMessage('user', 1, [{ type: 'text', text: '第一轮需求' }]),
        createMessage('assistant', 2, [{ type: 'text', text: '工具结果-1' }]),
        createMessage('assistant', 3, [{ type: 'text', text: '工具结果-2' }])
      ],
      existingSummary: null,
      model: MODEL,
      summaryMaxTokens: 128
    })

    expect(result.updated).toBe(true)
    expect(result.summary).toEqual({
      summary: '## Goal\n保留单轮任务',
      coveredUntil: 2
    })
    const input = providerClient.complete.mock.calls[0]?.[0].input
    expect(input).toContain('第一轮需求')
    expect(input).toContain('工具结果-1')
    expect(input).not.toContain('工具结果-2')
  })

  it('only summarizes messages newer than coveredUntil when an existing summary is present', async () => {
    const providerClient = createProviderClient('## Goal\n更新摘要')
    const compactor = new ConversationCompactor(providerClient)
    const existingSummary: SummaryRecord = {
      summary: '旧摘要',
      coveredUntil: 2
    }

    const result = await compactor.compact({
      messages: [
        createMessage('user', 1, [{ type: 'text', text: 'old-1' }]),
        createMessage('assistant', 2, [{ type: 'text', text: 'old-2' }]),
        createMessage('assistant', 3, [{ type: 'text', text: 'new-1' }]),
        createMessage('user', 4, [{ type: 'text', text: 'active tail' }]),
        createMessage('assistant', 5, [{ type: 'text', text: 'keep recent' }])
      ],
      existingSummary,
      model: MODEL,
      summaryMaxTokens: 128
    })

    expect(result.updated).toBe(true)
    expect(result.summary).toEqual({
      summary: '## Goal\n更新摘要',
      coveredUntil: 3
    })
    const input = providerClient.complete.mock.calls[0]?.[0].input
    expect(input).toContain('## Existing Summary')
    expect(input).toContain('旧摘要')
    expect(input).toContain('new-1')
    expect(input).not.toContain('old-1')
  })

  it('reuses the existing summary when no new summary-candidate messages exist', async () => {
    const providerClient = createProviderClient('unused')
    const compactor = new ConversationCompactor(providerClient)
    const existingSummary: SummaryRecord = {
      summary: 'Old summary',
      coveredUntil: 2
    }

    const result = await compactor.compact({
      messages: [
        createMessage('user', 1, [{ type: 'text', text: 'old-1' }]),
        createMessage('assistant', 2, [{ type: 'text', text: 'old-2' }]),
        createMessage('user', 3, [{ type: 'text', text: 'active tail' }])
      ],
      existingSummary,
      model: MODEL,
      summaryMaxTokens: 128
    })

    expect(result.updated).toBe(false)
    expect(result.summary).toEqual(existingSummary)
    expect(providerClient.complete).not.toHaveBeenCalled()
  })

  it('surfaces provider failures and rejects empty summaries', async () => {
    const failureClient = createProviderClient(new Error('provider down'))
    const failureCompactor = new ConversationCompactor(failureClient)
    const emptyClient = createProviderClient('   ')
    const emptyCompactor = new ConversationCompactor(emptyClient)
    const messages = [
      createMessage('user', 1, [{ type: 'text', text: 'old-1' }]),
      createMessage('assistant', 2, [{ type: 'text', text: 'keep recent' }]),
      createMessage('user', 3, [{ type: 'text', text: 'active tail' }])
    ]

    await expect(failureCompactor.compact({
      messages,
      existingSummary: null,
      model: MODEL,
      summaryMaxTokens: 64
    })).rejects.toThrow('provider down')

    await expect(emptyCompactor.compact({
      messages,
      existingSummary: null,
      model: MODEL,
      summaryMaxTokens: 64
    })).rejects.toThrow('Summary model returned empty response')
  })
})
