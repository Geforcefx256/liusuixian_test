import type { AgentCatalogService } from '../../agents/service.js'
import { runWithLogContext } from '../../logging/index.js'
import type { ChatOrchestrator } from '../chatOrchestrator.js'
import type { ToolRegistryLike } from '../loopTypes.js'
import type { ProviderClient } from '../providerClient.js'
import type { AgentSessionStore } from '../sessionStore.js'
import type { ToolDisplayNameResolver } from '../toolInvocationSignal.js'
import type { AgentRunRequest, AgentRunResult, AgentStreamEvent } from '../types.js'
import { WorkspaceOccupancyConflictError } from './runtimeErrors.js'
import { RunExecution } from './RunExecution.js'
import type { ActiveRun, RunOutcome, WorkspaceOccupancy } from './types.js'

export class RunCoordinator {
  private runs = new Map<string, ActiveRun>()
  private results = new Map<string, AgentRunResult>()
  private sessionOccupancies = new Map<string, WorkspaceOccupancy>()
  private blockedSessionKeys = new Set<string>()
  private runExecution: RunExecution

  constructor(params: {
    catalogService: AgentCatalogService
    chatOrchestrator: ChatOrchestrator
    sessionStore: AgentSessionStore
    providerClient: ProviderClient
    toolRegistry: ToolRegistryLike
    workspaceDir: string
    displayNameResolver?: ToolDisplayNameResolver
  }) {
    this.runExecution = new RunExecution({
      catalogService: params.catalogService,
      chatOrchestrator: params.chatOrchestrator,
      sessionStore: params.sessionStore,
      providerClient: params.providerClient,
      toolRegistry: params.toolRegistry,
      workspaceDir: params.workspaceDir,
      displayNameResolver: params.displayNameResolver,
      runs: this.runs,
      results: this.results
    })
  }

  async executeRun(
    request: AgentRunRequest,
    emit: (event: AgentStreamEvent) => void
  ): Promise<AgentRunResult> {
    const conflict = this.resolveRunConflict(request)
    if (conflict) {
      throw new WorkspaceOccupancyConflictError(buildRunConflictMessage(), conflict)
    }
    return this.executeRunWithSessionLock(request, emit)
  }

  cancelRun(runId: string): boolean {
    const run = this.runs.get(runId)
    if (!run) {
      return false
    }
    const cancelled = this.runExecution.cancelRun(runId)
    if (!cancelled) {
      return false
    }
    const key = buildSessionRunKey(run.userId, run.agentId, run.sessionId)
    const occupancy = this.sessionOccupancies.get(key)
    if (occupancy?.runId === runId) {
      this.sessionOccupancies.set(key, {
        occupied: true,
        state: 'stop-pending',
        ownerSessionId: run.sessionId,
        runId
      })
    }
    return true
  }

  getRunResult(runId: string): AgentRunResult | null {
    return this.runExecution.getRunResult(runId)
  }

  getSessionOccupancy(userId: number, agentId: string, sessionId: string): WorkspaceOccupancy | null {
    const occupancy = this.sessionOccupancies.get(buildSessionRunKey(userId, agentId, sessionId))
    return occupancy ? { ...occupancy } : null
  }

  clearAwaitingQuestionOccupancy(userId: number, agentId: string, sessionId: string): void {
    const key = buildSessionRunKey(userId, agentId, sessionId)
    const occupancy = this.sessionOccupancies.get(key)
    if (!occupancy || occupancy.state !== 'awaiting-question') {
      return
    }
    this.sessionOccupancies.delete(key)
  }

  releaseSessionOccupancy(
    userId: number,
    agentId: string,
    sessionId: string,
    options: {
      block?: boolean
    } = {}
  ): void {
    const key = buildSessionRunKey(userId, agentId, sessionId)
    this.sessionOccupancies.delete(key)
    if (options.block) {
      this.blockedSessionKeys.add(key)
    }
  }

  listSessionOccupancies(userId: number, agentId: string): Map<string, WorkspaceOccupancy> {
    const prefix = `${userId}:${agentId}:`
    const result = new Map<string, WorkspaceOccupancy>()
    for (const [key, occupancy] of this.sessionOccupancies.entries()) {
      if (!key.startsWith(prefix)) {
        continue
      }
      result.set(key.slice(prefix.length), { ...occupancy })
    }
    return result
  }

  private async executeRunWithSessionLock(
    request: AgentRunRequest,
    emit: (event: AgentStreamEvent) => void
  ): Promise<AgentRunResult> {
    const key = buildSessionRunKey(request.userId, request.agentId, request.sessionId)
    this.blockedSessionKeys.delete(key)
    this.sessionOccupancies.set(key, {
      occupied: true,
      state: 'running',
      ownerSessionId: request.sessionId,
      runId: request.runId
    })
    const outcome = await runWithLogContext({
      userId: request.userId,
      agentId: request.agentId,
      sessionId: request.sessionId,
      runId: request.runId,
      turnId: `${request.sessionId}:turn-1`
    }, () => this.performRun(request, emit))
    this.runExecution.removeRun(request.runId)
    this.completeSessionOccupancy({ key, request, outcome })
    return outcome.result
  }

  private async performRun(
    request: AgentRunRequest,
    emit: (event: AgentStreamEvent) => void
  ): Promise<RunOutcome> {
    return this.runExecution.performRun(request, emit)
  }

  private resolveRunConflict(request: AgentRunRequest): WorkspaceOccupancy | null {
    const occupancy = this.sessionOccupancies.get(
      buildSessionRunKey(request.userId, request.agentId, request.sessionId)
    )
    if (!occupancy?.occupied) {
      return null
    }
    if (occupancy.state === 'awaiting-question' && request.continuation) {
      return null
    }
    return { ...occupancy }
  }

  private completeSessionOccupancy(params: {
    key: string
    request: AgentRunRequest
    outcome: RunOutcome
  }): void {
    if (this.blockedSessionKeys.has(params.key)) {
      this.sessionOccupancies.delete(params.key)
      return
    }
    if (params.outcome.status === 'awaiting-interaction') {
      this.sessionOccupancies.set(params.key, {
        occupied: true,
        state: 'awaiting-question',
        ownerSessionId: params.request.sessionId,
        runId: null
      })
      return
    }
    this.sessionOccupancies.delete(params.key)
  }
}

function buildSessionRunKey(userId: number, agentId: string, sessionId: string): string {
  return `${userId}:${agentId}:${sessionId}`
}

function buildRunConflictMessage(): string {
  return '当前会话还在处理中，请等它结束后再发送。'
}
