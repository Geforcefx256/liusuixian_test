import type { AgentCatalogService } from '../../agents/service.js'
import type { ChatOrchestrator } from '../chatOrchestrator.js'
import type { ContextLogEntry } from '../context/types.js'
import type { ProviderClient } from '../providerClient.js'
import type { AgentSessionStore } from '../sessionStore.js'
import type { ToolFailureSignal, ToolRegistryLike } from '../loopTypes.js'
import type {
  AgentRunRequest,
  AgentRunResult,
  AgentStreamEvent,
  RuntimeError,
  RuntimeErrorCode
} from '../types.js'
import { RUN_CANCELLED_MESSAGE } from './constants.js'
import {
  buildErrorResult,
  buildSuccessResult,
  emitRunTiming
} from './resultBuilders.js'
import {
  buildRuntimeErrorFromUnknown,
  isAbortError,
  isToolInvocationError,
  logRuntimeError,
  resolveErrorMessage
} from './runtimeErrors.js'
import type { ActiveRun, RunOutcome } from './types.js'
import { executePlanPhase } from '../workspace/planner.js'
import {
  type ModelMetricsAggregate,
  isAgentExecutionError
} from '../executionErrors.js'
import {
  buildDefaultExecutionRequest,
  buildExecutionRequest
} from '../workspace/buildPhase.js'
import { PLAN_PRIMARY_AGENT } from '../workspace/constants.js'
import {
  isPlannerEnabled,
  resolveDefaultPrimaryAgent
} from '../workspace/runtimeConfig.js'
import { createLogger, recordTimelineEvent } from '../../logging/index.js'
import { PendingQuestionInteractionError } from '../interactions.js'
import { isModelRequestError } from '../modelRequestError.js'
import type { ToolDisplayNameResolver } from '../toolInvocationSignal.js'

const runExecutionLogger = createLogger({
  category: 'runtime',
  component: 'run_execution'
})

export class RunExecution {
  private catalogService: AgentCatalogService
  private chatOrchestrator: ChatOrchestrator
  private sessionStore: AgentSessionStore
  private providerClient: ProviderClient
  private toolRegistry: ToolRegistryLike
  private workspaceDir: string
  private displayNameResolver?: ToolDisplayNameResolver
  private runs: Map<string, ActiveRun>
  private results: Map<string, AgentRunResult>

  constructor(params: {
    catalogService: AgentCatalogService
    chatOrchestrator: ChatOrchestrator
    sessionStore: AgentSessionStore
    providerClient: ProviderClient
    toolRegistry: ToolRegistryLike
    workspaceDir: string
    displayNameResolver?: ToolDisplayNameResolver
    runs: Map<string, ActiveRun>
    results: Map<string, AgentRunResult>
  }) {
    this.catalogService = params.catalogService
    this.chatOrchestrator = params.chatOrchestrator
    this.sessionStore = params.sessionStore
    this.providerClient = params.providerClient
    this.toolRegistry = params.toolRegistry
    this.workspaceDir = params.workspaceDir
    this.displayNameResolver = params.displayNameResolver
    this.runs = params.runs
    this.results = params.results
  }

  async performRun(
    request: AgentRunRequest,
    emit: (event: AgentStreamEvent) => void
  ): Promise<RunOutcome> {
    const emitWithTimeline = this.createEmitWithTimeline(emit)
    const runContext = this.startRun(request, emitWithTimeline)
    try {
      const execution = await this.executeWithResolvedRequest({
        request,
        controller: runContext.controller,
        turnId: runContext.turnId,
        emit: emitWithTimeline
      })
      const success = this.handleRunSuccess({ request, execution, startedAt: runContext.startedAt, emit: emitWithTimeline })
      runContext.emitTerminal(success.status, success.result)
      return { result: success.result, toolFailed: false, status: success.status }
    } catch (error) {
      const failure = this.handleRunError({
        request,
        error,
        startedAt: runContext.startedAt,
        emit: emitWithTimeline,
        turnId: runContext.turnId
      })
      runContext.emitTerminal(failure.status, failure.result, failure.error)
      return { result: failure.result, toolFailed: failure.toolFailed, status: failure.status }
    }
  }

  cancelRun(runId: string): boolean {
    const run = this.runs.get(runId)
    if (!run) return false
    run.controller.abort()
    this.runs.delete(runId)
    return true
  }

  getRunResult(runId: string): AgentRunResult | null {
    return this.results.get(runId) || null
  }

  removeRun(runId: string): void {
    this.runs.delete(runId)
  }

  private startRun(
    request: AgentRunRequest,
    emit: (event: AgentStreamEvent) => void
  ): {
    controller: AbortController
    startedAt: number
    turnId: string
    emitTerminal: ReturnType<RunExecution['createEmitTerminal']>
  } {
    const startedAt = Date.now()
    const controller = new AbortController()
    const turnId = `${request.sessionId}:turn-1`
    this.runs.set(request.runId, {
      controller,
      startedAt,
      userId: request.userId,
      agentId: request.agentId,
      sessionId: request.sessionId
    })
    emit({
      type: 'lifecycle.start',
      runId: request.runId,
      agentId: request.agentId,
      sessionId: request.sessionId,
      startedAt
    })
    return { controller, startedAt, turnId, emitTerminal: this.createEmitTerminal(emit, request.runId) }
  }

  private async executeWithResolvedRequest(params: {
    request: AgentRunRequest
    controller: AbortController
    turnId: string
    emit: (event: AgentStreamEvent) => void
  }) {
    await this.assertPendingInteractionResolved(params.request)
    if (params.request.editContext) {
      runExecutionLogger.info({
        message: 'edit rerun requested',
        context: {
          userId: params.request.userId,
          agentId: params.request.agentId,
          sessionId: params.request.sessionId,
          runId: params.request.runId,
          turnId: params.turnId
        },
        data: {
          inputChars: params.request.input.length,
          inputPreview: params.request.input.slice(0, 120),
          editContext: params.request.editContext
        }
      })
      await this.sessionStore.rewriteSessionFromMessage({
        userId: params.request.userId,
        agentId: params.request.agentId,
        sessionId: params.request.sessionId,
        messageId: params.request.editContext.messageId
      })
      runExecutionLogger.info({
        message: 'edit rerun rewrite complete',
        context: {
          agentId: params.request.agentId,
          sessionId: params.request.sessionId,
          runId: params.request.runId,
          turnId: params.turnId
        },
        data: {
          editContext: params.request.editContext
        }
      })
    }
    const executionCatalog = this.catalogService.getExecutionCatalog(params.request.agentId)
    if (!executionCatalog) {
      throw new Error(`Execution catalog not found for agent: ${params.request.agentId}`)
    }
    const session = await this.sessionStore.getSessionMeta({
      userId: params.request.userId,
      agentId: params.request.agentId,
      sessionId: params.request.sessionId
    })
    const plannerEnabled = isPlannerEnabled(params.request.agentId)
    const phase = plannerEnabled
      ? (session?.activePrimaryAgent || resolveDefaultPrimaryAgent(params.request.agentId))
      : resolveDefaultPrimaryAgent(params.request.agentId)
    const trace = {
      runId: params.request.runId,
      turnId: params.turnId
    }
    if (plannerEnabled && phase === PLAN_PRIMARY_AGENT) {
      return executePlanPhase({
        providerClient: this.providerClient,
        toolRegistry: this.toolRegistry,
        sessionStore: this.sessionStore,
        workspaceDir: this.workspaceDir,
        request: params.request,
        executionCatalog,
        signal: params.controller.signal,
        trace,
        emit: params.emit,
        displayNameResolver: this.displayNameResolver
      })
    }
    if (!plannerEnabled) {
      const approvedPlan = await this.sessionStore.getLatestPlan({
        userId: params.request.userId,
        agentId: params.request.agentId,
        sessionId: params.request.sessionId
      })
      const resolvedRequest = approvedPlan && approvedPlan.status === 'approved'
        ? buildExecutionRequest({
            request: params.request,
            executionCatalog,
            approvedPlan
          })
        : buildDefaultExecutionRequest({
            request: params.request,
            executionCatalog
          })
      return this.chatOrchestrator.execute({
        request: resolvedRequest,
        signal: params.controller.signal,
        trace,
        emitContextLog: entry => this.emitContextLog(entry, resolvedRequest, params.emit),
        onToolStarted: signal => this.emitToolStarted(signal, resolvedRequest, params.emit),
        onToolFailed: signal => this.emitToolFailed(signal, resolvedRequest, params.emit)
      })
    }
    const approvedPlan = await this.sessionStore.getLatestPlan({
      userId: params.request.userId,
      agentId: params.request.agentId,
      sessionId: params.request.sessionId
    })
    if (!approvedPlan || approvedPlan.status !== 'approved') {
      const workspaceFiles = await this.sessionStore.getWorkspaceFiles({
        userId: params.request.userId,
        agentId: params.request.agentId,
        sessionId: params.request.sessionId
      })
      await this.sessionStore.updateSessionMeta({
        userId: params.request.userId,
        agentId: params.request.agentId,
        sessionId: params.request.sessionId,
        meta: {
          activePrimaryAgent: PLAN_PRIMARY_AGENT,
          planState: approvedPlan
            ? {
                planId: approvedPlan.planId,
                version: approvedPlan.version,
                status: approvedPlan.status,
                title: approvedPlan.title,
                summary: approvedPlan.summary,
                filePath: approvedPlan.filePath,
                approvedSkillIds: approvedPlan.approvedSkillIds
              }
            : null,
          workspaceFiles
        }
      })
      params.emit({
        type: 'agent.handoff',
        runId: params.request.runId,
        agentId: params.request.agentId,
        sessionId: params.request.sessionId,
        from: 'build',
        to: 'plan',
        reason: 'No approved plan found for build phase.',
        plan: approvedPlan
      })
      return executePlanPhase({
        providerClient: this.providerClient,
        toolRegistry: this.toolRegistry,
        sessionStore: this.sessionStore,
        workspaceDir: this.workspaceDir,
        request: params.request,
        executionCatalog,
        signal: params.controller.signal,
        trace,
        emit: params.emit,
        displayNameResolver: this.displayNameResolver
      })
    }
    const resolvedRequest = buildExecutionRequest({
      request: params.request,
      executionCatalog,
      approvedPlan
    })
    return this.chatOrchestrator.execute({
      request: resolvedRequest,
      signal: params.controller.signal,
      trace,
      emitContextLog: entry => this.emitContextLog(entry, resolvedRequest, params.emit),
      onToolStarted: signal => this.emitToolStarted(signal, resolvedRequest, params.emit),
      onToolFailed: signal => this.emitToolFailed(signal, resolvedRequest, params.emit)
    })
  }

  private async assertPendingInteractionResolved(request: AgentRunRequest): Promise<void> {
    if (!request.input.trim() || request.continuation) {
      return
    }
    const pendingInteractions = await this.sessionStore.listInteractions({
      userId: request.userId,
      agentId: request.agentId,
      sessionId: request.sessionId,
      statuses: ['pending']
    })
    if (pendingInteractions.length > 0) {
      throw new PendingQuestionInteractionError()
    }
  }

  private emitContextLog(
    entry: ContextLogEntry,
    request: AgentRunRequest,
    emit: (event: AgentStreamEvent) => void
  ): void {
    emit({
      type: 'context.log',
      runId: request.runId,
      agentId: request.agentId,
      sessionId: request.sessionId,
      loggedAt: entry.loggedAt,
      level: entry.level,
      message: entry.message,
      data: entry.data
    })
  }

  private emitToolStarted(
    signal: {
      toolCallId: string
      tool: string
      displayName: string
      toolKind: 'skill' | 'tool'
      startedAt: number
    },
    request: AgentRunRequest,
    emit: (event: AgentStreamEvent) => void
  ): void {
    emit({
      type: 'tool.started',
      runId: request.runId,
      agentId: request.agentId,
      sessionId: request.sessionId,
      ...signal
    })
  }

  private emitToolFailed(
    signal: ToolFailureSignal,
    request: AgentRunRequest,
    emit: (event: AgentStreamEvent) => void
  ): void {
    emit({
      type: 'tool.failed',
      runId: request.runId,
      agentId: request.agentId,
      sessionId: request.sessionId,
      ...signal
    })
  }

  private handleRunSuccess(params: {
    request: AgentRunRequest
    execution: Awaited<ReturnType<ChatOrchestrator['execute']>>
    startedAt: number
    emit: (event: AgentStreamEvent) => void
  }): { result: AgentRunResult; status: 'success' | 'awaiting-interaction' } {
    if (shouldEmitAssistantText(params.execution)) {
      params.emit({ type: 'assistant.delta', runId: params.request.runId, delta: params.execution.text })
      params.emit({ type: 'assistant.final', runId: params.request.runId, text: params.execution.text })
    }
    const { result, metrics, completedAt } = buildSuccessResult({
      request: params.request,
      execution: params.execution,
      startedAt: params.startedAt
    })
    params.emit({ type: 'metrics.run', runId: params.request.runId, metrics })
    this.results.set(params.request.runId, result)
    emitRunTiming({
      startedAt: params.startedAt,
      endedAt: completedAt,
      modelAggregate: params.execution.modelMetricsAggregate,
      toolMetrics: metrics.tools
    })
    return {
      result,
      status: result.output.kind === 'awaiting-interaction' ? 'awaiting-interaction' : 'success'
    }
  }

  private handleRunError(params: {
    request: AgentRunRequest
    error: unknown
    startedAt: number
    emit: (event: AgentStreamEvent) => void
    turnId: string
  }): {
    result: AgentRunResult
    toolFailed: boolean
    status: 'error' | 'cancelled'
    error?: { code: RuntimeErrorCode; message: string; runtimeError?: RuntimeError }
  } {
    const resolved = this.resolveErrorContext({
      request: params.request,
      error: params.error,
      turnId: params.turnId
    })
    const { result, metrics, completedAt } = buildErrorResult({
      request: params.request,
      runtimeError: resolved.runtimeError,
      message: resolved.message,
      startedAt: params.startedAt
    })
    this.results.set(params.request.runId, result)
    this.emitErrorTelemetry({
      request: params.request,
      metrics,
      completedAt,
      message: resolved.message,
      runtimeError: resolved.runtimeError,
      modelAggregate: resolved.modelAggregate,
      startedAt: params.startedAt,
      emit: params.emit
    })
    return {
      result,
      toolFailed: resolved.toolFailed,
      status: resolved.status,
      error: {
        code: resolved.runtimeError.code,
        message: resolved.message,
        runtimeError: resolved.runtimeError
      }
    }
  }

  private resolveErrorContext(params: {
    request: AgentRunRequest
    error: unknown
    turnId: string
  }): {
    message: string
    runtimeError: RuntimeError
    modelAggregate: ModelMetricsAggregate | null
    toolFailed: boolean
    status: 'error' | 'cancelled'
  } {
    const cancelled = isAbortError(params.error)
    const message = cancelled ? RUN_CANCELLED_MESSAGE : resolveErrorMessage(params.error)
    const toolError = isToolInvocationError(params.error) ? params.error : null
    const runtimeError = buildRuntimeErrorFromUnknown({
      error: params.error,
      cancelled,
      runId: params.request.runId,
      provider: params.request.model?.provider,
      turnId: params.turnId,
      toolCallId: toolError?.toolCallId,
      toolName: toolError?.toolName,
      isToolError: Boolean(toolError)
    })
    logRuntimeError(message, runtimeError)
    return {
      message,
      runtimeError,
      modelAggregate: resolveFailedModelAggregate(params.error),
      toolFailed: Boolean(toolError),
      status: cancelled ? 'cancelled' : 'error'
    }
  }

  private emitErrorTelemetry(params: {
    request: AgentRunRequest
    metrics: ReturnType<typeof buildErrorResult>['metrics']
    completedAt: number
    message: string
    runtimeError: RuntimeError
    modelAggregate: ModelMetricsAggregate | null
    startedAt: number
    emit: (event: AgentStreamEvent) => void
  }): void {
    params.emit({ type: 'metrics.run', runId: params.request.runId, metrics: params.metrics })
    emitRunTiming({
      startedAt: params.startedAt,
      endedAt: params.completedAt,
      modelAggregate: params.modelAggregate,
      toolMetrics: params.metrics.tools
    })
    params.emit({
      type: 'lifecycle.error',
      runId: params.request.runId,
      endedAt: params.completedAt,
      error: params.message,
      runtimeError: params.runtimeError
    })
  }

  private createEmitTerminal(
    emit: (event: AgentStreamEvent) => void,
    runId: string
  ): (
    status: 'success' | 'awaiting-interaction' | 'error' | 'cancelled',
    result: AgentRunResult,
    error?: { code: RuntimeErrorCode; message: string; runtimeError?: RuntimeError }
  ) => void {
    let terminalEmitted = false
    return (status, result, error) => {
      if (terminalEmitted) return
      terminalEmitted = true
      emit({
        type: 'run.completed',
        runId,
        status,
        result,
        error,
        endedAt: Date.now()
      })
    }
  }

  private createEmitWithTimeline(
    emit: (event: AgentStreamEvent) => void
  ): (event: AgentStreamEvent) => void {
    return (event: AgentStreamEvent) => {
      recordTimelineEvent(event)
      emit(event)
    }
  }
}

function shouldEmitAssistantText(
  execution: Awaited<ReturnType<ChatOrchestrator['execute']>>
): boolean {
  if (execution.protocol || execution.structuredOutput?.kind === 'domain-result') {
    return false
  }
  return Boolean(execution.text.trim())
}

function resolveFailedModelAggregate(error: unknown): ModelMetricsAggregate | null {
  if (isAgentExecutionError(error)) {
    return error.modelMetricsAggregate
  }
  if (!isModelRequestError(error)) {
    return null
  }
  return {
    calls: 1,
    latencyMs: Math.max(0, error.metrics.latencyMs),
    inputTokens: Math.max(0, error.metrics.inputTokens),
    outputTokens: Math.max(0, error.metrics.outputTokens),
    totalTokens: Math.max(0, error.metrics.totalTokens)
  }
}
