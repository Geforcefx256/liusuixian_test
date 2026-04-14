import type { AgentRunRequest, AgentRunResult, AgentStreamEvent } from '../types.js'
import type { ProviderClient } from '../providerClient.js'
import type { AgentSessionStore } from '../sessionStore.js'
import type { ToolProviderRegistry } from '../../runtime/tools/index.js'
import type { Tokenizer } from '../context/types.js'

export interface ActiveRun {
  controller: AbortController
  startedAt: number
  userId: number
  agentId: string
  sessionId: string
}

export interface QueuedRun {
  request: AgentRunRequest
  emit: (event: AgentStreamEvent) => void
  resolve: (result: AgentRunResult) => void
  reject: (error: unknown) => void
}

export interface AgentServiceOptions {
  providerClient?: ProviderClient
  sessionStore?: AgentSessionStore
  toolRegistry?: ToolProviderRegistry
  tokenizer?: Tokenizer
  defaultContextWindow?: number
}

export type WorkspaceOccupancyState = 'idle' | 'running' | 'stop-pending' | 'awaiting-question'

export interface WorkspaceOccupancy {
  occupied: boolean
  state: WorkspaceOccupancyState
  ownerSessionId: string | null
  runId: string | null
}

export interface SessionActivity {
  active: boolean
  state: WorkspaceOccupancyState
  runId: string | null
}

export interface RunOutcome {
  result: AgentRunResult
  toolFailed: boolean
  status: 'success' | 'awaiting-interaction' | 'error' | 'cancelled'
}
