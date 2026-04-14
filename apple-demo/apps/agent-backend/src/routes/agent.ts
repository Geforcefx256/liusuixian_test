import { Router, type Request, type Response } from 'express'
import { AgentService } from '../agent/service.js'
import { PlanApprovalBlockedError } from '../agent/sessionStore.js'
import { isPlannerEnabled } from '../agent/workspace/runtimeConfig.js'
import type {
  AgentRunEditContext,
  AgentRunRequest,
  AgentSkill,
  AgentModelConfig,
  AgentDefinition,
  AgentInvocationContext,
  FileAsset
} from '../agent/types.js'
import {
  PendingQuestionInteractionError,
  QuestionInteractionValidationError,
  buildAnswerContinuationContext,
  buildRejectContinuationContext,
  toInteractionView,
  validateQuestionInteractionAnswer
} from '../agent/interactions.js'
import { requireUser, type AuthenticatedRequest } from '../auth/requireUser.js'
import type { WorkspaceSessionEntry, WorkspaceSidebarTask } from '../agent/workspace/types.js'
import { createLogger } from '../logging/index.js'
import {
  WorkspaceOccupancyConflictError,
  isWorkspaceOccupancyConflictError
} from '../agent/service/runtimeErrors.js'

const agentRouteLogger = createLogger({
  category: 'runtime',
  component: 'agent_route'
})

interface AgentModelProvider {
  resolve(agentId: string): AgentModelConfig | null
  getRuntime(agentId: string): {
    provider: AgentModelConfig['provider']
    modelName: string
    apiEndpoint?: string
    maxTokens?: number
    stream?: boolean
    streamFirstByteTimeoutMs?: number
    streamIdleTimeoutMs?: number
    hasApiKey: boolean
    hasCustomHeaders: boolean
    source: 'agent' | 'active' | 'default'
  } | null
}

function isAgentDefinition(definition: unknown): definition is AgentDefinition {
  if (!definition || typeof definition !== 'object') return false
  const candidate = definition as Partial<AgentDefinition>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.description === 'string' &&
    typeof candidate.version === 'string' &&
    typeof candidate.instructions === 'string'
  )
}

function asSkillArray(input: unknown): AgentSkill[] | undefined {
  if (!Array.isArray(input)) return undefined
  return input
    .filter(item => item && typeof item === 'object')
    .map(item => item as AgentSkill)
    .filter(item => typeof item.id === 'string' && typeof item.name === 'string' && typeof item.description === 'string')
}

function parseInvocationContext(input: unknown): { context?: AgentInvocationContext; error?: string } {
  if (!input || typeof input !== 'object') return {}
  const context = input as AgentInvocationContext
  if (context.activeFile !== undefined && !isValidFileAsset(context.activeFile)) {
    return { error: 'Invalid invocationContext.activeFile' }
  }
  return { context }
}

function parseEditContext(input: unknown): { context?: AgentRunEditContext; error?: string } {
  if (input === undefined || input === null) {
    return {}
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'Invalid editContext' }
  }
  const rawMessageId = (input as { messageId?: unknown }).messageId
  const messageId = typeof rawMessageId === 'number' && Number.isInteger(rawMessageId)
    ? rawMessageId
    : Number.NaN
  if (!Number.isFinite(messageId) || messageId <= 0) {
    return { error: 'Invalid editContext.messageId' }
  }
  return { context: { messageId } }
}

function isValidFileAsset(value: unknown): value is FileAsset {
  if (!value || typeof value !== 'object') return false
  const candidate = value as FileAsset
  const hasPath = typeof candidate.path === 'string' && candidate.path.trim().length > 0
  const hasName = typeof candidate.fileName === 'string' && candidate.fileName.trim().length > 0
  const hasSource = candidate.source === 'upload' || candidate.source === 'project'
  return hasPath && hasName && hasSource && typeof candidate.writable === 'boolean'
}

function isWorkspaceSessionEntry(value: unknown): value is WorkspaceSessionEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Partial<WorkspaceSessionEntry> & { folderKey?: unknown }
  const hasSharedFields = (
    typeof candidate.nodeId === 'string'
    && candidate.nodeId.trim().length > 0
    && typeof candidate.path === 'string'
    && candidate.path.trim().length > 0
    && typeof candidate.fileName === 'string'
    && candidate.fileName.trim().length > 0
    && typeof candidate.relativePath === 'string'
    && candidate.relativePath.trim().length > 0
    && (candidate.groupId === 'upload' || candidate.groupId === 'project')
    && Number.isFinite(candidate.addedAt)
  )
  if (!hasSharedFields) return false
  if (candidate.nodeType === 'file') {
    return typeof candidate.fileId === 'string'
      && candidate.fileId.trim().length > 0
      && typeof candidate.fileKey === 'string'
      && candidate.fileKey.trim().length > 0
      && (candidate.source === 'upload' || candidate.source === 'project')
      && typeof candidate.writable === 'boolean'
  }
  if (candidate.nodeType === 'folder') {
    return typeof candidate.folderKey === 'string'
      && candidate.folderKey.trim().length > 0
      && candidate.source === 'project'
      && candidate.writable === true
  }
  return false
}

function buildWorkspaceTasks(agentId: string, entries: WorkspaceSessionEntry[]): WorkspaceSidebarTask[] {
  return [
    {
      id: `workspace-${agentId}`,
      label: '工作目录',
      groups: [
        {
          id: 'upload',
          label: 'upload',
          entries: entries.filter(entry => entry.groupId === 'upload')
        },
        {
          id: 'project',
          label: 'project',
          entries: entries.filter(entry => entry.groupId === 'project')
        }
      ]
    }
  ]
}

function buildWorkspacePayload(agentId: string, entries: WorkspaceSessionEntry[]) {
  return {
    agentId,
    title: '共享工作区',
    tasks: buildWorkspaceTasks(agentId, entries)
  }
}

export function parseAgentRunRequest(
  body: unknown,
  userId: number,
  resolvedModel?: AgentModelConfig
): { error?: string; request?: AgentRunRequest } {
  const requestedRunId = typeof (body as Request['body'])?.runId === 'string'
    ? (body as Request['body']).runId.trim()
    : ''
  const input = typeof (body as Request['body'])?.input === 'string' ? (body as Request['body']).input.trim() : ''
  const agentId = typeof (body as Request['body'])?.agentId === 'string' ? (body as Request['body']).agentId.trim() : ''
  const sessionId = typeof (body as Request['body'])?.sessionId === 'string' ? (body as Request['body']).sessionId.trim() : ''
  const continuation = parseContinuation((body as Request['body'])?.continuation)
  const editContextResult = parseEditContext((body as Request['body'])?.editContext)

  if (!agentId || !sessionId || (!input && !continuation)) {
    return { error: 'Missing required fields: agentId, sessionId, and either input or continuation' }
  }
  if (editContextResult.error) {
    return { error: editContextResult.error }
  }
  if (continuation && editContextResult.context) {
    return { error: 'editContext cannot be combined with continuation' }
  }

  const invocationContextResult = parseInvocationContext((body as Request['body'])?.invocationContext)
  if (invocationContextResult.error) {
    return { error: invocationContextResult.error }
  }

  return {
    request: {
      runId: requestedRunId || crypto.randomUUID(),
      userId,
      input,
      agentId,
      sessionId,
      ...(editContextResult.context ? { editContext: editContextResult.context } : {}),
      ...(continuation ? { continuation } : {}),
      model: resolvedModel,
      availableSkills: asSkillArray((body as Request['body'])?.availableSkills),
      invocationContext: invocationContextResult.context,
      agentDefinition: isAgentDefinition((body as Request['body'])?.agentDefinition) ? (body as Request['body']).agentDefinition : undefined
    }
  }
}

function parseContinuation(input: unknown): { interactionId: string } | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return undefined
  }
  const interactionId = typeof (input as { interactionId?: unknown }).interactionId === 'string'
    ? (input as { interactionId: string }).interactionId.trim()
    : ''
  return interactionId ? { interactionId } : undefined
}

function hasSessionUsageAccess(req: AuthenticatedRequest): boolean {
  return (req.auth?.roles || []).some(role => role === 'admin' || role === 'super_admin')
}

export function createAgentRouter(
  service = new AgentService(),
  modelProvider?: AgentModelProvider
): Router {
  const router = Router()
  router.use(requireUser)

  router.post('/run', async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.auth?.userId
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    const rawBody = req.body as Request['body'] | undefined
    const rawInput = typeof rawBody?.input === 'string' ? rawBody.input : ''
    agentRouteLogger.info({
      message: 'run request received',
      context: {
        userId,
        agentId: typeof rawBody?.agentId === 'string' ? rawBody.agentId.trim() : '',
        sessionId: typeof rawBody?.sessionId === 'string' ? rawBody.sessionId.trim() : ''
      },
      data: {
        inputChars: rawInput.length,
        inputPreview: rawInput.slice(0, 120),
        editContext: rawBody?.editContext ?? null,
        continuation: rawBody?.continuation ?? null
      }
    })
    const parsed = parseAgentRunRequest(
      req.body,
      userId,
      modelProvider?.resolve(String(req.body?.agentId || '').trim()) || undefined
    )
    if (parsed.error || !parsed.request) {
      res.status(400).json({ error: parsed.error || 'Invalid request' })
      return
    }
    const runRequest = parsed.request
    agentRouteLogger.info({
      message: 'run request parsed',
      context: {
        userId: runRequest.userId,
        agentId: runRequest.agentId,
        sessionId: runRequest.sessionId,
        runId: runRequest.runId
      },
      data: {
        inputChars: runRequest.input.length,
        inputPreview: runRequest.input.slice(0, 120),
        editContext: runRequest.editContext ?? null,
        continuation: runRequest.continuation ?? null
      }
    })
    try {
      await assertRunRequestAllowed(service, runRequest)
    } catch (error) {
      if (error instanceof PendingQuestionInteractionError) {
        res.status(409).json({
          error: error.message,
          code: 'PENDING_INTERACTION_BLOCKED'
        })
        return
      }
      if (isWorkspaceOccupancyConflictError(error)) {
        res.status(409).json({
          error: error.message,
          code: error.code,
          occupancy: error.occupancy
        })
        return
      }
      throw error
    }

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    const emit = (event: unknown) => {
      if (res.writableEnded) return
      res.write(`${JSON.stringify(event)}\n`)
    }

    try {
      await service.executeRun(runRequest, emit)
    } catch (error) {
      if (isWorkspaceOccupancyConflictError(error) && !res.headersSent) {
        res.status(409).json({
          error: error.message,
          code: error.code,
          occupancy: error.occupancy
        })
        return
      }
      throw error
    }
    if (!res.writableEnded) {
      res.end()
    }
  })

  router.post('/runs/:runId/cancel', (req: Request, res: Response) => {
    const runId = String(req.params.runId || '').trim()
    if (!runId) {
      res.status(400).json({ error: 'Missing runId' })
      return
    }
    const cancelled = service.cancelRun(runId)
    res.json({ ok: true, runId, cancelled })
  })

  router.get('/runs/:runId/result', (req: Request, res: Response) => {
    const runId = String(req.params.runId || '').trim()
    if (!runId) {
      res.status(400).json({ error: 'Missing runId' })
      return
    }
    const result = service.getRunResult(runId)
    if (!result) {
      res.status(404).json({ error: `Run result not found: ${runId}` })
      return
    }
    res.json({ ok: true, result })
  })

  router.get('/runtime', (req: Request, res: Response) => {
    const agentId = String(req.query.agentId || '').trim()
    if (!agentId) {
      res.status(400).json({ error: 'Missing agentId' })
      return
    }
    const runtime = modelProvider?.getRuntime(agentId) || null
    if (!runtime) {
      res.status(404).json({ error: `No backend model configured for agent: ${agentId}` })
      return
    }
    res.json({ ok: true, runtime })
  })

  router.get('/sessions', async (req: AuthenticatedRequest, res: Response) => {
    const agentId = String(req.query.agentId || '').trim()
    if (!agentId) {
      res.status(400).json({ error: 'Missing agentId' })
      return
    }
    const userId = req.auth?.userId
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    const sessions = await service.listSessions(userId, agentId)
    res.json({ ok: true, sessions })
  })

  router.post('/sessions', async (req: AuthenticatedRequest, res: Response) => {
    const agentId = String(req.body?.agentId || '').trim()
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : undefined
    if (!agentId) {
      res.status(400).json({ error: 'Missing agentId' })
      return
    }
    const userId = req.auth?.userId
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    const session = await service.createSession(userId, agentId, title)
    res.json({ ok: true, session })
  })

  router.patch('/sessions/:sessionId', async (req: AuthenticatedRequest, res: Response) => {
    const agentId = String(req.body?.agentId || '').trim()
    const sessionId = String(req.params.sessionId || '').trim()
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
    if (!agentId || !sessionId || !title) {
      res.status(400).json({ error: 'Missing agentId, sessionId, or title' })
      return
    }
    const userId = req.auth?.userId
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    await service.renameSession(userId, agentId, sessionId, title)
    res.json({ ok: true, sessionId, title })
  })

  router.delete('/sessions/:sessionId', async (req: AuthenticatedRequest, res: Response) => {
    const agentId = String(req.query.agentId || '').trim()
    const sessionId = String(req.params.sessionId || '').trim()
    if (!agentId || !sessionId) {
      res.status(400).json({ error: 'Missing agentId or sessionId' })
      return
    }
    const userId = req.auth?.userId
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    const deleted = await service.deleteSession(userId, agentId, sessionId)
    if (!deleted) {
      res.status(404).json({ error: 'Session not found' })
      return
    }
    res.json({ ok: true, sessionId })
  })

  router.post('/sessions/history/clear', async (req: AuthenticatedRequest, res: Response) => {
    const agentId = String(req.body?.agentId || '').trim()
    const excludedSessionId = typeof req.body?.excludedSessionId === 'string'
      ? req.body.excludedSessionId.trim() || null
      : null
    if (!agentId) {
      res.status(400).json({ error: 'Missing agentId' })
      return
    }
    const userId = req.auth?.userId
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    const result = await service.clearHistorySessions(userId, agentId, excludedSessionId)
    res.json({ ok: true, ...result })
  })

  router.get('/workspace', async (req: AuthenticatedRequest, res: Response) => {
    const agentId = String(req.query.agentId || '').trim()
    if (!agentId) {
      res.status(400).json({ error: 'Missing agentId' })
      return
    }
    const userId = req.auth?.userId
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    res.json({
      ok: true,
      workspace: buildWorkspacePayload(agentId, service.listWorkspaceFiles(userId, agentId))
    })
  })

  router.get('/sessions/:sessionId/workspace', async (req: AuthenticatedRequest, res: Response) => {
    const agentId = String(req.query.agentId || '').trim()
    const sessionId = String(req.params.sessionId || '').trim()
    if (!agentId || !sessionId) {
      res.status(400).json({ error: 'Missing agentId or sessionId' })
      return
    }
    const userId = req.auth?.userId
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    const session = await service.getSessionMeta(userId, agentId, sessionId)
    if (!session) {
      res.status(404).json({ error: 'Session not found' })
      return
    }
    const files = await service.getWorkspaceFiles(userId, agentId, sessionId)
    res.json({
      ok: true,
      workspace: buildWorkspacePayload(agentId, files)
    })
  })

  router.patch('/sessions/:sessionId/workspace', async (req: AuthenticatedRequest, res: Response) => {
    const agentId = String(req.body?.agentId || '').trim()
    const sessionId = String(req.params.sessionId || '').trim()
    if (!agentId || !sessionId) {
      res.status(400).json({ error: 'Missing agentId or sessionId' })
      return
    }
    const userId = req.auth?.userId
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    const session = await service.getSessionMeta(userId, agentId, sessionId)
    if (!session) {
      res.status(404).json({ error: 'Session not found' })
      return
    }
    const files = await service.getWorkspaceFiles(userId, agentId, sessionId)
    res.json({
      ok: true,
      workspace: buildWorkspacePayload(agentId, files)
    })
  })

  router.get('/sessions/:sessionId/messages', async (req: AuthenticatedRequest, res: Response) => {
    const agentId = String(req.query.agentId || '').trim()
    const sessionId = String(req.params.sessionId || '').trim()
    const limitRaw = String(req.query.limit || '').trim()
    const limit = limitRaw ? Number(limitRaw) : undefined
    const cursorRaw = String(req.query.cursor || '').trim()
    const cursor = cursorRaw ? Number(cursorRaw) : undefined
    if (!agentId || !sessionId) {
      res.status(400).json({ error: 'Missing agentId or sessionId' })
      return
    }
    if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
      res.status(400).json({ error: 'Invalid limit' })
      return
    }
    if (cursor !== undefined && (!Number.isFinite(cursor) || cursor <= 0)) {
      res.status(400).json({ error: 'Invalid cursor' })
      return
    }
    const userId = req.auth?.userId
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    const result = await service.listSessionMessages(
      userId,
      agentId,
      sessionId,
      limit ? Math.floor(limit) : undefined,
      cursor ? Math.floor(cursor) : undefined
    )
    res.json({ ok: true, messages: result.messages, nextCursor: result.nextCursor, hasMore: result.hasMore })
  })

  router.get('/sessions/:sessionId/usage', async (req: AuthenticatedRequest, res: Response) => {
    const agentId = String(req.query.agentId || '').trim()
    const sessionId = String(req.params.sessionId || '').trim()
    if (!agentId || !sessionId) {
      res.status(400).json({ error: 'Missing agentId or sessionId' })
      return
    }
    const userId = req.auth?.userId
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    if (!hasSessionUsageAccess(req)) {
      res.status(403).json({ error: 'Admin access required' })
      return
    }
    const session = await service.getSessionMeta(userId, agentId, sessionId)
    if (!session) {
      res.status(404).json({ error: 'Session not found' })
      return
    }
    const usage = await service.getSessionUsageSummary(userId, agentId, sessionId)
    res.json({ ok: true, usage })
  })

  router.get('/sessions/:sessionId/interactions', async (req: AuthenticatedRequest, res: Response) => {
    const agentId = String(req.query.agentId || '').trim()
    const sessionId = String(req.params.sessionId || '').trim()
    if (!agentId || !sessionId) {
      res.status(400).json({ error: 'Missing agentId or sessionId' })
      return
    }
    const userId = req.auth?.userId
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    const statuses = String(req.query.statuses || '').trim()
      .split(',')
      .map(value => value.trim())
      .filter((value): value is 'pending' | 'answered' | 'rejected' => {
        return value === 'pending' || value === 'answered' || value === 'rejected'
      })
    const interactions = await service.listInteractions({
      userId,
      agentId,
      sessionId,
      statuses: statuses.length > 0 ? statuses : undefined
    })
    res.json({ ok: true, interactions: interactions.map(toInteractionView) })
  })

  router.post('/sessions/:sessionId/interactions/:interactionId/reply', async (req: AuthenticatedRequest, res: Response) => {
    const agentId = String(req.body?.agentId || '').trim()
    const sessionId = String(req.params.sessionId || '').trim()
    const interactionId = String(req.params.interactionId || '').trim()
    const userId = req.auth?.userId
    if (!agentId || !sessionId || !interactionId) {
      res.status(400).json({ error: 'Missing agentId, sessionId, or interactionId' })
      return
    }
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    const interaction = await service.getInteraction({ userId, agentId, sessionId, interactionId })
    if (!interaction) {
      res.status(404).json({ error: 'Interaction not found' })
      return
    }
    try {
      const answer = validateQuestionInteractionAnswer(interaction.payload, req.body?.answer)
      const resolved = await service.resolveInteraction({
        userId,
        agentId,
        sessionId,
        interactionId,
        status: 'answered',
        answer,
        continuationContext: buildAnswerContinuationContext(interaction, answer)
      })
      res.json({ ok: true, interaction: toInteractionView(resolved) })
    } catch (error) {
      if (error instanceof QuestionInteractionValidationError) {
        res.status(400).json({ error: error.message })
        return
      }
      throw error
    }
  })

  router.post('/sessions/:sessionId/interactions/:interactionId/reject', async (req: AuthenticatedRequest, res: Response) => {
    const agentId = String(req.body?.agentId || '').trim()
    const sessionId = String(req.params.sessionId || '').trim()
    const interactionId = String(req.params.interactionId || '').trim()
    const userId = req.auth?.userId
    if (!agentId || !sessionId || !interactionId) {
      res.status(400).json({ error: 'Missing agentId, sessionId, or interactionId' })
      return
    }
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    const interaction = await service.getInteraction({ userId, agentId, sessionId, interactionId })
    if (!interaction) {
      res.status(404).json({ error: 'Interaction not found' })
      return
    }
    try {
      const resolved = await service.resolveInteraction({
        userId,
        agentId,
        sessionId,
        interactionId,
        status: 'rejected',
        continuationContext: buildRejectContinuationContext(interaction)
      })
      res.json({ ok: true, interaction: toInteractionView(resolved) })
    } catch (error) {
      if (error instanceof QuestionInteractionValidationError) {
        res.status(400).json({ error: error.message })
        return
      }
      throw error
    }
  })

  router.patch('/sessions/:sessionId/messages/:messageId/protocol-state', async (req: AuthenticatedRequest, res: Response) => {
    const agentId = String(req.body?.agentId || '').trim()
    const sessionId = String(req.params.sessionId || '').trim()
    const messageId = Number(req.params.messageId || '')
    const protocolState = req.body?.protocolState as Record<string, unknown> | null | undefined
    if (!agentId || !sessionId || !Number.isFinite(messageId) || messageId <= 0) {
      res.status(400).json({ error: 'Missing or invalid agentId, sessionId, or messageId' })
      return
    }
    if (protocolState !== null && (typeof protocolState !== 'object' || Array.isArray(protocolState))) {
      res.status(400).json({ error: 'Invalid protocolState' })
      return
    }
    const userId = req.auth?.userId
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    await service.updateSessionMessageProtocolState({
      userId,
      agentId,
      sessionId,
      messageId,
      protocolState: protocolState || null
    })
    res.json({ ok: true, messageId })
  })

  router.post('/sessions/:sessionId/plan/decision', async (req: AuthenticatedRequest, res: Response) => {
    const agentId = String(req.body?.agentId || '').trim()
    const sessionId = String(req.params.sessionId || '').trim()
    const decision = req.body?.decision === 'approve' ? 'approve' : req.body?.decision === 'revise' ? 'revise' : ''
    const planId = typeof req.body?.planId === 'string' ? req.body.planId.trim() : undefined
    if (!agentId || !sessionId || !decision) {
      res.status(400).json({ error: 'Missing or invalid agentId, sessionId, or decision' })
      return
    }
    const userId = req.auth?.userId
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    if (!isPlannerEnabled(agentId)) {
      res.status(409).json({ error: 'Planner mode is disabled for this agent' })
      return
    }
    try {
      const result = await service.decidePlan({
        userId,
        agentId,
        sessionId,
        decision,
        planId
      })
      res.json({ ok: true, session: result.session, plan: result.plan })
    } catch (error) {
      if (error instanceof PlanApprovalBlockedError) {
        res.status(409).json({ error: 'Plan has unresolved planning questions' })
        return
      }
      throw error
    }
  })

  return router
}

async function assertRunRequestAllowed(
  service: AgentService,
  request: AgentRunRequest
): Promise<void> {
  await service.assertWorkspaceRunAllowed(request)
  if (!request.input.trim() || request.continuation) {
    return
  }
  const pendingInteractions = await service.listInteractions({
    userId: request.userId,
    agentId: request.agentId,
    sessionId: request.sessionId,
    statuses: ['pending']
  })
  if (pendingInteractions.length > 0) {
    throw new PendingQuestionInteractionError()
  }
}
