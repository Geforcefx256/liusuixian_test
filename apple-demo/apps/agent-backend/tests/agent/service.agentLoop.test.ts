import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildAnswerContinuationContext,
  buildAwaitingInteractionToolSummary,
  buildRejectContinuationContext,
  buildQuestionInteractionPayload,
  toInteractionView
} from '../../src/agent/interactions.js'
import { AgentService } from '../../src/agent/service.js'
import { SQLiteAgentSessionStore } from '../../src/agent/sessionStore.js'
import type { AgentRunRequest } from '../../src/agent/types.js'
import { buildFailedModelCallMetrics, buildModelRequestError } from '../../src/agent/modelRequestError.js'

const TEST_USER_ID = 1
const WORKSPACE_AGENT_ID = 'workspace-agent'
const TEST_FILE_DIR = dirname(fileURLToPath(import.meta.url))
const AGENT_ASSETS_ROOT = resolve(TEST_FILE_DIR, '..', '..', 'assets')

function makeRequest(sessionId: string, input: string): AgentRunRequest {
  return {
    runId: `${sessionId}-${input}`,
    userId: TEST_USER_ID,
    agentId: WORKSPACE_AGENT_ID,
    sessionId,
    input,
    model: {
      provider: 'openai',
      modelName: 'gpt-4o-mini',
      apiKey: 'test-key'
    },
    availableSkills: [{
      id: 'llm-skill',
      name: 'LLM Skill',
      description: 'Tool-enabled llm skill',
      instructions: 'Use tools when needed.',
      sourcePath: resolve(AGENT_ASSETS_ROOT, 'skills', 'manifest.json')
    }]
  }
}

describe('AgentService tool loop integration', () => {
  let tempDir = ''
  let stores: SQLiteAgentSessionStore[] = []
  const originalRuntimeAgentLoopMaxSteps = process.env.RUNTIME_AGENT_LOOP_MAX_STEPS

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'agent-service-loop-'))
    stores = []
  })

  afterEach(async () => {
    for (const store of stores) {
      store.close()
    }
    if (originalRuntimeAgentLoopMaxSteps === undefined) {
      delete process.env.RUNTIME_AGENT_LOOP_MAX_STEPS
    } else {
      process.env.RUNTIME_AGENT_LOOP_MAX_STEPS = originalRuntimeAgentLoopMaxSteps
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('reuses session history on the next run with the same sessionId', async () => {
    const seenMessageCounts: number[] = []
    const sessionStore = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'session.db') })
    stores.push(sessionStore)
    const session = await sessionStore.createSession(TEST_USER_ID, WORKSPACE_AGENT_ID, 'history')
    await approveTestPlan(sessionStore, session.sessionId)
    const service = new AgentService(undefined, {
      sessionStore,
      providerClient: {
        async completeWithTools(request) {
          seenMessageCounts.push(request.messages.length)
          const reminderMessage = request.messages.find(message =>
            message.parts.some(part => part.type === 'text' && part.text.includes('Available skills for this run:'))
          )
          expect(request.systemPrompt).not.toContain('discoveryMode: disabled')
          expect(reminderMessage?.parts).toEqual([
            expect.objectContaining({
              type: 'text',
              text: expect.stringContaining('Available skills for this run:')
            })
          ])
          expect(reminderMessage?.parts).toEqual([
            expect.objectContaining({
              type: 'text',
              text: expect.stringContaining('LLM Skill')
            })
          ])
          return {
            text: `reply-${seenMessageCounts.length}`,
            toolCalls: [],
            metrics: {
              provider: request.model.provider,
              modelName: request.model.modelName,
              latencyMs: 1,
              inputTokens: 1,
              outputTokens: 1,
              totalTokens: 2
            }
          }
        },
        async complete(request) {
          throw new Error(`legacy complete should not be used: ${request.input}`)
        }
      }
    })

    const first = await service.executeRun(makeRequest(session.sessionId, 'first'), () => {})
    const second = await service.executeRun(makeRequest(session.sessionId, 'second'), () => {})

    expect(first.text).toBe('reply-1')
    expect(second.text).toBe('reply-2')
    expect(seenMessageCounts).toEqual([2, 4])
  })

  it('rewrites the same session from the last editable user message before rerun', async () => {
    const seenMessages: Array<Array<{ role: string; text: string }>> = []
    const sessionStore = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'session-rerun.db') })
    stores.push(sessionStore)
    const session = await sessionStore.createSession(TEST_USER_ID, WORKSPACE_AGENT_ID, 'rewrite')
    await approveTestPlan(sessionStore, session.sessionId)

    await sessionStore.appendMessage({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId,
      message: {
        role: 'user',
        parts: [{ type: 'text', text: '保留的首条消息' }],
        createdAt: 1
      }
    })
    await sessionStore.appendMessage({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId,
      message: {
        role: 'assistant',
        parts: [{ type: 'text', text: '保留的首条回复' }],
        createdAt: 2
      }
    })
    const targetMessageId = await sessionStore.appendMessage({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId,
      message: {
        role: 'user',
        parts: [{ type: 'text', text: '需要被替换的旧消息' }],
        createdAt: 3
      }
    })
    await sessionStore.appendMessage({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId,
      message: {
        role: 'assistant',
        parts: [{ type: 'text', text: '已经过时的旧回复' }],
        createdAt: 4
      }
    })

    const service = new AgentService(undefined, {
      sessionStore,
      providerClient: {
        async completeWithTools(request) {
          seenMessages.push(request.messages.map(message => ({
            role: message.role,
            text: message.parts
              .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
              .map(part => part.text)
              .join('\n')
          })))
          return {
            text: '新的尾部回复',
            toolCalls: [],
            metrics: {
              provider: request.model.provider,
              modelName: request.model.modelName,
              latencyMs: 1,
              inputTokens: 1,
              outputTokens: 1,
              totalTokens: 2
            }
          }
        },
        async complete(request) {
          throw new Error(`legacy complete should not be used: ${request.input}`)
        }
      }
    })

    const result = await service.executeRun({
      ...makeRequest(session.sessionId, '修正后的新消息'),
      editContext: {
        messageId: targetMessageId
      }
    }, () => {})

    const messages = await sessionStore.listMessages({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId
    })

    expect(result.text).toBe('新的尾部回复')
    expect(seenMessages).toEqual([[
      { role: 'user', text: '保留的首条消息' },
      { role: 'assistant', text: '保留的首条回复' },
      { role: 'user', text: '修正后的新消息' },
      { role: 'user', text: expect.stringContaining('Available skills for this run:') },
    ]])
    expect(seenMessages[0]?.[3]?.text).toContain('LLM Skill')
    expect(messages.map(message => ({
      role: message.role,
      text: message.parts
        .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
        .map(part => part.text)
        .join('\n')
    }))).toEqual([
      { role: 'user', text: '保留的首条消息' },
      { role: 'assistant', text: '保留的首条回复' },
      { role: 'user', text: '修正后的新消息' },
      { role: 'assistant', text: '新的尾部回复' }
    ])
  })

  it('rejects edit reruns that do not target the last editable user message', async () => {
    const completeWithTools = vi.fn()
    const sessionStore = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'session-rerun-invalid.db') })
    stores.push(sessionStore)
    const session = await sessionStore.createSession(TEST_USER_ID, WORKSPACE_AGENT_ID, 'rewrite-invalid')
    await approveTestPlan(sessionStore, session.sessionId)

    const firstMessageId = await sessionStore.appendMessage({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId,
      message: {
        role: 'user',
        parts: [{ type: 'text', text: '第一条用户消息' }],
        createdAt: 1
      }
    })
    await sessionStore.appendMessage({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId,
      message: {
        role: 'assistant',
        parts: [{ type: 'text', text: '第一条回复' }],
        createdAt: 2
      }
    })
    await sessionStore.appendMessage({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId,
      message: {
        role: 'user',
        parts: [{ type: 'text', text: '最后一条用户消息' }],
        createdAt: 3
      }
    })

    const service = new AgentService(undefined, {
      sessionStore,
      providerClient: {
        completeWithTools,
        async complete(request) {
          throw new Error(`legacy complete should not be used: ${request.input}`)
        }
      } as any
    })

    const result = await service.executeRun({
      ...makeRequest(session.sessionId, '错误地改第一条'),
      editContext: {
        messageId: firstMessageId
      }
    }, () => {})

    const messages = await sessionStore.listMessages({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId
    })

    expect(completeWithTools).not.toHaveBeenCalled()
    expect(result.error).toContain('只允许编辑并重跑当前会话中最后一条可编辑的用户消息')
    expect(messages).toHaveLength(3)
  })

  it('rejects edit reruns while a pending interaction still exists', async () => {
    const completeWithTools = vi.fn()
    const sessionStore = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'session-rerun-pending.db') })
    stores.push(sessionStore)
    const session = await sessionStore.createSession(TEST_USER_ID, WORKSPACE_AGENT_ID, 'rewrite-pending')
    await approveTestPlan(sessionStore, session.sessionId)

    const targetMessageId = await sessionStore.appendMessage({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId,
      message: {
        role: 'user',
        parts: [{ type: 'text', text: '最后一条用户消息' }],
        createdAt: 1
      }
    })
    await sessionStore.createInteraction({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId,
      runId: 'run-pending',
      kind: 'question',
      payload: buildQuestionInteractionPayload({
        id: 'pending-question',
        prompt: '请补充信息',
        fields: [{ id: 'answer', label: '回答', type: 'text' }]
      })
    })

    const service = new AgentService(undefined, {
      sessionStore,
      providerClient: {
        completeWithTools,
        async complete(request) {
          throw new Error(`legacy complete should not be used: ${request.input}`)
        }
      } as any
    })

    const result = await service.executeRun({
      ...makeRequest(session.sessionId, '尝试改写'),
      editContext: {
        messageId: targetMessageId
      }
    }, () => {})

    const messages = await sessionStore.listMessages({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId
    })

    expect(completeWithTools).not.toHaveBeenCalled()
    expect(result.error).toContain('当前会话有待回答的问题')
    expect(messages).toHaveLength(1)
  })

  it('returns protocol output when native tools lead to a final A2UI response', async () => {
    const sessionStore = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'protocol.db') })
    stores.push(sessionStore)
    const session = await sessionStore.createSession(TEST_USER_ID, WORKSPACE_AGENT_ID, 'protocol')
    await approveTestPlan(sessionStore, session.sessionId)
    const service = new AgentService(undefined, {
      sessionStore,
      providerClient: {
        async completeWithTools(request) {
          const lastMessage = request.messages.at(-1)
          const lastToolResult = lastMessage?.parts.find(part => part.type === 'tool')
          if (!lastToolResult) {
            return {
              text: '先读取文件内容',
              toolCalls: [{
                id: 'tool-read-1',
                name: 'local:read_file',
                input: { path: 'agent-backend/assets/agents/mml-converter/CONTEXT.md' }
              }],
              metrics: {
                provider: request.model.provider,
                modelName: request.model.modelName,
                latencyMs: 1,
                inputTokens: 1,
                outputTokens: 1,
                totalTokens: 2
              }
            }
          }

          return {
            text: JSON.stringify({
              version: '1.0',
              components: [{
                type: 'form',
                id: 'select-sheet',
                fields: [{
                  id: 'targetSheet',
                  label: '目标表',
                  type: 'select',
                  options: [{ label: 'VLR', value: 'VLR' }]
                }]
              }],
              actions: [],
              data: {}
            }),
            toolCalls: [],
            metrics: {
              provider: request.model.provider,
              modelName: request.model.modelName,
              latencyMs: 1,
              inputTokens: 1,
              outputTokens: 1,
              totalTokens: 2
            }
          }
        },
        async complete(request) {
          throw new Error(`legacy complete should not be used: ${request.input}`)
        }
      },
      toolRegistry: {
        catalog: () => ({
          ok: true,
          tools: [{
            id: 'local:read_file',
            server: 'local',
            name: 'read_file',
            description: 'Read file'
          }]
        }),
        async invoke() {
          return {
            ok: true,
            requestId: 'req-1',
            result: {
              tool: 'local:read_file',
              summary: '{"success":true,"content":"1 | alpha"}',
              operations: [],
              meta: {
                server: 'local',
                tool: 'read_file',
                latencyMs: 1,
                inputChars: 10,
                operationsChars: 0,
                summaryChars: 30
              }
            }
          }
        }
      } as any
    })

    const result = await service.executeRun(makeRequest(session.sessionId, 'read then ask me'), () => {})

    expect(result.output.kind).toBe('protocol')
    expect(result.output.protocol).toMatchObject({
      version: '1.0',
      components: [expect.objectContaining({ type: 'form', id: 'select-sheet' })]
    })
  })

  it('emits tool.started and preserves skillTriggered when the skill tool is invoked', async () => {
    const sessionStore = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'skill-started.db') })
    stores.push(sessionStore)
    const session = await sessionStore.createSession(TEST_USER_ID, WORKSPACE_AGENT_ID, 'skill-started')
    await approveTestPlan(sessionStore, session.sessionId)
    const events: Array<Record<string, unknown>> = []
    const service = new AgentService(undefined, {
      sessionStore,
      providerClient: {
        async completeWithTools(request) {
          const lastToolResult = request.messages.at(-1)?.parts.find(part => part.type === 'tool')
          if (!lastToolResult) {
            return {
              text: '先读取技能说明',
              toolCalls: [{
                id: 'tool-skill-1',
                name: 'skill:skill',
                input: { name: 'LLM Skill' }
              }],
              metrics: {
                provider: request.model.provider,
                modelName: request.model.modelName,
                latencyMs: 1,
                inputTokens: 1,
                outputTokens: 1,
                totalTokens: 2
              }
            }
          }

          return {
            text: '技能已载入并完成回复',
            toolCalls: [],
            metrics: {
              provider: request.model.provider,
              modelName: request.model.modelName,
              latencyMs: 1,
              inputTokens: 1,
              outputTokens: 1,
              totalTokens: 2
            }
          }
        },
        async complete(request) {
          throw new Error(`legacy complete should not be used: ${request.input}`)
        }
      },
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
        async invoke() {
          return {
            ok: true,
            requestId: 'req-skill',
            result: {
              tool: 'skill:skill',
              summary: '<skill_content name="LLM Skill">...</skill_content>',
              operations: [],
              meta: {
                server: 'skill',
                tool: 'skill',
                latencyMs: 1,
                inputChars: 10,
                operationsChars: 0,
                summaryChars: 40
              }
            }
          }
        }
      } as any
    })

    const result = await service.executeRun(makeRequest(session.sessionId, '读取 skill'), event => {
      events.push(event as unknown as Record<string, unknown>)
    })

    expect(result.skillTriggered).toBe('LLM Skill')
    expect(events).toContainEqual(expect.objectContaining({
      type: 'tool.started',
      tool: 'skill:skill',
      toolCallId: 'tool-skill-1',
      displayName: 'LLM Skill',
      toolKind: 'skill'
    }))
  })

  it('uses configured display names for built-in runtime tools', async () => {
    const sessionStore = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'configured-tool-display-name.db') })
    stores.push(sessionStore)
    const session = await sessionStore.createSession(TEST_USER_ID, WORKSPACE_AGENT_ID, 'configured-tool-display-name')
    await approveTestPlan(sessionStore, session.sessionId)
    const events: Array<Record<string, unknown>> = []
    const service = new AgentService(undefined, {
      sessionStore,
      providerClient: {
        async completeWithTools(request) {
          const lastToolResult = request.messages.at(-1)?.parts.find(part => part.type === 'tool')
          if (!lastToolResult) {
            return {
              text: '先等待用户回答',
              toolCalls: [{
                id: 'tool-question-1',
                name: 'local:question',
                input: {
                  prompt: '请补充列索引',
                  fields: [{ id: 'columnIndex', label: '列索引', type: 'text' }]
                }
              }],
              metrics: {
                provider: request.model.provider,
                modelName: request.model.modelName,
                latencyMs: 1,
                inputTokens: 1,
                outputTokens: 1,
                totalTokens: 2
              }
            }
          }

          return {
            text: '等待用户回答',
            toolCalls: [],
            metrics: {
              provider: request.model.provider,
              modelName: request.model.modelName,
              latencyMs: 1,
              inputTokens: 1,
              outputTokens: 1,
              totalTokens: 2
            }
          }
        },
        async complete(request) {
          throw new Error(`legacy complete should not be used: ${request.input}`)
        }
      },
      toolRegistry: {
        catalog: () => ({
          ok: true,
          tools: [{
            id: 'local:question',
            server: 'local',
            name: 'question',
            description: 'Ask a follow-up question'
          }]
        }),
        async invoke() {
          return {
            ok: true,
            requestId: 'req-question',
            result: {
              tool: 'local:question',
              summary: buildAwaitingInteractionToolSummary({
                kind: 'question',
                title: '补充信息',
                prompt: '请补充列索引',
                required: true,
                fields: [{ id: 'columnIndex', label: '列索引', type: 'text' }]
              }),
              operations: [],
              meta: {
                server: 'local',
                tool: 'question',
                latencyMs: 1,
                inputChars: 10,
                operationsChars: 0,
                summaryChars: 40
              }
            }
          }
        }
      } as any
    })

    await service.executeRun(makeRequest(session.sessionId, '等待回答'), event => {
      events.push(event as unknown as Record<string, unknown>)
    })

    expect(events).toContainEqual(expect.objectContaining({
      type: 'tool.started',
      tool: 'local:question',
      displayName: '等待你回答',
      toolKind: 'tool'
    }))
  })

  it('persists one canonical assistant message and returns awaiting interaction for question tool runs', async () => {
    const sessionStore = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'awaiting-interaction.db') })
    stores.push(sessionStore)
    const session = await sessionStore.createSession(TEST_USER_ID, WORKSPACE_AGENT_ID, 'awaiting-interaction')
    await approveTestPlan(sessionStore, session.sessionId)
    const request = makeRequest(session.sessionId, '需要补充信息')
    const payload = buildQuestionInteractionPayload({
      id: 'question-1',
      prompt: '请补充列索引',
      fields: [{ id: 'columnIndex', label: '列索引', type: 'text' }]
    })
    const service = new AgentService(undefined, {
      sessionStore,
      providerClient: {
        async completeWithTools(request) {
          return {
            text: '请调用提问工具',
            toolCalls: [{
              id: 'tool-question-1',
              name: 'local:question',
              input: {
                prompt: '请补充列索引',
                fields: [{ id: 'columnIndex', label: '列索引', type: 'text' }]
              }
            }],
            metrics: {
              provider: request.model.provider,
              modelName: request.model.modelName,
              latencyMs: 1,
              inputTokens: 1,
              outputTokens: 1,
              totalTokens: 2
            }
          }
        },
        async complete(request) {
          throw new Error(`legacy complete should not be used: ${request.input}`)
        }
      },
      toolRegistry: {
        catalog: () => ({
          ok: true,
          tools: [{
            id: 'local:question',
            server: 'local',
            name: 'question',
            description: 'Ask a question'
          }]
        }),
        async invoke() {
          const interaction = await sessionStore.createInteraction({
            userId: TEST_USER_ID,
            agentId: WORKSPACE_AGENT_ID,
            sessionId: session.sessionId,
            runId: request.runId,
            kind: 'question',
            payload
          })
          return {
            ok: true,
            requestId: 'req-question-awaiting',
            result: {
              tool: 'local:question',
              summary: buildAwaitingInteractionToolSummary(toInteractionView(interaction)),
              operations: [],
              meta: {
                server: 'local',
                tool: 'question',
                latencyMs: 1,
                inputChars: 10,
                operationsChars: 0,
                summaryChars: 42
              }
            }
          }
        }
      } as any
    })

    const eventTypes: string[] = []
    const result = await service.executeRun(request, event => {
      eventTypes.push(event.type)
    })

    expect(result.output.kind).toBe('awaiting-interaction')
    expect(result.text).toBe('请补充列索引，填写后我会继续。')
    expect(result.output.interaction).toMatchObject({
      kind: 'question',
      status: 'pending',
      payload: {
        prompt: '请补充列索引'
      }
    })
    expect(eventTypes).toEqual(expect.arrayContaining(['assistant.delta', 'assistant.final']))

    const messages = await sessionStore.listMessages({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId
    })
    expect(messages).toHaveLength(2)
    expect(messages[1]?.parts).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'tool', id: 'tool-question-1' }),
      expect.objectContaining({ type: 'text', text: '请补充列索引，填写后我会继续。' })
    ]))
    expect(messages[1]?.parts.some(part => part.type === 'structured')).toBe(false)

    const interactions = await sessionStore.listInteractions({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId,
      statuses: ['pending']
    })
    expect(interactions).toEqual([
      expect.objectContaining({
        kind: 'question',
        status: 'pending',
        payload: expect.objectContaining({
          prompt: '请补充列索引'
        })
      })
    ])
  })

  it('keeps tool artifact outputs non-terminal until the model finishes explicitly', async () => {
    const sessionStore = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'domain-result-explicit-finish.db') })
    stores.push(sessionStore)
    const session = await sessionStore.createSession(TEST_USER_ID, WORKSPACE_AGENT_ID, 'domain-result-explicit-finish')
    await approveTestPlan(sessionStore, session.sessionId)
    const providerCalls: number[] = []
    const invoke = vi.fn(async () => ({
      ok: true as const,
      requestId: 'req-run-command-artifact',
      result: {
        tool: 'local:write',
        summary: JSON.stringify({
          kind: 'artifact_ref',
          data: {
            fileId: 'artifact-1'
          }
        }),
        operations: [],
        meta: {
          server: 'local',
          tool: 'bash',
          latencyMs: 1,
          inputChars: 10,
          operationsChars: 0,
          summaryChars: 42
        }
      }
    }))
    const service = new AgentService(undefined, {
      sessionStore,
      providerClient: {
        async completeWithTools(request) {
          providerCalls.push(request.messages.length)
          if (providerCalls.length === 1) {
            return {
              text: '请执行命令并返回产物',
              toolCalls: [{
                id: 'tool-run-command-artifact',
                name: 'local:write',
                input: {
                  path: 'artifact.json',
                  content: '{"ok":true}'
                }
              }],
              metrics: {
                provider: request.model.provider,
                modelName: request.model.modelName,
                latencyMs: 1,
                inputTokens: 1,
                outputTokens: 1,
                totalTokens: 2
              }
            }
          }

          const lastTool = request.messages.at(-1)?.parts.find(part => part.type === 'tool')
          expect(lastTool).toMatchObject({
            type: 'tool',
            id: 'tool-run-command-artifact',
            status: 'success'
          })
          return {
            text: JSON.stringify({
              kind: 'artifact_ref',
              data: {
                fileId: 'artifact-1'
              }
            }),
            toolCalls: [],
            metrics: {
              provider: request.model.provider,
              modelName: request.model.modelName,
              latencyMs: 1,
              inputTokens: 1,
              outputTokens: 1,
              totalTokens: 2
            }
          }
        },
        async complete(request) {
          throw new Error(`legacy complete should not be used: ${request.input}`)
        }
      },
      toolRegistry: {
        catalog: () => ({
          ok: true,
          tools: [{
            id: 'local:write',
            server: 'local',
            name: 'write',
            description: 'Write scoped outputs'
          }]
        }),
        invoke
      } as any
    })

    const eventTypes: string[] = []
    const result = await service.executeRun(makeRequest(session.sessionId, '生成产物'), event => {
      eventTypes.push(event.type)
    })

    expect(result.output.kind).toBe('domain-result')
    expect(result.output.domainResult).toMatchObject({
      kind: 'artifact_ref',
      data: {
        fileId: 'artifact-1'
      }
    })
    expect(providerCalls).toEqual([2, 3])
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(eventTypes).toEqual(expect.arrayContaining(['assistant.delta', 'assistant.final']))
  })

  it('continues the next run after an awaiting interaction is resolved', async () => {
    const sessionStore = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'awaiting-interaction-continue.db') })
    stores.push(sessionStore)
    const session = await sessionStore.createSession(TEST_USER_ID, WORKSPACE_AGENT_ID, 'awaiting-interaction-continue')
    await approveTestPlan(sessionStore, session.sessionId)
    const firstRequest = makeRequest(session.sessionId, '需要补充信息')
    const payload = buildQuestionInteractionPayload({
      id: 'question-continue-1',
      prompt: '请补充列索引',
      fields: [{ id: 'columnIndex', label: '列索引', type: 'text' }]
    })
    const interactionContextCounts: number[] = []
    const seenWaitingArtifacts: boolean[] = []
    let modelCallCount = 0
    const service = new AgentService(undefined, {
      sessionStore,
      providerClient: {
        async completeWithTools(request) {
          modelCallCount += 1
          interactionContextCounts.push(countInteractionContextMessages(request.messages))
          seenWaitingArtifacts.push(hasAwaitingInteractionArtifacts(request.messages))

          if (modelCallCount === 1) {
            return {
              text: '请调用提问工具',
              toolCalls: [{
                id: 'tool-question-continue-1',
                name: 'local:question',
                input: {
                  prompt: '请补充列索引',
                  fields: [{ id: 'columnIndex', label: '列索引', type: 'text' }]
                }
              }],
              metrics: {
                provider: request.model.provider,
                modelName: request.model.modelName,
                latencyMs: 1,
                inputTokens: 1,
                outputTokens: 1,
                totalTokens: 2
              }
            }
          }

          return {
            text: '已基于补充信息继续处理',
            toolCalls: [],
            metrics: {
              provider: request.model.provider,
              modelName: request.model.modelName,
              latencyMs: 1,
              inputTokens: 1,
              outputTokens: 1,
              totalTokens: 2
            }
          }
        },
        async complete(request) {
          throw new Error(`legacy complete should not be used: ${request.input}`)
        }
      },
      toolRegistry: {
        catalog: () => ({
          ok: true,
          tools: [{
            id: 'local:question',
            server: 'local',
            name: 'question',
            description: 'Ask a question'
          }]
        }),
        async invoke() {
          const interaction = await sessionStore.createInteraction({
            userId: TEST_USER_ID,
            agentId: WORKSPACE_AGENT_ID,
            sessionId: session.sessionId,
            runId: firstRequest.runId,
            kind: 'question',
            payload
          })
          return {
            ok: true,
            requestId: 'req-question-continue',
            result: {
              tool: 'local:question',
              summary: buildAwaitingInteractionToolSummary(toInteractionView(interaction)),
              operations: [],
              meta: {
                server: 'local',
                tool: 'question',
                latencyMs: 1,
                inputChars: 10,
                operationsChars: 0,
                summaryChars: 42
              }
            }
          }
        }
      } as any
    })

    const firstResult = await service.executeRun(firstRequest, () => {})
    expect(firstResult.output.kind).toBe('awaiting-interaction')

    const interactionId = firstResult.output.interaction?.interactionId
    expect(interactionId).toBeTruthy()
    const interaction = await sessionStore.getInteraction({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId,
      interactionId: interactionId!
    })
    expect(interaction).toBeTruthy()

    await service.resolveInteraction({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId,
      interactionId: interactionId!,
      status: 'answered',
      answer: { columnIndex: '2' },
      continuationContext: buildAnswerContinuationContext(interaction!, { columnIndex: '2' })
    })
    const resolvedMessages = await sessionStore.listMessages({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId
    })
    expect(resolvedMessages.at(-1)).toMatchObject({
      role: 'user',
      parts: [{
        type: 'text',
        text: expect.stringContaining(`[INTERACTION CONTEXT]
interaction_id: ${interactionId}`)
      }]
    })

    const secondResult = await service.executeRun({
      ...makeRequest(session.sessionId, '继续处理'),
      continuation: {
        interactionId: interactionId!
      }
    }, () => {})

    expect(secondResult.text).toBe('已基于补充信息继续处理')
    expect(secondResult.continuationOfInteractionId).toBe(interactionId)
    expect(interactionContextCounts).toEqual([0, 1])
    expect(seenWaitingArtifacts).toEqual([false, false])
  })

  it('continues after a rejected interaction using canonical session history', async () => {
    const sessionStore = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'awaiting-interaction-reject.db') })
    stores.push(sessionStore)
    const session = await sessionStore.createSession(TEST_USER_ID, WORKSPACE_AGENT_ID, 'awaiting-interaction-reject')
    await approveTestPlan(sessionStore, session.sessionId)
    const payload = buildQuestionInteractionPayload({
      id: 'question-reject-1',
      prompt: '请确认是否继续',
      fields: [{ id: 'answer', label: '回答', type: 'text' }]
    })
    let modelCallCount = 0
    const service = new AgentService(undefined, {
      sessionStore,
      providerClient: {
        async completeWithTools(request) {
          modelCallCount += 1
          if (modelCallCount === 1) {
            return {
              text: '请调用提问工具',
              toolCalls: [{
                id: 'tool-question-reject-1',
                name: 'local:question',
                input: {
                  prompt: '请确认是否继续'
                }
              }],
              metrics: {
                provider: request.model.provider,
                modelName: request.model.modelName,
                latencyMs: 1,
                inputTokens: 1,
                outputTokens: 1,
                totalTokens: 2
              }
            }
          }
          expect(countInteractionContextMessages(request.messages)).toBe(1)
          return {
            text: '已按拒绝路径继续。',
            toolCalls: [],
            metrics: {
              provider: request.model.provider,
              modelName: request.model.modelName,
              latencyMs: 1,
              inputTokens: 1,
              outputTokens: 1,
              totalTokens: 2
            }
          }
        },
        async complete(request) {
          throw new Error(`legacy complete should not be used: ${request.input}`)
        }
      },
      toolRegistry: {
        catalog: () => ({
          ok: true,
          tools: [{
            id: 'local:question',
            server: 'local',
            name: 'question',
            description: 'Ask a question'
          }]
        }),
        async invoke() {
          const interaction = await sessionStore.createInteraction({
            userId: TEST_USER_ID,
            agentId: WORKSPACE_AGENT_ID,
            sessionId: session.sessionId,
            runId: 'run-reject',
            kind: 'question',
            payload
          })
          return {
            ok: true,
            requestId: 'req-question-reject',
            result: {
              tool: 'local:question',
              summary: buildAwaitingInteractionToolSummary(toInteractionView(interaction)),
              operations: [],
              meta: {
                server: 'local',
                tool: 'question',
                latencyMs: 1,
                inputChars: 10,
                operationsChars: 0,
                summaryChars: 42
              }
            }
          }
        }
      } as any
    })

    const firstResult = await service.executeRun(makeRequest(session.sessionId, '需要确认'), () => {})
    const interactionId = firstResult.output.interaction?.interactionId
    expect(interactionId).toBeTruthy()
    const interaction = await sessionStore.getInteraction({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId,
      interactionId: interactionId!
    })
    await service.resolveInteraction({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId,
      interactionId: interactionId!,
      status: 'rejected',
      continuationContext: buildRejectContinuationContext(interaction!)
    })

    const messages = await sessionStore.listMessages({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId
    })
    expect(messages.at(-1)).toMatchObject({
      role: 'user',
      parts: [{
        type: 'text',
        text: expect.stringContaining('status: rejected')
      }]
    })

    const secondResult = await service.executeRun({
      ...makeRequest(session.sessionId, '继续处理'),
      continuation: {
        interactionId: interactionId!
      }
    }, () => {})

    expect(secondResult.text).toBe('已按拒绝路径继续。')
  })

  it('accepts a fresh ordinary run after rejecting an awaiting interaction', async () => {
    const payload = buildQuestionInteractionPayload({
      id: 'question-reject-unlock',
      prompt: '请确认是否继续',
      fields: [{ id: 'answer', label: '回答', type: 'text' }]
    })
    const sessionStore = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'reject-unlock.db') })
    stores.push(sessionStore)
    const session = await sessionStore.createSession(TEST_USER_ID, WORKSPACE_AGENT_ID, 'reject-unlock')
    await approveTestPlan(sessionStore, session.sessionId)

    let modelCallCount = 0
    const service = new AgentService(undefined, {
      sessionStore,
      providerClient: {
        async completeWithTools() {
          modelCallCount += 1
          if (modelCallCount === 1) {
            return {
              text: '请调用提问工具',
              toolCalls: [{
                id: 'tool-question-reject-unlock-1',
                name: 'local:question',
                input: {
                  prompt: '请确认是否继续'
                }
              }],
              metrics: {
                provider: 'openai',
                modelName: 'gpt-4o-mini',
                latencyMs: 1,
                inputTokens: 1,
                outputTokens: 1,
                totalTokens: 2
              }
            }
          }
          return {
            text: '拒绝后已恢复，可以继续新对话。',
            toolCalls: [],
            metrics: {
              provider: 'openai',
              modelName: 'gpt-4o-mini',
              latencyMs: 1,
              inputTokens: 1,
              outputTokens: 1,
              totalTokens: 2
            }
          }
        },
        async complete(request) {
          throw new Error(`legacy complete should not be used: ${request.input}`)
        }
      },
      toolRegistry: {
        catalog: () => ({
          ok: true,
          tools: [{
            id: 'local:question',
            server: 'local',
            name: 'question',
            description: 'Ask a question'
          }]
        }),
        async invoke() {
          const interaction = await sessionStore.createInteraction({
            userId: TEST_USER_ID,
            agentId: WORKSPACE_AGENT_ID,
            sessionId: session.sessionId,
            runId: 'run-reject-unlock',
            kind: 'question',
            payload
          })
          return {
            ok: true,
            requestId: 'req-question-reject-unlock',
            result: {
              tool: 'local:question',
              summary: buildAwaitingInteractionToolSummary(toInteractionView(interaction)),
              operations: [],
              meta: {
                server: 'local',
                tool: 'question',
                latencyMs: 1,
                inputChars: 10,
                operationsChars: 0,
                summaryChars: 42
              }
            }
          }
        }
      } as any
    })

    const firstResult = await service.executeRun(makeRequest(session.sessionId, '需要确认'), () => {})
    const interactionId = firstResult.output.interaction?.interactionId
    expect(interactionId).toBeTruthy()

    const interaction = await sessionStore.getInteraction({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId,
      interactionId: interactionId!
    })
    await service.resolveInteraction({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId,
      interactionId: interactionId!,
      status: 'rejected',
      continuationContext: buildRejectContinuationContext(interaction!)
    })

    const secondResult = await service.executeRun(makeRequest(session.sessionId, '重新开始'), () => {})

    expect(secondResult.error).toBeUndefined()
    expect(secondResult.text).toBe('拒绝后已恢复，可以继续新对话。')
  })

  it('rejects ordinary run input while a pending interaction still blocks the session', async () => {
    const sessionStore = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'pending-interaction-blocked.db') })
    stores.push(sessionStore)
    const session = await sessionStore.createSession(TEST_USER_ID, WORKSPACE_AGENT_ID, 'pending-interaction-blocked')
    await approveTestPlan(sessionStore, session.sessionId)
    await sessionStore.createInteraction({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId,
      runId: 'run-blocked',
      kind: 'question',
      payload: buildQuestionInteractionPayload({
        id: 'question-blocked-1',
        prompt: '请补充列索引',
        fields: [{ id: 'columnIndex', label: '列索引', type: 'text' }]
      })
    })
    const completeWithTools = vi.fn()
    const service = new AgentService(undefined, {
      sessionStore,
      providerClient: {
        completeWithTools,
        async complete(request) {
          throw new Error(`legacy complete should not be used: ${request.input}`)
        }
      }
    })

    const result = await service.executeRun(makeRequest(session.sessionId, '继续处理'), () => {})

    expect(completeWithTools).not.toHaveBeenCalled()
    expect(result.error).toBe('当前会话有待回答的问题，请先提交或拒绝该问题后再继续。')
    expect(result.runtimeError?.userMessage).toBe('当前会话有待回答的问题，请先提交或拒绝该问题后再继续。')
  })

  it('surfaces actionable read_file path errors with details', async () => {
    const sessionStore = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'missing-file.db') })
    stores.push(sessionStore)
    const session = await sessionStore.createSession(TEST_USER_ID, WORKSPACE_AGENT_ID, 'missing-file')
    await approveTestPlan(sessionStore, session.sessionId)
    const service = new AgentService(undefined, {
      sessionStore,
      providerClient: {
        async completeWithTools(request) {
          return {
            text: '先读取文件内容',
            toolCalls: [{
              id: 'tool-read-missing',
              name: 'local:read_file',
              input: { path: 'CONTEXT.md' }
            }],
            metrics: {
              provider: request.model.provider,
              modelName: request.model.modelName,
              latencyMs: 1,
              inputTokens: 1,
              outputTokens: 1,
              totalTokens: 2
            }
          }
        },
        async complete(request) {
          throw new Error(`legacy complete should not be used: ${request.input}`)
        }
      }
    })

    const result = await service.executeRun(makeRequest(session.sessionId, '读取 CONTEXT.md前 5 行内容'), () => {})

    expect(result.error).toContain('File not found')
    expect(result.runtimeError?.userMessage).toContain('修正尝试已耗尽')
    expect(result.runtimeError?.userMessage).toContain('local:read_file')
    expect(result.runtimeError?.toolName).toBe('local:read_file')
    expect(result.runtimeError?.normalizedCode).toBe('path_not_found')
    expect(result.runtimeError?.stopReason).toBe('model_recovery_exhausted')
    expect(result.runtimeError?.detail).toContain('File not found')
    expect(result.runtimeError?.detail).toContain('Use find_files')
  })

  it('degrades exhausted local:question validation loops into pending interactions and continues through interaction reply', async () => {
    const sessionStore = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'question-degrade-service.db') })
    stores.push(sessionStore)
    const session = await sessionStore.createSession(TEST_USER_ID, WORKSPACE_AGENT_ID, 'question-degrade-service')
    await approveTestPlan(sessionStore, session.sessionId)
    const seenMessages: Array<Array<{ role: string; text: string }>> = []
    let modelCallCount = 0
    const service = new AgentService(undefined, {
      sessionStore,
      providerClient: {
        async completeWithTools(request) {
          modelCallCount += 1
          seenMessages.push(request.messages.map(message => ({
            role: message.role,
            text: message.parts
              .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
              .map(part => part.text)
              .join('\n')
          })))
          if (modelCallCount === 1) {
            return {
              text: '先发起结构化提问',
              toolCalls: [{
                id: 'tool-question-invalid-1',
                name: 'local:question',
                input: {
                  prompt: '请选择列',
                  options: [{ label: '第一列', value: '1' }]
                }
              }],
              metrics: {
                provider: request.model.provider,
                modelName: request.model.modelName,
                latencyMs: 1,
                inputTokens: 1,
                outputTokens: 1,
                totalTokens: 2
              }
            }
          }
          if (modelCallCount === 2) {
            return {
              text: '继续修正结构化提问',
              toolCalls: [{
                id: 'tool-question-invalid-2',
                name: 'local:question',
                input: {
                  prompt: '请选择列',
                  options: [{ label: '第一列', value: '1' }]
                }
              }],
              metrics: {
                provider: request.model.provider,
                modelName: request.model.modelName,
                latencyMs: 1,
                inputTokens: 1,
                outputTokens: 1,
                totalTokens: 2
              }
            }
          }
          expect(request.messages.some(message => message.parts.some(part => (
            part.type === 'text' && part.text.includes('[INTERACTION CONTEXT]')
          )))).toBe(true)
          return {
            text: '已根据降级问题回答继续处理',
            toolCalls: [],
            metrics: {
              provider: request.model.provider,
              modelName: request.model.modelName,
              latencyMs: 1,
              inputTokens: 1,
              outputTokens: 1,
              totalTokens: 2
            }
          }
        },
        async complete(request) {
          throw new Error(`legacy complete should not be used: ${request.input}`)
        }
      },
      toolRegistry: {
        catalog: () => ({
          ok: true,
          tools: [{
            id: 'local:question',
            server: 'local',
            name: 'question',
            description: 'Ask a question'
          }]
        }),
        async invoke() {
          return {
            ok: false as const,
            requestId: crypto.randomUUID(),
            error: {
              type: 'VALIDATION_ERROR' as const,
              message: 'Invalid local:question payload: at least 2 options required.',
              field: 'options',
              expected: 'at least 2 options',
              actual: 'fewer than 2 options',
              fix: 'Add more options.'
            }
          }
        }
      } as any
    })

    const firstEvents: string[] = []
    const firstResult = await service.executeRun(makeRequest(session.sessionId, '帮我抽取列'), event => {
      firstEvents.push(event.type)
    })

    expect(firstResult.output.kind).toBe('awaiting-interaction')
    expect(firstResult.text).toBe('请选择列，填写后我会继续。')
    expect(firstResult.error).toBeUndefined()
    expect(firstResult.runtimeError).toBeUndefined()
    expect(firstEvents).toEqual(expect.arrayContaining(['assistant.delta', 'assistant.final']))

    const pendingInteractions = await sessionStore.listInteractions({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId,
      statuses: ['pending']
    })
    expect(pendingInteractions).toHaveLength(1)
    expect(pendingInteractions[0]?.payload).toMatchObject({
      prompt: '请选择列',
      degraded: {
        reason: expect.stringContaining('结构化问题收集失败'),
        referenceOptions: ['第一列']
      },
      fields: [
        { id: 'answer', type: 'text', required: true },
        { id: 'notes', type: 'text', required: false }
      ]
    })

    const messagesAfterDegrade = await sessionStore.listMessages({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId
    })
    expect(messagesAfterDegrade).toHaveLength(2)
    expect(messagesAfterDegrade[1]?.parts[0]).toEqual({
      type: 'text',
      text: '请选择列，填写后我会继续。'
    })

    const interactionId = firstResult.output.interaction?.interactionId
    expect(interactionId).toBeTruthy()
    const interaction = await sessionStore.getInteraction({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId,
      interactionId: interactionId!
    })
    expect(interaction).toBeTruthy()

    await service.resolveInteraction({
      userId: TEST_USER_ID,
      agentId: WORKSPACE_AGENT_ID,
      sessionId: session.sessionId,
      interactionId: interactionId!,
      status: 'answered',
      answer: {
        answer: '第一列',
        notes: '只处理非空行'
      },
      continuationContext: buildAnswerContinuationContext(interaction!, {
        answer: '第一列',
        notes: '只处理非空行'
      })
    })

    const secondResult = await service.executeRun({
      ...makeRequest(session.sessionId, ''),
      continuation: {
        interactionId: interactionId!
      }
    }, () => {})

    expect(secondResult.output.kind).toBe('text')
    expect(secondResult.text).toBe('已根据降级问题回答继续处理')
    expect(secondResult.continuationOfInteractionId).toBe(interactionId)
    expect(seenMessages).toHaveLength(3)
    expect(seenMessages[2]).toEqual([
      { role: 'user', text: '帮我抽取列' },
      {
        role: 'user',
        text: expect.stringContaining('[INTERACTION CONTEXT]')
      },
      {
        role: 'user',
        text: expect.stringContaining('Available skills for this run:')
      }
    ])
  })

  it('does not emit assistant.final when upstream streaming fails with timeout', async () => {
    const sessionStore = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'stream-timeout.db') })
    stores.push(sessionStore)
    const session = await sessionStore.createSession(TEST_USER_ID, WORKSPACE_AGENT_ID, 'stream-timeout')
    await approveTestPlan(sessionStore, session.sessionId)
    const service = new AgentService(undefined, {
      sessionStore,
      providerClient: {
        async completeWithTools(request) {
          throw buildModelRequestError({
            message: 'Model stream idle timeout; provider=openai; model=gpt-4o-mini; requestUrl=https://api.openai.com/v1/chat/completions',
            failureKind: 'timeout_idle',
            metrics: buildFailedModelCallMetrics({
              model: request.model,
              latencyMs: 30,
              requestUrl: 'https://api.openai.com/v1/chat/completions'
            }),
            detail: 'idle timeout',
            retryable: true
          })
        },
        async complete(request) {
          throw new Error(`legacy complete should not be used: ${request.input}`)
        }
      }
    })

    const events: Array<{ type: string; runtimeError?: { failureKind?: string }; status?: string }> = []
    const result = await service.executeRun(makeRequest(session.sessionId, 'stream timeout'), event => {
      if ('type' in event) {
        events.push({
          type: event.type,
          runtimeError: event.type === 'lifecycle.error' ? event.runtimeError : undefined,
          status: event.type === 'run.completed' ? event.status : undefined
        })
      }
    })

    expect(result.runtimeError?.failureKind).toBe('timeout_idle')
    expect(events.some(event => event.type === 'assistant.final')).toBe(false)
    expect(events.find(event => event.type === 'lifecycle.error')?.runtimeError?.failureKind).toBe('timeout_idle')
    expect(events.find(event => event.type === 'run.completed')?.status).toBe('error')
  })

  it('supports skill:exec tool call loop and keeps result in the final response', async () => {
    const sessionStore = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'skill-exec.db') })
    stores.push(sessionStore)
    const session = await sessionStore.createSession(TEST_USER_ID, WORKSPACE_AGENT_ID, 'run-governed-script')
    await approveTestPlan(sessionStore, session.sessionId)
    const service = new AgentService(undefined, {
      sessionStore,
      providerClient: {
        async completeWithTools(request) {
          const lastMessage = request.messages.at(-1)
          const lastToolResult = lastMessage?.parts.find(part => part.type === 'tool')
          if (!lastToolResult) {
            return {
              text: '执行 governed script 确认环境',
              toolCalls: [{
                id: 'tool-exec-1',
                name: 'skill:exec',
                input: {
                  skillName: 'env-check',
                  templateId: 'node-version',
                  args: {}
                }
              }],
              metrics: {
                provider: request.model.provider,
                modelName: request.model.modelName,
                latencyMs: 1,
                inputTokens: 1,
                outputTokens: 1,
                totalTokens: 2
              }
            }
          }
          return {
            text: `exec done: ${lastToolResult.output}`,
            toolCalls: [],
            metrics: {
              provider: request.model.provider,
              modelName: request.model.modelName,
              latencyMs: 1,
              inputTokens: 1,
              outputTokens: 1,
              totalTokens: 2
            }
          }
        },
        async complete(request) {
          throw new Error(`legacy complete should not be used: ${request.input}`)
        }
      },
      toolRegistry: {
        catalog: () => ({
          ok: true,
          tools: [{
            id: 'skill:exec',
            server: 'skill',
            name: 'exec',
            description: 'Run governed project script'
          }]
        }),
        async invoke() {
          return {
            ok: true,
            requestId: 'req-exec',
            result: {
              tool: 'skill:exec',
              summary: 'v20.0.0',
              operations: [],
              meta: {
                server: 'skill',
                tool: 'exec',
                latencyMs: 1,
                inputChars: 10,
                operationsChars: 0,
                summaryChars: 7
              }
            }
          }
        }
      } as any
    })

    const result = await service.executeRun(makeRequest(session.sessionId, '跑一下 node 版本'), () => {})

    expect(result.text).toContain('exec done')
    expect(result.text).toContain('v20.0.0')
  })

  it('fails with a clear error when tool loop exceeds configured max steps', async () => {
    process.env.RUNTIME_AGENT_LOOP_MAX_STEPS = '20'
    const terminalEvents: Array<{ status: string; error?: { message: string } }> = []
    const sessionStore = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'step-limit-service.db') })
    stores.push(sessionStore)
    const session = await sessionStore.createSession(TEST_USER_ID, WORKSPACE_AGENT_ID, 'step-limit')
    await approveTestPlan(sessionStore, session.sessionId)
    const service = new AgentService(undefined, {
      sessionStore,
      providerClient: {
        async completeWithTools(request) {
          return {
            text: '继续读取文件',
            toolCalls: [{
              id: `tool-read-${request.messages.length}`,
              name: 'local:read_file',
              input: { path: 'agent-backend/assets/agents/mml-converter/CONTEXT.md' }
            }],
            metrics: {
              provider: request.model.provider,
              modelName: request.model.modelName,
              latencyMs: 1,
              inputTokens: 1,
              outputTokens: 1,
              totalTokens: 2
            }
          }
        },
        async complete(request) {
          throw new Error(`legacy complete should not be used: ${request.input}`)
        }
      },
      toolRegistry: {
        catalog: () => ({
          ok: true,
          tools: [{
            id: 'local:read_file',
            server: 'local',
            name: 'read_file',
            description: 'Read file'
          }]
        }),
        async invoke() {
          return {
            ok: true,
            requestId: 'req-limit',
            result: {
              tool: 'local:read_file',
              summary: '{"success":true,"content":"1 | alpha"}',
              operations: [],
              meta: {
                server: 'local',
                tool: 'read_file',
                latencyMs: 1,
                inputChars: 10,
                operationsChars: 0,
                summaryChars: 30
              }
            }
          }
        }
      } as any
    })

    const result = await service.executeRun(makeRequest(session.sessionId, 'keep looping'), event => {
      if (event.type === 'run.completed') {
        terminalEvents.push({ status: event.status, error: event.error })
      }
    })

    expect(result.error).toBe('Agent loop exceeded max steps: 20.')
    expect(result.runtimeError?.userMessage).toBe('智能体执行步数超过限制，当前运行已停止。')
    expect(result.runtimeError?.code).toBe('MODEL')
    expect(result.runtimeError?.stage).toBe('model')
    expect(terminalEvents).toEqual([{
      status: 'error',
      error: expect.objectContaining({ message: 'Agent loop exceeded max steps: 20.' })
    }])
  })
})

async function approveTestPlan(
  sessionStore: SQLiteAgentSessionStore,
  sessionId: string
): Promise<void> {
  const saved = await sessionStore.savePlan({
    userId: TEST_USER_ID,
    agentId: WORKSPACE_AGENT_ID,
    sessionId,
    draft: {
      title: 'Approved test plan',
      summary: 'Use llm skill for execution.',
      goal: 'Run build phase directly in tests.',
      steps: ['Execute the requested action.'],
      approvedSkillIds: ['llm-skill'],
      skillsReasoning: ['Synthetic llm-skill is injected by the test request.'],
      risks: [],
      openQuestions: [],
      markdown: '# Approved test plan\n',
      filePath: `plans/agent/${sessionId}/v1-approved-test-plan.md`
    }
  })
  await sessionStore.decidePlan({
    userId: TEST_USER_ID,
    agentId: WORKSPACE_AGENT_ID,
    sessionId,
    decision: 'approve',
    planId: saved.planId
  })
}

function countInteractionContextMessages(
  messages: Array<{ role: string; parts: Array<{ type: string; text?: string; output?: string }> }>
): number {
  return messages.filter(message => {
    return message.role === 'user'
      && message.parts.some(part => part.type === 'text' && part.text?.includes('[INTERACTION CONTEXT]'))
  }).length
}

function hasAwaitingInteractionArtifacts(
  messages: Array<{ parts: Array<{ type: string; text?: string; output?: string }> }>
): boolean {
  return messages.some(message => {
    return message.parts.some(part => {
      if (part.type !== 'tool') {
        return false
      }
      return part.output?.includes('"kind":"awaiting-interaction"') === true
    })
  })
}
