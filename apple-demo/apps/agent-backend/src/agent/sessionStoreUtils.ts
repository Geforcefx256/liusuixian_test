import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import type {
  AgentSessionMessage,
  AgentSessionMessageAttributes,
  AgentSessionMessageMeta,
  AgentSessionMeta,
  AgentSessionPart
} from './sessionStoreTypes.js'
import {
  parseAgentSessionParts,
  renderSessionPart
} from './sessionParts.js'
import {
  createDefaultWorkspaceSessionMeta,
  parseWorkspaceSessionMeta
} from './workspace/sessionMeta.js'

export const DEFAULT_MESSAGE_LIMIT = 40
export const SCHEMA_VERSION = 8
export const MAX_TITLE_LENGTH = 64
export const TITLE_FALLBACK_PREFIX = 'Session'
export const ONE = 1
export const ZERO = 0

export interface DatabaseSyncLike {
  exec(sql: string): void
  prepare(sql: string): {
    run(...params: unknown[]): unknown
    all(...params: unknown[]): unknown[]
  }
  close(): void
}

export interface SessionRow {
  id: number
  user_id: number
  role: AgentSessionMessage['role']
  parts_json: string
  created_at: number
  meta_json?: string | null
  attributes_json?: string | null
  protocol_state_json?: string | null
  reasoning_json?: string | null
}

export interface SessionMetaRow {
  user_id: number
  agent_id: string
  session_id: string
  title: string
  created_at: number
  updated_at: number
  message_count: number
  meta_json?: string | null
}

export interface SessionPlanRow {
  plan_id: string
  user_id: number
  agent_id: string
  session_id: string
  version: number
  status: string
  title: string
  summary: string
  goal: string
  steps_json: string
  approved_skill_ids_json: string
  skills_reasoning_json: string
  risks_json: string
  open_questions_json: string
  markdown: string
  file_path: string
  created_at: number
  updated_at: number
}

export interface SummaryRow {
  user_id: number
  agent_id: string
  session_id: string
  summary: string
  covered_until: number
  updated_at: number
}

export interface SessionInteractionRow {
  interaction_id: string
  user_id: number
  agent_id: string
  session_id: string
  run_id: string
  kind: string
  status: string
  payload_json: string
  answer_json: string | null
  continuation_context_json: string | null
  created_at: number
  resolved_at: number | null
}

interface SessionTombstoneLookupRow {
  deleted_at: number
}

export function ensureDbDirectory(dbPath: string): void {
  const directory = path.dirname(dbPath)
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true })
  }
}

export function ensureSchema(db: DatabaseSyncLike): void {
  db.exec(buildSchemaSql())
  ensureSessionMetaColumn(db)
  ensurePlanTable(db)
  ensureInteractionTable(db)
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
}

export function normalizeLimit(limit: number | undefined): number {
  if (!limit || !Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_MESSAGE_LIMIT
  }
  return Math.floor(limit)
}

export function toSessionMessage(row: SessionRow): AgentSessionMessage {
  return {
    role: row.role,
    parts: parseAgentSessionParts(row.parts_json),
    createdAt: row.created_at,
    ...(row.reasoning_json ? { reasoning: parseReasoningJson(row.reasoning_json) } : {}),
    ...(row.attributes_json ? { attributes: parseMessageAttributes(row.attributes_json) } : {}),
    ...(row.meta_json ? { meta: parseMessageMeta(row.meta_json) } : {})
  }
}

function parseReasoningJson(raw: string): string | undefined {
  try {
    const value = JSON.parse(raw)
    return typeof value === 'string' && value ? value : undefined
  } catch {
    return undefined
  }
}

export function toSessionMeta(row: SessionMetaRow): AgentSessionMeta {
  const meta = row.meta_json
    ? parseWorkspaceSessionMeta(row.meta_json, row.agent_id)
    : createDefaultWorkspaceSessionMeta(row.agent_id)
  return {
    userId: row.user_id,
    agentId: row.agent_id,
    sessionId: row.session_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messageCount: row.message_count,
    preview: '',
    activity: {
      active: false,
      state: 'idle',
      runId: null
    },
    activePrimaryAgent: meta.activePrimaryAgent,
    planState: meta.planState,
    workspaceFiles: meta.workspaceFiles
  }
}

export function markSessionDeleted(
  db: DatabaseSyncLike,
  params: {
    userId: number
    agentId: string
    sessionId: string
    deletedAt: number
  }
): void {
  db.prepare(`
    INSERT INTO agent_session_tombstones (
      user_id,
      agent_id,
      session_id,
      deleted_at
    ) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, agent_id, session_id)
    DO UPDATE SET deleted_at = excluded.deleted_at
  `).run(
    params.userId,
    params.agentId,
    params.sessionId,
    params.deletedAt
  )
}

export function isSessionDeleted(
  db: DatabaseSyncLike,
  params: {
    userId: number
    agentId: string
    sessionId: string
  }
): boolean {
  const rows = db.prepare(`
    SELECT deleted_at
    FROM agent_session_tombstones
    WHERE user_id = ? AND agent_id = ? AND session_id = ?
    LIMIT 1
  `).all(
    params.userId,
    params.agentId,
    params.sessionId
  ) as SessionTombstoneLookupRow[]
  return Number.isFinite(rows[0]?.deleted_at)
}

export function renderMessageText(message: AgentSessionMessage): string {
  const parts = message.parts.map(part => renderPartText(part)).filter(Boolean)
  return parts.join('\n')
}

export function extractTextParts(message: AgentSessionMessage): string[] {
  return message.parts
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .filter(text => text.trim().length > ZERO)
}

export function resolveSessionTitle(
  existing: AgentSessionMeta | null,
  message: AgentSessionMessage
): string {
  if (existing?.title) return existing.title
  if (message.role !== 'user') {
    return `${TITLE_FALLBACK_PREFIX} ${new Date().toISOString()}`
  }
  const text = message.parts
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join(' ')
  return normalizeTitle(text) || `${TITLE_FALLBACK_PREFIX} ${new Date().toISOString()}`
}

export function normalizeTitle(title: string | undefined): string {
  if (!title) return ''
  const trimmed = title.trim()
  if (!trimmed) return ''
  return trimmed.slice(0, MAX_TITLE_LENGTH)
}

export function toMessageMetaJson(meta: AgentSessionMessageMeta | null | undefined): string | null {
  if (!meta) return null
  return JSON.stringify(meta)
}

export function toMessageAttributesJson(
  attributes: AgentSessionMessageAttributes | null | undefined
): string | null {
  if (!attributes) return null
  return JSON.stringify(attributes)
}

export function loadDatabaseSync(): new (path: string) => DatabaseSyncLike {
  const require = createRequire(import.meta.url)
  const sqliteModule = require('node:sqlite') as {
    DatabaseSync: new (path: string) => DatabaseSyncLike
  }
  return sqliteModule.DatabaseSync
}

function buildSchemaSql(): string {
  return `
    CREATE TABLE IF NOT EXISTS agent_session_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      agent_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      parts_json TEXT NOT NULL,
      meta_json TEXT,
      attributes_json TEXT,
      protocol_state_json TEXT,
      reasoning_json TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_agent_session_messages_lookup
    ON agent_session_messages (user_id, agent_id, session_id, id);

    CREATE TABLE IF NOT EXISTS agent_sessions (
      user_id INTEGER NOT NULL,
      agent_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      message_count INTEGER NOT NULL,
      meta_json TEXT,
      PRIMARY KEY (user_id, agent_id, session_id)
    );

    CREATE TABLE IF NOT EXISTS agent_session_summaries (
      user_id INTEGER NOT NULL,
      agent_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      covered_until INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, agent_id, session_id)
    );

    CREATE TABLE IF NOT EXISTS agent_session_tombstones (
      user_id INTEGER NOT NULL,
      agent_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      deleted_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, agent_id, session_id)
    );
  `
}

function ensureSessionMetaColumn(db: DatabaseSyncLike): void {
  try {
    db.exec('ALTER TABLE agent_sessions ADD COLUMN meta_json TEXT')
  } catch {
    // Column already exists.
  }
  try {
    db.exec('ALTER TABLE agent_session_messages ADD COLUMN meta_json TEXT')
  } catch {
    // Column already exists.
  }
  try {
    db.exec('ALTER TABLE agent_session_messages ADD COLUMN attributes_json TEXT')
  } catch {
    // Column already exists.
  }
  try {
    db.exec('ALTER TABLE agent_session_messages ADD COLUMN reasoning_json TEXT')
  } catch {
    // Column already exists.
  }
}

function ensurePlanTable(db: DatabaseSyncLike): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_session_plans (
      plan_id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      agent_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      goal TEXT NOT NULL,
      steps_json TEXT NOT NULL,
      approved_skill_ids_json TEXT NOT NULL,
      skills_reasoning_json TEXT NOT NULL,
      risks_json TEXT NOT NULL,
      open_questions_json TEXT NOT NULL,
      markdown TEXT NOT NULL,
      file_path TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_session_plans_lookup
    ON agent_session_plans (user_id, agent_id, session_id, version);
  `)
}

function ensureInteractionTable(db: DatabaseSyncLike): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_session_interactions (
      interaction_id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      agent_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      answer_json TEXT,
      continuation_context_json TEXT,
      created_at INTEGER NOT NULL,
      resolved_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_agent_session_interactions_lookup
    ON agent_session_interactions (user_id, agent_id, session_id, status, created_at);
  `)
}

function renderPartText(part: AgentSessionPart): string {
  return renderSessionPart(part)
}

function parseMessageMeta(raw: string): AgentSessionMessageMeta | undefined {
  try {
    const parsed = JSON.parse(raw) as Partial<AgentSessionMessageMeta>
    if (!parsed || typeof parsed !== 'object') return undefined
    if (
      parsed.model?.provider !== 'openai'
      && parsed.model?.provider !== 'qwen'
      && parsed.model?.provider !== 'deepseek'
      && parsed.model?.provider !== 'hw'
    ) {
      return undefined
    }
    if (typeof parsed.model?.modelName !== 'string') return undefined
    if (!Number.isFinite(parsed.usage?.inputTokens)) return undefined
    if (!Number.isFinite(parsed.usage?.outputTokens)) return undefined
    if (!Number.isFinite(parsed.usage?.totalTokens)) return undefined
    if (!Number.isFinite(parsed.usage?.cacheReadTokens)) return undefined
    if (!Number.isFinite(parsed.usage?.cacheWriteTokens)) return undefined
    if (parsed.finishReason !== null && typeof parsed.finishReason !== 'string') return undefined
    if (!Number.isFinite(parsed.compaction?.checkedAt)) return undefined
    if (typeof parsed.compaction?.overflow !== 'boolean') return undefined
    if (typeof parsed.compaction?.applied !== 'boolean') return undefined
    const usage = parsed.usage
    const compaction = parsed.compaction
    if (!usage || !compaction) return undefined
    return {
      model: {
        provider: parsed.model.provider,
        modelName: parsed.model.modelName
      },
      usage: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        cacheReadTokens: usage.cacheReadTokens,
        cacheWriteTokens: usage.cacheWriteTokens
      },
      finishReason: parsed.finishReason,
      compaction: {
        checkedAt: compaction.checkedAt,
        overflow: compaction.overflow,
        applied: compaction.applied
      }
    }
  } catch {
    return undefined
  }
}

function parseMessageAttributes(raw: string): AgentSessionMessageAttributes | undefined {
  try {
    const parsed = JSON.parse(raw) as Partial<AgentSessionMessageAttributes>
    if (!parsed || typeof parsed !== 'object') return undefined
    if (parsed.visibility === 'hidden' && parsed.semantic === 'skill-context') {
      if (typeof parsed.skillName !== 'string' || !parsed.skillName.trim()) return undefined
      return {
        visibility: 'hidden',
        semantic: 'skill-context',
        skillName: parsed.skillName
      }
    }
    if (parsed.visibility === 'internal' && parsed.semantic === 'intermediate') {
      const toolDisplayNames = Array.isArray(parsed.toolDisplayNames)
        ? parsed.toolDisplayNames.filter(
            (value): value is string => typeof value === 'string' && value.trim().length > ZERO
          )
        : []
      return {
        visibility: 'internal',
        semantic: 'intermediate',
        toolDisplayNames
      }
    }
    return undefined
  } catch {
    return undefined
  }
}
