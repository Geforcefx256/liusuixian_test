import { loadConfig } from '../../memory/ConfigLoader.js'
import {
  BUILD_PRIMARY_AGENT,
  WORKSPACE_AGENT_ID
} from './constants.js'
import type { WorkspacePrimaryAgent } from './types.js'

export interface WorkspaceAgentRuntimeConfig {
  plannerEnabled: boolean
  defaultPrimaryAgent: WorkspacePrimaryAgent
}

const NON_WORKSPACE_AGENT_RUNTIME_CONFIG: WorkspaceAgentRuntimeConfig = {
  plannerEnabled: false,
  defaultPrimaryAgent: BUILD_PRIMARY_AGENT
}

export function getWorkspaceAgentRuntimeConfig(agentId: string): WorkspaceAgentRuntimeConfig {
  if (agentId !== WORKSPACE_AGENT_ID) {
    return NON_WORKSPACE_AGENT_RUNTIME_CONFIG
  }
  return loadConfig().runtime.workspaceAgent
}

export function isPlannerEnabled(agentId: string): boolean {
  return getWorkspaceAgentRuntimeConfig(agentId).plannerEnabled
}

export function resolveDefaultPrimaryAgent(agentId: string): WorkspacePrimaryAgent {
  const config = getWorkspaceAgentRuntimeConfig(agentId)
  return config.plannerEnabled ? config.defaultPrimaryAgent : BUILD_PRIMARY_AGENT
}
