import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/agentApi', () => ({
  agentApi: {
    listAgents: vi.fn(),
    getAgent: vi.fn(),
    bootstrap: vi.fn(),
    listSessions: vi.fn(),
    createSession: vi.fn(),
    deleteSession: vi.fn(),
    clearHistorySessions: vi.fn(),
    getSessionUsageSummary: vi.fn(),
    getSessionMessages: vi.fn(),
    listSessionInteractions: vi.fn(),
    replySessionInteraction: vi.fn(),
    rejectSessionInteraction: vi.fn(),
    cancelRun: vi.fn(),
    updateProtocolState: vi.fn(),
    decidePlan: vi.fn(),
    getWorkspace: vi.fn(),
    getSessionWorkspace: vi.fn(),
    replaceSessionWorkspace: vi.fn(),
    runStream: vi.fn(),
    uploadFile: vi.fn(),
    createProjectEntry: vi.fn(),
    renameProjectFolder: vi.fn(),
    renameWorkspaceFile: vi.fn(),
    downloadWorkspaceFile: vi.fn(),
    openWorkspaceFile: vi.fn(),
    saveWorkspaceFile: vi.fn(),
    deleteWorkspaceFile: vi.fn()
  }
}))

import { agentApi } from '@/api/agentApi'
import { useWorkbenchStore } from './workbenchStore'
import type {
  AgentRunRequest,
  AgentRunResult,
  AgentSessionInteraction,
  AgentSessionListItem,
  AgentSessionUsageSummary,
  AgentStreamEvent,
  AgentWorkspacePayload,
  WorkspaceFileDescriptor
} from '@/api/types'

const mockedAgentApi = vi.mocked(agentApi)

function buildAgent() {
  return {
    id: 'workspace-agent',
    name: '小曼智能体',
    description: '工作区助手',
    version: '1.0.0',
    skillCount: 4,
    runtime: {
      provider: 'openai',
      modelName: 'gpt-test',
      hasApiKey: true,
      hasCustomHeaders: false,
      source: 'default' as const
    },
    presentation: {
      title: '小曼智能体',
      summary: '处理当前任务与文件上下文',
      role: 'assistant',
      capabilities: ['技能一']
    },
    skills: [
      {
        id: 'dpi-new-bwm-pcc',
        name: 'DPI 规划入口',
        description: '用于 DPI 带宽模型规划。',
        starterSummary: '根据业务场景描述，生成 DPI 配置草案。',
        inputExample: '请规划 DPI 带宽控制方案',
        lifecycle: 'published' as const,
        intentGroup: 'planning' as const,
        starterEnabled: true,
        starterPriority: 100
      },
      {
        id: 'naming-generation-rowcipher',
        name: '命名生成',
        description: '用于配置制作与行密规则生成。',
        lifecycle: 'published' as const,
        intentGroup: 'configuration-authoring' as const,
        starterEnabled: true,
        starterPriority: 90
      },
      {
        id: 'tai-fqdn-converter',
        name: 'TAI FQDN 转换',
        description: '用于 TAI 与 FQDN 数据转化。',
        lifecycle: 'published' as const,
        starterEnabled: true,
        starterPriority: 80
      },
      {
        id: 'ugc-content-creator',
        name: 'UGC 创作',
        description: '测试实验技能。',
        lifecycle: 'draft' as const,
        starterEnabled: false,
        starterPriority: 10
      }
    ]
  }
}

function buildBootstrap() {
  return {
    agent: buildAgent(),
    workspaceAgent: {
      plannerEnabled: false,
      defaultPrimaryAgent: 'build' as const
    },
    workspaceOccupancy: {
      occupied: false,
      state: 'idle' as const,
      ownerSessionId: null,
      runId: null
    },
    toolDisplayNames: {
      'local:question': '等待你回答',
      'skill:read_asset': '读取技能文件'
    },
    gateway: {
      configSource: 'runtime',
      tools: []
    },
    configVersion: '1',
    configChecksum: 'abc'
  }
}

function buildSession(overrides: Partial<AgentSessionListItem> = {}): AgentSessionListItem {
  return {
    ...baseSession(),
    ...overrides
  }
}

function baseSession(): AgentSessionListItem {
  return {
    userId: 1,
    agentId: 'workspace-agent',
    sessionId: 'session-1',
    title: 'DPI 任务',
    createdAt: 1,
    updatedAt: 2,
    messageCount: 3,
    preview: '最近一条预览',
    activity: {
      active: false,
      state: 'idle',
      runId: null
    },
    activePrimaryAgent: 'build',
    planState: null
  }
}

function buildWorkspacePayload(
  agentId = 'workspace-agent',
  title = '工作区',
  files: Array<{
    nodeId?: string
    fileId: string
    fileKey: string
    path: string
    fileName: string
    source: 'upload' | 'project'
    groupId: 'upload' | 'project'
    writable: boolean
    addedAt: number
  }> = [
    {
      nodeId: 'file-1',
      fileId: 'file-1',
      fileKey: 'file-1',
      path: 'upload/input.csv',
      fileName: 'input.csv',
      source: 'upload',
      groupId: 'upload',
      writable: true,
      addedAt: 100
    }
  ]
): AgentWorkspacePayload {
  const entries = files.map(file => ({
    nodeId: file.nodeId || file.fileId,
    fileId: file.fileId,
    fileKey: file.fileKey,
    path: file.path,
    fileName: file.fileName,
    relativePath: file.fileName,
    source: file.source,
    groupId: file.groupId,
    nodeType: 'file' as const,
    writable: file.writable,
    addedAt: file.addedAt
  }))
  return {
    agentId,
    title,
    tasks: [
      {
        id: `workspace-${agentId}`,
        label: '工作目录',
        groups: [
          {
            id: 'upload' as const,
            label: 'upload',
            entries: entries.filter(entry => entry.groupId === 'upload')
          },
          {
            id: 'project' as const,
            label: 'project',
            entries: entries.filter(entry => entry.groupId === 'project')
          }
        ]
      }
    ]
  }
}

function buildRawWorkspacePayloadLabels(agentId = 'workspace-agent'): AgentWorkspacePayload {
  return {
    agentId,
    title: '工作区',
    tasks: [
      {
        id: `workspace-${agentId}`,
        label: '工作目录',
        groups: [
          {
            id: 'upload',
            label: 'upload',
            entries: []
          },
          {
            id: 'project',
            label: 'project',
            entries: []
          }
        ]
      }
    ]
  }
}

function buildRunResult(overrides: Partial<AgentRunResult> = {}): AgentRunResult {
  return {
    runId: 'run-1',
    sessionId: 'session-1',
    agentId: 'workspace-agent',
    output: {
      kind: 'text' as const,
      text: overrides.text || '处理完成'
    },
    text: '处理完成',
    completedAt: Date.now(),
    ...overrides
  }
}

function buildSessionUsageSummary(
  overrides: Partial<AgentSessionUsageSummary> = {}
): AgentSessionUsageSummary {
  return {
    userId: 1,
    agentId: 'workspace-agent',
    sessionId: 'session-1',
    totalTokens: 18234,
    inputTokens: 12000,
    outputTokens: 6234,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    assistantMessageCount: 3,
    ...overrides
  }
}

function buildRuntimeError() {
  return {
    code: 'INTERNAL' as const,
    stage: 'model' as const,
    retryable: false,
    userMessage: '模型输出失败'
  }
}

function buildWorkspaceFileDescriptor(overrides: Partial<WorkspaceFileDescriptor> = {}): WorkspaceFileDescriptor {
  return {
    fileKey: 'file-1',
    fileId: 'backend-file-1',
    path: 'upload/input.csv',
    fileName: 'input.csv',
    source: 'upload',
    writable: false,
    mode: 'csv',
    content: 'name,value\nalpha,1\n',
    mmlMetadata: null,
    ...overrides
  }
}

function buildPendingQuestionInteraction(
  overrides: Partial<AgentSessionInteraction> = {}
): AgentSessionInteraction {
  return {
    interactionId: 'interaction-1',
    runId: 'run-1',
    kind: 'question',
    status: 'pending',
    payload: {
      questionId: 'question-1',
      title: '补充信息',
      prompt: '请输入信息',
      required: true,
      fields: [{ id: 'answer', label: '回答', type: 'text' }]
    },
    createdAt: 1,
    resolvedAt: null,
    ...overrides
  }
}

function mockStreamingRunOnce() {
  let emitEvent: (event: AgentStreamEvent) => void = () => {
    throw new Error('runStream emitter was not captured')
  }
  let resolveRun: (result: AgentRunResult) => void = () => {
    throw new Error('runStream resolver was not captured')
  }
  let rejectRun: (reason?: unknown) => void = () => {
    throw new Error('runStream rejecter was not captured')
  }
  mockedAgentApi.runStream.mockImplementationOnce(async (_request, onEvent) => {
    emitEvent = onEvent
    return new Promise((resolve, reject) => {
      resolveRun = resolve
      rejectRun = reject
    })
  })
  return {
    emitEvent(event: AgentStreamEvent) {
      emitEvent(event)
    },
    resolveRun(result: AgentRunResult) {
      resolveRun(result)
    },
    rejectRun(reason?: unknown) {
      rejectRun(reason)
    }
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

describe('workbenchStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    mockedAgentApi.listAgents.mockResolvedValue([
      { id: 'workspace-agent', name: '小曼智能体', description: 'desc', version: '1.0.0', skillCount: 4 }
    ])
    mockedAgentApi.getAgent.mockResolvedValue(buildAgent())
    mockedAgentApi.bootstrap.mockResolvedValue(buildBootstrap())
    mockedAgentApi.listSessions.mockResolvedValue([])
    mockedAgentApi.getWorkspace.mockResolvedValue(buildWorkspacePayload())
    mockedAgentApi.getSessionMessages.mockResolvedValue([])
    mockedAgentApi.listSessionInteractions.mockResolvedValue([])
    mockedAgentApi.replySessionInteraction.mockResolvedValue({
      interactionId: 'interaction-1',
      runId: 'run-1',
      kind: 'question',
      status: 'answered',
      payload: {
        questionId: 'question-1',
        title: '补充信息',
        prompt: '请输入信息',
        required: true,
        fields: [{ id: 'answer', label: '回答', type: 'text' }]
      },
      createdAt: 1,
      resolvedAt: 2
    })
    mockedAgentApi.rejectSessionInteraction.mockResolvedValue({
      interactionId: 'interaction-1',
      runId: 'run-1',
      kind: 'question',
      status: 'rejected',
      payload: {
        questionId: 'question-1',
        title: '补充信息',
        prompt: '请输入信息',
        required: true,
        fields: [{ id: 'answer', label: '回答', type: 'text' }]
      },
      createdAt: 1,
      resolvedAt: 2
    })
    mockedAgentApi.deleteSession.mockResolvedValue('session-1')
    mockedAgentApi.getSessionUsageSummary.mockResolvedValue(buildSessionUsageSummary())
    mockedAgentApi.cancelRun.mockResolvedValue({
      ok: true,
      runId: 'run-1',
      cancelled: true
    })
    mockedAgentApi.updateProtocolState.mockResolvedValue()
    mockedAgentApi.renameWorkspaceFile.mockResolvedValue(buildWorkspaceFileDescriptor({
      fileKey: 'file-1',
      fileId: 'backend-file-1',
      path: 'upload/input-renamed.csv',
      fileName: 'input-renamed.csv',
      source: 'upload',
      writable: false,
      mode: 'csv',
      content: 'name,value\nalpha,1\n'
    }))
    mockedAgentApi.downloadWorkspaceFile.mockResolvedValue({
      blob: new Blob(['name,value\nalpha,1\n'], { type: 'text/csv' }),
      fileName: 'input.csv'
    })
    mockedAgentApi.openWorkspaceFile.mockResolvedValue(buildWorkspaceFileDescriptor())
    mockedAgentApi.saveWorkspaceFile.mockResolvedValue(buildWorkspaceFileDescriptor())
    mockedAgentApi.deleteWorkspaceFile.mockResolvedValue()
  })

  it('loads governed starter groups while keeping the workbench in blank draft mode', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession()])

    const store = useWorkbenchStore()
    await store.initialize()

    expect(store.activeAgentId).toBe('workspace-agent')
    expect(store.activeSessionId).toBeNull()
    expect(store.sessions).toHaveLength(1)
    expect(store.starterGroups).toHaveLength(3)
    expect(store.starterGroups.find(group => group.id === 'planning')?.previewSkills.map(skill => skill.name)).toEqual(['DPI 规划入口'])
    expect(store.starterGroups.find(group => group.id === 'planning')?.previewSkills[0]?.starterSummaryText).toBe('根据业务场景描述，生成 DPI 配置草案。')
    expect(store.starterGroups.find(group => group.id === 'planning')?.previewSkills[0]?.governedDescriptionText).toBe('用于 DPI 带宽模型规划。')
    expect(store.starterGroups.find(group => group.id === 'verification')?.previewSkills).toEqual([])
    expect(store.searchableSkills.map(skill => skill.id)).not.toContain('ugc-content-creator')
  })

  it('normalizes backend workspace group labels to upload and project', async () => {
    mockedAgentApi.getWorkspace.mockResolvedValueOnce(buildRawWorkspacePayloadLabels())

    const store = useWorkbenchStore()
    await store.initialize()

    expect(store.workspaceTasks[0]?.groups[0]?.label).toBe('upload')
    expect(store.workspaceTasks[0]?.groups[1]?.label).toBe('project')
  })

  it('caches loaded session usage summaries by session id', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession()])

    const store = useWorkbenchStore()
    await store.initialize()
    await store.loadSessionUsage('session-1')
    await store.loadSessionUsage('session-1')

    expect(mockedAgentApi.getSessionUsageSummary).toHaveBeenCalledTimes(1)
    expect(store.sessionUsageById['session-1']).toEqual({
      loading: false,
      summary: buildSessionUsageSummary(),
      error: null
    })
  })

  it('reloads session usage after the session message count or updated time changes', async () => {
    mockedAgentApi.listSessions
      .mockResolvedValueOnce([buildSession({
        sessionId: 'session-1',
        updatedAt: 2,
        messageCount: 1
      })])
      .mockResolvedValueOnce([buildSession({
        sessionId: 'session-1',
        updatedAt: 10,
        messageCount: 3
      })])
    mockedAgentApi.getSessionUsageSummary
      .mockResolvedValueOnce(buildSessionUsageSummary({
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        assistantMessageCount: 0
      }))
      .mockResolvedValueOnce(buildSessionUsageSummary({
        totalTokens: 18234,
        inputTokens: 12000,
        outputTokens: 6234,
        assistantMessageCount: 3
      }))

    const store = useWorkbenchStore()
    await store.initialize()
    await store.loadSessionUsage('session-1')
    await store.refreshSessions()
    await store.loadSessionUsage('session-1')

    expect(mockedAgentApi.getSessionUsageSummary).toHaveBeenCalledTimes(2)
    expect(store.sessionUsageById['session-1']).toEqual({
      loading: false,
      summary: buildSessionUsageSummary(),
      error: null
    })
  })

  it('stores session usage request failures explicitly for later retry', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession()])
    mockedAgentApi.getSessionUsageSummary.mockRejectedValueOnce(new Error('usage failed'))

    const store = useWorkbenchStore()
    await store.initialize()
    await store.loadSessionUsage('session-1')

    expect(store.sessionUsageById['session-1']).toEqual({
      loading: false,
      summary: null,
      error: 'usage failed'
    })
  })

  it('preserves blank and session composer drafts across session switching', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([
      buildSession({ sessionId: 'session-1', title: '会话一' }),
      buildSession({ sessionId: 'session-2', title: '会话二', updatedAt: 3 })
    ])

    const store = useWorkbenchStore()
    await store.initialize()

    store.setComposerDraft('空白草稿')
    await store.selectSession('session-1')
    store.setComposerDraft('会话一草稿')
    await store.selectSession('session-2')
    store.setComposerDraft('会话二草稿')

    store.startNewConversation()
    expect(store.composerDraft).toBe('空白草稿')

    await store.selectSession('session-1')
    expect(store.composerDraft).toBe('会话一草稿')

    await store.selectSession('session-2')
    expect(store.composerDraft).toBe('会话二草稿')
  })

  it('no longer exposes cross-session composer and history lock copy', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([
      buildSession({ sessionId: 'session-owner', title: '你好' }),
      buildSession({ sessionId: 'session-viewing', title: '当前会话', updatedAt: 3 })
    ])
    mockedAgentApi.bootstrap.mockResolvedValueOnce({
      ...buildBootstrap(),
      workspaceOccupancy: {
        occupied: true,
        state: 'running',
        ownerSessionId: 'session-owner',
        runId: 'run-1'
      }
    })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-viewing')

    expect(store.composerLockReason).toBeNull()
    expect(store.historyLockReason).toBeNull()
  })

  it('allows prompt submission in an idle secondary session even when another session is active', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([
      buildSession({
        sessionId: 'session-owner',
        title: '你好',
        activity: {
          active: true,
          state: 'running',
          runId: 'run-1'
        }
      }),
      buildSession({ sessionId: 'session-viewing', title: '当前会话', updatedAt: 3 })
    ])
    const { resolveRun } = mockStreamingRunOnce()
    const successResult = buildRunResult({
      runId: 'run-2',
      sessionId: 'session-viewing',
      assistantMessageId: 2,
      text: '已完成'
    })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-viewing')
    store.setComposerDraft('旁路草稿')

    const pending = store.sendPrompt('尝试发送')
    await Promise.resolve()
    resolveRun(successResult)
    await pending

    expect(store.isWorkspaceOccupiedByAnotherSession).toBe(false)
    expect(store.isActiveSessionRunning).toBe(false)
    expect(store.error).toBeNull()
    expect(mockedAgentApi.runStream).toHaveBeenCalledTimes(1)
  })

  it('restores awaiting-question activity only for the owning session', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([
      buildSession({
        sessionId: 'session-owner',
        title: '你好',
        activity: {
          active: true,
          state: 'awaiting-question',
          runId: null
        }
      }),
      buildSession({ sessionId: 'session-viewing', title: '当前会话', updatedAt: 3 })
    ])

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-viewing')

    mockedAgentApi.getAgent.mockResolvedValueOnce(buildAgent())
    mockedAgentApi.bootstrap.mockResolvedValueOnce({
      ...buildBootstrap(),
      workspaceOccupancy: {
        occupied: true,
        state: 'awaiting-question',
        ownerSessionId: 'session-owner',
        runId: null
      }
    })

    await store.refreshActiveAgentGovernance()
    await store.sendPrompt('等待回答时继续发送')

    expect(store.workspaceOccupancy).toEqual({
      occupied: false,
      state: 'idle',
      ownerSessionId: null,
      runId: null
    })
    expect(store.isWorkspaceOccupiedByAnotherSession).toBe(false)
    expect(store.composerLockReason).toBeNull()
    expect(mockedAgentApi.runStream).toHaveBeenCalledTimes(1)
  })

  it('filters searchable skills from the governed visible set only', async () => {
    const store = useWorkbenchStore()
    await store.initialize()

    store.setSkillSearchQuery('TAI 转化')

    expect(store.searchableSkills.map(skill => skill.id)).toEqual(['tai-fqdn-converter'])
  })

  it('tracks selected starter skill and clears on conversation switch', async () => {
    const store = useWorkbenchStore()
    await store.initialize()

    store.selectStarterSkill('dpi-new-bwm-pcc')

    expect(store.selectedStarterSkillId).toBe('dpi-new-bwm-pcc')
    expect(store.selectedStarterSkill?.name).toBe('DPI 规划入口')
    expect(store.selectedStarterSkill?.governedTitleText).toBe('DPI 规划入口')
    expect(store.selectedStarterSkill?.governedDescriptionText).toBe('用于 DPI 带宽模型规划。')
    expect(store.selectedStarterSkill?.starterSummaryText).toBe('根据业务场景描述，生成 DPI 配置草案。')
    expect(store.selectedStarterSkill?.starterSummaryText).not.toBe(store.selectedStarterSkill?.governedDescriptionText)

    store.selectStarterSkill('naming-generation-rowcipher')

    expect(store.selectedStarterSkillId).toBe('naming-generation-rowcipher')
    expect(store.selectedStarterSkill?.name).toBe('命名生成')

    store.selectStarterSkill(null)

    expect(store.selectedStarterSkillId).toBeNull()
    expect(store.selectedStarterSkill).toBeNull()

    store.selectStarterSkill('dpi-new-bwm-pcc')
    store.startNewConversation()

    expect(store.selectedStarterSkillId).toBeNull()
  })

  it('refreshes governed agent metadata for the active agent without resetting the shell state', async () => {
    const store = useWorkbenchStore()
    await store.initialize()

    mockedAgentApi.getAgent.mockResolvedValueOnce({
      ...buildAgent(),
      skills: [
        {
          id: 'dpi-new-bwm-pcc',
          name: '治理后的 DPI 规划',
          description: '更新后的治理名称。',
          starterSummary: '根据业务场景描述，生成治理后的 DPI 配置草案。',
          inputExample: '请规划 DPI 带宽控制方案',
          lifecycle: 'published' as const,
          intentGroup: 'planning' as const,
          starterEnabled: true,
          starterPriority: 100
        }
      ]
    })
    mockedAgentApi.bootstrap.mockResolvedValueOnce({
      ...buildBootstrap(),
      agent: {
        ...buildAgent(),
        skills: [
          {
            id: 'dpi-new-bwm-pcc',
            name: '治理后的 DPI 规划',
            description: '更新后的治理名称。',
            starterSummary: '根据业务场景描述，生成治理后的 DPI 配置草案。',
            inputExample: '请规划 DPI 带宽控制方案',
            lifecycle: 'published' as const,
            intentGroup: 'planning' as const,
            starterEnabled: true,
            starterPriority: 100
          }
        ]
      }
    })

    await store.refreshActiveAgentGovernance()

    expect(store.activeAgent?.skills[0]?.name).toBe('治理后的 DPI 规划')
    expect(store.starterGroups.find(group => group.id === 'planning')?.previewSkills.map(skill => skill.name)).toEqual(['治理后的 DPI 规划'])
    expect(store.searchableSkills.map(skill => skill.name)).toContain('治理后的 DPI 规划')
    expect(store.activeSessionId).toBeNull()
  })

  it('creates the backend session lazily on first prompt and keeps agent-scoped workspace files available', async () => {
    const finalResult = buildRunResult({
      text: '处理完成',
      assistantMessageId: 2,
      metrics: {
        tools: [{
          provider: 'local',
          tool: 'readFile',
          latencyMs: 12,
          success: true
        }],
        totalLatencyMs: 12,
        failures: []
      }
    })

    mockedAgentApi.createSession.mockResolvedValueOnce(buildSession({
      title: '你好',
      messageCount: 0
    }))
    mockedAgentApi.listSessions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        buildSession({
          title: '你好',
          messageCount: 2
        })
      ])
    mockedAgentApi.getWorkspace
      .mockResolvedValueOnce(buildWorkspacePayload('workspace-agent', '工作区', []))
      .mockResolvedValueOnce(buildWorkspacePayload('workspace-agent', '工作区', [
        {
          fileId: 'upload-1',
          fileKey: 'upload-1',
          path: 'upload/input.csv',
          fileName: 'input.csv',
          source: 'upload',
          groupId: 'upload',
          writable: false,
          addedAt: 100
        }
      ]))
      .mockResolvedValueOnce(buildWorkspacePayload('workspace-agent', '工作区', [
        {
          fileId: 'upload-1',
          fileKey: 'upload-1',
          path: 'upload/input.csv',
          fileName: 'input.csv',
          source: 'upload',
          groupId: 'upload',
          writable: false,
          addedAt: 100
        }
      ]))
    mockedAgentApi.uploadFile.mockResolvedValueOnce({
      fileKey: 'upload-1',
      originalName: 'input.csv',
      path: 'upload/input.csv',
      source: 'upload',
      writable: true,
      replaced: false
    })
    mockedAgentApi.getSessionMessages.mockResolvedValueOnce([
      {
        messageId: 1,
        role: 'user',
        text: '你好',
        createdAt: 1,
        kind: 'text'
      },
      {
        messageId: 2,
        role: 'assistant',
        text: '处理完成',
        createdAt: 2,
        kind: 'text'
      }
    ])
    mockedAgentApi.runStream.mockImplementation(async (_request, onEvent) => {
      onEvent({ type: 'assistant.delta', runId: 'run-1', delta: '处理' })
      onEvent({ type: 'assistant.final', runId: 'run-1', text: '处理完成' })
      onEvent({ type: 'run.completed', runId: 'run-1', status: 'success', result: finalResult, endedAt: Date.now() })
      return finalResult
    })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.uploadFiles([new File(['hello'], 'input.csv', { type: 'text/csv' })])

    expect(store.workspaceOpen).toBe(false)

    await store.sendPrompt('你好')

    expect(mockedAgentApi.createSession).toHaveBeenCalledTimes(1)
    expect(mockedAgentApi.uploadFile).toHaveBeenCalledWith(
      'workspace-agent',
      expect.any(File),
      false,
      undefined
    )
    expect(mockedAgentApi.runStream).toHaveBeenCalledTimes(1)
    expect(store.activeSessionId).toBe('session-1')
    expect(store.messages.at(-1)?.text).toBe('处理完成')
    expect(store.messages.at(-1)?.assistantHeader).toMatchObject({
      label: '使用 Tools: readFile',
      tone: 'summary'
    })
    expect(store.workspaceFiles).toHaveLength(1)
    expect(store.workspaceOpen).toBe(false)
  })

  it('updates assistant headers through queued, generating, and failed run states', async () => {
    const failedResult = buildRunResult({
      runId: 'run-failed',
      text: '模型输出失败',
      error: '模型输出失败',
      runtimeError: buildRuntimeError()
    })
    let emitEvent: (event: AgentStreamEvent) => void = () => {
      throw new Error('runStream emitter was not captured')
    }
    let resolveRun: (result: AgentRunResult) => void = () => {
      throw new Error('runStream resolver was not captured')
    }

    mockedAgentApi.createSession.mockResolvedValueOnce(buildSession({
      title: '失败任务',
      messageCount: 0
    }))
    mockedAgentApi.listSessions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([buildSession({ title: '失败任务', messageCount: 2 })])
    mockedAgentApi.runStream.mockImplementationOnce(async (_request, onEvent) => {
      emitEvent = onEvent
      return new Promise(resolve => {
        resolveRun = resolve
      })
    })

    const store = useWorkbenchStore()
    await store.initialize()

    const pending = store.sendPrompt('失败任务')
    await Promise.resolve()
    await Promise.resolve()

    expect(store.messages.at(-1)?.assistantHeader).toMatchObject({
      label: '思考中',
      tone: 'progress'
    })

    emitEvent({
      type: 'lifecycle.queued',
      runId: 'run-failed',
      agentId: 'workspace-agent',
      sessionId: 'session-1',
      queuedAt: Date.now(),
      message: 'queued'
    })
    await Promise.resolve()

    expect(store.messages.at(-1)?.assistantHeader).toMatchObject({
      label: '排队中',
      tone: 'progress'
    })

    emitEvent({
      type: 'tool.started',
      runId: 'run-failed',
      agentId: 'workspace-agent',
      sessionId: 'session-1',
      toolCallId: 'tool-read-1',
      tool: 'local:read_file',
      displayName: 'read_file',
      toolKind: 'tool',
      startedAt: Date.now()
    })
    await Promise.resolve()

    expect(store.messages.at(-1)?.assistantHeader).toMatchObject({
      label: '正在调用 Tool: read_file',
      tone: 'progress'
    })

    emitEvent({
      type: 'tool.failed',
      runId: 'run-failed',
      agentId: 'workspace-agent',
      sessionId: 'session-1',
      toolCallId: 'tool-read-1',
      tool: 'local:read_file',
      displayName: 'read_file',
      toolKind: 'tool',
      startedAt: Date.now(),
      failedAt: Date.now(),
      statusMessage: '工具 read_file 执行失败，正在修正后重试。',
      recoveryMode: 'recovering',
      normalizedCode: 'path_not_found',
      retryHint: 'correct_input',
      attempt: 1,
      remainingRecoveryBudget: 0,
      runtimeRetryCount: 0
    })
    await Promise.resolve()

    expect(store.messages.at(-1)).toMatchObject({
      kind: 'text',
      assistantHeader: {
        label: '工具 read_file 执行失败，正在修正后重试。',
        tone: 'progress',
        liveMode: 'polite'
      }
    })

    emitEvent({
      type: 'assistant.delta',
      runId: 'run-failed',
      delta: '处理中'
    })
    await Promise.resolve()

    expect(store.messages.at(-1)?.assistantHeader).toMatchObject({
      label: '正在生成回复',
      tone: 'progress'
    })

    emitEvent({
      type: 'lifecycle.error',
      runId: 'run-failed',
      endedAt: Date.now(),
      error: '模型输出失败',
      runtimeError: buildRuntimeError()
    })
    await Promise.resolve()

    expect(store.messages.at(-1)?.assistantHeader).toMatchObject({
      label: '执行失败',
      tone: 'error'
    })

    resolveRun(failedResult)
    await pending

    expect(store.messages.at(-1)?.assistantHeader).toMatchObject({
      label: '执行失败',
      tone: 'error'
    })
  })

  it('restores the persisted last user message after timeout failures while keeping the error bubble visible', async () => {
    const timeoutResult = buildRunResult({
      runId: 'run-timeout',
      sessionId: 'session-timeout',
      text: '模型流式响应空闲超时，请重试。',
      error: 'Model stream idle timeout',
      runtimeError: {
        ...buildRuntimeError(),
        retryable: true,
        userMessage: '模型流式响应空闲超时，请重试。',
        detail: 'idle timeout'
      }
    })

    mockedAgentApi.listSessions
      .mockResolvedValueOnce([
        buildSession({
          sessionId: 'session-timeout',
          title: '超时会话',
          messageCount: 2
        })
      ])
      .mockResolvedValueOnce([
        buildSession({
          sessionId: 'session-timeout',
          title: '超时会话',
          messageCount: 3,
          preview: '模型流式响应空闲超时，请重试。'
        })
      ])
    mockedAgentApi.getSessionMessages
      .mockResolvedValueOnce([
        {
          messageId: 1,
          role: 'user',
          text: '上一条消息',
          createdAt: 1,
          kind: 'text'
        },
        {
          messageId: 2,
          role: 'assistant',
          text: '上一条回复',
          createdAt: 2,
          kind: 'text'
        }
      ])
      .mockResolvedValueOnce([
        {
          messageId: 1,
          role: 'user',
          text: '上一条消息',
          createdAt: 1,
          kind: 'text'
        },
        {
          messageId: 2,
          role: 'assistant',
          text: '上一条回复',
          createdAt: 2,
          kind: 'text'
        },
        {
          messageId: 3,
          role: 'user',
          text: '这次请求超时了',
          createdAt: 3,
          kind: 'text'
        }
      ])
    mockedAgentApi.runStream.mockImplementationOnce(async (_request, onEvent) => {
      onEvent({
        type: 'lifecycle.start',
        runId: 'run-timeout',
        agentId: 'workspace-agent',
        sessionId: 'session-timeout',
        startedAt: Date.now()
      })
      onEvent({
        type: 'lifecycle.error',
        runId: 'run-timeout',
        endedAt: Date.now(),
        error: 'Model stream idle timeout',
        runtimeError: timeoutResult.runtimeError
      })
      onEvent({
        type: 'run.completed',
        runId: 'run-timeout',
        status: 'error',
        result: timeoutResult,
        endedAt: Date.now()
      })
      return timeoutResult
    })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-timeout')

    expect(store.editableUserMessageId).toBe(1)

    await store.sendPrompt('这次请求超时了')

    expect(store.editableUserMessageId).toBe(3)
    expect(store.messages.some(message => {
      return message.role === 'user'
        && message.messageId === 3
        && message.text === '这次请求超时了'
    })).toBe(true)
    expect(store.messages.at(-1)).toMatchObject({
      kind: 'error',
      role: 'assistant',
      text: '模型流式响应空闲超时，请重试。',
      assistantHeader: {
        label: '执行失败',
        tone: 'error'
      }
    })
  })

  it('uses a tool-specific error header for terminal tool failures', async () => {
    const toolFailureResult = buildRunResult({
      runId: 'run-tool-failure',
      sessionId: 'session-tool-failure',
      text: '工具 read_file 连续失败且没有进展，当前运行已停止。',
      error: 'File not found: missing.txt',
      runtimeError: {
        ...buildRuntimeError(),
        stage: 'tool',
        userMessage: '工具 read_file 连续失败且没有进展，当前运行已停止。',
        detail: 'File not found: missing.txt',
        toolName: 'local:read_file',
        normalizedCode: 'path_not_found',
        stopReason: 'no_progress_same_failure'
      }
    })

    mockedAgentApi.listSessions
      .mockResolvedValueOnce([
        buildSession({
          sessionId: 'session-tool-failure',
          title: '工具失败会话',
          messageCount: 2
        })
      ])
      .mockResolvedValueOnce([
        buildSession({
          sessionId: 'session-tool-failure',
          title: '工具失败会话',
          messageCount: 3,
          preview: '工具 read_file 连续失败且没有进展，当前运行已停止。'
        })
      ])
    mockedAgentApi.getSessionMessages
      .mockResolvedValueOnce([
        {
          messageId: 1,
          role: 'user',
          text: '上一条消息',
          createdAt: 1,
          kind: 'text'
        },
        {
          messageId: 2,
          role: 'assistant',
          text: '上一条回复',
          createdAt: 2,
          kind: 'text'
        }
      ])
      .mockResolvedValueOnce([
        {
          messageId: 1,
          role: 'user',
          text: '上一条消息',
          createdAt: 1,
          kind: 'text'
        },
        {
          messageId: 2,
          role: 'assistant',
          text: '上一条回复',
          createdAt: 2,
          kind: 'text'
        },
        {
          messageId: 3,
          role: 'user',
          text: '读取缺失文件',
          createdAt: 3,
          kind: 'text'
        }
      ])
    mockedAgentApi.runStream.mockImplementationOnce(async (_request, onEvent) => {
      onEvent({
        type: 'lifecycle.start',
        runId: 'run-tool-failure',
        agentId: 'workspace-agent',
        sessionId: 'session-tool-failure',
        startedAt: Date.now()
      })
      onEvent({
        type: 'tool.failed',
        runId: 'run-tool-failure',
        agentId: 'workspace-agent',
        sessionId: 'session-tool-failure',
        toolCallId: 'tool-read-1',
        tool: 'local:read_file',
        displayName: 'read_file',
        toolKind: 'tool',
        startedAt: Date.now(),
        failedAt: Date.now(),
        statusMessage: '工具 read_file 执行失败，正在修正后重试。',
        recoveryMode: 'recovering',
        normalizedCode: 'path_not_found',
        retryHint: 'correct_input',
        attempt: 1,
        remainingRecoveryBudget: 0,
        runtimeRetryCount: 0
      })
      onEvent({
        type: 'lifecycle.error',
        runId: 'run-tool-failure',
        endedAt: Date.now(),
        error: 'File not found: missing.txt',
        runtimeError: toolFailureResult.runtimeError
      })
      onEvent({
        type: 'run.completed',
        runId: 'run-tool-failure',
        status: 'error',
        result: toolFailureResult,
        endedAt: Date.now()
      })
      return toolFailureResult
    })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-tool-failure')
    await store.sendPrompt('读取缺失文件')

    expect(store.messages.at(-1)).toMatchObject({
      kind: 'error',
      text: '工具 read_file 连续失败且没有进展，当前运行已停止。',
      assistantHeader: {
        label: '工具执行失败',
        tone: 'error'
      }
    })
  })

  it('fails picker or drag uploads explicitly when files are outside the governed allowlist', async () => {
    const store = useWorkbenchStore()
    await store.initialize()

    await store.uploadFiles([new File(['{}'], 'notes.json', { type: 'application/json' })])

    expect(mockedAgentApi.uploadFile).not.toHaveBeenCalled()
    expect(store.error).toBe('仅支持上传 TXT / MD / CSV 文件：notes.json')
    expect(store.latestStatus).toBe('文件上传失败')
  })

  it('tracks the active run id and converges cancelled runs into a transient stopped message', async () => {
    const cancelledResult = buildRunResult({
      runId: 'run-stop',
      error: 'Request cancelled',
      runtimeError: {
        code: 'CANCELLED',
        stage: 'finalize',
        retryable: false,
        userMessage: '请求已取消。'
      }
    })
    const { emitEvent, resolveRun } = mockStreamingRunOnce()

    mockedAgentApi.createSession.mockResolvedValueOnce(buildSession({
      title: '停止任务',
      messageCount: 0
    }))
    mockedAgentApi.listSessions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([buildSession({
        title: '停止任务',
        messageCount: 1
      })])
    mockedAgentApi.getSessionMessages.mockResolvedValueOnce([
      {
        messageId: 1,
        role: 'user',
        text: '停止任务',
        createdAt: 1,
        kind: 'text'
      }
    ])

    const store = useWorkbenchStore()
    await store.initialize()

    const pending = store.sendPrompt('停止任务')
    await Promise.resolve()
    await Promise.resolve()

    emitEvent({
      type: 'lifecycle.start',
      runId: 'run-stop',
      agentId: 'workspace-agent',
      sessionId: 'session-1',
      startedAt: Date.now()
    })
    emitEvent({
      type: 'assistant.delta',
      runId: 'run-stop',
      delta: '正在处理'
    })
    await Promise.resolve()

    expect(store.activeRunId).toBe('run-stop')
    expect(store.canStopActiveRun).toBe(true)

    await store.stopCurrentRun()

    expect(mockedAgentApi.cancelRun).toHaveBeenCalledWith('run-stop')
    expect(store.isStopPending).toBe(true)

    emitEvent({
      type: 'lifecycle.error',
      runId: 'run-stop',
      endedAt: Date.now(),
      error: 'Request cancelled',
      runtimeError: {
        code: 'CANCELLED',
        stage: 'finalize',
        retryable: false,
        userMessage: '请求已取消。'
      }
    })
    emitEvent({
      type: 'run.completed',
      runId: 'run-stop',
      status: 'cancelled',
      result: cancelledResult,
      endedAt: Date.now()
    })
    resolveRun(cancelledResult)
    await pending

    expect(store.activeRunId).toBeNull()
    expect(store.canStopActiveRun).toBe(false)
    expect(store.isStopPending).toBe(false)
    expect(store.messages.at(-1)).toMatchObject({
      kind: 'text',
      text: '正在处理',
      assistantHeader: {
        label: '已停止',
        tone: 'summary'
      }
    })
    expect(store.error).toBeNull()
  })

  it('exposes a stoppable run immediately after send before lifecycle start arrives', async () => {
    const deferred = createDeferred<AgentRunResult>()
    let capturedRunId: string | null = null
    mockedAgentApi.createSession.mockResolvedValueOnce(buildSession({
      title: '立即停止',
      messageCount: 0
    }))
    mockedAgentApi.runStream.mockImplementationOnce(async (request, _onEvent) => {
      capturedRunId = request.runId ?? null
      return deferred.promise
    })

    const store = useWorkbenchStore()
    await store.initialize()

    const pending = store.sendPrompt('立即停止')
    await Promise.resolve()
    await Promise.resolve()

    expect(capturedRunId).toBeTruthy()
    expect(store.activeRunId).toBe(capturedRunId)
    expect(store.canStopActiveRun).toBe(true)

    mockedAgentApi.cancelRun.mockResolvedValueOnce({
      ok: true,
      runId: capturedRunId ?? 'missing-run-id',
      cancelled: true
    })

    await store.stopCurrentRun()

    expect(mockedAgentApi.cancelRun).toHaveBeenCalledWith(capturedRunId)

    deferred.resolve(buildRunResult({
      runId: capturedRunId ?? 'missing-run-id',
      assistantMessageId: 2,
      text: '停止后结束'
    }))
    await pending
  })

  it('keeps stream ownership on the run-owning session while another session is active', async () => {
    const successResult = buildRunResult({
      runId: 'run-owner',
      sessionId: 'session-1',
      assistantMessageId: 2,
      text: '已完成'
    })
    const { emitEvent, resolveRun } = mockStreamingRunOnce()

    mockedAgentApi.listSessions.mockResolvedValueOnce([
      buildSession({ sessionId: 'session-1', title: '运行中会话' }),
      buildSession({ sessionId: 'session-2', title: '旁路会话', updatedAt: 2 })
    ])
    mockedAgentApi.getSessionMessages
      .mockResolvedValueOnce([
        {
          messageId: 1,
          role: 'user',
          text: '运行中会话',
          createdAt: 1,
          kind: 'text'
        }
      ])
      .mockResolvedValueOnce([
        {
          messageId: 11,
          role: 'assistant',
          text: '旁路内容',
          createdAt: 2,
          kind: 'text'
        }
      ])
      .mockResolvedValueOnce([
        {
          messageId: 1,
          role: 'user',
          text: '运行中会话',
          createdAt: 1,
          kind: 'text'
        }
      ])
      .mockResolvedValueOnce([
        {
          messageId: 1,
          role: 'user',
          text: '运行中会话',
          createdAt: 1,
          kind: 'text'
        },
        {
          messageId: 2,
          role: 'assistant',
          text: '已完成',
          createdAt: 3,
          kind: 'text'
        }
      ])
    mockedAgentApi.listSessionInteractions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')

    const pending = store.sendPrompt('运行中会话')
    await Promise.resolve()
    await Promise.resolve()

    emitEvent({
      type: 'lifecycle.start',
      runId: 'run-owner',
      agentId: 'workspace-agent',
      sessionId: 'session-1',
      startedAt: Date.now()
    })
    emitEvent({
      type: 'assistant.delta',
      runId: 'run-owner',
      delta: '处理中'
    })
    await Promise.resolve()

    await store.selectSession('session-2')
    expect(store.activeRunId).toBeNull()
    expect(store.isActiveSessionRunning).toBe(false)
    expect(store.canStopActiveRun).toBe(false)
    expect(store.messages).toEqual([
      expect.objectContaining({
        text: '旁路内容'
      })
    ])

    emitEvent({
      type: 'assistant.delta',
      runId: 'run-owner',
      delta: '，继续中'
    })
    await Promise.resolve()

    expect(store.messages).toEqual([
      expect.objectContaining({
        text: '旁路内容'
      })
    ])

    await store.selectSession('session-1')
    expect(store.isActiveSessionRunning).toBe(true)
    expect(store.canStopActiveRun).toBe(true)

    emitEvent({
      type: 'assistant.final',
      runId: 'run-owner',
      text: '已完成'
    })
    emitEvent({
      type: 'run.completed',
      runId: 'run-owner',
      status: 'success',
      result: successResult,
      endedAt: Date.now()
    })
    resolveRun(successResult)
    await pending
  })

  it('keeps active-session conversation status isolated from background lifecycle updates', async () => {
    const successResult = buildRunResult({
      runId: 'run-background',
      sessionId: 'session-1',
      assistantMessageId: 2,
      text: '后台完成'
    })
    const { emitEvent, resolveRun } = mockStreamingRunOnce()

    mockedAgentApi.listSessions
      .mockResolvedValueOnce([
        buildSession({ sessionId: 'session-1', title: '后台会话' }),
        buildSession({ sessionId: 'session-2', title: '当前会话', updatedAt: 2 })
      ])
      .mockResolvedValueOnce([
        buildSession({
          sessionId: 'session-1',
          title: '后台会话',
          updatedAt: 4,
          planState: {
            planId: 'plan-background',
            version: 1,
            status: 'awaiting_approval',
            title: '后台计划',
            summary: '后台计划摘要',
            filePath: 'plans/background.md',
            approvedSkillIds: []
          }
        }),
        buildSession({ sessionId: 'session-2', title: '当前会话', updatedAt: 2 })
      ])
    mockedAgentApi.getSessionMessages
      .mockResolvedValueOnce([
        {
          messageId: 1,
          role: 'user',
          text: '后台会话',
          createdAt: 1,
          kind: 'text'
        }
      ])
      .mockResolvedValueOnce([
        {
          messageId: 11,
          role: 'assistant',
          text: '当前会话内容',
          createdAt: 2,
          kind: 'text'
        }
      ])
      .mockResolvedValueOnce([
        {
          messageId: 1,
          role: 'user',
          text: '后台会话',
          createdAt: 1,
          kind: 'text'
        },
        {
          messageId: 2,
          role: 'assistant',
          text: '后台完成',
          createdAt: 3,
          kind: 'text'
        }
      ])
      .mockResolvedValueOnce([
        {
          messageId: 1,
          role: 'user',
          text: '后台会话',
          createdAt: 1,
          kind: 'text'
        },
        {
          messageId: 2,
          role: 'assistant',
          text: '后台完成',
          createdAt: 3,
          kind: 'text'
        }
      ])
    mockedAgentApi.listSessionInteractions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')

    const pending = store.sendPrompt('后台会话')
    await Promise.resolve()
    await Promise.resolve()

    emitEvent({
      type: 'lifecycle.start',
      runId: 'run-background',
      agentId: 'workspace-agent',
      sessionId: 'session-1',
      startedAt: Date.now()
    })

    await store.selectSession('session-2')
    expect(store.latestStatus).toBe('已打开会话：当前会话')
    expect(store.latestPlanSummary).toBe('')

    emitEvent({
      type: 'plan.snapshot',
      runId: 'run-background',
      agentId: 'workspace-agent',
      sessionId: 'session-1',
      plan: {
        planId: 'plan-background',
        version: 1,
        status: 'awaiting_approval',
        title: '后台计划',
        summary: '后台计划摘要',
        filePath: 'plans/background.md',
        approvedSkillIds: [],
        steps: ['步骤一'],
        risks: [],
        openQuestions: []
      }
    })
    emitEvent({
      type: 'assistant.final',
      runId: 'run-background',
      text: '后台完成'
    })
    emitEvent({
      type: 'run.completed',
      runId: 'run-background',
      status: 'success',
      result: successResult,
      endedAt: Date.now()
    })
    resolveRun(successResult)
    await pending

    expect(store.latestStatus).toBe('已打开会话：当前会话')
    expect(store.latestPlanSummary).toBe('')

    await store.selectSession('session-1')

    expect(store.latestStatus).toBe('已完成本轮对话')
    expect(store.latestPlanSummary).toBe('后台计划摘要')
  })

  it('discards stale A -> B -> A hydration responses for the same session', async () => {
    const firstSessionHydration = createDeferred<Array<{
      messageId: number
      role: 'user' | 'assistant'
      text: string
      createdAt: number
      kind: 'text'
    }>>()
    const secondSessionHydration = createDeferred<Array<{
      messageId: number
      role: 'user' | 'assistant'
      text: string
      createdAt: number
      kind: 'text'
    }>>()
    const refreshedFirstSessionHydration = createDeferred<Array<{
      messageId: number
      role: 'user' | 'assistant'
      text: string
      createdAt: number
      kind: 'text'
    }>>()

    mockedAgentApi.listSessions.mockResolvedValueOnce([
      buildSession({ sessionId: 'session-1', title: '会话 A' }),
      buildSession({ sessionId: 'session-2', title: '会话 B', updatedAt: 2 })
    ])
    mockedAgentApi.getSessionMessages
      .mockImplementationOnce(() => firstSessionHydration.promise)
      .mockImplementationOnce(() => secondSessionHydration.promise)
      .mockImplementationOnce(() => refreshedFirstSessionHydration.promise)
    mockedAgentApi.listSessionInteractions.mockResolvedValue([])

    const store = useWorkbenchStore()
    await store.initialize()

    const firstSelect = store.selectSession('session-1')
    await Promise.resolve()
    const selectSecond = store.selectSession('session-2')
    await Promise.resolve()
    const selectFirstAgain = store.selectSession('session-1')
    await Promise.resolve()

    refreshedFirstSessionHydration.resolve([
      {
        messageId: 21,
        role: 'assistant',
        text: 'A 的最新响应',
        createdAt: 3,
        kind: 'text'
      }
    ])
    await selectFirstAgain

    secondSessionHydration.resolve([
      {
        messageId: 11,
        role: 'assistant',
        text: 'B 的响应',
        createdAt: 2,
        kind: 'text'
      }
    ])
    await selectSecond

    firstSessionHydration.resolve([
      {
        messageId: 1,
        role: 'assistant',
        text: 'A 的过期响应',
        createdAt: 1,
        kind: 'text'
      }
    ])
    await firstSelect

    expect(store.activeSessionId).toBe('session-1')
    expect(store.messages).toEqual([
      expect.objectContaining({
        text: 'A 的最新响应'
      })
    ])
    expect(store.latestStatus).toBe('已打开会话：会话 A')
  })

  it('preserves a running session placeholder during rapid A -> B -> A hydration', async () => {
    const { emitEvent, rejectRun } = mockStreamingRunOnce()

    mockedAgentApi.listSessions.mockResolvedValueOnce([
      buildSession({ sessionId: 'session-1', title: '会话 A' }),
      buildSession({ sessionId: 'session-2', title: '会话 B', updatedAt: 2 })
    ])
    mockedAgentApi.getSessionMessages
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          messageId: 11,
          role: 'assistant',
          text: 'B 的历史',
          createdAt: 2,
          kind: 'text'
        }
      ])
      .mockResolvedValueOnce([
        {
          messageId: 21,
          role: 'user',
          text: '继续处理 A',
          createdAt: 3,
          kind: 'text'
        }
      ])

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')

    const pending = store.sendPrompt('继续处理 A')
    await Promise.resolve()
    await Promise.resolve()
    emitEvent({
      type: 'lifecycle.start',
      runId: 'run-1',
      agentId: 'workspace-agent',
      sessionId: 'session-1',
      startedAt: Date.now()
    })

    await store.selectSession('session-2')
    await store.selectSession('session-1')

    expect(store.messages).toHaveLength(2)
    expect(store.messages[0]).toEqual(expect.objectContaining({
      role: 'user',
      text: '继续处理 A'
    }))
    expect(store.messages[1]).toEqual(expect.objectContaining({
      id: expect.stringMatching(/^local-assistant-/),
      role: 'assistant',
      status: 'streaming'
    }))

    rejectRun(new Error('test cleanup'))
    await pending
  })

  it('continues streaming into the preserved placeholder after reopening the session', async () => {
    const { emitEvent, rejectRun } = mockStreamingRunOnce()

    mockedAgentApi.listSessions.mockResolvedValueOnce([
      buildSession({ sessionId: 'session-1', title: '会话 A' }),
      buildSession({ sessionId: 'session-2', title: '会话 B', updatedAt: 2 })
    ])
    mockedAgentApi.getSessionMessages
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          messageId: 11,
          role: 'assistant',
          text: 'B 的历史',
          createdAt: 2,
          kind: 'text'
        }
      ])
      .mockResolvedValueOnce([
        {
          messageId: 21,
          role: 'user',
          text: '继续处理 A',
          createdAt: 3,
          kind: 'text'
        }
      ])

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')

    const pending = store.sendPrompt('继续处理 A')
    await Promise.resolve()
    await Promise.resolve()
    emitEvent({
      type: 'lifecycle.start',
      runId: 'run-1',
      agentId: 'workspace-agent',
      sessionId: 'session-1',
      startedAt: Date.now()
    })

    await store.selectSession('session-2')
    await store.selectSession('session-1')

    emitEvent({
      type: 'assistant.delta',
      runId: 'run-1',
      delta: '新的输出'
    })

    expect(store.messages[1]).toEqual(expect.objectContaining({
      id: expect.stringMatching(/^local-assistant-/),
      role: 'assistant',
      status: 'streaming',
      text: '新的输出'
    }))

    rejectRun(new Error('test cleanup'))
    await pending
  })

  it('removes the transient placeholder once persisted assistant history catches up', async () => {
    const { emitEvent, rejectRun } = mockStreamingRunOnce()

    mockedAgentApi.listSessions.mockResolvedValueOnce([
      buildSession({ sessionId: 'session-1', title: '会话 A' }),
      buildSession({ sessionId: 'session-2', title: '会话 B', updatedAt: 2 })
    ])
    mockedAgentApi.getSessionMessages
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          messageId: 11,
          role: 'assistant',
          text: 'B 的历史',
          createdAt: 2,
          kind: 'text'
        }
      ])
      .mockResolvedValueOnce([
        {
          messageId: 21,
          role: 'user',
          text: '继续处理 A',
          createdAt: 3,
          kind: 'text'
        }
      ])
      .mockResolvedValueOnce([
        {
          messageId: 21,
          role: 'user',
          text: '继续处理 A',
          createdAt: 3,
          kind: 'text'
        },
        {
          messageId: 22,
          role: 'assistant',
          text: 'A 的持久化响应',
          createdAt: 4,
          kind: 'text'
        }
      ])

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')

    const pending = store.sendPrompt('继续处理 A')
    await Promise.resolve()
    await Promise.resolve()
    emitEvent({
      type: 'lifecycle.start',
      runId: 'run-1',
      agentId: 'workspace-agent',
      sessionId: 'session-1',
      startedAt: Date.now()
    })

    await store.selectSession('session-2')
    await store.selectSession('session-1')
    await store.selectSession('session-1')

    expect(store.messages).toEqual([
      expect.objectContaining({
        id: 'persisted-21',
        role: 'user',
        text: '继续处理 A'
      }),
      expect.objectContaining({
        id: 'persisted-22',
        role: 'assistant',
        text: 'A 的持久化响应',
        status: 'done'
      })
    ])

    rejectRun(new Error('test cleanup'))
    await pending
  })

  it('reconciles run failure against the owning session after switching away', async () => {
    let rejectRun: (reason?: unknown) => void = () => {
      throw new Error('runStream rejecter was not captured')
    }

    mockedAgentApi.listSessions.mockResolvedValueOnce([
      buildSession({ sessionId: 'session-1', title: '失败会话' }),
      buildSession({ sessionId: 'session-2', title: '旁路会话', updatedAt: 2 })
    ])
    mockedAgentApi.getSessionMessages
      .mockResolvedValueOnce([
        {
          messageId: 1,
          role: 'user',
          text: '失败会话',
          createdAt: 1,
          kind: 'text'
        }
      ])
      .mockResolvedValueOnce([
        {
          messageId: 11,
          role: 'assistant',
          text: '旁路内容',
          createdAt: 2,
          kind: 'text'
        }
      ])
    mockedAgentApi.listSessionInteractions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    mockedAgentApi.runStream.mockImplementationOnce(async () => {
      return new Promise((_resolve, reject) => {
        rejectRun = reject
      })
    })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')

    const pending = store.sendPrompt('失败会话')
    await Promise.resolve()
    await Promise.resolve()

    await store.selectSession('session-2')
    rejectRun(new Error('stream failed'))
    await pending

    expect(store.messages).toEqual([
      expect.objectContaining({
        text: '旁路内容'
      })
    ])
    expect(store.latestStatus).toBe('已打开会话：旁路会话')
    expect(store.sessions.find(session => session.sessionId === 'session-1')?.activity.active).toBe(false)
    expect(store.sessions.find(session => session.sessionId === 'session-2')?.activity.active).toBe(false)
    expect(store.error).toBe('stream failed')
  })

  it('uses the active-session run state instead of the global running flag for editable history', async () => {
    const successResult = buildRunResult({
      runId: 'run-no-start-yet',
      sessionId: 'session-1',
      assistantMessageId: 2,
      text: '已完成'
    })
    const { resolveRun } = mockStreamingRunOnce()

    mockedAgentApi.listSessions
      .mockResolvedValueOnce([
        buildSession({ sessionId: 'session-1', title: '运行中会话', messageCount: 1 }),
        buildSession({ sessionId: 'session-2', title: '目标会话', updatedAt: 2, messageCount: 1 })
      ])
      .mockResolvedValueOnce([
        buildSession({ sessionId: 'session-1', title: '运行中会话', messageCount: 2 }),
        buildSession({ sessionId: 'session-2', title: '目标会话', updatedAt: 2, messageCount: 1 })
      ])
    mockedAgentApi.getSessionMessages
      .mockResolvedValueOnce([
        {
          messageId: 1,
          role: 'user',
          text: '运行中会话',
          createdAt: 1,
          kind: 'text'
        }
      ])
      .mockResolvedValueOnce([
        {
          messageId: 11,
          role: 'user',
          text: '目标会话最后一条消息',
          createdAt: 2,
          kind: 'text'
        }
      ])

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')

    const pending = store.sendPrompt('运行中会话')
    await Promise.resolve()
    await Promise.resolve()

    await store.selectSession('session-2')

    expect(store.editableUserMessageId).toBe(11)

    resolveRun(successResult)
    await pending
  })

  it('surfaces explicit stop request failures and keeps the run stoppable', async () => {
    const successResult = buildRunResult({
      runId: 'run-stop-fail',
      assistantMessageId: 2,
      text: '处理完成'
    })
    const { emitEvent, resolveRun } = mockStreamingRunOnce()

    mockedAgentApi.createSession.mockResolvedValueOnce(buildSession({
      title: '停止失败任务',
      messageCount: 0
    }))
    mockedAgentApi.listSessions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([buildSession({
        title: '停止失败任务',
        messageCount: 2
      })])
    mockedAgentApi.cancelRun.mockRejectedValueOnce(new Error('HTTP 500'))

    const store = useWorkbenchStore()
    await store.initialize()

    const pending = store.sendPrompt('停止失败任务')
    await Promise.resolve()
    await Promise.resolve()

    emitEvent({
      type: 'lifecycle.start',
      runId: 'run-stop-fail',
      agentId: 'workspace-agent',
      sessionId: 'session-1',
      startedAt: Date.now()
    })

    await store.stopCurrentRun()

    expect(store.error).toBe('停止失败：HTTP 500')
    expect(store.isStopPending).toBe(false)
    expect(store.canStopActiveRun).toBe(true)

    emitEvent({
      type: 'assistant.final',
      runId: 'run-stop-fail',
      text: '处理完成'
    })
    emitEvent({
      type: 'run.completed',
      runId: 'run-stop-fail',
      status: 'success',
      result: successResult,
      endedAt: Date.now()
    })
    resolveRun(successResult)
    await pending
  })

  it('treats cancelled false as an acknowledged no-op while waiting for the terminal run result', async () => {
    const finalResult = buildRunResult({
      runId: 'run-noop',
      assistantMessageId: 2,
      text: '最终完成'
    })
    const { emitEvent, resolveRun } = mockStreamingRunOnce()

    mockedAgentApi.createSession.mockResolvedValueOnce(buildSession({
      title: '竞态停止',
      messageCount: 0
    }))
    mockedAgentApi.listSessions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([buildSession({
        title: '竞态停止',
        messageCount: 2
      })])
    mockedAgentApi.getSessionMessages.mockResolvedValueOnce([
      {
        messageId: 1,
        role: 'user',
        text: '竞态停止',
        createdAt: 1,
        kind: 'text'
      },
      {
        messageId: 2,
        role: 'assistant',
        text: '最终完成',
        createdAt: 2,
        kind: 'text'
      }
    ])
    mockedAgentApi.cancelRun.mockResolvedValueOnce({
      ok: true,
      runId: 'run-noop',
      cancelled: false
    })

    const store = useWorkbenchStore()
    await store.initialize()

    const pending = store.sendPrompt('竞态停止')
    await Promise.resolve()
    await Promise.resolve()

    emitEvent({
      type: 'lifecycle.start',
      runId: 'run-noop',
      agentId: 'workspace-agent',
      sessionId: 'session-1',
      startedAt: Date.now()
    })

    await store.stopCurrentRun()

    expect(store.error).toBeNull()
    expect(store.isStopPending).toBe(true)
    expect(store.latestStatus).toBe('停止请求已确认，等待运行结束')

    emitEvent({
      type: 'assistant.final',
      runId: 'run-noop',
      text: '最终完成'
    })
    emitEvent({
      type: 'run.completed',
      runId: 'run-noop',
      status: 'success',
      result: finalResult,
      endedAt: Date.now()
    })
    resolveRun(finalResult)
    await pending

    expect(store.isStopPending).toBe(false)
    expect(store.messages.at(-1)?.text).toBe('最终完成')
  })

  it('exposes upload conflict confirmation state before retrying overwrite uploads', async () => {
    mockedAgentApi.uploadFile
      .mockRejectedValueOnce(Object.assign(new Error('Upload already exists: upload/input.csv'), {
        code: 'UPLOAD_CONFLICT',
        path: 'upload/input.csv'
      }))
      .mockResolvedValueOnce({
        fileKey: 'upload-1',
        originalName: 'input.csv',
        path: 'upload/input.csv',
        source: 'upload',
        writable: true,
        replaced: true
      })
    mockedAgentApi.getWorkspace.mockResolvedValueOnce(buildWorkspacePayload('workspace-agent', '工作区', [
      {
        fileId: 'upload-1',
        fileKey: 'upload-1',
        path: 'upload/input.csv',
        fileName: 'input.csv',
        source: 'upload',
        groupId: 'upload',
        writable: false,
        addedAt: 100
      }
    ]))

    const store = useWorkbenchStore()
    await store.initialize()
    const uploadPromise = store.uploadFiles([new File(['hello'], 'input.csv', { type: 'text/csv' })])

    await Promise.resolve()

    expect(store.uploadConflictConfirmation).toMatchObject({
      conflictPath: 'upload/input.csv',
      fileName: 'input.csv'
    })
    store.confirmUploadConflict()
    await uploadPromise

    expect(mockedAgentApi.uploadFile).toHaveBeenNthCalledWith(1, 'workspace-agent', expect.any(File), false, undefined)
    expect(mockedAgentApi.uploadFile).toHaveBeenNthCalledWith(2, 'workspace-agent', expect.any(File), true, undefined)
    expect(store.uploadConflictConfirmation).toBeNull()
  })

  it('continues multi-file uploads in order after canceling a conflict', async () => {
    mockedAgentApi.uploadFile
      .mockRejectedValueOnce(Object.assign(new Error('Upload already exists: upload/input.csv'), {
        code: 'UPLOAD_CONFLICT',
        path: 'upload/input.csv'
      }))
      .mockResolvedValueOnce({
        fileKey: 'upload-2',
        originalName: 'report.csv',
        path: 'upload/report.csv',
        source: 'upload',
        writable: true,
        replaced: false
      })
    mockedAgentApi.getWorkspace.mockResolvedValueOnce(buildWorkspacePayload('workspace-agent', '工作区', [
      {
        fileId: 'upload-2',
        fileKey: 'upload-2',
        path: 'upload/report.csv',
        fileName: 'report.csv',
        source: 'upload',
        groupId: 'upload',
        writable: false,
        addedAt: 100
      }
    ]))

    const store = useWorkbenchStore()
    await store.initialize()
    const uploadPromise = store.uploadFiles([
      new File(['hello'], 'input.csv', { type: 'text/csv' }),
      new File(['world'], 'report.csv', { type: 'text/csv' })
    ])

    await Promise.resolve()

    expect(store.uploadConflictConfirmation?.conflictPath).toBe('upload/input.csv')
    expect(mockedAgentApi.uploadFile).toHaveBeenCalledTimes(1)

    store.cancelUploadConflict()
    await uploadPromise

    expect(mockedAgentApi.uploadFile).toHaveBeenCalledTimes(2)
    expect(mockedAgentApi.uploadFile).toHaveBeenNthCalledWith(1, 'workspace-agent', expect.any(File), false, undefined)
    expect(mockedAgentApi.uploadFile).toHaveBeenNthCalledWith(2, 'workspace-agent', expect.any(File), false, undefined)
    expect(mockedAgentApi.getWorkspace).toHaveBeenCalledTimes(2)
    expect(store.workspaceStatus).toBe('已上传 1 个文件')
    expect(store.uploadConflictConfirmation).toBeNull()
  })

  it('keeps normalized chinese uploads readable after open save close and reopen', async () => {
    mockedAgentApi.getWorkspace
      .mockResolvedValueOnce(buildWorkspacePayload('workspace-agent', '工作区', []))
      .mockResolvedValueOnce(buildWorkspacePayload('workspace-agent', '工作区', [
        {
          fileId: 'upload-readable',
          fileKey: 'upload-readable',
          path: 'upload/report.csv',
          fileName: 'report.csv',
          source: 'upload',
          groupId: 'upload',
          writable: true,
          addedAt: 100
        }
      ]))
    mockedAgentApi.uploadFile.mockResolvedValueOnce({
      fileKey: 'upload-readable',
      originalName: 'report.csv',
      path: 'upload/report.csv',
      source: 'upload',
      writable: true,
      replaced: false
    })
    mockedAgentApi.openWorkspaceFile.mockResolvedValueOnce(buildWorkspaceFileDescriptor({
      fileKey: 'upload-readable',
      fileId: 'upload-readable',
      path: 'upload/report.csv',
      fileName: 'report.csv',
      writable: true,
      content: '标题,值\n中文,1\n'
    }))
    mockedAgentApi.saveWorkspaceFile.mockResolvedValueOnce(buildWorkspaceFileDescriptor({
      fileKey: 'upload-readable',
      fileId: 'upload-readable',
      path: 'upload/report.csv',
      fileName: 'report.csv',
      writable: true,
      content: '标题,值\n中文,2\n'
    }))

    const store = useWorkbenchStore()
    await store.initialize()
    await store.uploadFiles([new File(['placeholder'], 'report.csv', { type: 'text/csv' })])
    await store.openWorkspaceFile('upload-readable')

    expect(store.activeWorkspaceFile?.content).toBe('标题,值\n中文,1\n')

    store.updateWorkspaceFileContent('upload-readable', '标题,值\n中文,2\n')
    await store.closeWorkspaceFile('upload-readable')
    await store.openWorkspaceFile('upload-readable')

    expect(mockedAgentApi.saveWorkspaceFile).toHaveBeenCalledWith('upload-readable', {
      content: '标题,值\n中文,2\n',
      mode: 'csv',
      mmlMetadata: null
    })
    expect(store.activeWorkspaceFile?.content).toBe('标题,值\n中文,2\n')
    expect(store.workspaceStatus).toBe('已保存 report.csv')
  })

  it('surfaces unsupported upload failures without opening a rejected file', async () => {
    mockedAgentApi.getWorkspace.mockResolvedValueOnce(buildWorkspacePayload('workspace-agent', '工作区', []))
    mockedAgentApi.uploadFile.mockRejectedValueOnce(Object.assign(
      new Error('Upload content encoding is unsupported or file is not valid text'),
      {
        code: 'UPLOAD_UNSUPPORTED_ENCODING',
        status: 415
      }
    ))

    const store = useWorkbenchStore()
    await store.initialize()
    await store.uploadFiles([new File(['bad'], 'bad.csv', { type: 'text/csv' })])

    expect(store.workspaceStatus).toBe('文件上传失败')
    expect(store.error).toBe('Upload content encoding is unsupported or file is not valid text')
    expect(store.workspaceOpen).toBe(false)
    expect(store.activeWorkspaceFileId).toBeNull()
    expect(store.workspaceFiles).toHaveLength(0)
    expect(mockedAgentApi.openWorkspaceFile).not.toHaveBeenCalled()
  })

  it('converges protocol messages from terminal structured results without assistant text stream', async () => {
    const finalResult = buildRunResult({
      runId: 'run-protocol',
      text: '请补充列索引',
      assistantMessageId: 2,
      skillTriggered: 'dpi-new-bwm-pcc',
      metrics: {
        tools: [
          {
            provider: 'skill',
            tool: 'skill:skill',
            latencyMs: 2,
            success: true
          },
          {
            provider: 'local',
            tool: 'local:question',
            latencyMs: 3,
            success: true
          }
        ],
        totalLatencyMs: 5,
        failures: []
      },
      output: {
        kind: 'protocol',
        text: '请补充列索引',
        protocol: {
          version: '1.0',
          components: [{ type: 'text', id: 'title', content: '请补充列索引' }],
          actions: []
        }
      }
    })

    mockedAgentApi.createSession.mockResolvedValueOnce(buildSession({
      title: '补充信息',
      messageCount: 0
    }))
    mockedAgentApi.listSessions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([buildSession({ title: '补充信息', messageCount: 2 })])
    mockedAgentApi.getSessionMessages.mockResolvedValueOnce([
      {
        messageId: 1,
        role: 'user',
        text: '补充信息',
        createdAt: 1,
        kind: 'text'
      },
      {
        messageId: 2,
        role: 'assistant',
        text: '请补充列索引',
        createdAt: 2,
        kind: 'protocol',
        protocol: {
          version: '1.0',
          components: [{ type: 'text', id: 'title', content: '请补充列索引' }],
          actions: []
        },
        protocolState: null
      }
    ])
    mockedAgentApi.runStream.mockImplementationOnce(async (_request, onEvent) => {
      onEvent({ type: 'run.completed', runId: 'run-protocol', status: 'success', result: finalResult, endedAt: Date.now() })
      return finalResult
    })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.sendPrompt('补充信息')

    expect(store.messages.at(-1)).toMatchObject({
      kind: 'protocol',
      text: '请补充列索引',
      assistantHeader: {
        label: '使用 Skill: DPI 规划入口 · 等待你确认',
        tone: 'summary'
      }
    })
  })

  it('omits question tool summaries when the completed result already waits for confirmation', async () => {
    const finalResult = buildRunResult({
      runId: 'run-awaiting-interaction',
      text: '请选择CPU档位（针对游戏用途），选择后我会继续。',
      assistantMessageId: 2,
      metrics: {
        tools: [
          {
            provider: 'skill',
            tool: 'skill:read_asset',
            latencyMs: 2,
            success: true
          },
          {
            provider: 'local',
            tool: 'local:question',
            latencyMs: 3,
            success: true
          }
        ],
        totalLatencyMs: 5,
        failures: []
      },
      output: {
        kind: 'awaiting-interaction',
        text: '请选择CPU档位（针对游戏用途），选择后我会继续。',
        interaction: {
          interactionId: 'interaction-1',
          kind: 'question',
          status: 'pending',
          payload: {
            questionId: 'question-1',
            title: '补充信息',
            prompt: '请选择CPU档位（针对游戏用途）：',
            required: true,
            fields: [
              {
                id: 'answer',
                label: 'CPU档位',
                type: 'select',
                options: [
                  { label: '入门档', value: 'entry' },
                  { label: '主流档', value: 'mainstream' }
                ]
              },
              {
                id: 'notes',
                label: '补充说明',
                type: 'text'
              }
            ],
            degraded: {
              reason: '结构化问题收集失败',
              referenceOptions: ['入门档', '主流档']
            }
          }
        }
      } as AgentRunResult['output']
    })

    mockedAgentApi.createSession.mockResolvedValueOnce(buildSession({
      title: '等待确认',
      messageCount: 0
    }))
    mockedAgentApi.listSessions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([buildSession({ title: '等待确认', messageCount: 2 })])
    mockedAgentApi.getSessionMessages.mockResolvedValueOnce([
      {
        messageId: 1,
        role: 'user',
        text: '等待确认',
        createdAt: 1,
        kind: 'text'
      },
      {
        messageId: 2,
        role: 'assistant',
        text: '请选择CPU档位（针对游戏用途），选择后我会继续。',
        createdAt: 2,
        kind: 'text'
      }
    ])
    mockedAgentApi.listSessionInteractions.mockResolvedValueOnce([
      buildPendingQuestionInteraction({
        interactionId: 'interaction-1',
        payload: {
          questionId: 'question-1',
          title: '补充信息',
          prompt: '请选择CPU档位（针对游戏用途）：',
          required: true,
          fields: [
            {
              id: 'answer',
              label: 'CPU档位',
              type: 'select',
              options: [
                { label: '入门档', value: 'entry' },
                { label: '主流档', value: 'mainstream' }
              ]
            },
            {
              id: 'notes',
              label: '补充说明',
              type: 'text'
            }
          ],
          degraded: {
            reason: '结构化问题收集失败',
            referenceOptions: ['入门档', '主流档']
          }
        }
      })
    ])
    mockedAgentApi.runStream.mockImplementationOnce(async (_request, onEvent) => {
      onEvent({ type: 'run.completed', runId: 'run-awaiting-interaction', status: 'awaiting-interaction', result: finalResult, endedAt: Date.now() })
      return finalResult
    })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.sendPrompt('等待确认')

    const latestAssistantTextMessage = [...store.messages]
      .reverse()
      .find(message => message.kind === 'text' && message.role === 'assistant')

    expect(latestAssistantTextMessage?.assistantHeader).toMatchObject({
      label: '使用 Tools: 读取技能文件 · 等待你确认',
      tone: 'summary'
    })
    expect(store.pendingInteraction).toMatchObject({
      interactionId: 'interaction-1',
      payload: {
        prompt: '请选择CPU档位（针对游戏用途）：'
      }
    })
    expect(store.messages.at(-1)).toMatchObject({
      kind: 'question',
      id: 'interaction-1'
    })
    expect(latestAssistantTextMessage).toMatchObject({
      kind: 'text',
      text: '请选择CPU档位（针对游戏用途），选择后我会继续。'
    })
    expect(latestAssistantTextMessage?.text).not.toContain('入门档')
    expect(latestAssistantTextMessage?.text).not.toContain('结构化问题收集失败')
  })

  it('uses bootstrap tool display names for completed assistant headers and falls back for unmapped tools', async () => {
    const finalResult = buildRunResult({
      runId: 'run-tool-display-names',
      text: '处理完成',
      assistantMessageId: 2,
      metrics: {
        tools: [
          {
            provider: 'skill',
            tool: 'skill:read_asset',
            latencyMs: 3,
            success: true
          },
          {
            provider: 'local',
            tool: 'local:bash',
            latencyMs: 4,
            success: true
          }
        ],
        totalLatencyMs: 7,
        failures: []
      }
    })

    mockedAgentApi.createSession.mockResolvedValueOnce(buildSession({
      title: '读取技能文件',
      messageCount: 0
    }))
    mockedAgentApi.listSessions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([buildSession({ title: '读取技能文件', messageCount: 2 })])
    mockedAgentApi.getSessionMessages.mockResolvedValueOnce([
      {
        messageId: 1,
        role: 'user',
        text: '读取技能文件',
        createdAt: 1,
        kind: 'text'
      },
      {
        messageId: 2,
        role: 'assistant',
        text: '处理完成',
        createdAt: 2,
        kind: 'text'
      }
    ])
    mockedAgentApi.runStream.mockImplementationOnce(async (_request, onEvent) => {
      onEvent({ type: 'run.completed', runId: 'run-tool-display-names', status: 'success', result: finalResult, endedAt: Date.now() })
      return finalResult
    })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.sendPrompt('读取技能文件')

    expect(store.messages.at(-1)?.assistantHeader).toMatchObject({
      label: '使用 Tools: 读取技能文件, bash',
      tone: 'summary'
    })
  })

  it('converges domain results from terminal structured results without assistant text stream', async () => {
    const finalResult = buildRunResult({
      runId: 'run-artifact',
      text: '已生成产物：artifact-1。',
      assistantMessageId: 2,
      metrics: {
        tools: [{
          provider: 'local',
          tool: 'local:bash',
          latencyMs: 6,
          success: true
        }],
        totalLatencyMs: 6,
        failures: []
      },
      output: {
        kind: 'domain-result',
        text: '已生成产物：artifact-1。',
        domainResult: {
          kind: 'artifact_ref',
          data: {
            fileId: 'artifact-1'
          }
        }
      }
    })

    mockedAgentApi.createSession.mockResolvedValueOnce(buildSession({
      title: '生成产物',
      messageCount: 0
    }))
    mockedAgentApi.listSessions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([buildSession({ title: '生成产物', messageCount: 2 })])
    mockedAgentApi.getSessionMessages.mockResolvedValueOnce([
      {
        messageId: 1,
        role: 'user',
        text: '生成产物',
        createdAt: 1,
        kind: 'text'
      },
      {
        messageId: 2,
        role: 'assistant',
        text: '已生成产物：artifact-1。',
        createdAt: 2,
        kind: 'result',
        domainResult: {
          kind: 'artifact_ref',
          data: {
            fileId: 'artifact-1'
          }
        }
      }
    ])
    mockedAgentApi.runStream.mockImplementationOnce(async (_request, onEvent) => {
      onEvent({ type: 'run.completed', runId: 'run-artifact', status: 'success', result: finalResult, endedAt: Date.now() })
      return finalResult
    })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.sendPrompt('生成产物')

    expect(store.messages.at(-1)).toMatchObject({
      kind: 'result',
      text: '已生成产物：artifact-1。',
      assistantHeader: {
        label: '使用 Tools: bash · 生成结果',
        tone: 'summary'
      }
    })
  })

  it('refreshes workspace write outputs without auto-opening and keeps later requests path-first', async () => {
    const writeResult = buildRunResult({
      runId: 'run-write',
      text: '已生成产物：reports/final/result.txt。',
      assistantMessageId: 2,
      metrics: {
        tools: [{
          provider: 'local',
          tool: 'local:write',
          latencyMs: 6,
          success: true
        }],
        totalLatencyMs: 6,
        failures: []
      },
      output: {
        kind: 'domain-result',
        text: '已生成产物：reports/final/result.txt。',
        domainResult: {
          kind: 'artifact_ref',
          data: {
            fileId: 'backend-output-1',
            fileKey: 'output-1',
            fileName: 'reports/final/result.txt',
            path: 'project/reports/final/result.txt'
          }
        }
      }
    })
    const followupResult = buildRunResult({
      runId: 'run-followup',
      text: '继续完成'
    })
    const refreshedWorkspace = buildWorkspacePayload('workspace-agent', '工作区', [
      {
        fileId: 'file-1',
        fileKey: 'file-1',
        path: 'upload/input.csv',
        fileName: 'input.csv',
        source: 'upload',
        groupId: 'upload',
        writable: false,
        addedAt: 100
      },
      {
        fileId: 'output-1',
        fileKey: 'output-1',
        path: 'project/reports/final/result.txt',
        fileName: 'reports/final/result.txt',
        source: 'project',
        groupId: 'project',
        writable: true,
        addedAt: 200
      }
    ])

    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession()])
    mockedAgentApi.getWorkspace
      .mockResolvedValueOnce(buildWorkspacePayload())
      .mockResolvedValueOnce(refreshedWorkspace)
      .mockResolvedValueOnce(refreshedWorkspace)
    mockedAgentApi.getSessionMessages
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          messageId: 1,
          role: 'user',
          text: '生成文件',
          createdAt: 1,
          kind: 'text'
        },
        {
          messageId: 2,
          role: 'assistant',
          text: '已生成产物：reports/final/result.txt。',
          createdAt: 2,
          kind: 'result',
          domainResult: writeResult.output.kind === 'domain-result' ? writeResult.output.domainResult : undefined
        }
      ])
      .mockResolvedValueOnce([
        {
          messageId: 1,
          role: 'user',
          text: '生成文件',
          createdAt: 1,
          kind: 'text'
        },
        {
          messageId: 2,
          role: 'assistant',
          text: '已生成产物：reports/final/result.txt。',
          createdAt: 2,
          kind: 'result',
          domainResult: writeResult.output.kind === 'domain-result' ? writeResult.output.domainResult : undefined
        },
        {
          messageId: 3,
          role: 'user',
          text: '继续处理',
          createdAt: 3,
          kind: 'text'
        },
        {
          messageId: 4,
          role: 'assistant',
          text: '继续完成',
          createdAt: 4,
          kind: 'text'
        }
      ])

    let followupRequest: AgentRunRequest | null = null
    mockedAgentApi.runStream
      .mockImplementationOnce(async (_request, onEvent) => {
        onEvent({ type: 'run.completed', runId: 'run-write', status: 'success', result: writeResult, endedAt: Date.now() })
        return writeResult
      })
      .mockImplementationOnce(async (request, onEvent) => {
        followupRequest = request
        onEvent({ type: 'run.completed', runId: 'run-followup', status: 'success', result: followupResult, endedAt: Date.now() })
        return followupResult
      })
    mockedAgentApi.openWorkspaceFile.mockResolvedValueOnce(buildWorkspaceFileDescriptor({
      fileKey: 'output-1',
      fileId: 'backend-output-1',
      path: 'project/reports/final/result.txt',
      fileName: 'reports/final/result.txt',
      source: 'project',
      writable: true,
      mode: 'text',
      content: 'alpha'
    }))

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')
    await store.sendPrompt('生成文件')

    expect(store.workspaceFiles).toEqual(expect.arrayContaining([
      expect.objectContaining({
        fileId: 'output-1',
        fileName: 'reports/final/result.txt',
        source: 'project'
      })
    ]))
    expect(store.workspaceOpen).toBe(false)
    expect(store.activeWorkspaceFileId).toBeNull()

    await store.sendPrompt('继续处理')

    expect(followupRequest).toEqual(expect.objectContaining({
      invocationContext: {
        activeFile: undefined
      }
    }))

    await store.openWorkspaceFile('output-1')

    expect(store.workspaceOpen).toBe(true)
    expect(store.activeWorkspaceFileId).toBe('output-1')
  })

  it('clears transient assistant headers after returning to a blank draft and switching sessions', async () => {
    const finalResult = buildRunResult({
      text: '处理完成',
      assistantMessageId: 2,
      metrics: {
        tools: [{
          provider: 'local',
          tool: 'readFile',
          latencyMs: 8,
          success: true
        }],
        totalLatencyMs: 8,
        failures: []
      }
    })
    const sessionHistory = [
      {
        messageId: 1,
        role: 'user' as const,
        text: '你好',
        createdAt: 1,
        kind: 'text' as const
      },
      {
        messageId: 2,
        role: 'assistant' as const,
        text: '处理完成',
        createdAt: 2,
        kind: 'text' as const
      }
    ]

    mockedAgentApi.createSession.mockResolvedValueOnce(buildSession({
      title: '你好',
      messageCount: 0
    }))
    mockedAgentApi.listSessions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        buildSession({ title: '你好', messageCount: 2 }),
        buildSession({
          sessionId: 'session-2',
          title: '历史二',
          messageCount: 1,
          preview: '其他消息'
        })
      ])
    mockedAgentApi.getSessionMessages
      .mockResolvedValueOnce(sessionHistory)
      .mockResolvedValueOnce([
        {
          messageId: 11,
          role: 'assistant',
          text: '其他会话',
          createdAt: 3,
          kind: 'text'
        }
      ])
      .mockResolvedValueOnce(sessionHistory)
    mockedAgentApi.runStream.mockImplementationOnce(async (_request, onEvent) => {
      onEvent({ type: 'run.completed', runId: 'run-1', status: 'success', result: finalResult, endedAt: Date.now() })
      return finalResult
    })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.sendPrompt('你好')

    expect(store.messages.at(-1)?.assistantHeader?.label).toBe('使用 Tools: readFile')

    store.startNewConversation()
    await store.selectSession('session-2')
    await store.selectSession('session-1')

    expect(store.messages.at(-1)?.assistantHeader).toBeUndefined()
  })

  it('clears transient assistant headers after switching agents', async () => {
    const secondAgent = {
      id: 'workspace-agent-2',
      name: '第二智能体',
      description: '第二工作区助手',
      version: '1.0.0',
      skillCount: 0,
      runtime: {
        provider: 'openai',
        modelName: 'gpt-test',
        hasApiKey: true,
        hasCustomHeaders: false,
        source: 'default' as const
      },
      presentation: {
        title: '第二智能体',
        summary: '第二工作区助手',
        role: 'assistant',
        capabilities: []
      },
      skills: []
    }
    const finalResult = buildRunResult({
      text: '处理完成',
      assistantMessageId: 2,
      metrics: {
        tools: [{
          provider: 'local',
          tool: 'readFile',
          latencyMs: 8,
          success: true
        }],
        totalLatencyMs: 8,
        failures: []
      }
    })
    const sessionHistory = [
      {
        messageId: 1,
        role: 'user' as const,
        text: '你好',
        createdAt: 1,
        kind: 'text' as const
      },
      {
        messageId: 2,
        role: 'assistant' as const,
        text: '处理完成',
        createdAt: 2,
        kind: 'text' as const
      }
    ]

    mockedAgentApi.listAgents.mockResolvedValueOnce([
      { id: 'workspace-agent', name: '小曼智能体', description: 'desc', version: '1.0.0', skillCount: 4 },
      { id: 'workspace-agent-2', name: '第二智能体', description: 'desc', version: '1.0.0', skillCount: 0 }
    ])
    mockedAgentApi.getAgent
      .mockResolvedValueOnce(buildAgent())
      .mockResolvedValueOnce(secondAgent)
      .mockResolvedValueOnce(buildAgent())
    mockedAgentApi.bootstrap
      .mockResolvedValueOnce(buildBootstrap())
      .mockResolvedValueOnce(buildBootstrap())
      .mockResolvedValueOnce(buildBootstrap())
    mockedAgentApi.getWorkspace
      .mockResolvedValueOnce(buildWorkspacePayload('workspace-agent'))
      .mockResolvedValueOnce(buildWorkspacePayload('workspace-agent'))
      .mockResolvedValueOnce(buildWorkspacePayload('workspace-agent-2', '第二工作区', []))
      .mockResolvedValueOnce(buildWorkspacePayload('workspace-agent'))
    mockedAgentApi.createSession.mockResolvedValueOnce(buildSession({
      title: '你好',
      messageCount: 0
    }))
    mockedAgentApi.listSessions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([buildSession({ title: '你好', messageCount: 2 })])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([buildSession({ title: '你好', messageCount: 2 })])
    mockedAgentApi.getSessionMessages
      .mockResolvedValueOnce(sessionHistory)
      .mockResolvedValueOnce(sessionHistory)
    mockedAgentApi.runStream.mockImplementationOnce(async (_request, onEvent) => {
      onEvent({ type: 'run.completed', runId: 'run-1', status: 'success', result: finalResult, endedAt: Date.now() })
      return finalResult
    })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.sendPrompt('你好')

    expect(store.messages.at(-1)?.assistantHeader?.label).toBe('使用 Tools: readFile')

    await store.selectAgent('workspace-agent-2')
    await store.selectAgent('workspace-agent')
    await store.selectSession('session-1')

    expect(store.messages.at(-1)?.assistantHeader).toBeUndefined()
  })

  it('toggles reading mode per eligible assistant message without affecting neighbors', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession()])
    mockedAgentApi.getSessionMessages.mockResolvedValueOnce([
      {
        messageId: 1,
        role: 'user',
        text: '请整理一下',
        createdAt: 1,
        kind: 'text'
      },
      {
        messageId: 2,
        role: 'assistant',
        text: '# 方案\n\n- 第一步\n- 第二步',
        createdAt: 2,
        kind: 'text'
      },
      {
        messageId: 3,
        role: 'assistant',
        text: '# 另一条\n\n- Alpha\n- Beta',
        createdAt: 3,
        kind: 'text'
      },
      {
        messageId: 4,
        role: 'assistant',
        text: '可以，我继续处理。',
        createdAt: 4,
        kind: 'text'
      }
    ])

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')

    expect(store.messages.find(message => message.id === 'persisted-2')).toMatchObject({
      readingModeEligible: true,
      displayMode: 'reading'
    })
    expect(store.messages.find(message => message.id === 'persisted-3')).toMatchObject({
      readingModeEligible: true,
      displayMode: 'reading'
    })
    expect(store.messages.find(message => message.id === 'persisted-4')).toMatchObject({
      readingModeEligible: false,
      displayMode: 'raw'
    })

    store.toggleAssistantReadingMode('persisted-2')

    expect(store.messages.find(message => message.id === 'persisted-2')).toMatchObject({
      readingModeEligible: true,
      displayMode: 'raw'
    })
    expect(store.messages.find(message => message.id === 'persisted-3')).toMatchObject({
      readingModeEligible: true,
      displayMode: 'reading'
    })

    store.toggleAssistantReadingMode('persisted-2')
    store.toggleAssistantReadingMode('persisted-4')

    expect(store.messages.find(message => message.id === 'persisted-2')).toMatchObject({
      readingModeEligible: true,
      displayMode: 'reading'
    })
    expect(store.messages.find(message => message.id === 'persisted-4')).toMatchObject({
      readingModeEligible: false,
      displayMode: 'raw'
    })
  })

  it('recomputes assistant reading mode after reopening the session instead of restoring overrides', async () => {
    const sessionHistory = [
      {
        messageId: 1,
        role: 'user' as const,
        text: '请整理一下',
        createdAt: 1,
        kind: 'text' as const
      },
      {
        messageId: 2,
        role: 'assistant' as const,
        text: '# 方案\n\n- 第一步\n- 第二步',
        createdAt: 2,
        kind: 'text' as const
      }
    ]

    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession()])
    mockedAgentApi.getSessionMessages
      .mockResolvedValueOnce(sessionHistory)
      .mockResolvedValueOnce(sessionHistory)

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')

    store.toggleAssistantReadingMode('persisted-2')
    expect(store.messages.find(message => message.id === 'persisted-2')).toMatchObject({
      displayMode: 'raw'
    })

    store.startNewConversation()
    await store.selectSession('session-1')

    expect(store.messages.find(message => message.id === 'persisted-2')).toMatchObject({
      readingModeEligible: true,
      displayMode: 'reading'
    })
  })

  it('keeps streaming assistant text raw until completion and then recomputes reading mode from history', async () => {
    const structuredReply = '# 总结\n\n- 第一步\n- 第二步'
    const finalResult = buildRunResult({
      assistantMessageId: 2,
      text: structuredReply,
      output: {
        kind: 'text',
        text: structuredReply
      }
    })

    mockedAgentApi.createSession.mockResolvedValueOnce(buildSession({
      title: '请整理一下',
      messageCount: 0
    }))
    mockedAgentApi.listSessions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([buildSession({ title: '请整理一下', messageCount: 2 })])
    mockedAgentApi.getSessionMessages.mockResolvedValueOnce([
      {
        messageId: 1,
        role: 'user',
        text: '请整理一下',
        createdAt: 1,
        kind: 'text'
      },
      {
        messageId: 2,
        role: 'assistant',
        text: structuredReply,
        createdAt: 2,
        kind: 'text'
      }
    ])

    let store!: ReturnType<typeof useWorkbenchStore>
    mockedAgentApi.runStream.mockImplementationOnce(async (_request, onEvent) => {
      onEvent({ type: 'assistant.delta', runId: 'run-1', delta: structuredReply })
      expect(store.messages.at(-1)).toMatchObject({
        status: 'streaming',
        readingModeEligible: false,
        displayMode: 'raw'
      })

      onEvent({ type: 'assistant.final', runId: 'run-1', text: structuredReply })
      expect(store.messages.at(-1)).toMatchObject({
        status: 'done',
        readingModeEligible: false,
        displayMode: 'raw'
      })

      return finalResult
    })

    store = useWorkbenchStore()
    await store.initialize()
    await store.sendPrompt('请整理一下')

    expect(store.messages.at(-1)).toMatchObject({
      id: 'persisted-2',
      status: 'done',
      readingModeEligible: true,
      displayMode: 'reading'
    })
  })

  it('returns to a blank shell when deleting the active session', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([
      buildSession({
        activity: {
          active: true,
          state: 'running',
          runId: 'run-1'
        }
      })
    ])
    mockedAgentApi.getSessionMessages.mockResolvedValueOnce([
      {
        messageId: 1,
        role: 'user',
        text: '历史消息',
        createdAt: 1,
        kind: 'text'
      }
    ])

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')
    await store.openWorkspaceFile('file-1')
    await store.deleteSession('session-1')

    expect(mockedAgentApi.deleteSession).toHaveBeenCalledWith('workspace-agent', 'session-1')
    expect(store.activeSessionId).toBeNull()
    expect(store.messages).toHaveLength(0)
    expect(store.workspaceOpen).toBe(true)
    expect(store.sessions).toHaveLength(0)
  })

  it('rolls back an optimistic delete when the backend request fails', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession()])
    mockedAgentApi.getSessionMessages.mockResolvedValueOnce([
      {
        messageId: 1,
        role: 'user',
        text: '历史消息',
        createdAt: 1,
        kind: 'text'
      }
    ])
    mockedAgentApi.deleteSession.mockRejectedValueOnce(new Error('delete failed'))

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')
    await store.deleteSession('session-1')

    expect(store.activeSessionId).toBe('session-1')
    expect(store.sessions.map(session => session.sessionId)).toEqual(['session-1'])
    expect(store.messages).toHaveLength(1)
    expect(store.workspaceStatus).toBe('会话删除失败')
    expect(store.error).toBe('delete failed')
  })

  it('clears historical sessions while keeping the current session selected', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([
      buildSession({ sessionId: 'session-current', title: '当前会话' }),
      buildSession({ sessionId: 'session-old-1', title: '历史一', updatedAt: 3 }),
      buildSession({ sessionId: 'session-old-2', title: '历史二', updatedAt: 4 })
    ])
    mockedAgentApi.getSessionMessages.mockResolvedValueOnce([
      {
        messageId: 1,
        role: 'user',
        text: '当前消息',
        createdAt: 1,
        kind: 'text'
      }
    ])
    mockedAgentApi.clearHistorySessions.mockResolvedValue({
      deletedCount: 2,
      excludedSessionId: 'session-current',
      skippedActiveSessionIds: []
    })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-current')
    await store.clearHistorySessions()

    expect(mockedAgentApi.clearHistorySessions).toHaveBeenCalledWith('workspace-agent', 'session-current')
    expect(store.activeSessionId).toBe('session-current')
    expect(store.sessions.map(session => session.sessionId)).toEqual(['session-current'])
    expect(store.workspaceStatus).toBe('已清空 2 条历史会话')
  })

  it('clears all sessions when no current session is selected', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([
      buildSession({ sessionId: 'session-old-1', title: '历史一' }),
      buildSession({ sessionId: 'session-old-2', title: '历史二', updatedAt: 4 })
    ])
    mockedAgentApi.clearHistorySessions.mockResolvedValue({
      deletedCount: 2,
      excludedSessionId: null,
      skippedActiveSessionIds: []
    })

    const store = useWorkbenchStore()
    await store.initialize()
    store.startNewConversation()
    await store.clearHistorySessions()

    expect(mockedAgentApi.clearHistorySessions).toHaveBeenCalledWith('workspace-agent', null)
    expect(store.activeSessionId).toBeNull()
    expect(store.sessions).toHaveLength(0)
    expect(store.workspaceStatus).toBe('已清空 2 条历史会话')
  })

  it('ignores late reloads and session refreshes for a deleted session', async () => {
    const historyDeferred = createDeferred<Array<{
      messageId: number
      role: 'user'
      text: string
      createdAt: number
      kind: 'text'
    }>>()
    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession()])
    mockedAgentApi.getSessionMessages.mockReturnValueOnce(historyDeferred.promise)
    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession()])

    const store = useWorkbenchStore()
    await store.initialize()
    const selectPromise = store.selectSession('session-1')
    await store.deleteSession('session-1')
    historyDeferred.resolve([
      {
        messageId: 1,
        role: 'user',
        text: '迟到消息',
        createdAt: 1,
        kind: 'text'
      }
    ])
    await selectPromise
    await store.refreshSessions()

    expect(store.activeSessionId).toBeNull()
    expect(store.sessions).toHaveLength(0)
    expect(store.messages).toHaveLength(0)
  })

  it('ignores late stream callbacks for a deleted session', async () => {
    const { emitEvent, resolveRun } = mockStreamingRunOnce()
    mockedAgentApi.createSession.mockResolvedValueOnce(buildSession({
      sessionId: 'session-late',
      title: '迟到流'
    }))
    mockedAgentApi.listSessions.mockResolvedValueOnce([])
    mockedAgentApi.listSessions.mockResolvedValueOnce([
      buildSession({
        sessionId: 'session-late',
        title: '迟到流'
      })
    ])

    const store = useWorkbenchStore()
    await store.initialize()
    const sendPromise = store.sendPrompt('继续处理')
    await Promise.resolve()
    await Promise.resolve()

    await store.deleteSession('session-late')

    emitEvent({
      type: 'assistant.delta',
      runId: 'run-1',
      delta: '迟到输出'
    })
    emitEvent({
      type: 'assistant.final',
      runId: 'run-1',
      text: '迟到输出'
    })
    emitEvent({
      type: 'run.completed',
      runId: 'run-1',
      status: 'success',
      endedAt: Date.now(),
      result: buildRunResult({
        runId: 'run-1',
        sessionId: 'session-late'
      })
    })
    resolveRun(buildRunResult({
      runId: 'run-1',
      sessionId: 'session-late'
    }))
    await sendPromise

    expect(store.activeSessionId).toBeNull()
    expect(store.sessions).toHaveLength(0)
    expect(store.messages).toHaveLength(0)
  })

  it('skips active sessions during bulk clear', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([
      buildSession({
        sessionId: 'session-owner',
        title: '你好',
        activity: {
          active: true,
          state: 'running',
          runId: 'run-1'
        }
      }),
      buildSession({ sessionId: 'session-viewing', title: '当前会话', updatedAt: 3 })
    ])
    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-viewing')
    await store.clearHistorySessions()

    expect(mockedAgentApi.clearHistorySessions).not.toHaveBeenCalled()
    expect(store.workspaceStatus).toBe('暂无可清空历史会话')
  })

  it('opens the workspace only after an explicit file-open action', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession()])

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')

    expect(store.workspaceOpen).toBe(false)

    store.selectWorkspaceFile('file-1')

    expect(store.workspaceOpen).toBe(false)

    await store.openWorkspaceFile('file-1')

    expect(store.workspaceOpen).toBe(true)
    expect(store.activeWorkspaceFile?.fileName).toBe('input.csv')
  })

  it('downloads a workspace file through the scoped backend contract and triggers a browser attachment save', async () => {
    const createObjectURL = vi.fn(() => 'blob:workspace-file')
    const revokeObjectURL = vi.fn()
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.downloadWorkspaceFile('file-1')

    expect(mockedAgentApi.downloadWorkspaceFile).toHaveBeenCalledWith('workspace-agent', 'file-1')
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:workspace-file')
    expect(store.workspaceStatus).toBe('已下载 input.csv')

    clickSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('copies the exact workspace file name to the clipboard and reports success explicitly', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.copyWorkspaceFileName('file-1')

    expect(writeText).toHaveBeenCalledWith('input.csv')
    expect(store.workspaceStatus).toBe('已复制文件名 input.csv')
    expect(store.error).toBeNull()
  })

  it('surfaces clipboard write failures explicitly when copying a workspace file name', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard denied'))
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.copyWorkspaceFileName('file-1')

    expect(store.workspaceStatus).toBe('复制文件名失败')
    expect(store.error).toBe('clipboard denied')
  })

  it('keeps workspace selection and editor state unchanged when workspace file download fails', async () => {
    mockedAgentApi.downloadWorkspaceFile.mockRejectedValueOnce(new Error('download failed'))

    const store = useWorkbenchStore()
    await store.initialize()
    await store.openWorkspaceFile('file-1')
    const beforeContent = store.activeWorkspaceFile?.content

    await store.downloadWorkspaceFile('file-1')

    expect(store.error).toBe('download failed')
    expect(store.workspaceStatus).toBe('文件下载失败')
    expect(store.selectedWorkspaceFileId).toBe('file-1')
    expect(store.activeWorkspaceFileId).toBe('file-1')
    expect(store.workspaceOpen).toBe(true)
    expect(store.activeWorkspaceFile?.content).toBe(beforeContent)
  })

  it('deletes a workspace file without using a browser confirmation dialog', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockedAgentApi.getWorkspace
      .mockResolvedValueOnce(buildWorkspacePayload('workspace-agent', '工作区', [
        {
          fileId: 'file-1',
          fileKey: 'file-1',
          path: 'upload/input.csv',
          fileName: 'input.csv',
          source: 'upload',
          groupId: 'upload',
          writable: true,
          addedAt: 100
        }
      ]))
      .mockResolvedValueOnce(buildWorkspacePayload('workspace-agent', '工作区', []))
    const store = useWorkbenchStore()
    await store.initialize()
    await store.deleteWorkspaceFile('file-1')

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(mockedAgentApi.deleteWorkspaceFile).toHaveBeenCalledWith('workspace-agent', 'file-1')
    expect(store.workspaceFiles.map(file => file.fileId)).toEqual([])
    confirmSpy.mockRestore()
  })

  it('refreshes workspace metadata after a successful workspace file deletion', async () => {
    mockedAgentApi.getWorkspace
      .mockResolvedValueOnce(buildWorkspacePayload('workspace-agent', '工作区', [
        {
          fileId: 'file-1',
          fileKey: 'file-1',
          path: 'upload/input.csv',
          fileName: 'input.csv',
          source: 'upload',
          groupId: 'upload',
          writable: false,
          addedAt: 100
        },
        {
          fileId: 'file-2',
          fileKey: 'file-2',
          path: 'project/next.md',
          fileName: 'next.md',
          source: 'project',
          groupId: 'project',
          writable: true,
          addedAt: 101
        }
      ]))
      .mockResolvedValueOnce(buildWorkspacePayload('workspace-agent', '工作区', [
        {
          fileId: 'file-2',
          fileKey: 'file-2',
          path: 'project/next.md',
          fileName: 'next.md',
          source: 'project',
          groupId: 'project',
          writable: true,
          addedAt: 101
        }
      ]))

    const store = useWorkbenchStore()
    await store.initialize()
    await store.deleteWorkspaceFile('file-1')

    expect(mockedAgentApi.deleteWorkspaceFile).toHaveBeenCalledWith('workspace-agent', 'file-1')
    expect(store.workspaceFiles.map(file => file.fileId)).toEqual(['file-2'])
    expect(store.workspaceStatus).toBe('已删除 input.csv')
  })

  it('preserves workspace state when workspace file deletion fails', async () => {
    mockedAgentApi.deleteWorkspaceFile.mockRejectedValueOnce(new Error('delete failed'))

    const store = useWorkbenchStore()
    await store.initialize()
    const beforeIds = store.workspaceFiles.map(file => file.fileId)
    await store.deleteWorkspaceFile('file-1')

    expect(store.error).toBe('delete failed')
    expect(store.workspaceStatus).toBe('文件删除失败')
    expect(store.workspaceFiles.map(file => file.fileId)).toEqual(beforeIds)
  })

  it('blocks workspace deletion for dirty files before confirmation', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    mockedAgentApi.getWorkspace
      .mockResolvedValueOnce(buildWorkspacePayload('workspace-agent', '工作区', [
        {
          fileId: 'file-1',
          fileKey: 'file-1',
          path: 'upload/input.csv',
          fileName: 'input.csv',
          source: 'upload',
          groupId: 'upload',
          writable: false,
          addedAt: 100
        },
        {
          fileId: 'file-2',
          fileKey: 'file-2',
          path: 'project/current.md',
          fileName: 'current.md',
          source: 'project',
          groupId: 'project',
          writable: true,
          addedAt: 101
        }
      ]))
      .mockResolvedValueOnce(buildWorkspacePayload('workspace-agent', '工作区', [
        {
          fileId: 'file-1',
          fileKey: 'file-1',
          path: 'upload/input.csv',
          fileName: 'input.csv',
          source: 'upload',
          groupId: 'upload',
          writable: false,
          addedAt: 100
        }
      ]))
    mockedAgentApi.openWorkspaceFile
      .mockResolvedValueOnce(buildWorkspaceFileDescriptor({
        fileKey: 'file-1',
        fileId: 'backend-file-1',
        path: 'upload/input.csv',
        fileName: 'input.csv',
        source: 'upload',
        writable: false,
        mode: 'csv',
        content: 'name,value\nalpha,1\n'
      }))
      .mockResolvedValueOnce(buildWorkspaceFileDescriptor({
        fileKey: 'file-2',
        fileId: 'backend-file-2',
        path: 'project/current.md',
        fileName: 'current.md',
        source: 'project',
        writable: true,
        mode: 'markdown',
        content: '# current\n'
      }))

    const store = useWorkbenchStore()
    await store.initialize()
    await store.openWorkspaceFile('file-1')
    await store.openWorkspaceFile('file-2')

    store.updateWorkspaceFileContent('file-2', '# changed\n')
    await store.deleteWorkspaceFile('file-2')

    expect(alertSpy).toHaveBeenCalledWith('文件“current.md”有未保存修改，请先保存后再删除。')
    expect(mockedAgentApi.deleteWorkspaceFile).not.toHaveBeenCalled()
    expect(store.workspaceFiles.map(file => file.fileId)).toEqual(['file-1', 'file-2'])
    expect(store.activeWorkspaceFileId).toBe('file-2')
    expect(store.selectedWorkspaceFileId).toBe('file-2')
    expect(store.workspaceOpen).toBe(true)
    expect(store.openedWorkspaceFiles.map(file => file.fileId)).toEqual(['file-1', 'file-2'])
    alertSpy.mockRestore()
  })

  it('blocks workspace deletion while the current session is running', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    mockedAgentApi.listSessions.mockResolvedValueOnce([
      buildSession({
        activity: {
          active: true,
          state: 'running',
          runId: 'run-1'
        }
      })
    ])

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')

    await store.deleteWorkspaceFile('file-1')

    expect(alertSpy).toHaveBeenCalledWith('当前会话正在运行，暂不支持删除工作区文件。')
    expect(mockedAgentApi.deleteWorkspaceFile).not.toHaveBeenCalled()
    alertSpy.mockRestore()
  })

  it('creates a working file under the selected working folder context', async () => {
    mockedAgentApi.getWorkspace
      .mockResolvedValueOnce({
        agentId: 'workspace-agent',
        title: '工作区',
        tasks: [
          {
            id: 'workspace-workspace-agent',
            label: '工作目录',
            groups: [
              {
                id: 'upload',
                label: 'upload',
                entries: []
              },
              {
                id: 'project',
                label: 'project',
                entries: [
                  {
                    nodeId: 'folder-1',
                    folderKey: 'folder-1',
                    path: 'project/plans',
                    fileName: 'plans',
                    relativePath: 'plans',
                    groupId: 'project',
                    nodeType: 'folder' as const,
                    source: 'project' as const,
                    writable: true as const,
                    addedAt: 100
                  }
                ]
              }
            ]
          }
        ]
      })
      .mockResolvedValueOnce({
        agentId: 'workspace-agent',
        title: '工作区',
        tasks: [
          {
            id: 'workspace-workspace-agent',
            label: '工作目录',
            groups: [
              {
                id: 'upload',
                label: 'upload',
                entries: []
              },
              {
                id: 'project',
                label: 'project',
                entries: [
                  {
                    nodeId: 'folder-1',
                    folderKey: 'folder-1',
                    path: 'project/plans',
                    fileName: 'plans',
                    relativePath: 'plans',
                    groupId: 'project',
                    nodeType: 'folder' as const,
                    source: 'project' as const,
                    writable: true as const,
                    addedAt: 100
                  },
                  {
                    nodeId: 'node-2',
                    fileId: 'file-2',
                    fileKey: 'file-key-2',
                    path: 'project/plans/notes.md',
                    fileName: 'notes.md',
                    relativePath: 'plans/notes.md',
                    groupId: 'project',
                    nodeType: 'file' as const,
                    source: 'project' as const,
                    writable: true,
                    addedAt: 101
                  }
                ]
              }
            ]
          }
        ]
      })
    mockedAgentApi.createProjectEntry.mockResolvedValueOnce(buildWorkspaceFileDescriptor({
      fileKey: 'file-key-2',
      fileId: 'file-2',
      path: 'project/plans/notes.md',
      fileName: 'notes.md',
      source: 'project',
      writable: true,
      mode: 'markdown',
      content: ''
    }))
    mockedAgentApi.openWorkspaceFile.mockResolvedValueOnce(buildWorkspaceFileDescriptor({
      fileKey: 'file-key-2',
      fileId: 'file-2',
      path: 'project/plans/notes.md',
      fileName: 'notes.md',
      source: 'project',
      writable: true,
      mode: 'markdown',
      content: ''
    }))

    const store = useWorkbenchStore()
    await store.initialize()
    store.selectWorkspaceFile('folder-1')

    const created = await store.createProjectEntry('md', 'notes.md')

    expect(created).toBe(true)
    expect(mockedAgentApi.createProjectEntry).toHaveBeenCalledWith('workspace-agent', {
      kind: 'md',
      fileName: 'notes.md',
      parentPath: 'plans'
    })
    expect(store.activeWorkspaceFile?.path).toBe('project/plans/notes.md')
  })

  it('creates a working file at the root when parentPath is explicitly null', async () => {
    mockedAgentApi.getWorkspace
      .mockResolvedValueOnce({
        agentId: 'workspace-agent',
        title: '工作区',
        tasks: [
          {
            id: 'workspace-workspace-agent',
            label: '工作目录',
            groups: [
              {
                id: 'upload',
                label: 'upload',
                entries: []
              },
              {
                id: 'project',
                label: 'project',
                entries: [
                  {
                    nodeId: 'folder-1',
                    folderKey: 'folder-1',
                    path: 'project/plans',
                    fileName: 'plans',
                    relativePath: 'plans',
                    groupId: 'project',
                    nodeType: 'folder' as const,
                    source: 'project' as const,
                    writable: true as const,
                    addedAt: 100
                  }
                ]
              }
            ]
          }
        ]
      })
      .mockResolvedValueOnce({
        agentId: 'workspace-agent',
        title: '工作区',
        tasks: [
          {
            id: 'workspace-workspace-agent',
            label: '工作目录',
            groups: [
              {
                id: 'upload',
                label: 'upload',
                entries: []
              },
              {
                id: 'project',
                label: 'project',
                entries: [
                  {
                    nodeId: 'folder-1',
                    folderKey: 'folder-1',
                    path: 'project/plans',
                    fileName: 'plans',
                    relativePath: 'plans',
                    groupId: 'project',
                    nodeType: 'folder' as const,
                    source: 'project' as const,
                    writable: true as const,
                    addedAt: 100
                  },
                  {
                    nodeId: 'node-2',
                    fileId: 'file-2',
                    fileKey: 'file-key-2',
                    path: 'project/root-note.md',
                    fileName: 'root-note.md',
                    relativePath: 'root-note.md',
                    groupId: 'project',
                    nodeType: 'file' as const,
                    source: 'project' as const,
                    writable: true,
                    addedAt: 101
                  }
                ]
              }
            ]
          }
        ]
      })
    mockedAgentApi.createProjectEntry.mockResolvedValueOnce(buildWorkspaceFileDescriptor({
      fileKey: 'file-key-2',
      fileId: 'file-2',
      path: 'project/root-note.md',
      fileName: 'root-note.md',
      source: 'project',
      writable: true,
      mode: 'markdown',
      content: ''
    }))
    mockedAgentApi.openWorkspaceFile.mockResolvedValueOnce(buildWorkspaceFileDescriptor({
      fileKey: 'file-key-2',
      fileId: 'file-2',
      path: 'project/root-note.md',
      fileName: 'root-note.md',
      source: 'project',
      writable: true,
      mode: 'markdown',
      content: ''
    }))

    const store = useWorkbenchStore()
    await store.initialize()
    store.selectWorkspaceFile('folder-1')

    const created = await store.createProjectEntry('md', 'root-note.md', null)

    expect(created).toBe(true)
    expect(mockedAgentApi.createProjectEntry).toHaveBeenCalledWith('workspace-agent', {
      kind: 'md',
      fileName: 'root-note.md',
      parentPath: undefined
    })
    expect(store.activeWorkspaceFile?.path).toBe('project/root-note.md')
  })

  it('deletes a tracked working folder through the shared delete contract', async () => {
    mockedAgentApi.getWorkspace
      .mockResolvedValueOnce({
        agentId: 'workspace-agent',
        title: '工作区',
        tasks: [
          {
            id: 'workspace-workspace-agent',
            label: '工作目录',
            groups: [
              {
                id: 'upload',
                label: 'upload',
                entries: []
              },
              {
                id: 'project',
                label: 'project',
                entries: [
                  {
                    nodeId: 'folder-1',
                    folderKey: 'folder-1',
                    path: 'project/plans',
                    fileName: 'plans',
                    relativePath: 'plans',
                    groupId: 'project',
                    nodeType: 'folder' as const,
                    source: 'project' as const,
                    writable: true as const,
                    addedAt: 100
                  },
                  {
                    nodeId: 'node-2',
                    fileId: 'file-2',
                    fileKey: 'file-key-2',
                    path: 'project/plans/notes.md',
                    fileName: 'notes.md',
                    relativePath: 'plans/notes.md',
                    groupId: 'project',
                    nodeType: 'file' as const,
                    source: 'project' as const,
                    writable: true,
                    addedAt: 101
                  }
                ]
              }
            ]
          }
        ]
      })
      .mockResolvedValueOnce({
        agentId: 'workspace-agent',
        title: '工作区',
        tasks: [
          {
            id: 'workspace-workspace-agent',
            label: '工作目录',
            groups: [
              {
                id: 'upload',
                label: 'upload',
                entries: []
              },
              {
                id: 'project',
                label: 'project',
                entries: []
              }
            ]
          }
        ]
      })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.deleteWorkspaceFile('folder-1')

    expect(mockedAgentApi.deleteWorkspaceFile).toHaveBeenCalledWith('workspace-agent', 'folder-1')
    expect(store.workspaceFiles).toHaveLength(0)
    expect(store.workspaceStatus).toBe('已删除 plans')
  })

  it('renames a workspace file and updates open editor metadata in place', async () => {
    mockedAgentApi.getWorkspace
      .mockResolvedValueOnce(buildWorkspacePayload('workspace-agent', '工作区', [
        {
          fileId: 'file-1',
          fileKey: 'file-1',
          path: 'upload/input.csv',
          fileName: 'input.csv',
          source: 'upload',
          groupId: 'upload',
          writable: false,
          addedAt: 100
        }
      ]))
      .mockResolvedValueOnce(buildWorkspacePayload('workspace-agent', '工作区', [
        {
          fileId: 'file-1',
          fileKey: 'file-1',
          path: 'upload/input-renamed.csv',
          fileName: 'input-renamed.csv',
          source: 'upload',
          groupId: 'upload',
          writable: false,
          addedAt: 100
        }
      ]))
    mockedAgentApi.openWorkspaceFile.mockResolvedValueOnce(buildWorkspaceFileDescriptor({
      fileKey: 'file-1',
      fileId: 'backend-file-1',
      path: 'upload/input.csv',
      fileName: 'input.csv',
      source: 'upload',
      writable: false,
      mode: 'csv',
      content: 'name,value\nalpha,1\n'
    }))
    mockedAgentApi.renameWorkspaceFile.mockResolvedValueOnce(buildWorkspaceFileDescriptor({
      fileKey: 'file-1',
      fileId: 'backend-file-1',
      path: 'upload/input-renamed.csv',
      fileName: 'input-renamed.csv',
      source: 'upload',
      writable: false,
      mode: 'csv',
      content: 'name,value\nalpha,1\n'
    }))

    const store = useWorkbenchStore()
    await store.initialize()
    await store.openWorkspaceFile('file-1')

    await store.renameWorkspaceFile('file-1', 'input-renamed.csv')

    expect(mockedAgentApi.renameWorkspaceFile).toHaveBeenCalledWith('workspace-agent', 'file-1', 'input-renamed.csv')
    expect(store.workspaceFiles[0]).toMatchObject({
      fileId: 'file-1',
      fileName: 'input-renamed.csv',
      path: 'upload/input-renamed.csv'
    })
    expect(store.activeWorkspaceFile).toMatchObject({
      fileId: 'file-1',
      fileName: 'input-renamed.csv',
      path: 'upload/input-renamed.csv',
      content: 'name,value\nalpha,1\n'
    })
    expect(store.workspaceStatus).toBe('已重命名为 input-renamed.csv')
  })

  it('keeps extensionless workspace rename fully editable', async () => {
    mockedAgentApi.getWorkspace
      .mockResolvedValueOnce(buildWorkspacePayload('workspace-agent', '工作区', [
        {
          fileId: 'file-1',
          fileKey: 'file-1',
          path: 'upload/notes',
          fileName: 'notes',
          source: 'upload',
          groupId: 'upload',
          writable: false,
          addedAt: 100
        }
      ]))
      .mockResolvedValueOnce(buildWorkspacePayload('workspace-agent', '工作区', [
        {
          fileId: 'file-1',
          fileKey: 'file-1',
          path: 'upload/notes-renamed',
          fileName: 'notes-renamed',
          source: 'upload',
          groupId: 'upload',
          writable: false,
          addedAt: 100
        }
      ]))
    mockedAgentApi.openWorkspaceFile.mockResolvedValueOnce(buildWorkspaceFileDescriptor({
      fileKey: 'file-1',
      fileId: 'backend-file-1',
      path: 'upload/notes',
      fileName: 'notes',
      source: 'upload',
      writable: false,
      mode: 'text',
      content: 'alpha\n'
    }))
    mockedAgentApi.renameWorkspaceFile.mockResolvedValueOnce(buildWorkspaceFileDescriptor({
      fileKey: 'file-1',
      fileId: 'backend-file-1',
      path: 'upload/notes-renamed',
      fileName: 'notes-renamed',
      source: 'upload',
      writable: false,
      mode: 'text',
      content: 'alpha\n'
    }))

    const store = useWorkbenchStore()
    await store.initialize()
    await store.openWorkspaceFile('file-1')

    await store.renameWorkspaceFile('file-1', 'notes-renamed')

    expect(mockedAgentApi.renameWorkspaceFile).toHaveBeenCalledWith('workspace-agent', 'file-1', 'notes-renamed')
    expect(store.workspaceFiles[0]).toMatchObject({
      fileId: 'file-1',
      fileName: 'notes-renamed',
      path: 'upload/notes-renamed'
    })
  })

  it('skips workspace rename requests when the submitted file name is unchanged after trimming', async () => {
    mockedAgentApi.openWorkspaceFile.mockResolvedValueOnce(buildWorkspaceFileDescriptor({
      fileKey: 'file-1',
      fileId: 'backend-file-1',
      path: 'upload/input.csv',
      fileName: 'input.csv',
      source: 'upload',
      writable: false,
      mode: 'csv',
      content: 'name,value\nalpha,1\n'
    }))

    const store = useWorkbenchStore()
    await store.initialize()
    await store.openWorkspaceFile('file-1')

    const result = await store.renameWorkspaceFile('file-1', ' input.csv ')

    expect(result).toBe(true)
    expect(mockedAgentApi.renameWorkspaceFile).not.toHaveBeenCalled()
  })

  it('blocks workspace rename for dirty files and preserves the current editor state', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    mockedAgentApi.openWorkspaceFile.mockResolvedValueOnce(buildWorkspaceFileDescriptor({
      fileKey: 'file-1',
      fileId: 'backend-file-1',
      path: 'upload/input.csv',
      fileName: 'input.csv',
      source: 'upload',
      writable: false,
      mode: 'csv',
      content: 'name,value\nalpha,1\n'
    }))

    const store = useWorkbenchStore()
    await store.initialize()
    await store.openWorkspaceFile('file-1')
    store.updateWorkspaceFileContent('file-1', 'name,value\nbeta,2\n')

    const result = await store.renameWorkspaceFile('file-1', 'ignored.csv')

    expect(result).toBe(false)
    expect(alertSpy).toHaveBeenCalledWith('文件“input.csv”有未保存修改，请先保存后再重命名。')
    expect(mockedAgentApi.renameWorkspaceFile).not.toHaveBeenCalled()
    expect(store.activeWorkspaceFile).toMatchObject({
      fileName: 'input.csv',
      path: 'upload/input.csv',
      isDirty: true,
      content: 'name,value\nbeta,2\n'
    })
    alertSpy.mockRestore()
  })

  it('blocks workspace rename while the current session is running', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    mockedAgentApi.listSessions.mockResolvedValueOnce([
      buildSession({
        activity: {
          active: true,
          state: 'running',
          runId: 'run-1'
        }
      })
    ])

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')

    const result = await store.renameWorkspaceFile('file-1', 'ignored.csv')

    expect(result).toBe(false)
    expect(alertSpy).toHaveBeenCalledWith('当前会话正在运行，暂不支持重命名工作区文件。')
    expect(mockedAgentApi.renameWorkspaceFile).not.toHaveBeenCalled()
    alertSpy.mockRestore()
  })

  it('preserves sidebar and editor state when workspace rename fails', async () => {
    mockedAgentApi.openWorkspaceFile.mockResolvedValueOnce(buildWorkspaceFileDescriptor({
      fileKey: 'file-1',
      fileId: 'backend-file-1',
      path: 'upload/input.csv',
      fileName: 'input.csv',
      source: 'upload',
      writable: false,
      mode: 'csv',
      content: 'name,value\nalpha,1\n'
    }))
    mockedAgentApi.renameWorkspaceFile.mockRejectedValueOnce(new Error('rename failed'))

    const store = useWorkbenchStore()
    await store.initialize()
    await store.openWorkspaceFile('file-1')

    const result = await store.renameWorkspaceFile('file-1', 'input-renamed.csv')

    expect(result).toBe(false)
    expect(mockedAgentApi.renameWorkspaceFile).toHaveBeenCalledWith('workspace-agent', 'file-1', 'input-renamed.csv')
    expect(store.error).toBe('rename failed')
    expect(store.workspaceStatus).toBe('文件重命名失败')
    expect(store.workspaceFiles[0]).toMatchObject({
      fileName: 'input.csv',
      path: 'upload/input.csv'
    })
    expect(store.activeWorkspaceFile).toMatchObject({
      fileName: 'input.csv',
      path: 'upload/input.csv'
    })
  })

  it('closes the expanded workspace shell after the last open file is closed', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession()])

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')
    await store.openWorkspaceFile('file-1')

    expect(store.workspaceOpen).toBe(true)

    store.closeWorkspaceFile('file-1')

    expect(store.workspaceOpen).toBe(false)
    expect(store.activeWorkspaceFileId).toBeNull()
  })

  it('loads file content into the workspace editor and saves in place', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession()])
    mockedAgentApi.openWorkspaceFile.mockResolvedValueOnce(buildWorkspaceFileDescriptor({
      path: 'project/current.txt',
      fileName: 'current.txt',
      source: 'project',
      writable: true,
      mode: 'text',
      content: 'hello'
    }))
    mockedAgentApi.saveWorkspaceFile.mockResolvedValueOnce(buildWorkspaceFileDescriptor({
      path: 'project/current.txt',
      fileName: 'current.txt',
      source: 'project',
      writable: true,
      mode: 'text',
      content: 'hello world'
    }))

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')
    await store.openWorkspaceFile('file-1')

    expect(store.activeWorkspaceFile?.content).toBe('hello')

    store.updateWorkspaceFileContent('file-1', 'hello world')

    expect(store.activeWorkspaceFile?.isDirty).toBe(true)

    await store.saveWorkspaceFile('file-1')

    expect(mockedAgentApi.saveWorkspaceFile).toHaveBeenCalledWith('file-1', {
      content: 'hello world',
      mode: 'text',
      mmlMetadata: null
    })
    expect(store.activeWorkspaceFile?.isDirty).toBe(false)
    expect(store.activeWorkspaceFile?.saveStatus).toBe('saved')
  })

  it('saves uploaded files in place when input entries are writable', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession()])
    mockedAgentApi.openWorkspaceFile.mockResolvedValueOnce(buildWorkspaceFileDescriptor({
      fileName: 'current.txt',
      mode: 'text',
      content: 'hello',
      writable: true
    }))
    mockedAgentApi.saveWorkspaceFile.mockResolvedValueOnce(buildWorkspaceFileDescriptor({
      fileName: 'current.txt',
      mode: 'text',
      content: 'hello',
      writable: true
    }))

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')
    await store.openWorkspaceFile('file-1')
    await store.saveWorkspaceFile('file-1')

    expect(mockedAgentApi.saveWorkspaceFile).toHaveBeenCalledTimes(1)
    expect(store.activeWorkspaceFile?.saveStatus).toBe('saved')
    expect(store.activeWorkspaceFile?.saveError).toBeNull()
  })

  it('submits continue-processing with the active file as primary context', async () => {
    const finalResult = buildRunResult({ runId: 'run-continue', text: '继续完成' })

    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession()])
    mockedAgentApi.openWorkspaceFile.mockResolvedValueOnce(buildWorkspaceFileDescriptor({
      path: 'upload/current.mml',
      fileName: 'current.mml',
      source: 'upload',
      writable: false,
      mode: 'mml',
      content: '/* ME TYPE=UNC, Version=20.11.2 */\nADD TEST:NAME=\"A\";\n',
      mmlMetadata: {
        networkType: 'UNC',
        networkVersion: '20.11.2'
      }
    }))
    mockedAgentApi.runStream.mockImplementationOnce(async (request, onEvent) => {
      onEvent({ type: 'run.completed', runId: 'run-continue', status: 'success', result: finalResult, endedAt: Date.now() })
      return finalResult
    })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')
    await store.openWorkspaceFile('file-1')
    await store.continueProcessingCurrentFile()

    const [request] = mockedAgentApi.runStream.mock.calls[0] || []
    expect(request).toEqual(expect.objectContaining({
      invocationContext: {
        activeFile: {
          path: 'upload/current.mml',
          fileName: 'current.mml',
          source: 'upload',
          writable: false
        }
      }
    }))
  })

  it('updates MML metadata from header edits before saving', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession()])
    mockedAgentApi.openWorkspaceFile.mockResolvedValueOnce(buildWorkspaceFileDescriptor({
      fileName: 'current.txt',
      mode: 'mml',
      content: '/* ME TYPE=UNC, Version=20.11.2 */\nADD TEST:NAME=\"A\";\n',
      mmlMetadata: {
        networkType: 'UNC',
        networkVersion: '20.11.2'
      }
    }))

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')
    await store.openWorkspaceFile('file-1')

    store.updateWorkspaceFileContent('file-1', '/* ME TYPE=AMF, Version=20.9.2 */\nADD TEST:NAME="A";\n')

    expect(store.activeWorkspaceFile?.mmlMetadata).toEqual({
      networkType: 'AMF',
      networkVersion: '20.9.2'
    })
  })

  it('keeps toolbar metadata edits out of raw text until save-time convergence', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession()])
    mockedAgentApi.openWorkspaceFile.mockResolvedValueOnce(buildWorkspaceFileDescriptor({
      path: 'project/current.txt',
      fileName: 'current.txt',
      source: 'project',
      writable: true,
      mode: 'mml',
      content: '/* ME TYPE=UNC, Version=20.11.2 */\nADD TEST:NAME="A";\n',
      mmlMetadata: {
        networkType: 'UNC',
        networkVersion: '20.11.2'
      }
    }))
    mockedAgentApi.saveWorkspaceFile.mockResolvedValueOnce(buildWorkspaceFileDescriptor({
      path: 'project/current.txt',
      fileName: 'current.txt',
      source: 'project',
      writable: true,
      mode: 'mml',
      content: '/* ME TYPE=AMF, Version=20.9.2 */\nADD TEST:NAME="A";\n',
      mmlMetadata: {
        networkType: 'AMF',
        networkVersion: '20.9.2'
      }
    }))

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')
    await store.openWorkspaceFile('file-1')

    store.updateWorkspaceMmlMetadata('file-1', {
      networkType: 'AMF',
      networkVersion: '20.9.2'
    })

    expect(store.activeWorkspaceFile?.content).toBe('/* ME TYPE=UNC, Version=20.11.2 */\nADD TEST:NAME="A";\n')

    await store.saveWorkspaceFile('file-1')

    expect(mockedAgentApi.saveWorkspaceFile).toHaveBeenCalledWith('file-1', {
      content: '/* ME TYPE=UNC, Version=20.11.2 */\nADD TEST:NAME="A";\n',
      mode: 'mml',
      mmlMetadata: {
        networkType: 'AMF',
        networkVersion: '20.9.2'
      }
    })
    expect(store.activeWorkspaceFile?.content).toBe('/* ME TYPE=AMF, Version=20.9.2 */\nADD TEST:NAME="A";\n')
  })

  it('saves dirty Monaco-edited files before continue-processing and uses the latest saved file state', async () => {
    const finalResult = buildRunResult({ runId: 'run-save-first', text: '继续完成' })

    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession()])
    mockedAgentApi.openWorkspaceFile.mockResolvedValueOnce(buildWorkspaceFileDescriptor({
      path: 'project/current.txt',
      fileName: 'current.txt',
      source: 'project',
      writable: true,
      mode: 'text',
      content: 'alpha'
    }))
    mockedAgentApi.saveWorkspaceFile.mockResolvedValueOnce(buildWorkspaceFileDescriptor({
      path: 'project/current-saved.txt',
      fileName: 'current-saved.txt',
      source: 'project',
      writable: true,
      mode: 'text',
      content: 'beta'
    }))
    mockedAgentApi.runStream.mockImplementationOnce(async (request, onEvent) => {
      onEvent({ type: 'run.completed', runId: 'run-save-first', status: 'success', result: finalResult, endedAt: Date.now() })
      return finalResult
    })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')
    await store.openWorkspaceFile('file-1')

    store.updateWorkspaceFileContent('file-1', 'beta')

    await store.continueProcessingCurrentFile()

    const saveCallOrder = mockedAgentApi.saveWorkspaceFile.mock.invocationCallOrder.at(-1)
    const runCallOrder = mockedAgentApi.runStream.mock.invocationCallOrder.at(-1)
    const [request] = mockedAgentApi.runStream.mock.calls.at(-1) || []

    expect(saveCallOrder).toBeDefined()
    expect(runCallOrder).toBeDefined()
    expect(saveCallOrder!).toBeLessThan(runCallOrder!)
    expect(request).toEqual(expect.objectContaining({
      invocationContext: expect.objectContaining({
        activeFile: {
          path: 'project/current-saved.txt',
          fileName: 'current-saved.txt',
          source: 'project',
          writable: true
        }
      })
    }))
  })

  it('keeps the workspace open during normal chat after the user explicitly opens a file', async () => {
    const finalResult = buildRunResult({ runId: 'run-2', text: '继续处理完成' })

    mockedAgentApi.listSessions
      .mockResolvedValueOnce([buildSession()])
      .mockResolvedValueOnce([
        buildSession({
          updatedAt: 3,
          messageCount: 5,
          preview: '继续处理完成'
        })
      ])
    mockedAgentApi.getSessionMessages
      .mockResolvedValueOnce([
        {
          messageId: 1,
          role: 'assistant',
          text: '历史消息',
          createdAt: 1,
          kind: 'text'
        }
      ])
      .mockResolvedValueOnce([
        {
          messageId: 1,
          role: 'assistant',
          text: '历史消息',
          createdAt: 1,
          kind: 'text'
        },
        {
          messageId: 2,
          role: 'user',
          text: '继续处理',
          createdAt: 2,
          kind: 'text'
        },
        {
          messageId: 3,
          role: 'assistant',
          text: '继续处理完成',
          createdAt: 3,
          kind: 'text'
        }
      ])
    mockedAgentApi.getWorkspace
      .mockResolvedValueOnce(buildWorkspacePayload())
      .mockResolvedValueOnce(buildWorkspacePayload())
    mockedAgentApi.runStream.mockImplementationOnce(async (_request, onEvent) => {
      onEvent({ type: 'assistant.delta', runId: 'run-2', delta: '继续' })
      onEvent({ type: 'assistant.final', runId: 'run-2', text: '继续处理完成' })
      onEvent({ type: 'run.completed', runId: 'run-2', status: 'success', result: finalResult, endedAt: Date.now() })
      return finalResult
    })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')

    await store.openWorkspaceFile('file-1')

    expect(store.workspaceOpen).toBe(true)

    await store.sendPrompt('继续处理')

    expect(store.workspaceOpen).toBe(true)
    expect(store.activeWorkspaceFileId).toBe('file-1')
    expect(store.messages.at(-1)?.text).toBe('继续处理完成')
  })

  it('refreshes stale content for an already-open non-dirty workspace file after a successful run', async () => {
    const finalResult = buildRunResult({ runId: 'run-refresh', text: '刷新完成' })

    mockedAgentApi.listSessions
      .mockResolvedValueOnce([buildSession()])
      .mockResolvedValueOnce([
        buildSession({
          updatedAt: 3,
          messageCount: 3,
          preview: '刷新完成'
        })
      ])
    mockedAgentApi.getSessionMessages
      .mockResolvedValueOnce([
        {
          messageId: 1,
          role: 'assistant',
          text: '历史消息',
          createdAt: 1,
          kind: 'text'
        }
      ])
      .mockResolvedValueOnce([
        {
          messageId: 1,
          role: 'assistant',
          text: '历史消息',
          createdAt: 1,
          kind: 'text'
        },
        {
          messageId: 2,
          role: 'user',
          text: '刷新工作区',
          createdAt: 2,
          kind: 'text'
        },
        {
          messageId: 3,
          role: 'assistant',
          text: '刷新完成',
          createdAt: 3,
          kind: 'text'
        }
      ])
    mockedAgentApi.getWorkspace
      .mockResolvedValueOnce(buildWorkspacePayload())
      .mockResolvedValueOnce(buildWorkspacePayload())
    mockedAgentApi.openWorkspaceFile
      .mockResolvedValueOnce(buildWorkspaceFileDescriptor({
        content: 'name,value\nalpha,1\n'
      }))
      .mockResolvedValueOnce(buildWorkspaceFileDescriptor({
        content: 'name,value\nbeta,2\n'
      }))
    mockedAgentApi.runStream.mockImplementationOnce(async (_request, onEvent) => {
      onEvent({ type: 'run.completed', runId: 'run-refresh', status: 'success', result: finalResult, endedAt: Date.now() })
      return finalResult
    })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')
    await store.openWorkspaceFile('file-1')

    expect(store.activeWorkspaceFile?.content).toBe('name,value\nalpha,1\n')

    await store.sendPrompt('刷新工作区')

    expect(store.activeWorkspaceFileId).toBe('file-1')
    expect(store.openedWorkspaceFiles).toHaveLength(1)
    expect(store.activeWorkspaceFile?.content).toBe('name,value\nbeta,2\n')
    expect(store.activeWorkspaceFile?.isDirty).toBe(false)
    expect(mockedAgentApi.openWorkspaceFile).toHaveBeenCalledTimes(2)
  })

  it('keeps local dirty content for an already-open workspace file after a successful run', async () => {
    const finalResult = buildRunResult({ runId: 'run-dirty-refresh', text: '刷新完成' })

    mockedAgentApi.listSessions
      .mockResolvedValueOnce([buildSession()])
      .mockResolvedValueOnce([
        buildSession({
          updatedAt: 3,
          messageCount: 3,
          preview: '刷新完成'
        })
      ])
    mockedAgentApi.getSessionMessages
      .mockResolvedValueOnce([
        {
          messageId: 1,
          role: 'assistant',
          text: '历史消息',
          createdAt: 1,
          kind: 'text'
        }
      ])
      .mockResolvedValueOnce([
        {
          messageId: 1,
          role: 'assistant',
          text: '历史消息',
          createdAt: 1,
          kind: 'text'
        },
        {
          messageId: 2,
          role: 'user',
          text: '刷新工作区',
          createdAt: 2,
          kind: 'text'
        },
        {
          messageId: 3,
          role: 'assistant',
          text: '刷新完成',
          createdAt: 3,
          kind: 'text'
        }
      ])
    mockedAgentApi.getWorkspace
      .mockResolvedValueOnce(buildWorkspacePayload())
      .mockResolvedValueOnce(buildWorkspacePayload())
    mockedAgentApi.openWorkspaceFile.mockResolvedValueOnce(buildWorkspaceFileDescriptor({
      content: 'name,value\nalpha,1\n'
    }))
    mockedAgentApi.runStream.mockImplementationOnce(async (_request, onEvent) => {
      onEvent({ type: 'run.completed', runId: 'run-dirty-refresh', status: 'success', result: finalResult, endedAt: Date.now() })
      return finalResult
    })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')
    await store.openWorkspaceFile('file-1')
    store.updateWorkspaceFileContent('file-1', 'name,value\nlocal,9\n')

    await store.sendPrompt('刷新工作区')

    expect(store.activeWorkspaceFileId).toBe('file-1')
    expect(store.activeWorkspaceFile?.content).toBe('name,value\nlocal,9\n')
    expect(store.activeWorkspaceFile?.isDirty).toBe(true)
    expect(mockedAgentApi.openWorkspaceFile).toHaveBeenCalledTimes(1)
  })

  it('maps protocol and result messages from session history without flattening them', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession()])
    mockedAgentApi.getSessionMessages.mockResolvedValueOnce([
      {
        messageId: 1,
        role: 'assistant',
        text: '{"version":"1.0"}',
        createdAt: 1,
        kind: 'protocol',
        protocol: {
          version: '1.0',
          components: [{ type: 'text', id: 'title', content: '计划' }],
          actions: []
        },
        protocolState: { note: '已恢复' }
      },
      {
        messageId: 2,
        role: 'assistant',
        text: '{"kind":"rows_result"}',
        createdAt: 2,
        kind: 'result',
        domainResult: {
          kind: 'rows_result',
          data: {
            columns: ['name'],
            rows: [{ name: 'foo' }]
          }
        }
      }
    ])

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')

    expect(store.messages[0]).toMatchObject({
      kind: 'protocol',
      protocolState: { note: '已恢复' }
    })
    expect(store.messages[1]).toMatchObject({
      kind: 'result'
    })
  })

  it('hides legacy question protocol and reply payload bubbles while restoring pending interactions on reload', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession()])
    mockedAgentApi.getSessionMessages.mockResolvedValueOnce([
      {
        messageId: 21,
        role: 'assistant',
        text: '{"version":"1.0"}',
        createdAt: 1,
        kind: 'protocol',
        protocol: {
          version: '1.0',
          components: [{ type: 'text', id: 'question-title', content: '原始问题' }],
          actions: [{
            id: 'submit-question',
            label: '提交',
            type: 'submit',
            tool: 'question_response',
            toolInput: {
              questionId: 'question-1',
              answer: '${form.question-form-1}'
            }
          }]
        },
        protocolState: {
          note: '问题已提交，等待继续处理。',
          message: {
            version: '1.0',
            components: [{ type: 'text', id: 'question-title', content: '已提交问题' }],
            actions: []
          }
        }
      },
      {
        messageId: 22,
        role: 'user',
        text: '{"questionId":"question-1","answer":{"task":"提取指标"}}',
        createdAt: 2,
        kind: 'text'
      }
    ])
    mockedAgentApi.listSessionInteractions.mockResolvedValueOnce([
      buildPendingQuestionInteraction()
    ])

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')

    expect(store.messages).toEqual([
      expect.objectContaining({
        kind: 'question',
        role: 'assistant',
        id: 'interaction-1',
        text: '请输入信息',
        interaction: expect.objectContaining({
          interactionId: 'interaction-1',
          status: 'pending'
        })
      })
    ])
    expect(store.pendingInteraction).toMatchObject({
      interactionId: 'interaction-1',
      payload: {
        questionId: 'question-1',
        title: '补充信息'
      }
    })
  })

  it('restores the pending question card after switching away from the session and back', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([
      buildSession({ sessionId: 'session-pending' }),
      buildSession({ sessionId: 'session-other' })
    ])
    mockedAgentApi.getSessionMessages
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    mockedAgentApi.listSessionInteractions
      .mockResolvedValueOnce([
        buildPendingQuestionInteraction({
          interactionId: 'interaction-switch'
        })
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        buildPendingQuestionInteraction({
          interactionId: 'interaction-switch'
        })
      ])

    const store = useWorkbenchStore()
    await store.initialize()

    await store.selectSession('session-pending')
    expect(store.messages[store.messages.length - 1]).toMatchObject({
      kind: 'question',
      id: 'interaction-switch'
    })

    await store.selectSession('session-other')
    expect(store.messages).toEqual([])
    expect(store.pendingInteraction).toBeNull()

    await store.selectSession('session-pending')
    expect(store.messages[store.messages.length - 1]).toMatchObject({
      kind: 'question',
      id: 'interaction-switch'
    })
    expect(store.pendingInteraction).toMatchObject({
      interactionId: 'interaction-switch',
      status: 'pending'
    })
  })

  it('restores resolved interaction context from normal session history on reload', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession()])
    mockedAgentApi.getSessionMessages.mockResolvedValueOnce([
      {
        messageId: 31,
        role: 'user',
        text: '[INTERACTION CONTEXT]\ninteraction_id: interaction-1\nquestion_id: question-1\nprompt: 请输入任务\nanswer: {"task":"提取指标"}',
        createdAt: 2,
        kind: 'text'
      }
    ])
    mockedAgentApi.listSessionInteractions.mockResolvedValueOnce([
      buildPendingQuestionInteraction({
        interactionId: 'interaction-1',
        status: 'answered',
        resolvedAt: 2,
        payload: {
          questionId: 'question-1',
          title: '补充信息',
          prompt: '请输入任务',
          required: true,
          fields: [{ id: 'task', label: '任务', type: 'text', required: true }]
        }
      })
    ])

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')

    expect(store.messages).toEqual([
      expect.objectContaining({
        kind: 'text',
        role: 'user',
        text: '已提交回答：任务：提取指标',
        editable: false
      })
    ])
    expect(mockedAgentApi.listSessionInteractions).toHaveBeenCalledWith(
      'workspace-agent',
      'session-1',
      ['pending', 'answered', 'rejected']
    )
  })

  it('preserves awaiting-question summaries from canonical history on reload', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession()])
    mockedAgentApi.getSessionMessages.mockResolvedValueOnce([
      {
        messageId: 41,
        role: 'assistant',
        text: '请选择CPU档位（针对游戏用途），选择后我会继续。',
        createdAt: 2,
        kind: 'text'
      }
    ])
    mockedAgentApi.listSessionInteractions.mockResolvedValueOnce([
      buildPendingQuestionInteraction({
        interactionId: 'interaction-1',
        payload: {
          questionId: 'question-1',
          title: '补充信息',
          prompt: '请选择CPU档位（针对游戏用途）：',
          required: true,
          fields: [
            {
              id: 'answer',
              label: 'CPU档位',
              type: 'select',
              options: [
                { label: '入门档', value: 'entry' },
                { label: '主流档', value: 'mainstream' }
              ]
            },
            {
              id: 'notes',
              label: '补充说明',
              type: 'text'
            }
          ],
          degraded: {
            reason: '结构化问题收集失败',
            referenceOptions: ['入门档', '主流档']
          }
        }
      })
    ])

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-1')

    expect(store.messages).toEqual([
      expect.objectContaining({
        kind: 'text',
        role: 'assistant',
        text: '请选择CPU档位（针对游戏用途），选择后我会继续。'
      }),
      expect.objectContaining({
        kind: 'question',
        role: 'assistant',
        id: 'interaction-1'
      })
    ])
    expect(store.messages[0]?.text).not.toContain('入门档')
    expect(store.messages[0]?.text).not.toContain('结构化问题收集失败')
    expect(store.pendingInteraction).toMatchObject({
      interactionId: 'interaction-1',
      status: 'pending'
    })
  })

  it('submits edit reruns through the existing session flow and replaces same-session history', async () => {
    mockedAgentApi.listSessions
      .mockResolvedValueOnce([buildSession({ sessionId: 'session-edit', messageCount: 4 })])
      .mockResolvedValueOnce([buildSession({ sessionId: 'session-edit', messageCount: 4, preview: '新的回复' })])
    mockedAgentApi.getSessionMessages
      .mockResolvedValueOnce([
        {
          messageId: 1,
          role: 'user',
          text: '第一条消息',
          createdAt: 1,
          kind: 'text'
        },
        {
          messageId: 2,
          role: 'assistant',
          text: '第一条回复',
          createdAt: 2,
          kind: 'text'
        },
        {
          messageId: 3,
          role: 'user',
          text: '需要修正的最后一条消息',
          createdAt: 3,
          kind: 'text'
        },
        {
          messageId: 4,
          role: 'assistant',
          text: '旧的尾部回复',
          createdAt: 4,
          kind: 'text'
        }
      ])
      .mockResolvedValueOnce([
        {
          messageId: 1,
          role: 'user',
          text: '第一条消息',
          createdAt: 1,
          kind: 'text'
        },
        {
          messageId: 2,
          role: 'assistant',
          text: '第一条回复',
          createdAt: 2,
          kind: 'text'
        },
        {
          messageId: 5,
          role: 'user',
          text: '修正后的最后一条消息',
          createdAt: 5,
          kind: 'text'
        },
        {
          messageId: 6,
          role: 'assistant',
          text: '新的尾部回复',
          createdAt: 6,
          kind: 'text'
        }
      ])
    mockedAgentApi.listSessionInteractions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    mockedAgentApi.getWorkspace
      .mockResolvedValueOnce(buildWorkspacePayload())
      .mockResolvedValueOnce(buildWorkspacePayload())
    mockedAgentApi.runStream.mockImplementationOnce(async (request, onEvent) => {
      expect(request).toMatchObject({
        agentId: 'workspace-agent',
        sessionId: 'session-edit',
        input: '修正后的最后一条消息',
        editContext: {
          messageId: 3
        }
      })
      onEvent({ type: 'assistant.delta', runId: 'run-edit', delta: '新的' })
      onEvent({ type: 'assistant.final', runId: 'run-edit', text: '新的尾部回复' })
      onEvent({
        type: 'run.completed',
        runId: 'run-edit',
        status: 'success',
        result: buildRunResult({
          runId: 'run-edit',
          sessionId: 'session-edit',
          assistantMessageId: 6,
          text: '新的尾部回复'
        }),
        endedAt: Date.now()
      })
      return buildRunResult({
        runId: 'run-edit',
        sessionId: 'session-edit',
        assistantMessageId: 6,
        text: '新的尾部回复'
      })
    })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-edit')

    expect(store.editableUserMessageId).toBe(3)

    store.startEditRerun(3)
    expect(store.editRerunTarget).toEqual({
      messageId: 3,
      text: '需要修正的最后一条消息'
    })

    await store.submitEditRerun('修正后的最后一条消息')

    expect(store.activeSessionId).toBe('session-edit')
    expect(store.editRerunTarget).toBeNull()
    expect(store.messages).toEqual([
      expect.objectContaining({
        messageId: 1,
        role: 'user',
        text: '第一条消息'
      }),
      expect.objectContaining({
        messageId: 2,
        role: 'assistant',
        text: '第一条回复'
      }),
      expect.objectContaining({
        messageId: 5,
        role: 'user',
        text: '修正后的最后一条消息'
      }),
      expect.objectContaining({
        messageId: 6,
        role: 'assistant',
        text: '新的尾部回复'
      })
    ])
  })

  it('clears edit rerun mode immediately after submitting the replacement prompt', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession({ sessionId: 'session-edit', messageCount: 4 })])
    mockedAgentApi.getSessionMessages.mockResolvedValueOnce([
      {
        messageId: 1,
        role: 'user',
        text: '第一条消息',
        createdAt: 1,
        kind: 'text'
      },
      {
        messageId: 2,
        role: 'assistant',
        text: '第一条回复',
        createdAt: 2,
        kind: 'text'
      },
      {
        messageId: 3,
        role: 'user',
        text: '需要修正的最后一条消息',
        createdAt: 3,
        kind: 'text'
      },
      {
        messageId: 4,
        role: 'assistant',
        text: '旧的尾部回复',
        createdAt: 4,
        kind: 'text'
      }
    ])
    mockedAgentApi.listSessionInteractions.mockResolvedValueOnce([])
    mockedAgentApi.getWorkspace.mockResolvedValueOnce(buildWorkspacePayload())
    const running = mockStreamingRunOnce()

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-edit')

    store.startEditRerun(3)
    const pending = store.submitEditRerun('修正后的最后一条消息')
    await Promise.resolve()
    await Promise.resolve()

    expect(store.editRerunTarget).toBeNull()

    running.emitEvent({ type: 'assistant.delta', runId: 'run-edit-pending', delta: '新的' })
    running.emitEvent({ type: 'assistant.final', runId: 'run-edit-pending', text: '新的尾部回复' })
    running.emitEvent({
      type: 'run.completed',
      runId: 'run-edit-pending',
      status: 'success',
      result: buildRunResult({
        runId: 'run-edit-pending',
        sessionId: 'session-edit',
        assistantMessageId: 6,
        text: '新的尾部回复'
      }),
      endedAt: Date.now()
    })
    running.resolveRun(buildRunResult({
      runId: 'run-edit-pending',
      sessionId: 'session-edit',
      assistantMessageId: 6,
      text: '新的尾部回复'
    }))
    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession({
      sessionId: 'session-edit',
      messageCount: 4,
      preview: '新的尾部回复'
    })])
    mockedAgentApi.getSessionMessages.mockResolvedValueOnce([
      {
        messageId: 1,
        role: 'user',
        text: '第一条消息',
        createdAt: 1,
        kind: 'text'
      },
      {
        messageId: 2,
        role: 'assistant',
        text: '第一条回复',
        createdAt: 2,
        kind: 'text'
      },
      {
        messageId: 5,
        role: 'user',
        text: '修正后的最后一条消息',
        createdAt: 5,
        kind: 'text'
      },
      {
        messageId: 6,
        role: 'assistant',
        text: '新的尾部回复',
        createdAt: 6,
        kind: 'text'
      }
    ])
    mockedAgentApi.listSessionInteractions.mockResolvedValueOnce([])
    mockedAgentApi.getWorkspace.mockResolvedValueOnce(buildWorkspacePayload())

    await pending
  })

  it('replies to a pending interaction through the continuation run without replaying a user payload bubble', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession({ sessionId: 'session-question' })])
    mockedAgentApi.getSessionMessages
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          messageId: 32,
          role: 'user',
          text: '[INTERACTION CONTEXT]\ninteraction_id: interaction-reply\nquestion_id: question-1\nprompt: 请输入任务和模式\nanswer: {"task":"提取指标","mode":"VLR"}',
          createdAt: 2,
          kind: 'text'
        },
        {
          messageId: 33,
          role: 'assistant',
          text: '收到，继续处理。',
          createdAt: 3,
          kind: 'text'
        }
      ])
    mockedAgentApi.listSessionInteractions
      .mockResolvedValueOnce([
        buildPendingQuestionInteraction({
          interactionId: 'interaction-reply',
          payload: {
            questionId: 'question-1',
            title: '补充信息',
            prompt: '请输入任务和模式',
            required: true,
            fields: [
              { id: 'task', label: '任务', type: 'text', required: true },
              {
                id: 'mode',
                label: '模式',
                type: 'select',
                required: false,
                options: [
                  { label: 'VLR', value: 'VLR' },
                  { label: 'SGSN', value: 'SGSN' }
                ]
              }
            ]
          }
        })
      ])
      .mockResolvedValueOnce([
        buildPendingQuestionInteraction({
          interactionId: 'interaction-reply',
          status: 'answered',
          resolvedAt: 2,
          payload: {
            questionId: 'question-1',
            title: '补充信息',
            prompt: '请输入任务和模式',
            required: true,
            fields: [
              { id: 'task', label: '任务', type: 'text', required: true },
              {
                id: 'mode',
                label: '模式',
                type: 'select',
                required: false,
                options: [
                  { label: 'VLR', value: 'VLR' },
                  { label: 'SGSN', value: 'SGSN' }
                ]
              }
            ]
          }
        })
      ])
    mockedAgentApi.replySessionInteraction.mockResolvedValueOnce(buildPendingQuestionInteraction({
      interactionId: 'interaction-reply',
      status: 'answered',
      resolvedAt: 2
    }))
    mockedAgentApi.runStream.mockImplementationOnce(async (request, onEvent) => {
      onEvent({
        type: 'run.completed',
        runId: 'run-continue',
        status: 'success',
        result: buildRunResult({
          runId: 'run-continue',
          sessionId: 'session-question',
          text: '收到，继续处理。',
          continuationOfInteractionId: 'interaction-reply'
        }),
        endedAt: Date.now()
      })
      return buildRunResult({
        runId: 'run-continue',
        sessionId: 'session-question',
        text: '收到，继续处理。',
        continuationOfInteractionId: 'interaction-reply'
      })
    })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-question')
    await store.replyPendingInteraction({
      task: '提取指标',
      mode: 'VLR'
    })

    expect(mockedAgentApi.replySessionInteraction).toHaveBeenCalledWith(
      'workspace-agent',
      'session-question',
      'interaction-reply',
      {
        task: '提取指标',
        mode: 'VLR'
      }
    )
    expect(mockedAgentApi.runStream).toHaveBeenCalledWith(expect.objectContaining({
      agentId: 'workspace-agent',
      sessionId: 'session-question',
      input: '',
      continuation: {
        interactionId: 'interaction-reply'
      }
    }), expect.any(Function))
    expect(store.pendingInteraction).toBeNull()
    expect(store.messages).toEqual([
      expect.objectContaining({
        kind: 'text',
        role: 'user',
        text: '已提交回答：任务：提取指标，模式：VLR',
        editable: false
      }),
      expect.objectContaining({
        kind: 'text',
        role: 'assistant',
        text: '收到，继续处理。'
      })
    ])
  })

  it('rejects a pending interaction and appends a local task-ended message', async () => {
    mockedAgentApi.listSessions
      .mockResolvedValueOnce([buildSession({
        sessionId: 'session-question-reject',
        activity: {
          active: true,
          state: 'awaiting-question',
          runId: null
        }
      })])
      .mockResolvedValueOnce([buildSession({ sessionId: 'session-question-reject' })])
    mockedAgentApi.getSessionMessages
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          messageId: 42,
          role: 'user',
          text: '[INTERACTION CONTEXT]\ninteraction_id: interaction-reject\nquestion_id: question-2\nprompt: 是否继续？\nstatus: rejected',
          createdAt: 3,
          kind: 'text'
        },
      ])
    mockedAgentApi.listSessionInteractions
      .mockResolvedValueOnce([
        buildPendingQuestionInteraction({
          interactionId: 'interaction-reject',
          payload: {
            questionId: 'question-2',
            title: '补充信息',
            prompt: '是否继续？',
            required: true,
            fields: [{ id: 'answer', label: '回答', type: 'text', required: true }]
          }
        })
      ])
    mockedAgentApi.rejectSessionInteraction.mockResolvedValueOnce(buildPendingQuestionInteraction({
      interactionId: 'interaction-reject',
      status: 'rejected',
      resolvedAt: 3,
      payload: {
        questionId: 'question-2',
        title: '补充信息',
        prompt: '是否继续？',
        required: true,
        fields: [{ id: 'answer', label: '回答', type: 'text', required: true }]
      }
    }))

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-question-reject')
    await store.rejectPendingInteraction()

    expect(mockedAgentApi.rejectSessionInteraction).toHaveBeenCalledWith(
      'workspace-agent',
      'session-question-reject',
      'interaction-reject'
    )
    expect(mockedAgentApi.runStream).not.toHaveBeenCalled()
    expect(store.pendingInteraction).toBeNull()
    expect(store.messages).toEqual([
      expect.objectContaining({
        kind: 'text',
        role: 'user',
        text: '已拒绝回答：是否继续？',
        editable: false
      }),
      expect.objectContaining({
        kind: 'text',
        role: 'assistant',
        text: '你已跳过当前问题，当前任务已结束。你可以继续发送新消息。',
        assistantHeader: {
          label: '任务已结束',
          tone: 'summary'
        }
      })
    ])
    expect(store.latestStatus).toBe('任务已结束')
  })

  it('allows sending a fresh prompt after rejecting a pending interaction', async () => {
    const finalResult = buildRunResult({
      runId: 'run-after-reject',
      sessionId: 'session-question-reject',
      text: '收到，继续吧'
    })

    mockedAgentApi.listSessions
      .mockResolvedValueOnce([buildSession({
        sessionId: 'session-question-reject',
        activity: {
          active: true,
          state: 'awaiting-question',
          runId: null
        }
      })])
      .mockResolvedValueOnce([buildSession({ sessionId: 'session-question-reject' })])
      .mockResolvedValueOnce([buildSession({ sessionId: 'session-question-reject' })])
    mockedAgentApi.getSessionMessages
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          messageId: 42,
          role: 'user',
          text: '[INTERACTION CONTEXT]\ninteraction_id: interaction-reject\nquestion_id: question-2\nprompt: 是否继续？\nstatus: rejected',
          createdAt: 3,
          kind: 'text'
        }
      ])
      .mockResolvedValueOnce([
        {
          messageId: 42,
          role: 'user',
          text: '[INTERACTION CONTEXT]\ninteraction_id: interaction-reject\nquestion_id: question-2\nprompt: 是否继续？\nstatus: rejected',
          createdAt: 3,
          kind: 'text'
        },
        {
          messageId: 43,
          role: 'user',
          text: '继续吧',
          createdAt: 4,
          kind: 'text'
        },
        {
          messageId: 44,
          role: 'assistant',
          text: '收到，继续吧',
          createdAt: 5,
          kind: 'text'
        }
      ])
    mockedAgentApi.listSessionInteractions
      .mockResolvedValueOnce([
        buildPendingQuestionInteraction({
          interactionId: 'interaction-reject',
          payload: {
            questionId: 'question-2',
            title: '补充信息',
            prompt: '是否继续？',
            required: true,
            fields: [{ id: 'answer', label: '回答', type: 'text', required: true }]
          }
        })
      ])
      .mockResolvedValueOnce([
        buildPendingQuestionInteraction({
          interactionId: 'interaction-reject',
          status: 'rejected',
          resolvedAt: 3,
          payload: {
            questionId: 'question-2',
            title: '补充信息',
            prompt: '是否继续？',
            required: true,
            fields: [{ id: 'answer', label: '回答', type: 'text', required: true }]
          }
        })
      ])
    mockedAgentApi.rejectSessionInteraction.mockResolvedValueOnce(buildPendingQuestionInteraction({
      interactionId: 'interaction-reject',
      status: 'rejected',
      resolvedAt: 3,
      payload: {
        questionId: 'question-2',
        title: '补充信息',
        prompt: '是否继续？',
        required: true,
        fields: [{ id: 'answer', label: '回答', type: 'text', required: true }]
      }
    }))
    mockedAgentApi.runStream.mockImplementationOnce(async (request, onEvent) => {
      expect(request).toEqual(expect.objectContaining({
        agentId: 'workspace-agent',
        sessionId: 'session-question-reject',
        input: '继续吧'
      }))
      expect(request.continuation).toBeUndefined()
      onEvent({ type: 'assistant.final', runId: 'run-after-reject', text: '收到，继续吧' })
      onEvent({
        type: 'run.completed',
        runId: 'run-after-reject',
        status: 'success',
        result: finalResult,
        endedAt: Date.now()
      })
      return finalResult
    })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-question-reject')
    await store.rejectPendingInteraction()
    expect(store.isSessionInputBlocked).toBe(false)

    await store.sendPrompt('继续吧')

    expect(mockedAgentApi.runStream).toHaveBeenCalledTimes(1)
    expect(store.error).toBeNull()
    expect(store.pendingInteraction).toBeNull()
    expect(store.messages).toEqual([
      expect.objectContaining({
        kind: 'text',
        role: 'user',
        text: '已拒绝回答：是否继续？'
      }),
      expect.objectContaining({
        kind: 'text',
        role: 'user',
        text: '继续吧'
      }),
      expect.objectContaining({
        kind: 'text',
        role: 'assistant',
        text: '收到，继续吧'
      })
    ])
  })

  it('replies to a degraded pending interaction through the dedicated interaction APIs', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession({ sessionId: 'session-question-degraded' })])
    mockedAgentApi.getSessionMessages
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          messageId: 52,
          role: 'user',
          text: '[INTERACTION CONTEXT]\ninteraction_id: interaction-degraded\nquestion_id: question-3\nprompt: 请选择列\nanswer: {"answer":"第一列","notes":"只处理非空行"}',
          createdAt: 2,
          kind: 'text'
        },
        {
          messageId: 53,
          role: 'assistant',
          text: '已根据降级问题回答继续处理。',
          createdAt: 3,
          kind: 'text'
        }
      ])
    mockedAgentApi.listSessionInteractions
      .mockResolvedValueOnce([
        buildPendingQuestionInteraction({
          interactionId: 'interaction-degraded',
          payload: {
            questionId: 'question-3',
            title: '补充信息',
            prompt: '请选择列',
            required: true,
            degraded: {
              reason: '结构化问题收集失败，请手动填写。',
              referenceOptions: ['第一列']
            },
            fields: [
              { id: 'answer', label: '手动回答', type: 'text', required: true },
              { id: 'notes', label: '补充说明', type: 'text', required: false }
            ]
          }
        })
      ])
      .mockResolvedValueOnce([
        buildPendingQuestionInteraction({
          interactionId: 'interaction-degraded',
          status: 'answered',
          resolvedAt: 2,
          payload: {
            questionId: 'question-3',
            title: '补充信息',
            prompt: '请选择列',
            required: true,
            degraded: {
              reason: '结构化问题收集失败，请手动填写。',
              referenceOptions: ['第一列']
            },
            fields: [
              { id: 'answer', label: '手动回答', type: 'text', required: true },
              { id: 'notes', label: '补充说明', type: 'text', required: false }
            ]
          }
        })
      ])
    mockedAgentApi.replySessionInteraction.mockResolvedValueOnce(buildPendingQuestionInteraction({
      interactionId: 'interaction-degraded',
      status: 'answered',
      resolvedAt: 2
    }))
    mockedAgentApi.runStream.mockImplementationOnce(async (request, onEvent) => {
      onEvent({
        type: 'run.completed',
        runId: 'run-degraded-continue',
        status: 'success',
        result: buildRunResult({
          runId: 'run-degraded-continue',
          sessionId: 'session-question-degraded',
          text: '已根据降级问题回答继续处理。',
          continuationOfInteractionId: 'interaction-degraded'
        }),
        endedAt: Date.now()
      })
      return buildRunResult({
        runId: 'run-degraded-continue',
        sessionId: 'session-question-degraded',
        text: '已根据降级问题回答继续处理。',
        continuationOfInteractionId: 'interaction-degraded'
      })
    })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-question-degraded')
    await store.replyPendingInteraction({
      answer: '第一列',
      notes: '只处理非空行'
    })

    expect(mockedAgentApi.replySessionInteraction).toHaveBeenCalledWith(
      'workspace-agent',
      'session-question-degraded',
      'interaction-degraded',
      {
        answer: '第一列',
        notes: '只处理非空行'
      }
    )
    expect(mockedAgentApi.runStream).toHaveBeenCalledWith(expect.objectContaining({
      input: '',
      continuation: {
        interactionId: 'interaction-degraded'
      }
    }), expect.any(Function))
    expect(store.messages[0]).toMatchObject({
      role: 'user',
      text: '已提交回答：手动回答：第一列，补充说明：只处理非空行',
      editable: false
    })
  })

  it('blocks ordinary prompt submission while a pending interaction exists', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession({ sessionId: 'session-pending' })])
    mockedAgentApi.getSessionMessages.mockResolvedValueOnce([])
    mockedAgentApi.listSessionInteractions.mockResolvedValueOnce([
      buildPendingQuestionInteraction()
    ])

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-pending')
    await store.sendPrompt('继续处理')

    expect(store.isSessionInputBlocked).toBe(true)
    expect(store.error).toBe('当前会话正在等待问题回答，请先提交或拒绝该问题。')
    expect(mockedAgentApi.runStream).not.toHaveBeenCalled()
  })

  it('reloads the session when backend rejects ordinary input for a pending interaction', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession({ sessionId: 'session-pending-reject' })])
    mockedAgentApi.getSessionMessages
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          messageId: 51,
          role: 'assistant',
          text: '仍在等待回答。',
          createdAt: 5,
          kind: 'text'
        }
      ])
    mockedAgentApi.listSessionInteractions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([buildPendingQuestionInteraction()])
    mockedAgentApi.runStream.mockRejectedValueOnce(Object.assign(
      new Error('当前会话有待回答的问题，请先提交或拒绝该问题后再继续。'),
      { code: 'PENDING_INTERACTION_BLOCKED' }
    ))

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-pending-reject')

    await store.sendPrompt('继续处理')

    expect(mockedAgentApi.getSessionMessages).toHaveBeenCalledTimes(2)
    expect(mockedAgentApi.listSessionInteractions).toHaveBeenCalledTimes(2)
    expect(store.pendingInteraction).toMatchObject({
      interactionId: 'interaction-1',
      status: 'pending'
    })
    expect(store.messages).toEqual([
      expect.objectContaining({
        kind: 'text',
        role: 'assistant',
        text: '仍在等待回答。'
      }),
      expect.objectContaining({
        kind: 'question',
        role: 'assistant',
        id: 'interaction-1'
      })
    ])
    expect(store.latestStatus).toBe('请先回答当前问题')
  })

  it('applies redirect and cancel actions as persisted protocol-state convergence', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession({ sessionId: 'session-protocol' })])
    mockedAgentApi.getSessionMessages.mockResolvedValueOnce([
      {
        messageId: 40,
        role: 'assistant',
        text: '{"version":"1.0"}',
        createdAt: 1,
        kind: 'protocol',
        protocol: {
          version: '1.0',
          components: [{ type: 'text', id: 'step-1', content: '第一步' }],
          actions: [
            {
              id: 'go-next',
              label: '下一步',
              type: 'redirect',
              toolInput: {
                message: {
                  version: '1.0',
                  components: [{ type: 'text', id: 'step-2', content: '第二步' }],
                  actions: []
                }
              }
            },
            {
              id: 'cancel-step',
              label: '取消',
              type: 'cancel'
            }
          ]
        },
        protocolState: null
      }
    ])

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-protocol')
    await store.executeProtocolAction('persisted-40', {
      id: 'go-next',
      label: '下一步',
      type: 'redirect',
      toolInput: {
        message: {
          version: '1.0',
          components: [{ type: 'text', id: 'step-2', content: '第二步' }],
          actions: []
        }
      }
    })

    expect(store.messages[0]).toMatchObject({
      kind: 'protocol',
      protocol: {
        components: [{ type: 'text', id: 'step-2', content: '第二步' }]
      }
    })

    await store.executeProtocolAction('persisted-40', {
      id: 'cancel-step',
      label: '取消',
      type: 'cancel'
    })

    expect(store.messages[0]).toMatchObject({
      kind: 'protocol',
      protocolState: {
        note: '已取消当前协议操作。'
      }
    })
  })

  it('surfaces governed compatibility feedback for workbook-coupled protocol tools', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession({ sessionId: 'session-workbook' })])
    mockedAgentApi.getSessionMessages.mockResolvedValueOnce([
      {
        messageId: 41,
        role: 'assistant',
        text: '{"version":"1.0"}',
        createdAt: 1,
        kind: 'protocol',
        protocol: {
          version: '1.0',
          components: [{ type: 'text', id: 'title', content: '执行 workbook 操作' }],
          actions: [{
            id: 'invoke-gateway',
            label: '执行',
            type: 'tool',
            tool: 'gateway_tools_invoke',
            toolInput: {
              toolId: 'gateway:test'
            }
          }]
        },
        protocolState: null
      }
    ])

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-workbook')
    await store.executeProtocolAction('persisted-41', {
      id: 'invoke-gateway',
      label: '执行',
      type: 'tool',
      tool: 'gateway_tools_invoke',
      toolInput: {
        toolId: 'gateway:test'
      }
    })

    expect(store.messages[0]).toMatchObject({
      kind: 'protocol',
      protocolState: {
        actionStatus: 'blocked'
      }
    })
    expect(store.messages[0]?.kind === 'protocol' && store.messages[0].protocolState?.note).toContain('网关工具执行上下文')
  })

  it('prefers authoritative pending interactions over a synthetic stopped placeholder after cancellation', async () => {
    const cancelledResult = buildRunResult({
      runId: 'run-pending-stop',
      error: 'Request cancelled',
      runtimeError: {
        code: 'CANCELLED',
        stage: 'finalize',
        retryable: false,
        userMessage: '请求已取消。'
      }
    })
    const { emitEvent, resolveRun } = mockStreamingRunOnce()

    mockedAgentApi.createSession.mockResolvedValueOnce(buildSession({
      title: '问题竞态',
      messageCount: 0
    }))
    mockedAgentApi.listSessions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([buildSession({
        title: '问题竞态',
        messageCount: 1
      })])
    mockedAgentApi.getSessionMessages.mockResolvedValueOnce([
      {
        messageId: 1,
        role: 'user',
        text: '问题竞态',
        createdAt: 1,
        kind: 'text'
      }
    ])
    mockedAgentApi.listSessionInteractions.mockResolvedValueOnce([
      buildPendingQuestionInteraction({
        interactionId: 'interaction-stop'
      })
    ])

    const store = useWorkbenchStore()
    await store.initialize()

    const pending = store.sendPrompt('问题竞态')
    await Promise.resolve()
    await Promise.resolve()

    emitEvent({
      type: 'lifecycle.start',
      runId: 'run-pending-stop',
      agentId: 'workspace-agent',
      sessionId: 'session-1',
      startedAt: Date.now()
    })

    await store.stopCurrentRun()

    emitEvent({
      type: 'lifecycle.error',
      runId: 'run-pending-stop',
      endedAt: Date.now(),
      error: 'Request cancelled',
      runtimeError: {
        code: 'CANCELLED',
        stage: 'finalize',
        retryable: false,
        userMessage: '请求已取消。'
      }
    })
    emitEvent({
      type: 'run.completed',
      runId: 'run-pending-stop',
      status: 'cancelled',
      result: cancelledResult,
      endedAt: Date.now()
    })
    resolveRun(cancelledResult)
    await pending

    expect(store.pendingInteraction).toMatchObject({
      interactionId: 'interaction-stop'
    })
    expect(store.messages.some(message => message.assistantHeader?.label === '已停止')).toBe(false)
  })

  it('prefers refreshed saved plan state over a synthetic stopped placeholder after cancellation', async () => {
    const cancelledResult = buildRunResult({
      runId: 'run-plan-stop',
      error: 'Request cancelled',
      runtimeError: {
        code: 'CANCELLED',
        stage: 'finalize',
        retryable: false,
        userMessage: '请求已取消。'
      }
    })
    const { emitEvent, resolveRun } = mockStreamingRunOnce()

    mockedAgentApi.createSession.mockResolvedValueOnce(buildSession({
      title: '计划竞态',
      messageCount: 0
    }))
    mockedAgentApi.listSessions
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([buildSession({
        title: '计划竞态',
        messageCount: 1,
        activePrimaryAgent: 'plan',
        planState: {
          planId: 'plan-stop',
          version: 1,
          status: 'awaiting_approval',
          title: '计划',
          summary: '待批准',
          filePath: 'plans/stop.md',
          approvedSkillIds: []
        }
      })])
    mockedAgentApi.getSessionMessages.mockResolvedValueOnce([
      {
        messageId: 1,
        role: 'assistant',
        text: '{"version":"1.0"}',
        createdAt: 1,
        kind: 'protocol',
        protocol: {
          version: '1.0',
          components: [{ type: 'text', id: 'plan', content: '计划待批准' }],
          actions: []
        },
        protocolState: null
      }
    ])
    mockedAgentApi.listSessionInteractions.mockResolvedValueOnce([])

    const store = useWorkbenchStore()
    await store.initialize()

    const pending = store.sendPrompt('计划竞态')
    await Promise.resolve()
    await Promise.resolve()

    emitEvent({
      type: 'lifecycle.start',
      runId: 'run-plan-stop',
      agentId: 'workspace-agent',
      sessionId: 'session-1',
      startedAt: Date.now()
    })

    await store.stopCurrentRun()

    emitEvent({
      type: 'lifecycle.error',
      runId: 'run-plan-stop',
      endedAt: Date.now(),
      error: 'Request cancelled',
      runtimeError: {
        code: 'CANCELLED',
        stage: 'finalize',
        retryable: false,
        userMessage: '请求已取消。'
      }
    })
    emitEvent({
      type: 'run.completed',
      runId: 'run-plan-stop',
      status: 'cancelled',
      result: cancelledResult,
      endedAt: Date.now()
    })
    resolveRun(cancelledResult)
    await pending

    expect(store.latestPlanSummary).toBe('待批准')
    expect(store.messages[0]).toMatchObject({
      kind: 'protocol'
    })
    expect(store.messages.some(message => message.assistantHeader?.label === '已停止')).toBe(false)
  })

  it('executes a plan decision and refreshes session plan state', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([
      buildSession({
        sessionId: 'session-plan',
        activePrimaryAgent: 'plan',
        planState: {
          planId: 'plan-1',
          version: 1,
          status: 'awaiting_approval',
          title: '计划',
          summary: '待批准',
          filePath: 'plans/v1.md',
          approvedSkillIds: ['skill-a']
        }
      })
    ])
    mockedAgentApi.getSessionMessages
      .mockResolvedValueOnce([
        {
          messageId: 10,
          role: 'assistant',
          text: '{"version":"1.0"}',
          createdAt: 1,
          kind: 'protocol',
          protocol: {
            version: '1.0',
            components: [{ type: 'text', id: 'title', content: '计划' }],
            actions: [{
              id: 'plan-approve',
              label: '批准执行',
              type: 'tool',
              tool: 'plan_decision',
              toolInput: { decision: 'approve', planId: 'plan-1' }
            }]
          },
          protocolState: null
        }
      ])
      .mockResolvedValueOnce([
        {
          messageId: 10,
          role: 'assistant',
          text: '{"version":"1.0"}',
          createdAt: 1,
          kind: 'protocol',
          protocol: {
            version: '1.0',
            components: [{ type: 'text', id: 'title', content: '计划' }],
            actions: []
          },
          protocolState: { note: '计划已批准，切换到 build。' }
        }
      ])
    mockedAgentApi.decidePlan.mockResolvedValueOnce({
      session: buildSession({
        sessionId: 'session-plan',
        activePrimaryAgent: 'build',
        planState: {
          planId: 'plan-1',
          version: 1,
          status: 'approved',
          title: '计划',
          summary: '已批准',
          filePath: 'plans/v1.md',
          approvedSkillIds: ['skill-a']
        }
      }),
      plan: {
        planId: 'plan-1',
        version: 1,
        status: 'approved',
        title: '计划',
        summary: '已批准',
        filePath: 'plans/v1.md',
        approvedSkillIds: ['skill-a'],
        steps: ['Step 1'],
        risks: [],
        openQuestions: []
      }
    })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-plan')
    await store.executeProtocolAction('persisted-10', {
      id: 'plan-approve',
      label: '批准执行',
      type: 'tool',
      tool: 'plan_decision',
      toolInput: { decision: 'approve', planId: 'plan-1' }
    })

    expect(mockedAgentApi.decidePlan).toHaveBeenCalledWith('workspace-agent', 'session-plan', 'approve', 'plan-1')
    expect(mockedAgentApi.updateProtocolState).toHaveBeenCalled()
    expect((mockedAgentApi.updateProtocolState.mock.calls.at(-1)?.[3] as Record<string, unknown>).message).toMatchObject({
      actions: []
    })
    expect(store.sessions[0]?.activePrimaryAgent).toBe('build')
    expect(store.latestPlanSummary).toBe('已批准')
  })

  it('keeps a blocked approval visible in protocol state feedback', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([buildSession({ sessionId: 'session-plan', activePrimaryAgent: 'plan' })])
    mockedAgentApi.getSessionMessages.mockResolvedValueOnce([
      {
        messageId: 11,
        role: 'assistant',
        text: '{"version":"1.0"}',
        createdAt: 1,
        kind: 'protocol',
        protocol: {
          version: '1.0',
          components: [{ type: 'text', id: 'title', content: '计划' }],
          actions: [{
            id: 'plan-approve',
            label: '批准执行',
            type: 'tool',
            tool: 'plan_decision',
            toolInput: { decision: 'approve', planId: 'plan-1' }
          }]
        },
        protocolState: null
      }
    ])
    mockedAgentApi.decidePlan.mockRejectedValueOnce(new Error('Plan has unresolved planning questions'))

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-plan')
    await expect(store.executeProtocolAction('persisted-11', {
      id: 'plan-approve',
      label: '批准执行',
      type: 'tool',
      tool: 'plan_decision',
      toolInput: { decision: 'approve', planId: 'plan-1' }
    })).rejects.toThrow('Plan has unresolved planning questions')

    expect(store.messages[0]).toMatchObject({
      kind: 'protocol',
      protocolState: {
        actionStatus: 'error',
        decision: 'approve',
        note: 'Plan has unresolved planning questions'
      }
    })
  })

  it('keeps the session in plan mode when the user chooses revise', async () => {
    mockedAgentApi.listSessions.mockResolvedValueOnce([
      buildSession({
        sessionId: 'session-plan',
        activePrimaryAgent: 'plan',
        planState: {
          planId: 'plan-2',
          version: 2,
          status: 'awaiting_approval',
          title: '计划',
          summary: '待修改',
          filePath: 'plans/v2.md',
          approvedSkillIds: ['skill-a']
        }
      })
    ])
    mockedAgentApi.getSessionMessages
      .mockResolvedValueOnce([
        {
          messageId: 12,
          role: 'assistant',
          text: '{"version":"1.0"}',
          createdAt: 1,
          kind: 'protocol',
          protocol: {
            version: '1.0',
            components: [{ type: 'text', id: 'title', content: '计划' }],
            actions: [{
              id: 'plan-revise',
              label: '继续修改',
              type: 'tool',
              tool: 'plan_decision',
              toolInput: { decision: 'revise', planId: 'plan-2' }
            }]
          },
          protocolState: null
        }
      ])
      .mockResolvedValueOnce([
        {
          messageId: 12,
          role: 'assistant',
          text: '{"version":"1.0"}',
          createdAt: 1,
          kind: 'protocol',
          protocol: {
            version: '1.0',
            components: [{ type: 'text', id: 'title', content: '计划' }],
            actions: []
          },
          protocolState: { note: '计划保持在 plan，可继续修改。' }
        }
      ])
    mockedAgentApi.decidePlan.mockResolvedValueOnce({
      session: buildSession({
        sessionId: 'session-plan',
        activePrimaryAgent: 'plan',
        planState: {
          planId: 'plan-2',
          version: 2,
          status: 'draft',
          title: '计划',
          summary: '继续修改',
          filePath: 'plans/v2.md',
          approvedSkillIds: ['skill-a']
        }
      }),
      plan: {
        planId: 'plan-2',
        version: 2,
        status: 'draft',
        title: '计划',
        summary: '继续修改',
        filePath: 'plans/v2.md',
        approvedSkillIds: ['skill-a'],
        steps: ['Step 1'],
        risks: ['Risk 1'],
        openQuestions: []
      }
    })

    const store = useWorkbenchStore()
    await store.initialize()
    await store.selectSession('session-plan')
    await store.executeProtocolAction('persisted-12', {
      id: 'plan-revise',
      label: '继续修改',
      type: 'tool',
      tool: 'plan_decision',
      toolInput: { decision: 'revise', planId: 'plan-2' }
    })

    expect(mockedAgentApi.decidePlan).toHaveBeenCalledWith('workspace-agent', 'session-plan', 'revise', 'plan-2')
    expect(store.sessions[0]?.activePrimaryAgent).toBe('plan')
    expect(store.latestPlanSummary).toBe('继续修改')
  })
})
