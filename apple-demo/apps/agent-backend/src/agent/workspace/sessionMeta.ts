import {
  BUILD_PRIMARY_AGENT,
  PLAN_PRIMARY_AGENT,
  PLAN_STATUS_DRAFT
} from './constants.js'
import type {
  WorkspacePlanRecord,
  WorkspacePlanSnapshot,
  WorkspaceSessionEntry,
  WorkspaceSessionMeta
} from './types.js'
import { resolveDefaultPrimaryAgent } from './runtimeConfig.js'

export function createDefaultWorkspaceSessionMeta(agentId: string): WorkspaceSessionMeta {
  return {
    activePrimaryAgent: resolveDefaultPrimaryAgent(agentId),
    planState: null,
    workspaceFiles: []
  }
}

export function parseWorkspaceSessionMeta(
  raw: string | null | undefined,
  agentId: string
): WorkspaceSessionMeta {
  if (!raw) return createDefaultWorkspaceSessionMeta(agentId)
  try {
    const parsed = JSON.parse(raw) as Partial<WorkspaceSessionMeta>
    return normalizeWorkspaceSessionMeta(parsed, agentId)
  } catch {
    return createDefaultWorkspaceSessionMeta(agentId)
  }
}

export function normalizeWorkspaceSessionMeta(
  meta: Partial<WorkspaceSessionMeta> | null | undefined,
  agentId: string
): WorkspaceSessionMeta {
  const defaultPrimaryAgent = resolveDefaultPrimaryAgent(agentId)
  const activePrimaryAgent = meta?.activePrimaryAgent === 'build'
    ? 'build'
    : meta?.activePrimaryAgent === 'plan'
      ? 'plan'
      : defaultPrimaryAgent
  const planState = isPlanSnapshot(meta?.planState) ? meta.planState : null
  const workspaceFiles = Array.isArray(meta?.workspaceFiles)
    ? meta.workspaceFiles.filter(isWorkspaceSessionEntry)
    : []
  return {
    activePrimaryAgent: activePrimaryAgent === 'build' ? BUILD_PRIMARY_AGENT : PLAN_PRIMARY_AGENT,
    planState,
    workspaceFiles
  }
}

export function toWorkspaceSessionMetaJson(meta: WorkspaceSessionMeta): string {
  return JSON.stringify(meta)
}

export function buildPlanSnapshot(plan: WorkspacePlanRecord): WorkspacePlanSnapshot {
  return {
    planId: plan.planId,
    version: plan.version,
    status: plan.status,
    title: plan.title,
    summary: plan.summary,
    filePath: plan.filePath,
    approvedSkillIds: [...plan.approvedSkillIds]
  }
}

export function createDraftPlanState(plan: WorkspacePlanSnapshot): WorkspacePlanSnapshot {
  return {
    ...plan,
    status: PLAN_STATUS_DRAFT
  }
}

function isPlanSnapshot(value: unknown): value is WorkspacePlanSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Partial<WorkspacePlanSnapshot>
  if (typeof candidate.planId !== 'string') return false
  if (!Number.isFinite(candidate.version)) return false
  if (typeof candidate.title !== 'string') return false
  if (typeof candidate.summary !== 'string') return false
  if (typeof candidate.filePath !== 'string') return false
  if (!Array.isArray(candidate.approvedSkillIds)) return false
  return (
    candidate.status === PLAN_STATUS_DRAFT
    || candidate.status === 'awaiting_approval'
    || candidate.status === 'approved'
    || candidate.status === 'superseded'
  )
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
