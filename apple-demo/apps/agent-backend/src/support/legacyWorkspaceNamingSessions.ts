import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import {
  CANONICAL_GROUP_IDS,
  CANONICAL_SOURCES,
  formatScope,
  LEGACY_GROUP_IDS,
  LEGACY_SOURCES,
  type LegacyWorkspaceIssue
} from './legacyWorkspaceNamingShared.js'

interface SessionMetaRow {
  user_id: number
  agent_id: string
  session_id: string
  meta_json: string | null
}

interface DatabaseSyncLike {
  prepare(sql: string): { all(): unknown[]; run(...params: unknown[]): unknown }
  close(): void
}

export function findLegacySessionIssues(sessionDbPath: string): LegacyWorkspaceIssue[] {
  if (!existsSync(sessionDbPath)) {
    return []
  }
  try {
    return loadSessionRows(sessionDbPath)
      .filter(row => rowHasLegacyWorkspaceFiles(row.meta_json))
      .map(row => ({
        type: 'session-meta' as const,
        detail: `${formatScope(row.user_id, row.agent_id)} session ${row.session_id} still contains legacy workspaceFiles metadata.`
      }))
  } catch {
    return []
  }
}

export function cleanupLegacySessionMetadata(sessionDbPath: string): number {
  if (!existsSync(sessionDbPath)) {
    return 0
  }
  try {
    const rows = loadSessionRows(sessionDbPath)
    const DatabaseSync = loadDatabaseSync()
    const db = new DatabaseSync(sessionDbPath)
    const updateStatement = db.prepare(`
      UPDATE agent_sessions
      SET meta_json = ?
      WHERE user_id = ? AND agent_id = ? AND session_id = ?
    `)
    let cleanedCount = 0
    for (const row of rows) {
      const nextMeta = stripLegacyWorkspaceFiles(row.meta_json)
      if (!nextMeta) continue
      updateStatement.run(nextMeta, row.user_id, row.agent_id, row.session_id)
      cleanedCount += 1
    }
    db.close()
    return cleanedCount
  } catch {
    return 0
  }
}

function loadSessionRows(sessionDbPath: string): SessionMetaRow[] {
  const DatabaseSync = loadDatabaseSync()
  const db = new DatabaseSync(sessionDbPath)
  const rows = db.prepare(`
    SELECT user_id, agent_id, session_id, meta_json
    FROM agent_sessions
  `).all() as SessionMetaRow[]
  db.close()
  return rows
}

function stripLegacyWorkspaceFiles(metaJson: string | null): string | null {
  if (!rowHasLegacyWorkspaceFiles(metaJson)) {
    return null
  }
  const parsed = JSON.parse(metaJson || '{}') as { workspaceFiles?: unknown[] }
  const workspaceFiles = Array.isArray(parsed.workspaceFiles)
    ? parsed.workspaceFiles.filter(entry => isCanonicalWorkspaceFileEntry(entry))
    : []
  return JSON.stringify({ ...parsed, workspaceFiles })
}

function rowHasLegacyWorkspaceFiles(metaJson: string | null): boolean {
  if (!metaJson) {
    return false
  }
  try {
    const parsed = JSON.parse(metaJson) as { workspaceFiles?: unknown[] }
    return Array.isArray(parsed.workspaceFiles)
      && parsed.workspaceFiles.some(entry => isLegacyWorkspaceFileEntry(entry))
  } catch {
    return false
  }
}

function isLegacyWorkspaceFileEntry(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const candidate = value as { groupId?: unknown; source?: unknown }
  return (typeof candidate.groupId === 'string' && LEGACY_GROUP_IDS.has(candidate.groupId))
    || (typeof candidate.source === 'string' && LEGACY_SOURCES.has(candidate.source))
}

function isCanonicalWorkspaceFileEntry(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const candidate = value as { groupId?: unknown; source?: unknown }
  const groupIdValid = typeof candidate.groupId === 'string' && CANONICAL_GROUP_IDS.has(candidate.groupId)
  const sourceValid = candidate.source === undefined
    || (typeof candidate.source === 'string' && CANONICAL_SOURCES.has(candidate.source))
  return groupIdValid && sourceValid
}

function loadDatabaseSync(): new (path: string) => DatabaseSyncLike {
  const require = createRequire(import.meta.url)
  const sqliteModule = require('node:sqlite') as {
    DatabaseSync: new (path: string) => DatabaseSyncLike
  }
  return sqliteModule.DatabaseSync
}
