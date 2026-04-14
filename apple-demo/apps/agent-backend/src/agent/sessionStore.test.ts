import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  DeletedSessionWriteError,
  SQLiteAgentSessionStore,
  type AgentSessionMessage
} from './sessionStore.js'
import {
  buildAnswerContinuationContext,
  buildRejectContinuationContext,
  buildQuestionInteractionPayload
} from './interactions.js'
import { createIntermediateAttributes, createSkillContextMessage } from './sessionMessages.js'

function createMessage(
  role: AgentSessionMessage['role'],
  parts: AgentSessionMessage['parts'],
  createdAt = Date.now()
): AgentSessionMessage {
  return {
    role,
    parts,
    createdAt
  }
}

describe('SQLiteAgentSessionStore', () => {
  let tempDir = ''
  let stores: SQLiteAgentSessionStore[] = []
  const USER_ID = 1

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'agent-session-store-'))
    stores = []
    process.env.APPLE_DEMO_AGENT_BACKEND_ROOT = tempDir
    await writeFile(join(tempDir, 'config.json'), JSON.stringify({
      runtime: {
        workspaceAgent: {
          plannerEnabled: true,
          defaultPrimaryAgent: 'plan'
        }
      }
    }, null, 2), 'utf8')
  })

  afterEach(async () => {
    delete process.env.APPLE_DEMO_AGENT_BACKEND_ROOT
    for (const store of stores) {
      store.close()
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('persists messages in append order for the same session', async () => {
    const store = new SQLiteAgentSessionStore({
      dbPath: join(tempDir, 'session.db')
    })
    stores.push(store)

    await store.appendMessage({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-1',
      message: createMessage('user', [{ type: 'text', text: 'read file' }])
    })
    await store.appendMessage({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-1',
      message: createMessage('assistant', [
        {
          type: 'tool',
          id: 'tool-1',
          name: 'local:read_file',
          input: { path: 'README.md' },
          status: 'success',
          output: '{"success":true}'
        }
      ])
    })

    const messages = await store.listMessages({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-1'
    })

    expect(messages).toHaveLength(2)
    expect(messages[0]?.role).toBe('user')
    expect(messages[1]?.parts[0]).toMatchObject({
      type: 'tool',
      id: 'tool-1',
      name: 'local:read_file'
    })
  })

  it('restores tool parts across store instances', async () => {
    const dbPath = join(tempDir, 'session.db')
    const writer = new SQLiteAgentSessionStore({ dbPath })
    stores.push(writer)

    await writer.appendMessage({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-2',
      message: createMessage('assistant', [
        {
          type: 'tool',
          id: 'tool-2',
          name: 'local:read_file',
          input: { path: 'docs/a.md' },
          status: 'success',
          output: '{"success":true}'
        }
      ])
    })
    writer.close()
    stores = stores.filter(store => store !== writer)

    const reader = new SQLiteAgentSessionStore({ dbPath })
    stores.push(reader)
    const messages = await reader.listMessages({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-2'
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.parts).toEqual([
      {
        type: 'tool',
        id: 'tool-2',
        name: 'local:read_file',
        input: { path: 'docs/a.md' },
        status: 'success',
        output: '{"success":true}'
      }
    ])
    reader.close()
    stores = stores.filter(store => store !== reader)
  })

  it('persists hidden skill-context messages without exposing them in ordinary history views', async () => {
    const store = new SQLiteAgentSessionStore({
      dbPath: join(tempDir, 'session-hidden-skill-context.db')
    })
    stores.push(store)

    const agentId = 'agent-1'
    const sessionId = 'session-hidden-skill-context'
    await store.appendMessage({
      userId: USER_ID,
      agentId,
      sessionId,
      message: createMessage('user', [{ type: 'text', text: 'load skill' }], 1)
    })
    await store.appendMessage({
      userId: USER_ID,
      agentId,
      sessionId,
      message: createSkillContextMessage({
        skillName: 'skill-a',
        text: '<skill_content name="skill-a">\nbody-a\n</skill_content>',
        createdAt: 2
      })
    })
    await store.appendMessage({
      userId: USER_ID,
      agentId,
      sessionId,
      message: createMessage('assistant', [{ type: 'text', text: 'visible reply' }], 3)
    })

    const messages = await store.listMessages({
      userId: USER_ID,
      agentId,
      sessionId
    })
    const views = await store.getSessionMessagesView({
      userId: USER_ID,
      agentId,
      sessionId
    })
    const sessions = await store.listSessions(USER_ID, agentId)

    expect(messages).toHaveLength(3)
    expect(messages[1]?.attributes).toEqual({
      visibility: 'hidden',
      semantic: 'skill-context',
      skillName: 'skill-a'
    })
    expect(views.messages.map(message => message.text)).toEqual(['load skill', 'visible reply'])
    expect(sessions[0]?.preview).toBe('visible reply')
  })

  it('paginates visible session history across hidden skill-context messages', async () => {
    const store = new SQLiteAgentSessionStore({
      dbPath: join(tempDir, 'session-hidden-pagination.db')
    })
    stores.push(store)

    const agentId = 'agent-1'
    const sessionId = 'session-hidden-pagination'
    await store.appendMessage({
      userId: USER_ID,
      agentId,
      sessionId,
      message: createMessage('user', [{ type: 'text', text: 'first' }], 1)
    })
    await store.appendMessage({
      userId: USER_ID,
      agentId,
      sessionId,
      message: createSkillContextMessage({
        skillName: 'skill-a',
        text: '<skill_content name="skill-a">\nbody-a\n</skill_content>',
        createdAt: 2
      })
    })
    await store.appendMessage({
      userId: USER_ID,
      agentId,
      sessionId,
      message: createMessage('assistant', [{ type: 'text', text: 'second' }], 3)
    })

    const firstPage = await store.getSessionMessagesView({
      userId: USER_ID,
      agentId,
      sessionId,
      limit: 1
    })
    const secondPage = await store.getSessionMessagesView({
      userId: USER_ID,
      agentId,
      sessionId,
      limit: 1,
      cursor: firstPage.nextCursor ?? undefined
    })

    expect(firstPage.messages.map(message => message.text)).toEqual(['second'])
    expect(firstPage.hasMore).toBe(true)
    expect(secondPage.messages.map(message => message.text)).toEqual(['first'])
    expect(secondPage.hasMore).toBe(false)
  })

  it('round-trips intermediate attributes and exposes tool-step views', async () => {
    const store = new SQLiteAgentSessionStore({
      dbPath: join(tempDir, 'session-intermediate-view.db')
    })
    stores.push(store)

    const agentId = 'agent-1'
    const sessionId = 'session-intermediate-view'
    await store.appendMessage({
      userId: USER_ID,
      agentId,
      sessionId,
      message: createMessage('assistant', [
        { type: 'text', text: '让我先检查文件。' },
        {
          type: 'tool',
          id: 'tool-1',
          name: 'local:read_file',
          input: { path: 'notes.txt' },
          status: 'success',
          output: '{"success":true}'
        }
      ], 1)
    })
    await store.appendMessage({
      userId: USER_ID,
      agentId,
      sessionId,
      message: {
        ...createMessage('assistant', [
          { type: 'text', text: '让我先检查文件。' },
          {
            type: 'tool',
            id: 'tool-2',
            name: 'local:read_file',
            input: { path: 'notes.txt' },
            status: 'success',
            output: '{"success":true}'
          }
        ], 2),
        attributes: createIntermediateAttributes(['读取工作区文件', '查看工作区目录'])
      }
    })

    const messages = await store.listMessages({
      userId: USER_ID,
      agentId,
      sessionId
    })
    const views = await store.getSessionMessagesView({
      userId: USER_ID,
      agentId,
      sessionId
    })

    expect(messages[1]?.attributes).toEqual({
      visibility: 'internal',
      semantic: 'intermediate',
      toolDisplayNames: ['读取工作区文件', '查看工作区目录']
    })
    expect(views.messages[0]).toMatchObject({
      kind: 'text',
      text: '让我先检查文件。'
    })
    expect(views.messages[1]).toMatchObject({
      kind: 'tool-step',
      text: '',
      toolDisplayNames: ['读取工作区文件', '查看工作区目录']
    })
  })

  it('persists and updates assistant message meta across store instances', async () => {
    const dbPath = join(tempDir, 'session-meta-json.db')
    const writer = new SQLiteAgentSessionStore({ dbPath })
    stores.push(writer)

    const messageId = await writer.appendMessage({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-meta',
      message: createMessage('assistant', [{ type: 'text', text: 'done' }])
    })

    await writer.updateMessageMeta({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-meta',
      messageId,
      meta: {
        model: {
          provider: 'openai',
          modelName: 'gpt-test'
        },
        usage: {
          inputTokens: 10,
          outputTokens: 8,
          totalTokens: 18,
          cacheReadTokens: 0,
          cacheWriteTokens: 0
        },
        finishReason: 'stop',
        compaction: {
          checkedAt: 123,
          overflow: true,
          applied: false
        }
      }
    })

    const messages = await writer.listMessages({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-meta'
    })

    expect(messages[0]?.meta).toMatchObject({
      model: {
        provider: 'openai',
        modelName: 'gpt-test'
      },
      usage: {
        totalTokens: 18
      },
      compaction: {
        overflow: true
      }
    })
  })

  it('aggregates persisted assistant usage by session', async () => {
    const store = new SQLiteAgentSessionStore({
      dbPath: join(tempDir, 'session-usage-summary.db')
    })
    stores.push(store)

    await store.appendMessage({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-usage',
      message: createMessage('user', [{ type: 'text', text: 'hello' }], 1)
    })
    await store.appendMessage({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-usage',
      message: {
        ...createMessage('assistant', [{ type: 'text', text: 'first reply' }], 2),
        meta: {
          model: {
            provider: 'openai',
            modelName: 'gpt-test'
          },
          usage: {
            inputTokens: 10,
            outputTokens: 8,
            totalTokens: 18,
            cacheReadTokens: 2,
            cacheWriteTokens: 1
          },
          finishReason: 'stop',
          compaction: {
            checkedAt: 0,
            overflow: false,
            applied: false
          }
        }
      }
    })
    await store.appendMessage({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-usage',
      message: {
        ...createMessage('assistant', [{ type: 'text', text: 'second reply' }], 3),
        meta: {
          model: {
            provider: 'openai',
            modelName: 'gpt-test'
          },
          usage: {
            inputTokens: 5,
            outputTokens: 7,
            totalTokens: 12,
            cacheReadTokens: 0,
            cacheWriteTokens: 0
          },
          finishReason: 'stop',
          compaction: {
            checkedAt: 0,
            overflow: false,
            applied: false
          }
        }
      }
    })

    const summary = await store.getSessionUsageSummary({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-usage'
    })

    expect(summary).toEqual({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-usage',
      totalTokens: 30,
      inputTokens: 15,
      outputTokens: 15,
      cacheReadTokens: 2,
      cacheWriteTokens: 1,
      assistantMessageCount: 2
    })
  })

  it('returns a zero usage summary for sessions without assistant usage metadata', async () => {
    const store = new SQLiteAgentSessionStore({
      dbPath: join(tempDir, 'session-usage-empty.db')
    })
    stores.push(store)

    const session = await store.createSession(USER_ID, 'agent-1', 'Empty Usage')

    const summary = await store.getSessionUsageSummary({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: session.sessionId
    })

    expect(summary).toEqual({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: session.sessionId,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      assistantMessageCount: 0
    })
  })

  it('returns only the most recent messages when a limit is provided', async () => {
    const store = new SQLiteAgentSessionStore({
      dbPath: join(tempDir, 'session.db')
    })
    stores.push(store)

    await store.appendMessage({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-3',
      message: createMessage('user', [{ type: 'text', text: 'first' }])
    })
    await store.appendMessage({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-3',
      message: createMessage('assistant', [{ type: 'text', text: 'second' }])
    })
    await store.appendMessage({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-3',
      message: createMessage('user', [{ type: 'text', text: 'third' }])
    })

    const messages = await store.listMessages({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-3',
      limit: 2
    })

    expect(messages).toHaveLength(2)
    expect(messages.map(message => message.parts[0]?.type === 'text' ? message.parts[0].text : null)).toEqual([
      'second',
      'third'
    ])
  })

  it('lists sessions with metadata updates', async () => {
    const store = new SQLiteAgentSessionStore({
      dbPath: join(tempDir, 'session-meta.db')
    })
    stores.push(store)

    const session = await store.createSession(USER_ID, 'agent-1', 'Session A')
    await store.appendMessage({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: session.sessionId,
      message: createMessage('user', [{ type: 'text', text: 'hello' }])
    })

    const sessions = await store.listSessions(USER_ID, 'agent-1')
    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.title).toBe('Session A')
    expect(sessions[0]?.messageCount).toBe(1)
    expect(sessions[0]?.preview).toBe('hello')
    expect(sessions[0]?.activePrimaryAgent).toBe('build')
    expect(sessions[0]?.planState).toBeNull()
  })

  it('persists workspace files and restores them across store instances', async () => {
    const dbPath = join(tempDir, 'session-workspace.db')
    const writer = new SQLiteAgentSessionStore({ dbPath })
    stores.push(writer)

    const session = await writer.createSession(USER_ID, 'agent-1', 'Workspace Session')
    await writer.replaceWorkspaceFiles({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: session.sessionId,
      files: [
        {
          nodeId: 'upload-1',
          fileId: 'upload-1',
          fileKey: 'upload-1',
          path: 'upload/input.csv',
          fileName: 'input.csv',
          relativePath: 'input.csv',
          nodeType: 'file',
          source: 'upload',
          groupId: 'upload',
          writable: false,
          addedAt: 10
        },
        {
          nodeId: 'output-1',
          fileId: 'output-1',
          fileKey: 'output-1',
          path: 'project/result.mml',
          fileName: 'result.mml',
          relativePath: 'result.mml',
          nodeType: 'file',
          source: 'project',
          groupId: 'project',
          writable: true,
          addedAt: 20
        }
      ]
    })
    writer.close()
    stores = stores.filter(store => store !== writer)

    const reader = new SQLiteAgentSessionStore({ dbPath })
    stores.push(reader)

    const files = await reader.getWorkspaceFiles({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: session.sessionId
    })
    const sessions = await reader.listSessions(USER_ID, 'agent-1')

    expect(files).toEqual([
      {
        nodeId: 'upload-1',
        fileId: 'upload-1',
        fileKey: 'upload-1',
        path: 'upload/input.csv',
        fileName: 'input.csv',
        relativePath: 'input.csv',
        nodeType: 'file',
        source: 'upload',
        groupId: 'upload',
        writable: false,
        addedAt: 10
      },
      {
        nodeId: 'output-1',
        fileId: 'output-1',
        fileKey: 'output-1',
        path: 'project/result.mml',
        fileName: 'result.mml',
        relativePath: 'result.mml',
        nodeType: 'file',
        source: 'project',
        groupId: 'project',
        writable: true,
        addedAt: 20
      }
    ])
    expect(sessions[0]?.workspaceFiles).toEqual(files)
  })

  it('stores plan versions and switches to build when approved', async () => {
    const store = new SQLiteAgentSessionStore({
      dbPath: join(tempDir, 'session-plan.db')
    })
    stores.push(store)

    const session = await store.createSession(USER_ID, 'workspace-agent', 'Session Plan')
    const saved = await store.savePlan({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: session.sessionId,
      draft: {
        title: 'Plan Title',
        summary: 'Plan Summary',
        goal: 'Plan Goal',
        steps: ['Step 1'],
        approvedSkillIds: ['skill-a'],
        skillsReasoning: ['Need skill-a'],
        risks: ['Risk 1'],
        openQuestions: ['Question 1'],
        markdown: '# Plan Title\n',
        filePath: 'plans/agent/session/v1-plan-title.md'
      }
    })

    expect(saved.version).toBe(1)
    expect(saved.status).toBe('awaiting_approval')

    await expect(store.decidePlan({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: session.sessionId,
      decision: 'approve',
      planId: saved.planId
    })).rejects.toThrow('Plan still has unresolved planning questions.')
  })

  it('approves a plan without open questions and switches to build', async () => {
    const store = new SQLiteAgentSessionStore({
      dbPath: join(tempDir, 'session-approve.db')
    })
    stores.push(store)
    const session = await store.createSession(USER_ID, 'workspace-agent', 'Approval clear')
    const saved = await store.savePlan({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: session.sessionId,
      draft: {
        title: 'Plan Title',
        summary: 'Plan Summary',
        goal: 'Plan Goal',
        steps: ['Step 1'],
        approvedSkillIds: ['skill-a'],
        skillsReasoning: ['Need skill-a'],
        risks: ['Risk 1'],
        openQuestions: [],
        markdown: '# Plan Title\n',
        filePath: 'plans/agent/session/v1-plan-title.md'
      }
    })

    const decided = await store.decidePlan({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: session.sessionId,
      decision: 'approve',
      planId: saved.planId
    })

    expect(decided.plan.status).toBe('approved')
    expect(decided.session.activePrimaryAgent).toBe('build')
    expect(decided.session.planState?.planId).toBe(saved.planId)
  })

  it('keeps the session in planner mode when revising a plan', async () => {
    const store = new SQLiteAgentSessionStore({
      dbPath: join(tempDir, 'session-revise.db')
    })
    stores.push(store)
    const session = await store.createSession(USER_ID, 'workspace-agent', 'Revise plan')
    const saved = await store.savePlan({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: session.sessionId,
      draft: {
        title: 'Plan Title',
        summary: 'Plan Summary',
        goal: 'Plan Goal',
        steps: ['Step 1'],
        approvedSkillIds: ['skill-a'],
        skillsReasoning: ['Need skill-a'],
        risks: ['Risk 1'],
        openQuestions: [],
        markdown: '# Plan Title\n',
        filePath: 'plans/agent/session/v1-plan-title.md'
      }
    })

    const decided = await store.decidePlan({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: session.sessionId,
      decision: 'revise',
      planId: saved.planId
    })

    expect(decided.plan.status).toBe('draft')
    expect(decided.session.activePrimaryAgent).toBe('plan')
    expect(decided.session.planState?.status).toBe('draft')
    expect(decided.session.planState?.planId).toBe(saved.planId)
  })

  it('stores and retrieves session summaries', async () => {
    const store = new SQLiteAgentSessionStore({
      dbPath: join(tempDir, 'session-summary.db')
    })
    stores.push(store)

    await store.upsertSummary({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-summary',
      summary: 'Summary text',
      coveredUntil: Date.now()
    })

    const summary = await store.getSummary({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-summary'
    })

    expect(summary?.summary).toBe('Summary text')
  })

  it('deletes session metadata, messages, and summaries', async () => {
    const store = new SQLiteAgentSessionStore({
      dbPath: join(tempDir, 'session-delete.db')
    })
    stores.push(store)

    const AGENT_ID = 'agent-1'
    const MESSAGE_TEXT = 'hello'
    const SUMMARY_TEXT = 'Summary text'
    const ZERO = 0

    const session = await store.createSession(USER_ID, AGENT_ID, 'Session Delete')
    await store.appendMessage({
      userId: USER_ID,
      agentId: AGENT_ID,
      sessionId: session.sessionId,
      message: createMessage('user', [{ type: 'text', text: MESSAGE_TEXT }])
    })
    await store.upsertSummary({
      userId: USER_ID,
      agentId: AGENT_ID,
      sessionId: session.sessionId,
      summary: SUMMARY_TEXT,
      coveredUntil: Date.now()
    })

    const deleted = await store.deleteSession(USER_ID, AGENT_ID, session.sessionId)
    const sessions = await store.listSessions(USER_ID, AGENT_ID)
    const messages = await store.listMessages({
      userId: USER_ID,
      agentId: AGENT_ID,
      sessionId: session.sessionId
    })
    const summary = await store.getSummary({
      userId: USER_ID,
      agentId: AGENT_ID,
      sessionId: session.sessionId
    })

    expect(deleted).toBe(true)
    expect(sessions).toHaveLength(ZERO)
    expect(messages).toHaveLength(ZERO)
    expect(summary).toBeNull()
  })

  it('tracks tombstoned session ids and rejects stale session-scoped writes', async () => {
    const store = new SQLiteAgentSessionStore({
      dbPath: join(tempDir, 'session-delete-tombstone.db')
    })
    stores.push(store)

    const agentId = 'agent-1'
    const session = await store.createSession(USER_ID, agentId, 'Delete Guard')
    const messageId = await store.appendMessage({
      userId: USER_ID,
      agentId,
      sessionId: session.sessionId,
      message: createMessage('assistant', [{ type: 'text', text: 'existing message' }])
    })

    await store.markSessionDeleted({
      userId: USER_ID,
      agentId,
      sessionId: session.sessionId
    })

    await expect(store.isSessionDeleted({
      userId: USER_ID,
      agentId,
      sessionId: session.sessionId
    })).resolves.toBe(true)

    const writeAttempts = [
      () => store.appendMessage({
        userId: USER_ID,
        agentId,
        sessionId: session.sessionId,
        message: createMessage('user', [{ type: 'text', text: 'late message' }])
      }),
      () => store.upsertSummary({
        userId: USER_ID,
        agentId,
        sessionId: session.sessionId,
        summary: 'late summary',
        coveredUntil: Date.now()
      }),
      () => store.savePlan({
        userId: USER_ID,
        agentId,
        sessionId: session.sessionId,
        draft: {
          title: 'Late plan',
          summary: 'late summary',
          goal: 'late goal',
          steps: ['late step'],
          approvedSkillIds: [],
          skillsReasoning: [],
          risks: [],
          openQuestions: [],
          markdown: '# late',
          filePath: 'plans/late.md'
        }
      }),
      () => store.createInteraction({
        userId: USER_ID,
        agentId,
        sessionId: session.sessionId,
        runId: 'run-late',
        kind: 'question',
        payload: buildQuestionInteractionPayload({
          id: 'late-question',
          prompt: 'late?',
          fields: [{ id: 'answer', label: 'Answer', type: 'text' }]
        })
      }),
      () => store.updateSessionMeta({
        userId: USER_ID,
        agentId,
        sessionId: session.sessionId,
        meta: {
          activePrimaryAgent: 'build',
          planState: null,
          workspaceFiles: []
        }
      }),
      () => store.updateMessageProtocolState({
        userId: USER_ID,
        agentId,
        sessionId: session.sessionId,
        messageId,
        protocolState: { step: 'late' }
      })
    ]

    for (const writeAttempt of writeAttempts) {
      await expect(writeAttempt()).rejects.toBeInstanceOf(DeletedSessionWriteError)
    }
  })

  it('keeps deleted sessions tombstoned so stale writes cannot resurrect them', async () => {
    const store = new SQLiteAgentSessionStore({
      dbPath: join(tempDir, 'session-delete-no-resurrection.db')
    })
    stores.push(store)

    const agentId = 'agent-1'
    const session = await store.createSession(USER_ID, agentId, 'Delete Me')
    await store.appendMessage({
      userId: USER_ID,
      agentId,
      sessionId: session.sessionId,
      message: createMessage('user', [{ type: 'text', text: 'before delete' }])
    })

    await expect(store.deleteSession(USER_ID, agentId, session.sessionId)).resolves.toBe(true)
    await expect(store.isSessionDeleted({
      userId: USER_ID,
      agentId,
      sessionId: session.sessionId
    })).resolves.toBe(true)
    await expect(store.appendMessage({
      userId: USER_ID,
      agentId,
      sessionId: session.sessionId,
      message: createMessage('assistant', [{ type: 'text', text: 'late write' }])
    })).rejects.toBeInstanceOf(DeletedSessionWriteError)

    await expect(store.listSessions(USER_ID, agentId)).resolves.toHaveLength(0)
    await expect(store.getSessionMeta({
      userId: USER_ID,
      agentId,
      sessionId: session.sessionId
    })).resolves.toBeNull()
    await expect(store.listMessages({
      userId: USER_ID,
      agentId,
      sessionId: session.sessionId
    })).resolves.toHaveLength(0)
  })

  it('clears historical sessions while preserving the excluded current session', async () => {
    const store = new SQLiteAgentSessionStore({
      dbPath: join(tempDir, 'session-clear-excluded.db')
    })
    stores.push(store)

    const currentSession = await store.createSession(USER_ID, 'workspace-agent', 'Current')
    const historySession = await store.createSession(USER_ID, 'workspace-agent', 'History')

    await store.appendMessage({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: historySession.sessionId,
      message: createMessage('user', [{ type: 'text', text: 'old message' }])
    })
    await store.upsertSummary({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: historySession.sessionId,
      summary: 'Old summary',
      coveredUntil: Date.now()
    })
    await store.savePlan({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: historySession.sessionId,
      draft: {
        title: 'History plan',
        summary: 'History plan summary',
        goal: 'Clear history',
        steps: ['Remove old session'],
        approvedSkillIds: [],
        skillsReasoning: [],
        risks: [],
        openQuestions: [],
        markdown: '# History plan',
        filePath: 'plans/agent/history/v1.md'
      }
    })
    await store.createInteraction({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: historySession.sessionId,
      runId: 'run-history',
      kind: 'question',
      payload: buildQuestionInteractionPayload({
        id: 'history-question',
        prompt: '需要保留吗？',
        fields: [{ id: 'keep', label: '是否保留', type: 'text' }]
      })
    })

    const deletedCount = await store.clearHistorySessions(USER_ID, 'workspace-agent', [currentSession.sessionId])
    const sessions = await store.listSessions(USER_ID, 'workspace-agent')
    const messages = await store.listMessages({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: historySession.sessionId
    })
    const summary = await store.getSummary({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: historySession.sessionId
    })
    const plan = await store.getLatestPlan({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: historySession.sessionId
    })
    const interactions = await store.listInteractions({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: historySession.sessionId
    })

    expect(deletedCount).toBe(1)
    expect(sessions.map(session => session.sessionId)).toEqual([currentSession.sessionId])
    expect(messages).toHaveLength(0)
    expect(summary).toBeNull()
    expect(plan).toBeNull()
    expect(interactions).toHaveLength(0)
  })

  it('clears all persisted sessions when no exclusion is provided', async () => {
    const store = new SQLiteAgentSessionStore({
      dbPath: join(tempDir, 'session-clear-all.db')
    })
    stores.push(store)

    const first = await store.createSession(USER_ID, 'workspace-agent', 'First')
    const second = await store.createSession(USER_ID, 'workspace-agent', 'Second')

    const deletedCount = await store.clearHistorySessions(USER_ID, 'workspace-agent')
    const sessions = await store.listSessions(USER_ID, 'workspace-agent')

    expect(deletedCount).toBe(2)
    expect(sessions).toHaveLength(0)
    await expect(store.getSessionMeta({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: first.sessionId
    })).resolves.toBeNull()
    await expect(store.getSessionMeta({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: second.sessionId
    })).resolves.toBeNull()
  })

  it('rewrites the last editable user message and clears overlapping derived state', async () => {
    const nowSpy = vi.spyOn(Date, 'now')
    let now = 10
    nowSpy.mockImplementation(() => now)

    const store = new SQLiteAgentSessionStore({
      dbPath: join(tempDir, 'session-rewrite.db')
    })
    stores.push(store)

    const session = await store.createSession(USER_ID, 'workspace-agent', 'Rewrite Session')
    await store.replaceWorkspaceFiles({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: session.sessionId,
      files: [{
        nodeId: 'output-1',
        fileId: 'output-1',
        fileKey: 'output-1',
        path: 'project/result.md',
        fileName: 'result.md',
        relativePath: 'result.md',
        nodeType: 'file',
        source: 'project',
        groupId: 'project',
        writable: true,
        addedAt: 9
      }]
    })

    now = 20
    const preservedPlan = await store.savePlan({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: session.sessionId,
      draft: {
        title: 'Preserved plan',
        summary: 'Keep me',
        goal: 'Old goal',
        steps: ['Step 1'],
        approvedSkillIds: [],
        skillsReasoning: [],
        risks: [],
        openQuestions: [],
        markdown: '# Preserved plan',
        filePath: 'plans/agent/session-edit/v1.md'
      }
    })

    await store.appendMessage({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: session.sessionId,
      message: createMessage('user', [{ type: 'text', text: '第一条消息' }], 30)
    })
    await store.appendMessage({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: session.sessionId,
      message: createMessage('assistant', [{ type: 'text', text: '第一条回复' }], 31)
    })
    const targetMessageId = await store.appendMessage({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: session.sessionId,
      message: createMessage('user', [{ type: 'text', text: '需要被替换的最后一条用户消息' }], 40)
    })
    await store.appendMessage({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: session.sessionId,
      message: createMessage('assistant', [{ type: 'text', text: '旧尾部回复' }], 41)
    })

    now = 50
    await store.upsertSummary({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: session.sessionId,
      summary: '过期摘要',
      coveredUntil: 41
    })
    now = 60
    const interaction = await store.createInteraction({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: session.sessionId,
      runId: 'run-tail',
      kind: 'question',
      payload: buildQuestionInteractionPayload({
        id: 'tail-question',
        prompt: '是否继续？',
        fields: [{ id: 'answer', label: '回答', type: 'text' }]
      })
    })
    now = 61
    await store.resolveInteraction({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: session.sessionId,
      interactionId: interaction.interactionId,
      status: 'rejected',
      continuationContext: buildRejectContinuationContext(interaction)
    })
    now = 70
    const discardedPlan = await store.savePlan({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: session.sessionId,
      draft: {
        title: 'Discarded plan',
        summary: 'Drop me',
        goal: 'New goal',
        steps: ['Step 2'],
        approvedSkillIds: [],
        skillsReasoning: [],
        risks: [],
        openQuestions: [],
        markdown: '# Discarded plan',
        filePath: 'plans/agent/session-edit/v2.md'
      }
    })

    now = 80
    await store.rewriteSessionFromMessage({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: session.sessionId,
      messageId: targetMessageId
    })

    const messages = await store.listMessages({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: session.sessionId
    })
    const summary = await store.getSummary({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: session.sessionId
    })
    const interactions = await store.listInteractions({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: session.sessionId
    })
    const latestPlan = await store.getLatestPlan({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: session.sessionId
    })
    const meta = await store.getSessionMeta({
      userId: USER_ID,
      agentId: 'workspace-agent',
      sessionId: session.sessionId
    })

    expect(messages).toHaveLength(2)
    expect(messages.map(message => message.parts[0]?.type === 'text' ? message.parts[0].text : null)).toEqual([
      '第一条消息',
      '第一条回复'
    ])
    expect(summary).toBeNull()
    expect(interactions).toEqual([])
    expect(latestPlan?.planId).toBe(preservedPlan.planId)
    expect(latestPlan?.planId).not.toBe(discardedPlan.planId)
    expect(meta).toMatchObject({
      messageCount: 2,
      workspaceFiles: [{
        fileKey: 'output-1',
        path: 'project/result.md'
      }],
      planState: {
        planId: preservedPlan.planId
      }
    })
  })

  it('returns protocol views and skips tool-only messages', async () => {
    const store = new SQLiteAgentSessionStore({
      dbPath: join(tempDir, 'session-view.db')
    })
    stores.push(store)

    const agentId = 'agent-1'
    const sessionId = 'session-view'
    const protocolPayload = JSON.stringify({
      version: '1.0',
      components: [{ type: 'text', id: 'content', content: 'hello' }],
      actions: []
    })
    const EXPECTED_COUNT = 2
    const VIEW_USER_INDEX = 0
    const VIEW_ASSISTANT_INDEX = 1

    await store.appendMessage({
      userId: USER_ID,
      agentId,
      sessionId,
      message: createMessage('assistant', [
        {
          type: 'tool',
          id: 'tool-1',
          name: 'local:question',
          input: {},
          status: 'success',
          output: '{"success":true}'
        }
      ])
    })
    await store.appendMessage({
      userId: USER_ID,
      agentId,
      sessionId,
      message: createMessage('user', [{ type: 'text', text: 'hi' }])
    })
    await store.appendMessage({
      userId: USER_ID,
      agentId,
      sessionId,
      message: createMessage('assistant', [{ type: 'text', text: protocolPayload }])
    })

    const viewsResult = await store.getSessionMessagesView({ userId: USER_ID, agentId, sessionId })
    const views = viewsResult.messages

    expect(views).toHaveLength(EXPECTED_COUNT)
    expect(views[VIEW_USER_INDEX]?.kind).toBe('text')
    expect(views[VIEW_ASSISTANT_INDEX]?.kind).toBe('protocol')
    expect(views[VIEW_ASSISTANT_INDEX]?.protocol).toMatchObject({ version: '1.0' })
  })

  it('prefers structured protocol parts over raw text parsing for session views', async () => {
    const store = new SQLiteAgentSessionStore({
      dbPath: join(tempDir, 'session-structured-protocol-view.db')
    })
    stores.push(store)

    await store.appendMessage({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-structured-protocol',
      message: createMessage('assistant', [
        { type: 'text', text: '需要补充信息后才能继续。' },
        {
          type: 'structured',
          kind: 'protocol',
          protocol: {
            version: '1.0',
            components: [{ type: 'form', id: 'question-form-1', fields: [] }],
            actions: []
          }
        }
      ])
    })

    const viewsResult = await store.getSessionMessagesView({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-structured-protocol'
    })

    expect(viewsResult.messages[0]).toMatchObject({
      text: '需要补充信息后才能继续。',
      kind: 'protocol',
      protocol: {
        version: '1.0',
        components: [expect.objectContaining({ type: 'form' })]
      }
    })
  })

  it('persists protocol state for session message views', async () => {
    const store = new SQLiteAgentSessionStore({
      dbPath: join(tempDir, 'session-protocol-state.db')
    })
    stores.push(store)

    const agentId = 'agent-1'
    const sessionId = 'session-protocol-state'
    const messageId = await store.appendMessage({
      userId: USER_ID,
      agentId,
      sessionId,
      message: createMessage('assistant', [{
        type: 'text',
        text: JSON.stringify({
          version: '1.0',
          components: [{ type: 'text', id: 'content', content: 'hello' }],
          actions: []
        })
      }])
    })

    await store.updateMessageProtocolState({
      userId: USER_ID,
      agentId,
      sessionId,
      messageId,
      protocolState: {
        lastActionId: 'submit-question',
        note: '问题已提交',
        form: {
          'question-form-1': {
            task: '提取指标'
          }
        },
        listSelection: {
          choices: ['item-1']
        },
        table: {
          'table-1': {
            columns: [{ id: 'name', label: '名称', editable: false }],
            rows: [{ name: 'alpha' }]
          }
        },
        message: {
          version: '1.0',
          components: [{ type: 'text', id: 'status', content: '问题已提交' }],
          actions: []
        }
      }
    })

    const viewsResult = await store.getSessionMessagesView({ userId: USER_ID, agentId, sessionId })

    expect(viewsResult.messages[0]).toMatchObject({
      kind: 'protocol',
      protocolState: {
        lastActionId: 'submit-question',
        note: '问题已提交',
        form: {
          'question-form-1': {
            task: '提取指标'
          }
        },
        listSelection: {
          choices: ['item-1']
        },
        table: {
          'table-1': {
            rows: [{ name: 'alpha' }]
          }
        },
        message: {
          version: '1.0',
          components: [{ type: 'text', id: 'status', content: '问题已提交' }],
          actions: []
        }
      }
    })
  })

  it('returns structured result views for persisted skill outputs', async () => {
    const store = new SQLiteAgentSessionStore({
      dbPath: join(tempDir, 'session-result-view.db')
    })
    stores.push(store)

    const agentId = 'agent-1'
    const sessionId = 'session-result-view'
    await store.appendMessage({
      userId: USER_ID,
      agentId,
      sessionId,
      message: createMessage('assistant', [{
        type: 'text',
        text: JSON.stringify({
          kind: 'rows_result',
          data: {
            columns: ['name'],
            rows: [{ name: 'foo' }]
          }
        })
      }])
    })

    const viewsResult = await store.getSessionMessagesView({ userId: USER_ID, agentId, sessionId })

    expect(viewsResult.messages[0]).toMatchObject({
      kind: 'result',
      domainResult: {
        kind: 'rows_result',
        data: {
          columns: ['name'],
          rows: [{ name: 'foo' }]
        }
      }
    })
  })

  it('prefers structured domain-result parts over raw text parsing for session views', async () => {
    const store = new SQLiteAgentSessionStore({
      dbPath: join(tempDir, 'session-structured-result-view.db')
    })
    stores.push(store)

    await store.appendMessage({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-structured-result',
      message: createMessage('assistant', [
        { type: 'text', text: '已生成产物：artifact-1。' },
        {
          type: 'structured',
          kind: 'domain-result',
          domainResult: {
            kind: 'artifact_ref',
            data: {
              fileId: 'artifact-1'
            }
          }
        }
      ])
    })

    const viewsResult = await store.getSessionMessagesView({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-structured-result'
    })

    expect(viewsResult.messages[0]).toMatchObject({
      text: '已生成产物：artifact-1。',
      kind: 'result',
      domainResult: {
        kind: 'artifact_ref',
        data: {
          fileId: 'artifact-1'
        }
      }
    })
  })

  it('persists question interactions and restores them across store instances', async () => {
    const dbPath = join(tempDir, 'session-interactions.db')
    const writer = new SQLiteAgentSessionStore({ dbPath })
    stores.push(writer)

    const created = await writer.createInteraction({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-interactions',
      runId: 'run-1',
      kind: 'question',
      payload: buildQuestionInteractionPayload({
        id: 'question-1',
        prompt: '请选择模式',
        options: [
          { label: 'A', value: 'A' },
          { label: 'B', value: 'B' }
        ]
      })
    })

    const resolved = await writer.resolveInteraction({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-interactions',
      interactionId: created.interactionId,
      status: 'answered',
      answer: { answer: 'A' },
      continuationContext: buildAnswerContinuationContext(created, { answer: 'A' })
    })

    writer.close()
    stores = stores.filter(store => store !== writer)

    const reader = new SQLiteAgentSessionStore({ dbPath })
    stores.push(reader)
    const pending = await reader.listInteractions({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-interactions',
      statuses: ['pending']
    })
    const answered = await reader.listInteractions({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-interactions',
      statuses: ['answered']
    })

    expect(pending).toEqual([])
    expect(answered[0]).toMatchObject({
      interactionId: created.interactionId,
      status: 'answered',
      answer: { answer: 'A' },
      continuationContext: resolved.continuationContext
    })
    const messages = await reader.listMessages({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-interactions'
    })
    expect(messages.at(-1)).toMatchObject({
      role: 'user',
      parts: [{
        type: 'text',
        text: expect.stringContaining(`[INTERACTION CONTEXT]
interaction_id: ${created.interactionId}`)
      }]
    })
  })

  it('persists rejected question interactions as canonical user messages', async () => {
    const store = new SQLiteAgentSessionStore({
      dbPath: join(tempDir, 'session-interactions-reject.db')
    })
    stores.push(store)

    const created = await store.createInteraction({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-interactions-reject',
      runId: 'run-1',
      kind: 'question',
      payload: buildQuestionInteractionPayload({
        id: 'question-reject-1',
        prompt: '请选择模式',
        fields: [{ id: 'answer', label: '回答', type: 'text' }]
      })
    })

    await store.resolveInteraction({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-interactions-reject',
      interactionId: created.interactionId,
      status: 'rejected',
      continuationContext: buildRejectContinuationContext(created)
    })

    const messages = await store.listMessages({
      userId: USER_ID,
      agentId: 'agent-1',
      sessionId: 'session-interactions-reject'
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      role: 'user',
      parts: [{
        type: 'text',
        text: expect.stringContaining('status: rejected')
      }]
    })
  })
})
