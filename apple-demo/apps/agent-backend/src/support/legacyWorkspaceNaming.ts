import {
  type LegacyWorkspaceCleanupSummary,
  type LegacyWorkspacePaths,
  type LegacyWorkspaceState,
  LegacyWorkspaceNamingError,
  resolveLegacyWorkspacePaths
} from './legacyWorkspaceNamingShared.js'
import {
  cleanupLegacyWorkspaceScopes,
  findLegacyWorkspaceIssues
} from './legacyWorkspaceNamingFs.js'
import {
  cleanupLegacySessionMetadata,
  findLegacySessionIssues
} from './legacyWorkspaceNamingSessions.js'

export { LegacyWorkspaceNamingError, resolveLegacyWorkspacePaths }

export async function assertNoLegacyWorkspaceNaming(paths: LegacyWorkspacePaths): Promise<void> {
  const state = await detectLegacyWorkspaceNaming(paths)
  if (state.issues.length > 0) {
    throw new LegacyWorkspaceNamingError(state)
  }
}

export async function detectLegacyWorkspaceNaming(
  paths: LegacyWorkspacePaths
): Promise<LegacyWorkspaceState> {
  const workspaceIssues = await findLegacyWorkspaceIssues(paths.workspaceDir)
  const sessionIssues = findLegacySessionIssues(paths.sessionDbPath)
  return { issues: [...workspaceIssues, ...sessionIssues] }
}

export async function cleanupLegacyWorkspaceNaming(
  paths: LegacyWorkspacePaths
): Promise<LegacyWorkspaceCleanupSummary> {
  const workspaceSummary = await cleanupLegacyWorkspaceScopes(paths.workspaceDir)
  const cleanedSessionCount = cleanupLegacySessionMetadata(paths.sessionDbPath)
  return { ...workspaceSummary, cleanedSessionCount }
}
