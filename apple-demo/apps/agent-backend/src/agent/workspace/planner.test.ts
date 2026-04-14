import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SQLiteAgentSessionStore } from '../sessionStore.js'
import { executePlanPhase } from './planner.js'
import { buildAwaitingInteractionToolSummary } from '../interactions.js'
import type { AgentRunRequest, AgentSkill } from '../types.js'
import type { AgentExecutionCatalog } from '../../agents/service.js'
import { createProvider } from '../agentLoopTestUtils.js'
import {
  attachRuntimeLogSink,
  resetRuntimeLoggingForTests,
  type RuntimeLogEntry,
  type RuntimeLogSink
} from '../../logging/index.js'

const TEST_USER_ID = 1
const AGENT_ID = 'workspace-agent'

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

const EXECUTION_CATALOG: AgentExecutionCatalog = {
  agent: {
    id: AGENT_ID,
    name: 'Workspace Agent',
    description: 'Plan-first agent',
    version: '1.0.0',
    instructions: 'Plan first.',
    contextTemplate: 'Question rules.'
  },
  skills: [{
    id: 'sheet-analyzer',
    name: 'Sheet Analyzer',
    description: 'Analyze worksheet data',
    instructions: 'Analyze data'
  } satisfies AgentSkill]
}

const CANDIDATE_SKILL_CATALOG: AgentExecutionCatalog = {
  agent: EXECUTION_CATALOG.agent,
  skills: [
    {
      id: 'sheet-analyzer',
      name: 'Sheet Analyzer',
      description: 'Analyze worksheet data',
      instructions: 'Analyze data'
    },
    {
      id: 'mml-cli',
      name: 'mml-cli',
      description: '查询存量网元 MML 脚本、按网元类型和版本查询命令参数含义、校验 MML 命令是否正确。',
      instructions: 'Query MML files and validate commands.'
    },
    {
      id: 'table-writer',
      name: 'Table Writer',
      description: 'Generate spreadsheet summaries',
      instructions: 'Write tables.'
    }
  ]
}

function createRequest(sessionId: string, input: string): AgentRunRequest {
  return {
    runId: `${sessionId}-run`,
    userId: TEST_USER_ID,
    agentId: AGENT_ID,
    sessionId,
    input,
    model: {
      provider: 'openai',
      modelName: 'gpt-4o-mini',
      apiKey: 'test-key'
    }
  }
}

describe('executePlanPhase', () => {
  let tempDir = ''
  let sessionStore: SQLiteAgentSessionStore

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'workspace-plan-phase-'))
    sessionStore = new SQLiteAgentSessionStore({ dbPath: join(tempDir, 'session.db') })
    resetRuntimeLoggingForTests()
  })

  afterEach(async () => {
    resetRuntimeLoggingForTests()
    sessionStore.close()
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('persists a plan when the planner returns valid JSON', async () => {
    const session = await sessionStore.createSession(TEST_USER_ID, AGENT_ID, 'plan-phase')
    const result = await executePlanPhase({
      providerClient: createProvider([{
        text: JSON.stringify({
          title: '澄清需求',
          summary: '当前信息不足，需要先明确任务目标。',
          goal: '确认用户想完成的任务、输入数据和期望结果。',
          steps: [
            '询问用户希望完成的具体任务。',
            '等待用户补充任务、输入和期望结果后，再生成可执行计划。'
          ],
          approvedSkillIds: [],
          skillsReasoning: [],
          risks: ['当前无法直接进入执行阶段。'],
          openQuestions: ['你希望我帮你做什么？请补充任务、输入和期望结果。']
        })
      }]) as any,
      toolRegistry: {
        catalog: () => ({ ok: true, tools: [] }),
        invoke: vi.fn()
      },
      sessionStore,
      workspaceDir: tempDir,
      request: createRequest(session.sessionId, '你好'),
      executionCatalog: EXECUTION_CATALOG,
      signal: new AbortController().signal,
      trace: { runId: 'run-1', turnId: 'turn-1' },
      emit: () => {}
    })

    expect(result.protocol.components).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'plan-title' }),
      expect.objectContaining({ id: 'plan-risks' }),
      expect.objectContaining({ id: 'plan-open-questions' })
    ]))
    const planComponents = result.protocol.components as Array<{ id: string; items?: Array<{ title: string }> }>
    const riskComponent = planComponents.find(component => component.id === 'plan-risks')
    const questionComponent = planComponents.find(component => component.id === 'plan-open-questions')
    expect(riskComponent?.items?.map(item => item.title)).toEqual(['当前无法直接进入执行阶段。'])
    expect(questionComponent?.items?.map(item => item.title)).toEqual(['你希望我帮你做什么？请补充任务、输入和期望结果。'])
    const latestPlan = await sessionStore.getLatestPlan({
      userId: TEST_USER_ID,
      agentId: AGENT_ID,
      sessionId: session.sessionId
    })
    expect(latestPlan?.title).toBe('澄清需求')
    expect(latestPlan?.openQuestions).toContain('你希望我帮你做什么？请补充任务、输入和期望结果。')
  })

  it('logs and rethrows planner JSON parse failures with semantic messaging', async () => {
    const session = await sessionStore.createSession(TEST_USER_ID, AGENT_ID, 'plan-error')
    const logs = captureRuntimeLogs()

    await expect(executePlanPhase({
      providerClient: createProvider([{ text: '{title:"bad"}' }]) as any,
      toolRegistry: {
        catalog: () => ({ ok: true, tools: [] }),
        invoke: vi.fn()
      },
      sessionStore,
      workspaceDir: tempDir,
      request: createRequest(session.sessionId, '你好'),
      executionCatalog: EXECUTION_CATALOG,
      signal: new AbortController().signal,
      trace: { runId: 'run-2', turnId: 'turn-1' },
      emit: () => {}
    })).rejects.toThrow(/规划器返回了非法 JSON/)

    expect(logs.some(entry => (
      entry.component === 'planner'
      && entry.message === 'planner parse failure'
    ))).toBe(true)
  })

  it('returns awaiting interaction without persisting a plan', async () => {
    const session = await sessionStore.createSession(TEST_USER_ID, AGENT_ID, 'plan-question')
    const interaction = {
      interactionId: 'planner-interaction-1',
      runId: 'run-3',
      kind: 'question' as const,
      status: 'pending' as const,
      payload: {
        questionId: 'question-1',
        title: '补充信息',
        prompt: '你希望我帮你做什么？',
        required: true,
        fields: [{
          type: 'text' as const,
          id: 'task',
          label: '任务'
        }]
      },
      createdAt: 10,
      resolvedAt: null
    }
    const events: Array<Record<string, unknown>> = []

    const result = await executePlanPhase({
      providerClient: createProvider([{
        text: '',
        toolCalls: [{
          id: 'tool-question-1',
          name: 'local:question',
          input: {
            id: 'question-1',
            title: '补充信息',
            prompt: '你希望我帮你做什么？',
            required: true,
            fields: [{
              type: 'text',
              id: 'task',
              label: '任务'
            }]
          }
        }]
      }]) as any,
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
        invoke: vi.fn(async () => ({
          ok: true as const,
          requestId: 'req-question',
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
        }))
      },
      sessionStore,
      workspaceDir: tempDir,
      request: createRequest(session.sessionId, '你好'),
      executionCatalog: EXECUTION_CATALOG,
      signal: new AbortController().signal,
      trace: { runId: 'run-3', turnId: 'turn-1' },
      emit: event => events.push(event as unknown as Record<string, unknown>)
    })

    expect(result.awaitingInteraction).toMatchObject(interaction)
    expect(result.protocol).toBeUndefined()
    expect(result.toolMetrics).toHaveLength(1)
    const latestPlan = await sessionStore.getLatestPlan({
      userId: TEST_USER_ID,
      agentId: AGENT_ID,
      sessionId: session.sessionId
    })
    expect(latestPlan).toBeNull()
    expect(events.some(event => event.type === 'plan.awaiting_decision')).toBe(false)
    expect(events).toContainEqual(expect.objectContaining({
      type: 'tool.started',
      tool: 'local:question',
      toolCallId: 'tool-question-1',
      displayName: 'question',
      toolKind: 'tool'
    }))
  })

  it('only exposes planner-safe tools and can use read plus skill tools before drafting', async () => {
    const session = await sessionStore.createSession(TEST_USER_ID, AGENT_ID, 'plan-tools')
    const seenToolIds: string[][] = []
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true as const,
        requestId: 'req-find',
        result: {
          tool: 'local:find_files',
          summary: '{"success":true,"matches":["docs/spec.md"]}',
          operations: [],
          meta: {
            server: 'local',
            tool: 'find_files',
            latencyMs: 1,
            inputChars: 10,
            operationsChars: 0,
            summaryChars: 40
          }
        }
      })
      .mockResolvedValueOnce({
        ok: true as const,
        requestId: 'req-skill',
        result: {
          tool: 'skill:skill',
          summary: '<skill_content name="Sheet Analyzer">Analyze data</skill_content>',
          operations: [],
          meta: {
            server: 'skill',
            tool: 'skill',
            latencyMs: 1,
            inputChars: 10,
            operationsChars: 0,
            summaryChars: 64
          }
        }
      })

    const providerClient = {
      async completeWithTools(request: { tools: Array<{ id: string }> }) {
        seenToolIds.push(request.tools.map(tool => tool.id))
        if (seenToolIds.length === 1) {
          return {
            text: '先找相关文档和技能说明。',
            toolCalls: [{
              id: 'tool-find-1',
              name: 'local:find_files',
              input: { pattern: 'spec.md' }
            }],
            metrics: {
              provider: 'openai' as const,
              modelName: 'gpt-4o-mini',
              latencyMs: 1,
              inputTokens: 1,
              outputTokens: 1,
              totalTokens: 2,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              finishReason: 'stop'
            }
          }
        }
        if (seenToolIds.length === 2) {
          return {
            text: '',
            toolCalls: [{
              id: 'tool-skill-1',
              name: 'skill:skill',
              input: { name: 'sheet-analyzer' }
            }],
            metrics: {
              provider: 'openai' as const,
              modelName: 'gpt-4o-mini',
              latencyMs: 1,
              inputTokens: 1,
              outputTokens: 1,
              totalTokens: 2,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              finishReason: 'stop'
            }
          }
        }
        return {
          text: JSON.stringify({
            title: '分析工作表',
            summary: '先阅读说明，再执行分析。',
            goal: '确认输入并调用正确技能。',
            steps: ['阅读相关说明文件。', '加载技能说明。', '等待用户批准后执行。'],
            approvedSkillIds: ['sheet-analyzer'],
            skillsReasoning: ['该技能负责分析工作表数据。'],
            risks: [],
            openQuestions: []
          }),
          toolCalls: [],
          metrics: {
            provider: 'openai' as const,
            modelName: 'gpt-4o-mini',
            latencyMs: 1,
            inputTokens: 1,
            outputTokens: 1,
            totalTokens: 2,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            finishReason: 'stop'
          }
        }
      }
    }

    const result = await executePlanPhase({
      providerClient: providerClient as any,
      toolRegistry: {
        catalog: () => ({
          ok: true,
          tools: [
            { id: 'local:question', server: 'local', name: 'question', description: 'Ask a question' },
            { id: 'local:read_file', server: 'local', name: 'read_file', description: 'Read a file' },
            { id: 'local:find_files', server: 'local', name: 'find_files', description: 'Find files' },
            { id: 'skill:skill', server: 'skill', name: 'skill', description: 'Load a skill' },
            { id: 'skill:read_asset', server: 'skill', name: 'read_asset', description: 'Read skill assets' },
            { id: 'skill:list_assets', server: 'skill', name: 'list_assets', description: 'List skill assets' },
            { id: 'skill:find_assets', server: 'skill', name: 'find_assets', description: 'Find skill assets' },
            { id: 'skill:exec', server: 'skill', name: 'exec', description: 'Execute governed scripts' }
          ]
        }),
        invoke
      },
      sessionStore,
      workspaceDir: tempDir,
      request: createRequest(session.sessionId, '分析一下'),
      executionCatalog: EXECUTION_CATALOG,
      signal: new AbortController().signal,
      trace: { runId: 'run-4', turnId: 'turn-1' },
      emit: () => {}
    })

    expect(seenToolIds[0]).toEqual([
      'local:question',
      'local:read_file',
      'local:find_files',
      'skill:skill'
    ])
    expect(invoke).toHaveBeenNthCalledWith(1, expect.objectContaining({
      tool: 'local:find_files'
    }))
    expect(invoke).toHaveBeenNthCalledWith(2, expect.objectContaining({
      tool: 'skill:skill',
      args: { name: 'sheet-analyzer' }
    }))
    expect(result.protocol.components).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'plan-title' })
    ]))
  })

  it.each([
    '读取存量mml配置',
    'read mml config',
    '查询mml命令'
  ])('includes mml-cli in planner candidates for "%s"', async input => {
    const session = await sessionStore.createSession(TEST_USER_ID, AGENT_ID, 'plan-candidates')
    const events: Array<Record<string, unknown>> = []

    await executePlanPhase({
      providerClient: createProvider([{
        text: JSON.stringify({
          title: '检查候选技能',
          summary: '验证 planner 候选技能筛选。',
          goal: '确认相关技能能进入候选列表。',
          steps: ['检查候选技能。'],
          approvedSkillIds: [],
          skillsReasoning: [],
          risks: [],
          openQuestions: []
        })
      }]) as any,
      toolRegistry: {
        catalog: () => ({ ok: true, tools: [] }),
        invoke: vi.fn()
      },
      sessionStore,
      workspaceDir: tempDir,
      request: createRequest(session.sessionId, input),
      executionCatalog: CANDIDATE_SKILL_CATALOG,
      signal: new AbortController().signal,
      trace: { runId: `run-${input}`, turnId: 'turn-1' },
      emit: event => events.push(event as unknown as Record<string, unknown>)
    })

    const candidateEvent = events.find(event => event.type === 'plan.delegation' && event.subagent === 'explore')
    expect(candidateEvent).toBeTruthy()
    expect(candidateEvent?.data).toEqual(expect.objectContaining({
      candidateSkillIds: expect.arrayContaining(['mml-cli'])
    }))
  })
})
