import { resolve } from 'node:path'
import { resolveBackendRoot } from './runtimePaths.js'

const DATA_DIR_NAME = 'data'
const SESSION_DB_NAME = 'memory.db'
export const USERS_DIR_NAME = 'users'
export const AGENTS_DIR_NAME = 'agents'
export const FILE_MAP_NAME = 'file-map.json'
export const LEGACY_UPLOAD_DIR_NAME = 'uploads'
export const LEGACY_OUTPUT_DIR_NAME = 'outputs'
export const CLEANUP_COMMAND = 'pnpm --filter @apple-demo/agent-backend run cleanup:legacy-workspace-naming'
export const CANONICAL_FILE_KINDS = new Set(['upload', 'project', 'folder'])
export const LEGACY_GROUP_IDS = new Set(['input', 'working'])
export const LEGACY_SOURCES = new Set(['input', 'output', 'working'])
export const CANONICAL_GROUP_IDS = new Set(['upload', 'project'])
export const CANONICAL_SOURCES = new Set(['upload', 'project'])

export interface LegacyWorkspacePaths {
  workspaceDir: string
  sessionDbPath: string
}

export interface LegacyWorkspaceIssue {
  type: 'workspace-root' | 'file-map' | 'session-meta'
  detail: string
}

export interface LegacyWorkspaceState {
  issues: LegacyWorkspaceIssue[]
}

export interface LegacyWorkspaceCleanupSummary {
  removedScopeCount: number
  removedLegacyDirCount: number
  removedFileMapCount: number
  cleanedSessionCount: number
}

export class LegacyWorkspaceNamingError extends Error {
  readonly state: LegacyWorkspaceState

  constructor(state: LegacyWorkspaceState) {
    super(buildLegacyWorkspaceErrorMessage(state))
    this.name = 'LegacyWorkspaceNamingError'
    this.state = state
  }
}

export function resolveLegacyWorkspacePaths(moduleUrl: string, levelsUp: number): LegacyWorkspacePaths {
  const backendRoot = resolveBackendRoot(moduleUrl, levelsUp)
  return {
    workspaceDir: resolve(backendRoot, 'workspace'),
    sessionDbPath: resolve(backendRoot, DATA_DIR_NAME, SESSION_DB_NAME)
  }
}

export function buildLegacyWorkspaceErrorMessage(state: LegacyWorkspaceState): string {
  const lines = [
    'Detected legacy workspace naming data from the retired input/working/output(s) upgrade path.',
    `Run ${CLEANUP_COMMAND} before starting apps/agent-backend again.`
  ]
  for (const issue of state.issues) {
    lines.push(`- ${issue.detail}`)
  }
  return lines.join('\n')
}

export function formatScope(userId: number, agentId: string): string {
  return `user ${userId} / agent ${agentId}`
}
