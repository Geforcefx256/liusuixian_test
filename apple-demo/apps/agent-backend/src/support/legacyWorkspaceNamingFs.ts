import { existsSync } from 'node:fs'
import { readdir, readFile, rm } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import {
  AGENTS_DIR_NAME,
  CANONICAL_FILE_KINDS,
  FILE_MAP_NAME,
  formatScope,
  LEGACY_OUTPUT_DIR_NAME,
  LEGACY_UPLOAD_DIR_NAME,
  type LegacyWorkspaceCleanupSummary,
  type LegacyWorkspaceIssue,
  USERS_DIR_NAME
} from './legacyWorkspaceNamingShared.js'

interface WorkspaceMapEntry {
  kind?: unknown
}

interface WorkspaceMapFile {
  entries?: WorkspaceMapEntry[]
}

interface LegacyScopeRecord {
  userId: number
  agentId: string
  scopePath: string
  hasLegacyRoots: boolean
  hasLegacyMapEntries: boolean
}

export async function findLegacyWorkspaceIssues(workspaceDir: string): Promise<LegacyWorkspaceIssue[]> {
  const scopes = await findLegacyWorkspaceScopes(workspaceDir)
  const issues: LegacyWorkspaceIssue[] = []
  for (const scope of scopes) {
    const label = formatScope(scope.userId, scope.agentId)
    if (scope.hasLegacyRoots) {
      issues.push({
        type: 'workspace-root',
        detail: `${label} still contains legacy workspace roots (${LEGACY_UPLOAD_DIR_NAME}/ or ${LEGACY_OUTPUT_DIR_NAME}/).`
      })
    }
    if (scope.hasLegacyMapEntries) {
      issues.push({
        type: 'file-map',
        detail: `${label} still contains legacy file-map entries in ${FILE_MAP_NAME}.`
      })
    }
  }
  return issues
}

export async function cleanupLegacyWorkspaceScopes(
  workspaceDir: string
): Promise<Omit<LegacyWorkspaceCleanupSummary, 'cleanedSessionCount'>> {
  const scopes = await findLegacyWorkspaceScopes(workspaceDir)
  let removedLegacyDirCount = 0
  let removedFileMapCount = 0
  for (const scope of scopes) {
    removedLegacyDirCount += await removeLegacyDirs(scope.scopePath)
    removedFileMapCount += await removeLegacyMap(scope.scopePath)
  }
  return {
    removedScopeCount: scopes.length,
    removedLegacyDirCount,
    removedFileMapCount
  }
}

async function findLegacyWorkspaceScopes(workspaceDir: string): Promise<LegacyScopeRecord[]> {
  const usersDir = join(workspaceDir, USERS_DIR_NAME)
  if (!existsSync(usersDir)) {
    return []
  }
  const scopePaths = await listScopePaths(usersDir)
  const scopes = await Promise.all(scopePaths.map(buildLegacyScopeRecord))
  return scopes.filter(scope => scope.hasLegacyRoots || scope.hasLegacyMapEntries)
}

async function listScopePaths(usersDir: string): Promise<string[]> {
  const results: string[] = []
  const userDirs = await readdir(usersDir, { withFileTypes: true })
  for (const userDir of userDirs) {
    if (!userDir.isDirectory()) continue
    const agentsDir = join(usersDir, userDir.name, AGENTS_DIR_NAME)
    if (!existsSync(agentsDir)) continue
    const agentDirs = await readdir(agentsDir, { withFileTypes: true })
    for (const agentDir of agentDirs) {
      if (agentDir.isDirectory()) {
        results.push(join(agentsDir, agentDir.name))
      }
    }
  }
  return results
}

async function buildLegacyScopeRecord(scopePath: string): Promise<LegacyScopeRecord> {
  const userId = Number(basename(dirname(dirname(scopePath))))
  const agentId = decodeURIComponent(basename(scopePath))
  const hasLegacyRoots = hasLegacyRootsInScope(scopePath)
  const hasLegacyMapEntries = await hasLegacyMapEntriesInScope(scopePath)
  return { userId, agentId, scopePath, hasLegacyRoots, hasLegacyMapEntries }
}

function hasLegacyRootsInScope(scopePath: string): boolean {
  return existsSync(join(scopePath, LEGACY_UPLOAD_DIR_NAME))
    || existsSync(join(scopePath, LEGACY_OUTPUT_DIR_NAME))
}

async function hasLegacyMapEntriesInScope(scopePath: string): Promise<boolean> {
  const mapPath = join(scopePath, FILE_MAP_NAME)
  if (!existsSync(mapPath)) {
    return false
  }
  const raw = await readFile(mapPath, 'utf8')
  if (!raw.trim()) {
    return false
  }
  const parsed = JSON.parse(raw) as WorkspaceMapFile
  return (parsed.entries || []).some(entry => isLegacyKind(entry.kind))
}

function isLegacyKind(kind: unknown): boolean {
  return typeof kind === 'string' && !CANONICAL_FILE_KINDS.has(kind)
}

async function removeLegacyDirs(scopePath: string): Promise<number> {
  let removedCount = 0
  for (const dirName of [LEGACY_UPLOAD_DIR_NAME, LEGACY_OUTPUT_DIR_NAME]) {
    const targetPath = join(scopePath, dirName)
    if (!existsSync(targetPath)) continue
    await rm(targetPath, { recursive: true, force: true })
    removedCount += 1
  }
  return removedCount
}

async function removeLegacyMap(scopePath: string): Promise<number> {
  const mapPath = join(scopePath, FILE_MAP_NAME)
  if (!existsSync(mapPath)) {
    return 0
  }
  await rm(mapPath, { force: true })
  return 1
}
