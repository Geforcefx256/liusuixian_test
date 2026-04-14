import type { ProviderClient } from '../providerClient.js'
import type { AgentSessionStore } from '../sessionStore.js'
import type { AgentRunRequest, AgentSkill, AgentStreamEvent, ToolCallMetrics } from '../types.js'
import type { AgentExecutionCatalog } from '../../agents/service.js'
import type { AgentSessionInteractionView } from '../interactions.js'
import { buildPlanningSystemPrompt, buildPlanningUserInput } from './planningPrompt.js'
import { parseWorkspacePlanDraft } from './planParser.js'
import { writePlanDocument } from './planDocument.js'
import { buildPlanProtocol } from './planProtocol.js'
import type { ToolRegistryLike } from '../loopTypes.js'
import type { WorkspacePlanDraft, WorkspacePlanSnapshot } from './types.js'
import { createPlannerToolRegistry, PLANNER_MAX_STEPS } from './plannerTools.js'
import { runPlannerLoop } from './plannerLoop.js'
import { fileStore } from '../../files/fileStore.js'
import { filterReplayMessages } from '../interactionReplay.js'
import { createLogger } from '../../logging/index.js'
import type { ToolDisplayNameResolver } from '../toolInvocationSignal.js'

const plannerLogger = createLogger({
  category: 'runtime',
  component: 'planner'
})

export interface PlannerExecutionResult {
  mode: 'llm'
  text: string
  protocol?: Record<string, unknown>
  awaitingInteraction?: AgentSessionInteractionView
  assistantMessageId: number
  continuationOfInteractionId?: string
  modelMetrics: {
    provider: NonNullable<AgentRunRequest['model']>['provider']
    modelName: string
    latencyMs: number
    inputTokens: number
    outputTokens: number
    totalTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
    finishReason: string | null
  }
  modelMetricsAggregate: {
    calls: number
    latencyMs: number
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  toolMetrics: ToolCallMetrics[]
  skillTriggered?: string
}

export async function executePlanPhase(params: {
  providerClient: ProviderClient
  toolRegistry: ToolRegistryLike
  sessionStore: AgentSessionStore
  workspaceDir: string
  request: AgentRunRequest
  executionCatalog: AgentExecutionCatalog
  signal: AbortSignal
  trace: { runId: string; turnId: string }
  emit: (event: AgentStreamEvent) => void
  displayNameResolver?: ToolDisplayNameResolver
}): Promise<PlannerExecutionResult> {
  const continuationInteraction = params.request.continuation
    ? await params.sessionStore.getInteraction({
        userId: params.request.userId,
        agentId: params.request.agentId,
        sessionId: params.request.sessionId,
        interactionId: params.request.continuation.interactionId
      })
    : null
  const request = params.request
  const history = await params.sessionStore.listMessages({
    userId: request.userId,
    agentId: request.agentId,
    sessionId: request.sessionId,
    limit: 12
  })
  const replayHistory = filterReplayMessages(history)
  const latestPlan = await resolveLatestPlan(params.sessionStore, request)
  const candidateSkills = pickCandidateSkills(request.input, params.executionCatalog.skills)
  emitDelegation(params.emit, request, 'explore', 'completed', {
    candidateSkillIds: candidateSkills.map(skill => skill.id),
    latestPlanId: latestPlan?.planId || null
  })
  const plannerResponse = await runPlannerLoop({
    providerClient: params.providerClient,
    toolRegistry: createPlannerToolRegistry(params.toolRegistry),
    sessionStore: params.sessionStore,
    request,
    systemPrompt: buildPlanningSystemPrompt(params.executionCatalog.agent),
    userInput: buildPlanningUserInput({
      request,
      history: replayHistory,
      availableSkills: params.executionCatalog.skills,
      candidateSkills,
      latestPlan
    }),
    signal: params.signal,
    trace: params.trace,
    maxSteps: PLANNER_MAX_STEPS,
    displayNameResolver: params.displayNameResolver,
    onToolStarted: signal => {
      params.emit({
        type: 'tool.started',
        runId: request.runId,
        agentId: request.agentId,
        sessionId: request.sessionId,
        ...signal
      })
    },
    onToolFailed: signal => {
      params.emit({
        type: 'tool.failed',
        runId: request.runId,
        agentId: request.agentId,
        sessionId: request.sessionId,
        ...signal
      })
    }
  })
  emitDelegation(params.emit, request, 'general', 'completed', {
    model: plannerResponse.modelMetrics.modelName
  })
  if (plannerResponse.kind === 'question') {
    return {
      mode: 'llm',
      text: plannerResponse.text,
      awaitingInteraction: plannerResponse.interaction,
      assistantMessageId: plannerResponse.assistantMessageId,
      continuationOfInteractionId: continuationInteraction?.interactionId,
      modelMetrics: plannerResponse.modelMetrics,
      modelMetricsAggregate: plannerResponse.modelMetricsAggregate,
      toolMetrics: plannerResponse.toolMetrics,
      skillTriggered: plannerResponse.skillTriggered
    }
  }
  const draft = parsePlannerDraftOrThrow({
    text: plannerResponse.text,
    skills: params.executionCatalog.skills,
    request: params.request,
    candidateSkills
  })
  const latestRecord = await params.sessionStore.getLatestPlan({
    userId: params.request.userId,
    agentId: params.request.agentId,
    sessionId: params.request.sessionId
  })
  const nextVersion = (latestRecord?.version || 0) + 1
  const document = await writePlanDocument({
    workspaceDir: fileStore.getWorkspaceRoot({
      userId: params.request.userId,
      agentId: params.request.agentId
    }),
    sessionId: params.request.sessionId,
    version: nextVersion,
    draft
  })
  const plan = await params.sessionStore.savePlan({
    userId: params.request.userId,
    agentId: params.request.agentId,
    sessionId: params.request.sessionId,
    draft: {
        ...draft,
        markdown: document.markdown,
        filePath: document.filePath
      }
    })
  const protocol = buildPlanProtocol(plan)
  const text = JSON.stringify(protocol)
  const assistantMessageId = await appendAssistantProtocol(params.sessionStore, params.request, text)
  params.emit({
    type: 'plan.snapshot',
    runId: params.request.runId,
    agentId: params.request.agentId,
    sessionId: params.request.sessionId,
    plan
  })
  params.emit({
    type: 'plan.awaiting_decision',
    runId: params.request.runId,
    agentId: params.request.agentId,
    sessionId: params.request.sessionId,
    planId: plan.planId,
    version: plan.version
  })
  return {
    mode: 'llm',
    text,
    protocol,
    assistantMessageId,
    continuationOfInteractionId: continuationInteraction?.interactionId,
    modelMetrics: plannerResponse.modelMetrics,
    modelMetricsAggregate: plannerResponse.modelMetricsAggregate,
    toolMetrics: plannerResponse.toolMetrics,
    skillTriggered: plannerResponse.skillTriggered
  }
}

function parsePlannerDraftOrThrow(params: {
  text: string
  skills: AgentSkill[]
  request: AgentRunRequest
  candidateSkills: AgentSkill[]
}): WorkspacePlanDraft {
  try {
    return parseWorkspacePlanDraft(params.text, params.skills)
  } catch (error) {
    const message = error instanceof Error ? error.message : '规划器返回了未知错误。'
    logPlannerParseFailure({
      request: params.request,
      candidateSkillCount: params.candidateSkills.length,
      text: params.text,
      message
    })
    throw error
  }
}

async function appendAssistantProtocol(
  sessionStore: AgentSessionStore,
  request: AgentRunRequest,
  text: string
): Promise<number> {
  return sessionStore.appendMessage({
    userId: request.userId,
    agentId: request.agentId,
    sessionId: request.sessionId,
    message: {
      role: 'assistant',
      parts: [{ type: 'text', text }],
      createdAt: Date.now()
    }
  })
}

async function resolveLatestPlan(
  sessionStore: AgentSessionStore,
  request: AgentRunRequest
): Promise<WorkspacePlanSnapshot | null> {
  const meta = await sessionStore.getSessionMeta({
    userId: request.userId,
    agentId: request.agentId,
    sessionId: request.sessionId
  })
  return meta?.planState || null
}

function pickCandidateSkills(input: string, skills: AgentSkill[]): AgentSkill[] {
  const lowered = input.toLowerCase()
  const scored = skills
    .map(skill => ({ skill, score: scoreSkill(skill, lowered) }))
    .sort((left, right) => right.score - left.score)
  const matched = scored.filter(entry => entry.score > 0).map(entry => entry.skill)
  return matched.length > 0 ? matched.slice(0, 5) : skills.slice(0, 5)
}

function tokenize(input: string): string[] {
  const segments = input.match(/[\u4e00-\u9fff]+|[a-z0-9_-]+/g) ?? []
  const tokens: string[] = []
  for (const segment of segments) {
    if (/[\u4e00-\u9fff]/.test(segment)) {
      if (segment.length === 2) {
        tokens.push(segment)
        continue
      }
      for (let index = 0; index < segment.length - 1; index += 1) {
        tokens.push(segment.slice(index, index + 2))
      }
      continue
    }
    tokens.push(segment)
  }
  return tokens.filter(token => token.length >= 2)
}

function scoreSkill(skill: AgentSkill, input: string): number {
  const haystack = `${skill.id} ${skill.name} ${skill.description}`.toLowerCase()
  if (!input.trim()) return 0
  let score = 0
  for (const token of tokenize(input)) {
    if (haystack.includes(token)) score += 1
  }
  return score
}

function logPlannerParseFailure(params: {
  request: AgentRunRequest
  candidateSkillCount: number
  text: string
  message: string
}): void {
  plannerLogger.warn({
    message: 'planner parse failure',
    context: {
      agentId: params.request.agentId,
      sessionId: params.request.sessionId,
      runId: params.request.runId
    },
    data: {
      candidateSkillCount: params.candidateSkillCount,
      message: params.message,
      rawOutputPreview: truncateText(params.text)
    }
  })
}

function truncateText(text: string, maxChars = 500): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}...[truncated]`
}

function emitDelegation(
  emit: (event: AgentStreamEvent) => void,
  request: AgentRunRequest,
  subagent: 'explore' | 'general',
  status: 'completed',
  data: Record<string, unknown>
): void {
  emit({
    type: 'plan.delegation',
    runId: request.runId,
    agentId: request.agentId,
    sessionId: request.sessionId,
    subagent,
    status,
    data
  })
}
