import type {
  AgentSessionMessage,
  AgentSessionMessageUsageMeta,
  AgentSessionMessageRef,
  AgentSessionMessageView,
  AgentSessionMeta,
  AgentSessionStore,
  AgentSessionSummary,
  AgentSessionUsageSummary,
  AppendSessionMessageParams,
  ListSessionMessagesParams
} from './sessionStoreTypes.js'
import type {
  SessionMetaRow,
  SessionInteractionRow,
  SessionPlanRow,
  SessionRow,
  SummaryRow,
  DatabaseSyncLike
} from './sessionStoreUtils.js'
import {
  ensureDbDirectory,
  ensureSchema,
  isSessionDeleted,
  loadDatabaseSync,
  markSessionDeleted,
  normalizeLimit,
  normalizeTitle,
  extractTextParts,
  resolveSessionTitle,
  toMessageMetaJson,
  toMessageAttributesJson,
  toSessionMessage,
  toSessionMeta,
  ONE,
  ZERO,
  TITLE_FALLBACK_PREFIX
} from './sessionStoreUtils.js'
import type { AgentSessionInteractionRecord } from './interactions.js'
import { parseProtocolOutput } from './protocolOutput.js'
import { parseSkillExecutionOutput } from './skillResult.js'
import { getStructuredOutput } from './structuredOutput.js'
import {
  PendingQuestionInteractionError,
  QuestionInteractionValidationError
} from './interactions.js'
import { buildResolvedInteractionMessage } from './interactionReplay.js'
import { isEditableUserMessage } from './editableUserMessage.js'
import {
  buildPlanSnapshot,
  createDefaultWorkspaceSessionMeta,
  createDraftPlanState,
  toWorkspaceSessionMetaJson
} from './workspace/sessionMeta.js'
import { buildSessionMetaAfterRewrite } from './sessionRewriteMeta.js'
import {
  BUILD_PRIMARY_AGENT,
  PLAN_PRIMARY_AGENT,
  PLAN_STATUS_APPROVED,
  PLAN_STATUS_AWAITING_APPROVAL,
  PLAN_STATUS_DRAFT,
  PLAN_STATUS_SUPERSEDED
} from './workspace/constants.js'
import type {
  WorkspacePlanRecord,
  WorkspaceSessionEntry,
  WorkspaceSessionMeta
} from './workspace/types.js'
import { buildLogPreview } from '../support/logPreview.js'
import { createLogger } from '../logging/index.js'
import {
  describeHiddenMessageAttributes,
  isIntermediateMessage,
  isHiddenSessionMessage
} from './sessionMessages.js'

const sessionStoreLogger = createLogger({
  category: 'runtime',
  component: 'session_store'
})

interface StoreConfig {
  dbPath: string
}

interface CountRow {
  count: number
}

interface SessionIdRow {
  session_id: string
}

interface SessionUsageRow {
  meta_json: string | null
}

const IDLE_SESSION_ACTIVITY = Object.freeze({
  active: false,
  state: 'idle' as const,
  runId: null
})

export class PlanApprovalBlockedError extends Error {
  constructor(message = 'Plan still has unresolved planning questions.') {
    super(message)
    this.name = 'PlanApprovalBlockedError'
  }
}

export class SessionRewriteValidationError extends Error {
  constructor(message = '只允许编辑并重跑当前会话中最后一条可编辑的用户消息。') {
    super(message)
    this.name = 'SessionRewriteValidationError'
  }
}

export class DeletedSessionWriteError extends Error {
  readonly sessionId: string

  constructor(sessionId: string) {
    super(`会话 ${sessionId} 已删除，禁止继续写入。`)
    this.name = 'DeletedSessionWriteError'
    this.sessionId = sessionId
  }
}

export class SQLiteAgentSessionStore implements AgentSessionStore {
  private readonly db: DatabaseSyncLike

  constructor(config: StoreConfig) {
    ensureDbDirectory(config.dbPath)
    const DatabaseSync = loadDatabaseSync()
    this.db = new DatabaseSync(config.dbPath)
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec('PRAGMA synchronous = NORMAL')
    ensureSchema(this.db)
  }

  async markSessionDeleted(params: AgentSessionMessageRef): Promise<void> {
    markSessionDeleted(this.db, {
      ...params,
      deletedAt: Date.now()
    })
  }

  async isSessionDeleted(params: AgentSessionMessageRef): Promise<boolean> {
    return isSessionDeleted(this.db, params)
  }

  async appendMessage(params: AppendSessionMessageParams): Promise<number> {
    this.assertSessionWritable(params)
    const statement = this.db.prepare(`
      INSERT INTO agent_session_messages (
        user_id,
        agent_id,
        session_id,
        role,
        parts_json,
        meta_json,
        attributes_json,
        protocol_state_json,
        reasoning_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const result = statement.run(
      params.userId,
      params.agentId,
      params.sessionId,
      params.message.role,
      JSON.stringify(params.message.parts),
      toMessageMetaJson(params.message.meta),
      toMessageAttributesJson(params.message.attributes),
      null,
      params.message.reasoning ? JSON.stringify(params.message.reasoning) : null,
      params.message.createdAt
    ) as { lastInsertRowid?: number }

    await this.upsertSessionMeta(params)
    const messageId = Number(result?.lastInsertRowid)
    if (!Number.isFinite(messageId)) {
      throw new Error('Failed to resolve message id')
    }
    return messageId
  }

  async listMessages(params: ListSessionMessagesParams): Promise<AgentSessionMessage[]> {
    const statement = this.db.prepare(`
      SELECT id, user_id, role, parts_json, meta_json, attributes_json, reasoning_json, created_at
      FROM agent_session_messages
      WHERE user_id = ? AND agent_id = ? AND session_id = ?
      ORDER BY id DESC
      LIMIT ?
    `)

    const rows = statement.all(
      params.userId,
      params.agentId,
      params.sessionId,
      normalizeLimit(params.limit)
    ) as SessionRow[]

    return rows.reverse().map(toSessionMessage)
  }

  async deleteMessages(
    params: AgentSessionMessageRef & { messageIds: number[] }
  ): Promise<void> {
    this.assertSessionWritable(params)
    const messageIds = Array.from(new Set(
      params.messageIds.filter(messageId => Number.isInteger(messageId) && messageId > ZERO)
    ))
    if (messageIds.length === ZERO) {
      return
    }

    const placeholders = messageIds.map(() => '?').join(', ')
    const statement = this.db.prepare(`
      DELETE FROM agent_session_messages
      WHERE user_id = ? AND agent_id = ? AND session_id = ? AND id IN (${placeholders})
    `)
    statement.run(
      params.userId,
      params.agentId,
      params.sessionId,
      ...messageIds
    )
    await this.upsertSessionMeta(params)
  }

  async rewriteSessionFromMessage(
    params: AgentSessionMessageRef & { messageId: number }
  ): Promise<void> {
    this.assertSessionWritable(params)
    const session = this.readSessionMeta(params.userId, params.agentId, params.sessionId)
    if (!session) {
      sessionStoreLogger.info({
        message: 'session rewrite rejected',
        context: {
          userId: params.userId,
          agentId: params.agentId,
          sessionId: params.sessionId
        },
        data: {
          requestedMessageId: params.messageId,
          reason: 'session_not_found'
        }
      })
      throw new SessionRewriteValidationError('会话不存在，无法执行编辑并重跑。')
    }
    const pendingInteractions = await this.listInteractions({
      ...params,
      statuses: ['pending']
    })
    if (pendingInteractions.length > ZERO) {
      sessionStoreLogger.info({
        message: 'session rewrite rejected',
        context: {
          userId: params.userId,
          agentId: params.agentId,
          sessionId: params.sessionId
        },
        data: {
          requestedMessageId: params.messageId,
          reason: 'pending_interaction',
          pendingInteractionIds: pendingInteractions.map(interaction => interaction.interactionId)
        }
      })
      throw new PendingQuestionInteractionError()
    }
    const currentRows = this.listSessionRows(params)
    const targetRow = this.findMessageRow(params, params.messageId)
    if (!targetRow) {
      sessionStoreLogger.info({
        message: 'session rewrite rejected',
        context: {
          userId: params.userId,
          agentId: params.agentId,
          sessionId: params.sessionId
        },
        data: {
          requestedMessageId: params.messageId,
          reason: 'target_not_found',
          currentMessages: summarizeSessionRowsForLog(currentRows)
        }
      })
      throw new SessionRewriteValidationError()
    }
    const editableTarget = this.findLastEditableUserMessage(params)
    if (!editableTarget || editableTarget.id !== targetRow.id) {
      sessionStoreLogger.info({
        message: 'session rewrite rejected',
        context: {
          userId: params.userId,
          agentId: params.agentId,
          sessionId: params.sessionId
        },
        data: {
          requestedMessageId: params.messageId,
          reason: 'target_is_not_last_editable_user_message',
          targetMessageId: targetRow.id,
          editableTargetMessageId: editableTarget?.id ?? null,
          currentMessages: summarizeSessionRowsForLog(currentRows)
        }
      })
      throw new SessionRewriteValidationError()
    }
    sessionStoreLogger.info({
      message: 'session rewrite accepted',
      context: {
        userId: params.userId,
        agentId: params.agentId,
        sessionId: params.sessionId
      },
      data: {
        requestedMessageId: params.messageId,
        editableTargetMessageId: editableTarget.id,
        currentMessages: summarizeSessionRowsForLog(currentRows)
      }
    })
    this.rewriteSessionTail({
      ...params,
      cutoffCreatedAt: targetRow.created_at,
      workspaceFiles: session.workspaceFiles
    })
  }

  async listSessions(userId: number, agentId: string): Promise<AgentSessionMeta[]> {
    const statement = this.db.prepare(`
      SELECT user_id, agent_id, session_id, title, created_at, updated_at, message_count, meta_json
      FROM agent_sessions
      WHERE user_id = ? AND agent_id = ?
      ORDER BY updated_at DESC
    `)
    const rows = statement.all(userId, agentId) as SessionMetaRow[]
    return rows.map(row => {
      const session = toSessionMeta(row)
      return {
        ...session,
        preview: this.buildSessionPreview(session),
        activity: IDLE_SESSION_ACTIVITY
      }
    })
  }

  async createSession(userId: number, agentId: string, title?: string): Promise<AgentSessionMeta> {
    const sessionId = crypto.randomUUID()
    const now = Date.now()
    const resolvedTitle = normalizeTitle(title) || `${TITLE_FALLBACK_PREFIX} ${new Date(now).toISOString()}`
    const meta = createDefaultWorkspaceSessionMeta(agentId)

    const statement = this.db.prepare(`
      INSERT INTO agent_sessions (
        user_id,
        agent_id,
        session_id,
        title,
        created_at,
        updated_at,
        message_count,
        meta_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    statement.run(userId, agentId, sessionId, resolvedTitle, now, now, ZERO, toWorkspaceSessionMetaJson(meta))

    return {
      userId,
      agentId,
      sessionId,
      title: resolvedTitle,
      createdAt: now,
      updatedAt: now,
      messageCount: ZERO,
      preview: '',
      activity: IDLE_SESSION_ACTIVITY,
      activePrimaryAgent: meta.activePrimaryAgent,
      planState: meta.planState,
      workspaceFiles: meta.workspaceFiles
    }
  }

  async getSessionMeta(params: AgentSessionMessageRef): Promise<AgentSessionMeta | null> {
    return this.readSessionMeta(params.userId, params.agentId, params.sessionId)
  }

  async getWorkspaceFiles(params: AgentSessionMessageRef): Promise<WorkspaceSessionEntry[]> {
    const session = this.readSessionMeta(params.userId, params.agentId, params.sessionId)
    return session?.workspaceFiles ?? []
  }

  async renameSession(userId: number, agentId: string, sessionId: string, title: string): Promise<void> {
    this.assertSessionWritable({ userId, agentId, sessionId })
    const normalized = normalizeTitle(title)
    if (!normalized) {
      throw new Error('Session title is required')
    }

    const statement = this.db.prepare(`
      UPDATE agent_sessions
      SET title = ?, updated_at = ?
      WHERE user_id = ? AND agent_id = ? AND session_id = ?
    `)

    statement.run(normalized, Date.now(), userId, agentId, sessionId)
  }

  async deleteSession(userId: number, agentId: string, sessionId: string): Promise<boolean> {
    const existing = this.readSessionMeta(userId, agentId, sessionId)
    if (!existing) {
      return false
    }
    this.deleteSessionsByIds(userId, agentId, [sessionId], { markDeleted: true })

    return true
  }

  async clearHistorySessions(
    userId: number,
    agentId: string,
    preservedSessionIds?: string[] | null
  ): Promise<number> {
    const sessionIds = this.listSessionIdsForClear(userId, agentId, preservedSessionIds)
    if (sessionIds.length === ZERO) {
      return ZERO
    }
    this.deleteSessionsByIds(userId, agentId, sessionIds)
    return sessionIds.length
  }

  async replaceWorkspaceFiles(params: AgentSessionMessageRef & {
    files: WorkspaceSessionEntry[]
  }): Promise<AgentSessionMeta | null> {
    this.assertSessionWritable(params)
    const existing = this.readSessionMeta(params.userId, params.agentId, params.sessionId)
    if (!existing) return null
    const dedupedFiles = dedupeWorkspaceFiles(params.files)
    await this.updateSessionMeta({
      ...params,
      meta: {
        activePrimaryAgent: existing.activePrimaryAgent,
        planState: existing.planState,
        workspaceFiles: dedupedFiles
      }
    })
    return this.readSessionMeta(params.userId, params.agentId, params.sessionId)
  }

  async getSessionMessagesView(
    params: ListSessionMessagesParams & { cursor?: number }
  ): Promise<{ messages: AgentSessionMessageView[]; nextCursor: number | null; hasMore: boolean }> {
    const limit = normalizeLimit(params.limit)
    const targetVisibleCount = limit + ONE
    const visibleMessages: AgentSessionMessageView[] = []
    let cursor = params.cursor
    let exhausted = false

    while (visibleMessages.length < targetVisibleCount && !exhausted) {
      const rows = this.listSessionViewRows({
        ...params,
        cursor,
        limit: targetVisibleCount
      })
      if (rows.length === ZERO) {
        exhausted = true
        break
      }
      cursor = rows[rows.length - ONE]?.id
      for (const row of rows) {
        const message = buildMessageView(row)
        if (!message) {
          continue
        }
        visibleMessages.push(message)
        if (visibleMessages.length >= targetVisibleCount) {
          break
        }
      }
      exhausted = rows.length < targetVisibleCount
    }

    const hasMore = visibleMessages.length > limit
    const messages = (hasMore ? visibleMessages.slice(0, limit) : visibleMessages)
      .slice()
      .reverse()
    const nextCursor = hasMore && messages.length > ZERO ? messages[ZERO].messageId : null
    return { messages, nextCursor, hasMore }
  }

  async updateMessageMeta(params: AgentSessionMessageRef & {
    messageId: number
    meta: AgentSessionMessage['meta'] | null
  }): Promise<void> {
    this.assertSessionWritable(params)
    const statement = this.db.prepare(`
      UPDATE agent_session_messages
      SET meta_json = ?
      WHERE user_id = ? AND agent_id = ? AND session_id = ? AND id = ?
    `)

    statement.run(
      toMessageMetaJson(params.meta),
      params.userId,
      params.agentId,
      params.sessionId,
      params.messageId
    )
  }

  async getSessionUsageSummary(params: AgentSessionMessageRef): Promise<AgentSessionUsageSummary> {
    const statement = this.db.prepare(`
      SELECT meta_json
      FROM agent_session_messages
      WHERE user_id = ? AND agent_id = ? AND session_id = ? AND role = 'assistant'
      ORDER BY id ASC
    `)
    const rows = statement.all(
      params.userId,
      params.agentId,
      params.sessionId
    ) as SessionUsageRow[]
    return buildSessionUsageSummary(params, rows)
  }

  async getSummary(params: AgentSessionMessageRef): Promise<AgentSessionSummary | null> {
    const statement = this.db.prepare(`
      SELECT user_id, agent_id, session_id, summary, covered_until, updated_at
      FROM agent_session_summaries
      WHERE user_id = ? AND agent_id = ? AND session_id = ?
    `)

    const rows = statement.all(params.userId, params.agentId, params.sessionId) as SummaryRow[]
    const row = rows[0]
    if (!row) return null
    return {
      userId: row.user_id,
      agentId: row.agent_id,
      sessionId: row.session_id,
      summary: row.summary,
      coveredUntil: row.covered_until,
      updatedAt: row.updated_at
    }
  }

  async upsertSummary(params: AgentSessionMessageRef & { summary: string; coveredUntil: number }): Promise<void> {
    this.assertSessionWritable(params)
    const statement = this.db.prepare(`
      INSERT INTO agent_session_summaries (
        user_id,
        agent_id,
        session_id,
        summary,
        covered_until,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, agent_id, session_id)
      DO UPDATE SET summary = excluded.summary, covered_until = excluded.covered_until, updated_at = excluded.updated_at
    `)

    statement.run(
      params.userId,
      params.agentId,
      params.sessionId,
      params.summary,
      params.coveredUntil,
      Date.now()
    )
  }

  async updateSessionMeta(params: AgentSessionMessageRef & { meta: WorkspaceSessionMeta }): Promise<void> {
    this.assertSessionWritable(params)
    const statement = this.db.prepare(`
      UPDATE agent_sessions
      SET meta_json = ?, updated_at = ?
      WHERE user_id = ? AND agent_id = ? AND session_id = ?
    `)
    statement.run(
      toWorkspaceSessionMetaJson(params.meta),
      Date.now(),
      params.userId,
      params.agentId,
      params.sessionId
    )
  }

  async getLatestPlan(params: AgentSessionMessageRef): Promise<WorkspacePlanRecord | null> {
    const row = this.selectLatestPlanRow(params)
    return row ? toPlanRecord(row) : null
  }

  async savePlan(params: AgentSessionMessageRef & {
    draft: Omit<WorkspacePlanRecord, 'planId' | 'version' | 'status' | 'createdAt' | 'updatedAt'>
  }): Promise<WorkspacePlanRecord> {
    this.assertSessionWritable(params)
    const latest = this.selectLatestPlanRow(params)
    const version = (latest?.version || ZERO) + ONE
    const now = Date.now()
    const planId = crypto.randomUUID()
    this.supersedeCurrentPlans(params)
    const workspaceFiles = await this.getWorkspaceFiles(params)
    const statement = this.db.prepare(`
      INSERT INTO agent_session_plans (
        plan_id, user_id, agent_id, session_id, version, status, title, summary, goal,
        steps_json, approved_skill_ids_json, skills_reasoning_json, risks_json, open_questions_json,
        markdown, file_path, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    statement.run(
      planId,
      params.userId,
      params.agentId,
      params.sessionId,
      version,
      PLAN_STATUS_AWAITING_APPROVAL,
      params.draft.title,
      params.draft.summary,
      params.draft.goal,
      toJson(params.draft.steps),
      toJson(params.draft.approvedSkillIds),
      toJson(params.draft.skillsReasoning),
      toJson(params.draft.risks),
      toJson(params.draft.openQuestions),
      params.draft.markdown,
      params.draft.filePath,
      now,
      now
    )
    const plan = this.requirePlan(params, planId)
    await this.updateSessionMeta({
      ...params,
      meta: {
        activePrimaryAgent: PLAN_PRIMARY_AGENT,
        planState: buildPlanSnapshot(plan),
        workspaceFiles
      }
    })
    return plan
  }

  async decidePlan(params: AgentSessionMessageRef & {
    decision: 'approve' | 'revise'
    planId?: string
  }): Promise<{ session: AgentSessionMeta; plan: WorkspacePlanRecord }> {
    this.assertSessionWritable(params)
    const plan = params.planId
      ? this.requirePlan(params, params.planId)
      : this.requireLatestPlan(params)
    assertPlanApprovalAllowed(params.decision, plan)
    const status = params.decision === 'approve'
      ? PLAN_STATUS_APPROVED
      : PLAN_STATUS_DRAFT
    const statement = this.db.prepare(`
      UPDATE agent_session_plans
      SET status = ?, updated_at = ?
      WHERE plan_id = ? AND user_id = ? AND agent_id = ? AND session_id = ?
    `)
    statement.run(
      status,
      Date.now(),
      plan.planId,
      params.userId,
      params.agentId,
      params.sessionId
    )
    const nextPlan = this.requirePlan(params, plan.planId)
    const meta = {
      activePrimaryAgent: params.decision === 'approve' ? BUILD_PRIMARY_AGENT : PLAN_PRIMARY_AGENT,
      planState: params.decision === 'approve'
        ? buildPlanSnapshot(nextPlan)
        : createDraftPlanState(buildPlanSnapshot(nextPlan)),
      workspaceFiles: await this.getWorkspaceFiles(params)
    } satisfies WorkspaceSessionMeta
    await this.updateSessionMeta({ ...params, meta })
    const session = await this.getSessionMeta(params)
    if (!session) {
      throw new Error('Session not found after plan decision')
    }
    return { session, plan: nextPlan }
  }

  async updateMessageProtocolState(params: {
    userId: number
    agentId: string
    sessionId: string
    messageId: number
    protocolState: Record<string, unknown> | null
  }): Promise<void> {
    this.assertSessionWritable(params)
    const statement = this.db.prepare(`
      UPDATE agent_session_messages
      SET protocol_state_json = ?
      WHERE user_id = ? AND agent_id = ? AND session_id = ? AND id = ?
    `)
    const result = statement.run(
      params.protocolState ? JSON.stringify(params.protocolState) : null,
      params.userId,
      params.agentId,
      params.sessionId,
      params.messageId
    ) as { changes?: number }
    if (!result || !Number.isFinite(result.changes) || Number(result.changes) <= ZERO) {
      throw new Error('Session message not found')
    }
  }

  async createInteraction(params: {
    userId: number
    agentId: string
    sessionId: string
    runId: string
    kind: AgentSessionInteractionRecord['kind']
    payload: AgentSessionInteractionRecord['payload']
  }): Promise<AgentSessionInteractionRecord> {
    this.assertSessionWritable(params)
    const interactionId = crypto.randomUUID()
    const createdAt = Date.now()
    const statement = this.db.prepare(`
      INSERT INTO agent_session_interactions (
        interaction_id,
        user_id,
        agent_id,
        session_id,
        run_id,
        kind,
        status,
        payload_json,
        answer_json,
        continuation_context_json,
        created_at,
        resolved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    statement.run(
      interactionId,
      params.userId,
      params.agentId,
      params.sessionId,
      params.runId,
      params.kind,
      'pending',
      JSON.stringify(params.payload),
      null,
      null,
      createdAt,
      null
    )
    const record = await this.getInteraction({
      userId: params.userId,
      agentId: params.agentId,
      sessionId: params.sessionId,
      interactionId
    })
    if (!record) {
      throw new Error('Failed to load created interaction.')
    }
    return record
  }

  async getInteraction(params: {
    userId: number
    agentId: string
    sessionId: string
    interactionId: string
  }): Promise<AgentSessionInteractionRecord | null> {
    const statement = this.db.prepare(`
      SELECT *
      FROM agent_session_interactions
      WHERE interaction_id = ? AND user_id = ? AND agent_id = ? AND session_id = ?
      LIMIT 1
    `)
    const rows = statement.all(
      params.interactionId,
      params.userId,
      params.agentId,
      params.sessionId
    ) as SessionInteractionRow[]
    const row = rows[0]
    return row ? toInteractionRecord(row) : null
  }

  async listInteractions(params: {
    userId: number
    agentId: string
    sessionId: string
    statuses?: Array<'pending' | 'answered' | 'rejected'>
  }): Promise<AgentSessionInteractionRecord[]> {
    const statuses = params.statuses?.filter(Boolean) || []
    const placeholders = statuses.map(() => '?').join(', ')
    const statement = this.db.prepare(`
      SELECT *
      FROM agent_session_interactions
      WHERE user_id = ? AND agent_id = ? AND session_id = ?
      ${statuses.length > ZERO ? `AND status IN (${placeholders})` : ''}
      ORDER BY created_at ASC, interaction_id ASC
    `)
    const rows = statement.all(
      params.userId,
      params.agentId,
      params.sessionId,
      ...statuses
    ) as SessionInteractionRow[]
    return rows.map(toInteractionRecord)
  }

  async resolveInteraction(params: {
    userId: number
    agentId: string
    sessionId: string
    interactionId: string
    status: 'answered' | 'rejected'
    answer?: AgentSessionInteractionRecord['answer']
    continuationContext?: AgentSessionInteractionRecord['continuationContext']
  }): Promise<AgentSessionInteractionRecord> {
    this.assertSessionWritable(params)
    const existing = await this.getInteraction(params)
    if (!existing) {
      throw new Error(`Interaction not found: ${params.interactionId}`)
    }
    if (existing.status !== 'pending') {
      throw new QuestionInteractionValidationError('当前问题交互已经处理过了。')
    }
    const resolvedAt = Date.now()
    const statement = this.db.prepare(`
      UPDATE agent_session_interactions
      SET status = ?, answer_json = ?, continuation_context_json = ?, resolved_at = ?
      WHERE interaction_id = ? AND user_id = ? AND agent_id = ? AND session_id = ?
    `)
    statement.run(
      params.status,
      params.answer ? JSON.stringify(params.answer) : null,
      params.continuationContext ? JSON.stringify(params.continuationContext) : null,
      resolvedAt,
      params.interactionId,
      params.userId,
      params.agentId,
      params.sessionId
    )
    if (params.continuationContext) {
      await this.appendMessage({
        userId: params.userId,
        agentId: params.agentId,
        sessionId: params.sessionId,
        message: buildResolvedInteractionMessage({
          context: params.continuationContext,
          createdAt: resolvedAt
        })
      })
    }
    const next = await this.getInteraction(params)
    if (!next) {
      throw new Error('Failed to reload resolved interaction.')
    }
    return next
  }

  close(): void {
    this.db.close()
  }

  private listSessionIdsForClear(
    userId: number,
    agentId: string,
    preservedSessionIds?: string[] | null
  ): string[] {
    const preservedIds = Array.from(new Set((preservedSessionIds || []).filter(Boolean)))
    const excludeClause = preservedIds.length > ZERO
      ? `AND session_id NOT IN (${preservedIds.map(() => '?').join(', ')})`
      : ''
    const statement = this.db.prepare(`
      SELECT session_id
      FROM agent_sessions
      WHERE user_id = ? AND agent_id = ?
      ${excludeClause}
    `)
    const rows = statement.all(
      userId,
      agentId,
      ...preservedIds
    ) as SessionIdRow[]

    return rows.map(row => row.session_id)
  }

  private deleteSessionsByIds(
    userId: number,
    agentId: string,
    sessionIds: string[],
    options: {
      markDeleted?: boolean
    } = {}
  ): void {
    if (sessionIds.length === ZERO) {
      return
    }

    const placeholders = sessionIds.map(() => '?').join(', ')
    const scopeParams = [userId, agentId, ...sessionIds]
    this.db.exec('BEGIN')

    try {
      if (options.markDeleted) {
        const deletedAt = Date.now()
        for (const sessionId of sessionIds) {
          markSessionDeleted(this.db, {
            userId,
            agentId,
            sessionId,
            deletedAt
          })
        }
      }

      this.db.prepare(`
        DELETE FROM agent_session_messages
        WHERE user_id = ? AND agent_id = ? AND session_id IN (${placeholders})
      `).run(...scopeParams)

      this.db.prepare(`
        DELETE FROM agent_session_summaries
        WHERE user_id = ? AND agent_id = ? AND session_id IN (${placeholders})
      `).run(...scopeParams)

      this.db.prepare(`
        DELETE FROM agent_session_plans
        WHERE user_id = ? AND agent_id = ? AND session_id IN (${placeholders})
      `).run(...scopeParams)

      this.db.prepare(`
        DELETE FROM agent_session_interactions
        WHERE user_id = ? AND agent_id = ? AND session_id IN (${placeholders})
      `).run(...scopeParams)

      this.db.prepare(`
        DELETE FROM agent_sessions
        WHERE user_id = ? AND agent_id = ? AND session_id IN (${placeholders})
      `).run(...scopeParams)

      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  private assertSessionWritable(params: AgentSessionMessageRef): void {
    if (!isSessionDeleted(this.db, params)) {
      return
    }
    throw new DeletedSessionWriteError(params.sessionId)
  }

  private async upsertSessionMeta(
    params: AgentSessionMessageRef & { message?: AgentSessionMessage }
  ): Promise<void> {
    const existing = this.readSessionMeta(params.userId, params.agentId, params.sessionId)
    const now = Date.now()
    const title = params.message
      ? resolveSessionTitle(existing, params.message)
      : (existing?.title || normalizeTitle(TITLE_FALLBACK_PREFIX))
    const messageCount = this.countSessionMessages(params)
    const createdAt = existing?.createdAt || now
    const meta = existing
      ? {
          activePrimaryAgent: existing.activePrimaryAgent,
          planState: existing.planState,
          workspaceFiles: existing.workspaceFiles
        }
      : createDefaultWorkspaceSessionMeta(params.agentId)

    const statement = this.db.prepare(`
      INSERT INTO agent_sessions (
        user_id,
        agent_id,
        session_id,
        title,
        created_at,
        updated_at,
        message_count,
        meta_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, agent_id, session_id)
      DO UPDATE SET
        title = excluded.title,
        updated_at = excluded.updated_at,
        message_count = excluded.message_count,
        meta_json = COALESCE(agent_sessions.meta_json, excluded.meta_json)
    `)

    statement.run(
      params.userId,
      params.agentId,
      params.sessionId,
      title,
      createdAt,
      now,
      messageCount,
      toWorkspaceSessionMetaJson(meta)
    )
  }

  private countSessionMessages(params: AgentSessionMessageRef): number {
    const statement = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM agent_session_messages
      WHERE user_id = ? AND agent_id = ? AND session_id = ?
    `)
    const rows = statement.all(params.userId, params.agentId, params.sessionId) as CountRow[]
    return rows[0]?.count || ZERO
  }

  private readSessionMeta(userId: number, agentId: string, sessionId: string): AgentSessionMeta | null {
    const statement = this.db.prepare(`
      SELECT user_id, agent_id, session_id, title, created_at, updated_at, message_count, meta_json
      FROM agent_sessions
      WHERE user_id = ? AND agent_id = ? AND session_id = ?
    `)
    const rows = statement.all(userId, agentId, sessionId) as SessionMetaRow[]
    const row = rows[0]
    if (!row) return null
    const session = toSessionMeta(row)
    return {
      ...session,
      preview: this.buildSessionPreview(session),
      activity: IDLE_SESSION_ACTIVITY
    }
  }

  private buildSessionPreview(params: AgentSessionMessageRef): string {
    const statement = this.db.prepare(`
      SELECT id, user_id, role, parts_json, meta_json, attributes_json, created_at, protocol_state_json
      FROM agent_session_messages
      WHERE user_id = ? AND agent_id = ? AND session_id = ?
      ORDER BY id DESC
      LIMIT 8
    `)
    const rows = statement.all(params.userId, params.agentId, params.sessionId) as SessionRow[]
    for (const row of rows) {
      const text = buildPreviewText(toSessionMessage(row))
      if (text) return text
    }
    return ''
  }

  private listSessionViewRows(params: ListSessionMessagesParams & { cursor?: number }): SessionRow[] {
    const statement = this.db.prepare(`
      SELECT id, role, parts_json, meta_json, attributes_json, created_at, protocol_state_json
      FROM agent_session_messages
      WHERE user_id = ? AND agent_id = ? AND session_id = ?
      ${params.cursor ? 'AND id < ?' : ''}
      ORDER BY id DESC
      LIMIT ?
    `)
    return statement.all(
      params.userId,
      params.agentId,
      params.sessionId,
      ...(params.cursor ? [params.cursor] : []),
      normalizeLimit(params.limit)
    ) as SessionRow[]
  }

  private selectLatestPlanRow(params: AgentSessionMessageRef): SessionPlanRow | null {
    const statement = this.db.prepare(`
      SELECT *
      FROM agent_session_plans
      WHERE user_id = ? AND agent_id = ? AND session_id = ?
      ORDER BY version DESC
      LIMIT 1
    `)
    const rows = statement.all(params.userId, params.agentId, params.sessionId) as SessionPlanRow[]
    return rows[0] || null
  }

  private supersedeCurrentPlans(params: AgentSessionMessageRef): void {
    const statement = this.db.prepare(`
      UPDATE agent_session_plans
      SET status = ?, updated_at = ?
      WHERE user_id = ? AND agent_id = ? AND session_id = ?
        AND status IN (?, ?, ?)
    `)
    statement.run(
      PLAN_STATUS_SUPERSEDED,
      Date.now(),
      params.userId,
      params.agentId,
      params.sessionId,
      PLAN_STATUS_DRAFT,
      PLAN_STATUS_AWAITING_APPROVAL,
      PLAN_STATUS_APPROVED
    )
  }

  private requirePlan(params: AgentSessionMessageRef, planId: string): WorkspacePlanRecord {
    const statement = this.db.prepare(`
      SELECT *
      FROM agent_session_plans
      WHERE plan_id = ? AND user_id = ? AND agent_id = ? AND session_id = ?
    `)
    const rows = statement.all(
      planId,
      params.userId,
      params.agentId,
      params.sessionId
    ) as SessionPlanRow[]
    const row = rows[0]
    if (!row) {
      throw new Error(`Plan not found: ${planId}`)
    }
    return toPlanRecord(row)
  }

  private requireLatestPlan(params: AgentSessionMessageRef): WorkspacePlanRecord {
    const latest = this.selectLatestPlanRow(params)
    if (!latest) {
      throw new Error('No plan found for session')
    }
    return toPlanRecord(latest)
  }

  private rewriteSessionTail(params: AgentSessionMessageRef & {
    messageId: number
    cutoffCreatedAt: number
    workspaceFiles: WorkspaceSessionMeta['workspaceFiles']
  }): void {
    const beforeRows = this.listSessionRows(params)
    this.db.exec('BEGIN IMMEDIATE')
    try {
      this.db.prepare(`
        DELETE FROM agent_session_messages
        WHERE user_id = ? AND agent_id = ? AND session_id = ? AND id >= ?
      `).run(params.userId, params.agentId, params.sessionId, params.messageId)
      this.db.prepare(`
        DELETE FROM agent_session_summaries
        WHERE user_id = ? AND agent_id = ? AND session_id = ? AND covered_until >= ?
      `).run(params.userId, params.agentId, params.sessionId, params.cutoffCreatedAt)
      this.db.prepare(`
        DELETE FROM agent_session_interactions
        WHERE user_id = ? AND agent_id = ? AND session_id = ? AND created_at >= ?
      `).run(params.userId, params.agentId, params.sessionId, params.cutoffCreatedAt)
      this.db.prepare(`
        DELETE FROM agent_session_plans
        WHERE user_id = ? AND agent_id = ? AND session_id = ? AND created_at >= ?
      `).run(params.userId, params.agentId, params.sessionId, params.cutoffCreatedAt)
      const latestPlan = this.selectLatestPlanRow(params)
      const nextMeta = buildSessionMetaAfterRewrite({
        agentId: params.agentId,
        workspaceFiles: params.workspaceFiles,
        latestPlan: latestPlan ? toPlanRecord(latestPlan) : null
      })
      this.db.prepare(`
        UPDATE agent_sessions
        SET updated_at = ?, message_count = ?, meta_json = ?
        WHERE user_id = ? AND agent_id = ? AND session_id = ?
      `).run(
        Date.now(),
        this.countMessages(params),
        toWorkspaceSessionMetaJson(nextMeta),
        params.userId,
        params.agentId,
        params.sessionId
      )
      const afterRows = this.listSessionRows(params)
      sessionStoreLogger.info({
        message: 'session tail rewritten',
        context: {
          userId: params.userId,
          agentId: params.agentId,
          sessionId: params.sessionId
        },
        data: {
          requestedMessageId: params.messageId,
          cutoffCreatedAt: params.cutoffCreatedAt,
          beforeCount: beforeRows.length,
          afterCount: afterRows.length,
          beforeMessages: summarizeSessionRowsForLog(beforeRows),
          afterMessages: summarizeSessionRowsForLog(afterRows)
        }
      })
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  private findLastEditableUserMessage(params: AgentSessionMessageRef): SessionRow | null {
    const statement = this.db.prepare(`
      SELECT id, user_id, role, parts_json, meta_json, attributes_json, created_at, protocol_state_json
      FROM agent_session_messages
      WHERE user_id = ? AND agent_id = ? AND session_id = ?
      ORDER BY id DESC
    `)
    const rows = statement.all(params.userId, params.agentId, params.sessionId) as SessionRow[]
    for (const row of rows) {
      if (isEditableUserMessage(toSessionMessage(row))) {
        return row
      }
    }
    return null
  }

  private findMessageRow(params: AgentSessionMessageRef, messageId: number): SessionRow | null {
    const statement = this.db.prepare(`
      SELECT id, user_id, role, parts_json, meta_json, attributes_json, created_at, protocol_state_json
      FROM agent_session_messages
      WHERE user_id = ? AND agent_id = ? AND session_id = ? AND id = ?
      LIMIT 1
    `)
    const rows = statement.all(
      params.userId,
      params.agentId,
      params.sessionId,
      messageId
    ) as SessionRow[]
    return rows[0] || null
  }

  private listSessionRows(params: AgentSessionMessageRef): SessionRow[] {
    const statement = this.db.prepare(`
      SELECT id, user_id, role, parts_json, meta_json, attributes_json, created_at, protocol_state_json
      FROM agent_session_messages
      WHERE user_id = ? AND agent_id = ? AND session_id = ?
      ORDER BY id ASC
    `)
    return statement.all(params.userId, params.agentId, params.sessionId) as SessionRow[]
  }

  private countMessages(params: AgentSessionMessageRef): number {
    const statement = this.db.prepare(`
      SELECT COUNT(*) AS count
      FROM agent_session_messages
      WHERE user_id = ? AND agent_id = ? AND session_id = ?
    `)
    const rows = statement.all(params.userId, params.agentId, params.sessionId) as CountRow[]
    return rows[0]?.count || ZERO
  }
}

function assertPlanApprovalAllowed(
  decision: 'approve' | 'revise',
  plan: WorkspacePlanRecord
): void {
  if (decision !== 'approve' || plan.openQuestions.length === 0) {
    return
  }
  throw new PlanApprovalBlockedError('Plan still has unresolved planning questions.')
}

function buildMessageView(row: SessionRow): AgentSessionMessageView | null {
  const message = toSessionMessage(row)
  if (isHiddenSessionMessage(message)) {
    return null
  }
  if (isIntermediateMessage(message)) {
    return {
      messageId: row.id,
      role: message.role,
      text: '',
      createdAt: message.createdAt,
      kind: 'tool-step',
      toolDisplayNames: message.attributes.toolDisplayNames,
      protocolState: parseProtocolState(row.protocol_state_json)
    }
  }
  const textParts = extractTextParts(message)
  const text = textParts.join('\n')
  const protocolState = parseProtocolState(row.protocol_state_json)
  const structuredView = buildStructuredMessageView({
    row,
    message,
    text,
    protocolState
  })
  if (structuredView) {
    return structuredView
  }
  if (textParts.length === ZERO) {
    return null
  }
  return {
    messageId: row.id,
    role: message.role,
    text,
    createdAt: message.createdAt,
    kind: 'text',
    protocolState
  }
}

function buildStructuredMessageView(params: {
  row: SessionRow
  message: AgentSessionMessage
  text: string
  protocolState: Record<string, unknown> | undefined
}): AgentSessionMessageView | null {
  const structuredOutput = getStructuredOutput(params.message)
  if (structuredOutput?.kind === 'protocol') {
    return {
      messageId: params.row.id,
      role: params.message.role,
      text: params.text,
      createdAt: params.message.createdAt,
      kind: 'protocol',
      protocol: structuredOutput.protocol,
      protocolState: params.protocolState
    }
  }
  if (structuredOutput?.kind === 'domain-result') {
    return {
      messageId: params.row.id,
      role: params.message.role,
      text: params.text,
      createdAt: params.message.createdAt,
      kind: 'result',
      domainResult: structuredOutput.domainResult,
      protocolState: params.protocolState
    }
  }
  if (params.message.role !== 'assistant') {
    return null
  }
  const parsed = parseProtocolOutput(params.text)
  if (parsed.protocol) {
    return {
      messageId: params.row.id,
      role: params.message.role,
      text: params.text,
      createdAt: params.message.createdAt,
      kind: 'protocol',
      protocol: parsed.protocol,
      protocolState: params.protocolState
    }
  }

  const domainResult = parseDomainResult(params.text)
  if (!domainResult) {
    return null
  }
  return {
    messageId: params.row.id,
    role: params.message.role,
    text: params.text,
    createdAt: params.message.createdAt,
    kind: 'result',
    domainResult,
    protocolState: params.protocolState
  }
}

function parseDomainResult(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return null
  const first = trimmed[0]
  if (first !== '{' && first !== '[') {
    return null
  }
  try {
    return parseSkillExecutionOutput(text)
  } catch {
    return null
  }
}

function parseProtocolState(raw: string | null | undefined): Record<string, unknown> | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
    return parsed
  } catch {
    return undefined
  }
}

function buildPreviewText(message: AgentSessionMessage): string {
  if (isHiddenSessionMessage(message)) {
    return ''
  }
  const rendered = extractTextParts(message)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!rendered) return ''
  const maxLength = 72
  return rendered.length <= maxLength ? rendered : `${rendered.slice(0, maxLength - 1)}…`
}

function summarizeSessionRowsForLog(rows: SessionRow[]): Array<Record<string, unknown>> {
  return rows.map(row => {
    const message = toSessionMessage(row)
    const text = extractTextParts(message).join('\n')
    const hiddenAttributes = describeHiddenMessageAttributes(message.attributes)
    return {
      id: row.id,
      role: message.role,
      attributes: hiddenAttributes ?? undefined,
      createdAt: row.created_at,
      editable: isEditableUserMessage(message),
      textChars: text.length,
      textPreview: buildLogPreview(text, { maxChars: 120 })
    }
  })
}

function dedupeWorkspaceFiles(files: WorkspaceSessionEntry[]): WorkspaceSessionEntry[] {
  const byKey = new Map<string, WorkspaceSessionEntry>()
  for (const file of files) {
    const key = file.nodeType === 'folder' ? file.folderKey : file.fileKey
    if (!key.trim() || !file.fileName.trim()) continue
    byKey.set(key, file)
  }
  return [...byKey.values()].sort((left, right) => left.addedAt - right.addedAt)
}

function toPlanRecord(row: SessionPlanRow): WorkspacePlanRecord {
  return {
    planId: row.plan_id,
    version: row.version,
    status: row.status as WorkspacePlanRecord['status'],
    title: row.title,
    summary: row.summary,
    goal: row.goal,
    steps: parseStringArray(row.steps_json),
    approvedSkillIds: parseStringArray(row.approved_skill_ids_json),
    skillsReasoning: parseStringArray(row.skills_reasoning_json),
    risks: parseStringArray(row.risks_json),
    openQuestions: parseStringArray(row.open_questions_json),
    markdown: row.markdown,
    filePath: row.file_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function toInteractionRecord(row: SessionInteractionRow): AgentSessionInteractionRecord {
  return {
    interactionId: row.interaction_id,
    userId: row.user_id,
    agentId: row.agent_id,
    sessionId: row.session_id,
    runId: row.run_id,
    kind: parseInteractionKind(row.kind),
    status: parseInteractionStatus(row.status),
    payload: parseJsonRecord(row.payload_json, 'interaction payload') as unknown as AgentSessionInteractionRecord['payload'],
    answer: parseOptionalJsonRecord(row.answer_json),
    continuationContext: parseOptionalJsonRecord(row.continuation_context_json) as AgentSessionInteractionRecord['continuationContext'],
    createdAt: row.created_at,
    resolvedAt: row.resolved_at
  }
}

function parseStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function toJson(value: string[]): string {
  return JSON.stringify(value)
}

function parseInteractionKind(value: string): AgentSessionInteractionRecord['kind'] {
  if (value === 'question') {
    return value
  }
  throw new Error(`Unknown interaction kind: ${value}`)
}

function parseInteractionStatus(value: string): AgentSessionInteractionRecord['status'] {
  if (value === 'pending' || value === 'answered' || value === 'rejected') {
    return value
  }
  throw new Error(`Unknown interaction status: ${value}`)
}

function parseJsonRecord(raw: string, label: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${label} must be an object.`)
    }
    return parsed
  } catch (error) {
    throw new Error(`Failed to parse ${label}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function parseOptionalJsonRecord(raw: string | null): Record<string, unknown> | null {
  if (!raw) {
    return null
  }
  return parseJsonRecord(raw, 'interaction resolution')
}

export type {
  AgentSessionInteractionRecord,
  AgentSessionMessage,
  AgentSessionMessageRef,
  AgentSessionMessageView,
  AgentSessionMeta,
  AgentSessionStore,
  AgentSessionSummary,
  AgentSessionUsageSummary,
  AgentSessionPart,
  AgentSessionToolPart,
  AppendSessionMessageParams,
  ListSessionMessagesParams
} from './sessionStoreTypes.js'

function buildSessionUsageSummary(
  params: AgentSessionMessageRef,
  rows: SessionUsageRow[]
): AgentSessionUsageSummary {
  return rows.reduce((summary, row) => {
    const usage = parseUsageMetaJson(row.meta_json)
    return usage ? addUsageToSummary(summary, usage) : summary
  }, createEmptySessionUsageSummary(params))
}

function createEmptySessionUsageSummary(
  params: AgentSessionMessageRef
): AgentSessionUsageSummary {
  return {
    ...params,
    totalTokens: ZERO,
    inputTokens: ZERO,
    outputTokens: ZERO,
    cacheReadTokens: ZERO,
    cacheWriteTokens: ZERO,
    assistantMessageCount: ZERO
  }
}

function addUsageToSummary(
  summary: AgentSessionUsageSummary,
  usage: AgentSessionMessageUsageMeta
): AgentSessionUsageSummary {
  return {
    ...summary,
    totalTokens: summary.totalTokens + usage.totalTokens,
    inputTokens: summary.inputTokens + usage.inputTokens,
    outputTokens: summary.outputTokens + usage.outputTokens,
    cacheReadTokens: summary.cacheReadTokens + usage.cacheReadTokens,
    cacheWriteTokens: summary.cacheWriteTokens + usage.cacheWriteTokens,
    assistantMessageCount: summary.assistantMessageCount + ONE
  }
}

function parseUsageMetaJson(raw: string | null): AgentSessionMessageUsageMeta | null {
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as { usage?: unknown }
    return normalizeUsageMeta(parsed.usage)
  } catch {
    return null
  }
}

function normalizeUsageMeta(input: unknown): AgentSessionMessageUsageMeta | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null
  }
  const usage = input as Record<string, unknown>
  const inputTokens = readTokenCount(usage.inputTokens)
  const outputTokens = readTokenCount(usage.outputTokens)
  const totalTokens = readTokenCount(usage.totalTokens)
  const cacheReadTokens = readTokenCount(usage.cacheReadTokens)
  const cacheWriteTokens = readTokenCount(usage.cacheWriteTokens)
  if (
    inputTokens === null
    || outputTokens === null
    || totalTokens === null
    || cacheReadTokens === null
    || cacheWriteTokens === null
  ) {
    return null
  }
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    cacheReadTokens,
    cacheWriteTokens
  }
}

function readTokenCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
