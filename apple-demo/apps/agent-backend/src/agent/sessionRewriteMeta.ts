import { buildPlanSnapshot, createDefaultWorkspaceSessionMeta } from './workspace/sessionMeta.js'
import { BUILD_PRIMARY_AGENT, PLAN_PRIMARY_AGENT } from './workspace/constants.js'
import type { WorkspacePlanRecord, WorkspaceSessionEntry, WorkspaceSessionMeta } from './workspace/types.js'

export function buildSessionMetaAfterRewrite(params: {
  agentId: string
  workspaceFiles: WorkspaceSessionEntry[]
  latestPlan: WorkspacePlanRecord | null
}): WorkspaceSessionMeta {
  const defaultMeta = createDefaultWorkspaceSessionMeta(params.agentId)
  if (!params.latestPlan) {
    return {
      ...defaultMeta,
      workspaceFiles: params.workspaceFiles
    }
  }
  return {
    activePrimaryAgent: resolvePrimaryAgent(params.latestPlan.status, defaultMeta.activePrimaryAgent),
    planState: buildPlanSnapshot(params.latestPlan),
    workspaceFiles: params.workspaceFiles
  }
}

function resolvePrimaryAgent(
  status: WorkspacePlanRecord['status'],
  defaultPrimaryAgent: WorkspaceSessionMeta['activePrimaryAgent']
): WorkspaceSessionMeta['activePrimaryAgent'] {
  if (status === 'approved') {
    return BUILD_PRIMARY_AGENT
  }
  if (status === 'draft' || status === 'awaiting_approval') {
    return PLAN_PRIMARY_AGENT
  }
  return defaultPrimaryAgent
}
