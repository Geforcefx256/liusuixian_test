import { describe, expect, it, vi } from 'vitest'
import type { ProviderClient } from '../providerClient.js'
import type {
  AgentSessionMessage,
  AgentSessionMessageRef,
  AgentSessionStore
} from '../sessionStoreTypes.js'
import type { AgentModelConfig } from '../types.js'
import type { ContextLogEntry, SummaryRecord } from './types.js'
import { ContextManager } from './ContextManager.js'
import { createSkillContextMessage } from '../sessionMessages.js'

const MODEL: AgentModelConfig = {
  provider: 'openai',
  modelName: 'test-model',
  maxTokens: 20,
  contextWindow: 200
}

const BASE_REF: AgentSessionMessageRef = {
  userId: 1,
  agentId: 'agent-1',
  sessionId: 'session-1'
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

function createSkillMessage(params: {
  createdAt: number
  skillName: string
  output: string
}): AgentSessionMessage {
  return createSkillContextMessage({
    skillName: params.skillName,
    text: params.output,
    createdAt: params.createdAt
  })
}

function createSessionStore(initialMessages: AgentSessionMessage[], summary: SummaryRecord | null = null) {
  return {
    listMessages: vi.fn(async () => initialMessages),
    getSummary: vi.fn(async () => summary),
    upsertSummary: vi.fn(async () => undefined),
    updateMessageMeta: vi.fn(async () => undefined)
  } as unknown as AgentSessionStore
}

function createManager(params: {
  messages: AgentSessionMessage[]
  summary: SummaryRecord | null
  contextWindow?: number
}) {
  const logs: ContextLogEntry[] = []
  const manager = new ContextManager(
    {
      countTokens: text => text.length
    },
    createSessionStore(params.messages, params.summary),
    {
      complete: vi.fn(async () => ({
        text: 'unused',
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
    } as unknown as ProviderClient,
    {
      contextWindow: params.contextWindow ?? 260,
      auto: true,
      prune: true,
      summaryMaxTokens: 64,
      logDetail: true
    },
    entry => logs.push(entry)
  )

  return { manager, logs }
}

describe('ContextManager retained skill reminder', () => {
  it('injects a dedicated retained-skill reminder only for compacted sessions', async () => {
    const messages = [
      createTextMessage('user', 'old user', 1),
      createSkillMessage({
        createdAt: 2,
        skillName: 'skill-a',
        output: '<skill_content name="skill-a">\nbody-a\n</skill_content>'
      }),
      createTextMessage('user', 'active user', 3),
      createTextMessage('assistant', 'active assistant', 4)
    ]
    const { manager, logs } = createManager({
      messages,
      summary: {
        summary: '旧摘要',
        coveredUntil: 2
      }
    })

    const result = await manager.build({
      ...BASE_REF,
      systemPrompt: 'sys',
      messages,
      model: MODEL
    })

    expect(result.messages[0]?.parts[0]).toEqual({
      type: 'text',
      text: '【会话摘要】\n旧摘要'
    })
    expect(result.messages[1]?.parts[0]).toEqual({
      type: 'text',
      text: [
        '【已调用技能保留】',
        '<invoked_skills>',
        '<skill name="skill-a">',
        '<skill_content name="skill-a">',
        'body-a',
        '</skill_content>',
        '</skill>',
        '</invoked_skills>'
      ].join('\n')
    })
    expect(result.messages.slice(2)).toEqual([messages[2], messages[3]])
    expect(logs.map(entry => entry.message)).toContain('skill.retention.injected')
  })

  it('does not inject retained reminder when no summary exists', async () => {
    const messages = [
      createTextMessage('user', 'request', 1),
      createSkillMessage({
        createdAt: 2,
        skillName: 'skill-a',
        output: '<skill_content name="skill-a">\nbody-a\n</skill_content>'
      })
    ]
    const { manager, logs } = createManager({
      messages,
      summary: null
    })

    const result = await manager.build({
      ...BASE_REF,
      systemPrompt: 'sys',
      messages,
      model: MODEL
    })

    expect(result.messages).toEqual(messages)
    expect(logs).toContainEqual(expect.objectContaining({
      message: 'skill.retention.skipped',
      data: expect.objectContaining({
        reason: 'no_compacted_summary',
        skillNames: ['skill-a']
      })
    }))
  })

  it('keeps retention separate from summary text and skips overflowed skills', async () => {
    const messages = [
      createTextMessage('user', 'old user', 1),
      createSkillMessage({
        createdAt: 2,
        skillName: 'skill-a',
        output: '<skill_content name="skill-a">\nshort\n</skill_content>'
      }),
      createSkillMessage({
        createdAt: 3,
        skillName: 'skill-b',
        output: [
          '<skill_content name="skill-b">',
          'very-long-skill-content-very-long-skill-content-very-long-skill-content-very-long-skill-content',
          '</skill_content>'
        ].join('\n')
      }),
      createTextMessage('user', 'active user', 4)
    ]
    const { manager, logs } = createManager({
      messages,
      summary: {
        summary: '旧摘要',
        coveredUntil: 3
      },
      contextWindow: 180
    })

    const result = await manager.build({
      ...BASE_REF,
      systemPrompt: 'sys',
      messages,
      model: MODEL
    })

    const reminderText = result.messages[1]?.parts[0]
    expect(reminderText).toEqual(expect.objectContaining({
      type: 'text',
      text: expect.stringContaining('skill-a')
    }))
    expect(reminderText).toEqual(expect.objectContaining({
      text: expect.not.stringContaining('skill-b')
    }))
    expect(result.messages[0]?.parts[0]).toEqual(expect.objectContaining({
      text: '【会话摘要】\n旧摘要'
    }))
    expect(logs).toContainEqual(expect.objectContaining({
      message: 'skill.retention.skipped',
      data: expect.objectContaining({
        reason: 'retention_budget_trimmed',
        skippedSkillNames: ['skill-b']
      })
    }))
  })
})
