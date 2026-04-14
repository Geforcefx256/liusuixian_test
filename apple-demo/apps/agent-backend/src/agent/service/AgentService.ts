import { AgentCatalogService } from '../../agents/service.js'
import { SkillCatalog } from '../../skills/catalog.js'
import { ChatOrchestrator } from '../chatOrchestrator.js'
import { ProviderClient } from '../providerClient.js'
import { AgentLoop } from '../agentLoop.js'
import type { AgentSessionStore } from '../sessionStore.js'
import type { QuestionInteractionContinuationContext } from '../interactions.js'
import { createDefaultToolProviderRegistry } from '../../runtime/tools/index.js'
import type { AgentRunRequest, AgentRunResult, AgentStreamEvent } from '../types.js'
import { loadConfig } from '../../memory/ConfigLoader.js'
import { resolveModelContextWindow } from '../modelDefaults.js'
import { DEFAULT_CONTEXT_CONFIG } from './constants.js'
import { getDefaultSessionStore, getDefaultTokenizer } from './defaults.js'
import { RunCoordinator } from './RunCoordinator.js'
import type { AgentServiceOptions, SessionActivity, WorkspaceOccupancy } from './types.js'
import type { WorkspaceSessionEntry } from '../workspace/types.js'
import { fileStore } from '../../files/fileStore.js'
import { createToolDisplayNameResolver } from '../toolInvocationSignal.js'
import { WorkspaceOccupancyConflictError } from './runtimeErrors.js'

export class AgentService {
  private sessionStore: AgentSessionStore
  private runCoordinator: RunCoordinator

  constructor(
    catalogService = new AgentCatalogService(undefined, new SkillCatalog()),
    options: AgentServiceOptions = {}
  ) {
    const runtimeConfig = loadConfig()
    const displayNameResolver = createToolDisplayNameResolver(
      runtimeConfig.runtime.tools.displayNames,
      (skillName, agentId) => agentId ? catalogService.resolveGovernedSkillName(skillName, agentId) : null
    )
    this.sessionStore = options.sessionStore || getDefaultSessionStore()
    const providerClient = options.providerClient || new ProviderClient({
      logDetail: runtimeConfig.runtime.context.logDetail,
      providerLogging: runtimeConfig.runtime.providerLogging === 'on'
    })
    const toolRegistry = options.toolRegistry || createDefaultToolProviderRegistry({
      runtimeRoot: runtimeConfig.runtime.workspaceDir,
      logDetail: runtimeConfig.runtime.context.logDetail,
      sessionStore: this.sessionStore,
      skillCatalog: new SkillCatalog(),
      toolDenyList: runtimeConfig.runtime.tools.deny,
      filesystemTools: runtimeConfig.runtime.filesystemTools
    })
    const agentLoop = new AgentLoop({
      providerClient,
      sessionStore: this.sessionStore,
      toolRegistry
    }, {
      logDetail: runtimeConfig.runtime.context.logDetail,
      displayNameResolver,
      toolFailurePolicy: {
        runtimeRetry: runtimeConfig.runtime.tools.runtimeRetry,
        modelRecovery: runtimeConfig.runtime.agentLoop.modelRecovery,
        loopDetection: runtimeConfig.runtime.agentLoop.loopDetection
      }
    })
    const tokenizer = options.tokenizer || getDefaultTokenizer()
    const contextWindow = options.defaultContextWindow || resolveModelContextWindow(runtimeConfig.agent.defaultModel)
    const contextConfig = buildContextConfig(runtimeConfig)
    const chatOrchestrator = new ChatOrchestrator(providerClient, agentLoop, this.sessionStore, {
      maxSteps: runtimeConfig.runtime.agentLoop.maxSteps,
      tokenizer,
      defaultContextWindow: contextWindow,
      contextConfig
    })
    this.runCoordinator = new RunCoordinator({
      catalogService,
      chatOrchestrator,
      sessionStore: this.sessionStore,
      providerClient,
      toolRegistry,
      workspaceDir: runtimeConfig.runtime.workspaceDir,
      displayNameResolver
    })
  }

  executeRun(
    request: AgentRunRequest,
    emit: (event: AgentStreamEvent) => void
  ): Promise<AgentRunResult> {
    return this.runCoordinator.executeRun(request, emit)
  }

  cancelRun(runId: string): boolean {
    return this.runCoordinator.cancelRun(runId)
  }

  getRunResult(runId: string): AgentRunResult | null {
    return this.runCoordinator.getRunResult(runId)
  }

  async getWorkspaceOccupancy(
    userId: number,
    agentId: string,
    sessionId?: string
  ): Promise<WorkspaceOccupancy> {
    if (!sessionId) {
      return createIdleOccupancy()
    }
    return this.getSessionOccupancy(userId, agentId, sessionId)
  }

  async assertWorkspaceRunAllowed(request: AgentRunRequest): Promise<void> {
    const occupancy = await this.getSessionOccupancy(request.userId, request.agentId, request.sessionId)
    if (!occupancy.occupied) {
      return
    }
    if (occupancy.state === 'awaiting-question' && request.continuation) {
      return
    }
    throw new WorkspaceOccupancyConflictError('当前会话还在处理中，请等它结束后再发送。', occupancy)
  }

  async assertSessionMutationAllowed(userId: number, agentId: string, sessionId: string): Promise<void> {
    const occupancy = await this.getSessionOccupancy(userId, agentId, sessionId)
    if (!occupancy.occupied) {
      return
    }
    throw new WorkspaceOccupancyConflictError('当前会话仍在处理中，暂时不能删除。', occupancy)
  }

  async listSessions(userId: number, agentId: string): ReturnType<AgentSessionStore['listSessions']> {
    const sessions = await this.sessionStore.listSessions(userId, agentId)
    const activityBySessionId = await this.resolveSessionActivities(userId, agentId, sessions.map(session => session.sessionId))
    return sessions.map(session => ({
      ...session,
      activity: activityBySessionId.get(session.sessionId) || createIdleActivity()
    }))
  }

  createSession(userId: number, agentId: string, title?: string): ReturnType<AgentSessionStore['createSession']> {
    return this.sessionStore.createSession(userId, agentId, title)
  }

  getSessionMeta(userId: number, agentId: string, sessionId: string) {
    return this.sessionStore.getSessionMeta({ userId, agentId, sessionId })
  }

  getSessionUsageSummary(userId: number, agentId: string, sessionId: string) {
    return this.sessionStore.getSessionUsageSummary({ userId, agentId, sessionId })
  }

  renameSession(userId: number, agentId: string, sessionId: string, title: string): Promise<void> {
    return this.sessionStore.renameSession(userId, agentId, sessionId, title)
  }

  async deleteSession(userId: number, agentId: string, sessionId: string): Promise<boolean> {
    const occupancy = await this.getSessionOccupancy(userId, agentId, sessionId)
    const deleted = await this.sessionStore.deleteSession(userId, agentId, sessionId)
    if (!deleted) {
      return false
    }
    if (occupancy.runId) {
      this.runCoordinator.cancelRun(occupancy.runId)
    }
    this.runCoordinator.releaseSessionOccupancy(userId, agentId, sessionId, {
      block: true
    })
    return true
  }

  async clearHistorySessions(userId: number, agentId: string, excludedSessionId?: string | null) {
    const sessions = await this.sessionStore.listSessions(userId, agentId)
    const activityBySessionId = await this.resolveSessionActivities(userId, agentId, sessions.map(session => session.sessionId))
    const skippedActiveSessionIds = sessions
      .map(session => session.sessionId)
      .filter(sessionId => sessionId !== excludedSessionId && (activityBySessionId.get(sessionId)?.active || false))
    const preservedSessionIds = [
      ...(excludedSessionId ? [excludedSessionId] : []),
      ...skippedActiveSessionIds
    ]
    const deletedCount = await this.sessionStore.clearHistorySessions(userId, agentId, preservedSessionIds)
    return {
      deletedCount,
      excludedSessionId: excludedSessionId || null,
      skippedActiveSessionIds
    }
  }

  private async getSessionOccupancy(userId: number, agentId: string, sessionId: string): Promise<WorkspaceOccupancy> {
    const activeOccupancy = this.runCoordinator.getSessionOccupancy(userId, agentId, sessionId)
    if (activeOccupancy?.occupied) {
      return activeOccupancy
    }
    const interactions = await this.sessionStore.listInteractions({
      userId,
      agentId,
      sessionId,
      statuses: ['pending']
    })
    if (interactions.length > 0) {
      return {
        occupied: true,
        state: 'awaiting-question',
        ownerSessionId: sessionId,
        runId: null
      }
    }
    return createIdleOccupancy()
  }

  private async resolveSessionActivities(
    userId: number,
    agentId: string,
    sessionIds: string[]
  ): Promise<Map<string, SessionActivity>> {
    const activities = new Map<string, SessionActivity>()
    const activeOccupancies = this.runCoordinator.listSessionOccupancies(userId, agentId)

    for (const sessionId of sessionIds) {
      const activeOccupancy = activeOccupancies.get(sessionId)
      if (activeOccupancy?.occupied) {
        activities.set(sessionId, toSessionActivity(activeOccupancy))
        continue
      }
      const interactions = await this.sessionStore.listInteractions({
        userId,
        agentId,
        sessionId,
        statuses: ['pending']
      })
      activities.set(sessionId, interactions.length > 0
        ? {
            active: true,
            state: 'awaiting-question',
            runId: null
          }
        : createIdleActivity())
    }

    return activities
  }

  listWorkspaceFiles(userId: number, agentId: string): WorkspaceSessionEntry[] {
    return fileStore.listWorkspaceEntries({ userId, agentId }).map(entry => {
      const base = {
        nodeId: entry.fileKey,
        path: fileStore.getWorkspaceRelativePath(entry),
        fileName: entry.originalName,
        relativePath: entry.relativePath || entry.originalName,
        groupId: entry.kind === 'upload' ? 'upload' : 'project',
        addedAt: entry.createdAt
      } as const
      if (entry.kind === 'folder') {
        return {
          ...base,
          nodeType: 'folder' as const,
          folderKey: entry.fileKey,
          source: 'project' as const,
          writable: true as const
        }
      }
      return {
        ...base,
        nodeType: 'file' as const,
        fileId: entry.fileId,
        fileKey: entry.fileKey,
        source: entry.kind,
        writable: true
      }
    })
  }

  getWorkspaceFiles(userId: number, agentId: string, sessionId: string) {
    void sessionId
    return Promise.resolve(this.listWorkspaceFiles(userId, agentId))
  }

  replaceWorkspaceFiles(
    userId: number,
    agentId: string,
    sessionId: string,
    files: WorkspaceSessionEntry[]
  ) {
    void files
    return this.sessionStore.getSessionMeta({ userId, agentId, sessionId })
  }

  listSessionMessages(userId: number, agentId: string, sessionId: string, limit?: number, cursor?: number) {
    return this.sessionStore.getSessionMessagesView({ userId, agentId, sessionId, limit, cursor })
  }

  updateSessionMessageProtocolState(params: {
    userId: number
    agentId: string
    sessionId: string
    messageId: number
    protocolState: Record<string, unknown> | null
  }): Promise<void> {
    return this.sessionStore.updateMessageProtocolState(params)
  }

  decidePlan(params: {
    userId: number
    agentId: string
    sessionId: string
    decision: 'approve' | 'revise'
    planId?: string
  }) {
    return this.sessionStore.decidePlan(params)
  }

  listInteractions(params: {
    userId: number
    agentId: string
    sessionId: string
    statuses?: Array<'pending' | 'answered' | 'rejected'>
  }) {
    return this.sessionStore.listInteractions(params)
  }

  getInteraction(params: {
    userId: number
    agentId: string
    sessionId: string
    interactionId: string
  }) {
    return this.sessionStore.getInteraction(params)
  }

  resolveInteraction(params: {
    userId: number
    agentId: string
    sessionId: string
    interactionId: string
    status: 'answered' | 'rejected'
    answer?: Record<string, unknown> | null
    continuationContext?: QuestionInteractionContinuationContext | null
  }) {
    return this.resolveInteractionAndReleaseOccupancy({
      ...params,
      answer: params.answer ?? undefined,
      continuationContext: params.continuationContext ?? undefined
    })
  }

  private async resolveInteractionAndReleaseOccupancy(params: {
    userId: number
    agentId: string
    sessionId: string
    interactionId: string
    status: 'answered' | 'rejected'
    answer?: Record<string, unknown>
    continuationContext?: QuestionInteractionContinuationContext
  }) {
    const resolved = await this.sessionStore.resolveInteraction(params)
    this.runCoordinator.clearAwaitingQuestionOccupancy(params.userId, params.agentId, params.sessionId)
    return resolved
  }
}

function buildContextConfig(runtimeConfig: ReturnType<typeof loadConfig>) {
  return {
    ...DEFAULT_CONTEXT_CONFIG,
    auto: runtimeConfig.runtime.context.auto,
    prune: runtimeConfig.runtime.context.prune,
    logDetail: runtimeConfig.runtime.context.logDetail
  }
}

function createIdleActivity(): SessionActivity {
  return {
    active: false,
    state: 'idle',
    runId: null
  }
}

function createIdleOccupancy(): WorkspaceOccupancy {
  return {
    occupied: false,
    state: 'idle',
    ownerSessionId: null,
    runId: null
  }
}

function toSessionActivity(occupancy: WorkspaceOccupancy): SessionActivity {
  return {
    active: occupancy.occupied,
    state: occupancy.state,
    runId: occupancy.runId
  }
}
