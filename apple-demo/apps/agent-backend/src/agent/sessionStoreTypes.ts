import type {
  WorkspacePlanRecord,
  WorkspacePlanSnapshot,
  WorkspaceSessionEntry,
  WorkspaceSessionMeta
} from './workspace/types.js'
import type {
  AgentSessionInteractionRecord,
  AgentSessionInteractionStatus
} from './interactions.js'
import type { AgentModelConfig, SkillExecutionOutput } from './types.js'
import type { SessionActivity } from './service/types.js'

export type { AgentSessionInteractionRecord } from './interactions.js'

export interface AgentSessionMessageUsageMeta {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export interface AgentSessionUsageSummary extends AgentSessionMessageRef {
  totalTokens: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  assistantMessageCount: number
}

export interface AgentSessionMessageCompactionMeta {
  checkedAt: number
  overflow: boolean
  applied: boolean
}

export interface AgentSessionMessageMeta {
  model: Pick<AgentModelConfig, 'provider' | 'modelName'>
  usage: AgentSessionMessageUsageMeta
  finishReason: string | null
  compaction: AgentSessionMessageCompactionMeta
}

export interface AgentSessionSkillContextMessageAttributes {
  visibility: 'hidden'
  semantic: 'skill-context'
  skillName: string
}

export interface AgentSessionIntermediateMessageAttributes {
  visibility: 'internal'
  semantic: 'intermediate'
  toolDisplayNames: string[]
}

export type AgentSessionMessageAttributes =
  | AgentSessionSkillContextMessageAttributes
  | AgentSessionIntermediateMessageAttributes

export interface AgentSessionTextPart {
  type: 'text'
  text: string
}

export interface AgentSessionToolPart {
  type: 'tool'
  id: string
  name: string
  input: Record<string, unknown>
  status: 'success' | 'error'
  output: string
  compressed?: boolean
}

export interface AgentSessionStructuredProtocolPart {
  type: 'structured'
  kind: 'protocol'
  protocol: Record<string, unknown>
}

export interface AgentSessionStructuredDomainResultPart {
  type: 'structured'
  kind: 'domain-result'
  domainResult: SkillExecutionOutput
}

export type AgentSessionStructuredPart =
  | AgentSessionStructuredProtocolPart
  | AgentSessionStructuredDomainResultPart

export type AgentSessionPart =
  | AgentSessionTextPart
  | AgentSessionToolPart
  | AgentSessionStructuredPart

export interface AgentSessionMessage {
  role: 'user' | 'assistant'
  parts: AgentSessionPart[]
  createdAt: number
  reasoning?: string
  meta?: AgentSessionMessageMeta
  attributes?: AgentSessionMessageAttributes
}

export interface AgentSessionMessageRef {
  userId: number
  agentId: string
  sessionId: string
}

export interface AppendSessionMessageParams extends AgentSessionMessageRef {
  message: AgentSessionMessage
}

export interface ListSessionMessagesParams extends AgentSessionMessageRef {
  limit?: number
}

export interface AgentSessionMeta extends AgentSessionMessageRef {
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
  preview: string
  activity: SessionActivity
  activePrimaryAgent: WorkspaceSessionMeta['activePrimaryAgent']
  planState: WorkspacePlanSnapshot | null
  workspaceFiles: WorkspaceSessionEntry[]
}

export interface AgentSessionSummary extends AgentSessionMessageRef {
  summary: string
  coveredUntil: number
  updatedAt: number
}

export interface AgentSessionMessageView {
  messageId: number
  role: AgentSessionMessage['role']
  text: string
  createdAt: number
  kind: 'text' | 'protocol' | 'result' | 'tool-step'
  protocol?: Record<string, unknown>
  domainResult?: SkillExecutionOutput
  protocolState?: Record<string, unknown>
  toolDisplayNames?: string[]
}

export interface AgentSessionStore {
  appendMessage(params: AppendSessionMessageParams): Promise<number>
  listMessages(params: ListSessionMessagesParams): Promise<AgentSessionMessage[]>
  deleteMessages?(params: AgentSessionMessageRef & { messageIds: number[] }): Promise<void>
  rewriteSessionFromMessage(params: AgentSessionMessageRef & {
    messageId: number
  }): Promise<void>
  listSessions(userId: number, agentId: string): Promise<AgentSessionMeta[]>
  createSession(userId: number, agentId: string, title?: string): Promise<AgentSessionMeta>
  getSessionMeta(params: AgentSessionMessageRef): Promise<AgentSessionMeta | null>
  getWorkspaceFiles(params: AgentSessionMessageRef): Promise<WorkspaceSessionEntry[]>
  renameSession(userId: number, agentId: string, sessionId: string, title: string): Promise<void>
  deleteSession(userId: number, agentId: string, sessionId: string): Promise<boolean>
  clearHistorySessions(userId: number, agentId: string, preservedSessionIds?: string[] | null): Promise<number>
  replaceWorkspaceFiles(params: AgentSessionMessageRef & {
    files: WorkspaceSessionEntry[]
  }): Promise<AgentSessionMeta | null>
  getSessionMessagesView(params: ListSessionMessagesParams & { cursor?: number }): Promise<{
    messages: AgentSessionMessageView[]
    nextCursor: number | null
    hasMore: boolean
  }>
  updateMessageProtocolState(params: {
    userId: number
    agentId: string
    sessionId: string
    messageId: number
    protocolState: Record<string, unknown> | null
  }): Promise<void>
  updateMessageMeta(params: AgentSessionMessageRef & {
    messageId: number
    meta: AgentSessionMessageMeta | null
  }): Promise<void>
  getSessionUsageSummary(params: AgentSessionMessageRef): Promise<AgentSessionUsageSummary>
  getSummary(params: AgentSessionMessageRef): Promise<AgentSessionSummary | null>
  upsertSummary(params: AgentSessionMessageRef & { summary: string; coveredUntil: number }): Promise<void>
  updateSessionMeta(params: AgentSessionMessageRef & { meta: WorkspaceSessionMeta }): Promise<void>
  getLatestPlan(params: AgentSessionMessageRef): Promise<WorkspacePlanRecord | null>
  savePlan(params: AgentSessionMessageRef & {
    draft: Omit<WorkspacePlanRecord, 'planId' | 'version' | 'status' | 'createdAt' | 'updatedAt'>
  }): Promise<WorkspacePlanRecord>
  decidePlan(params: AgentSessionMessageRef & {
    decision: 'approve' | 'revise'
    planId?: string
  }): Promise<{ session: AgentSessionMeta; plan: WorkspacePlanRecord }>
  createInteraction(params: AgentSessionMessageRef & {
    runId: string
    kind: AgentSessionInteractionRecord['kind']
    payload: AgentSessionInteractionRecord['payload']
  }): Promise<AgentSessionInteractionRecord>
  getInteraction(params: AgentSessionMessageRef & {
    interactionId: string
  }): Promise<AgentSessionInteractionRecord | null>
  listInteractions(params: AgentSessionMessageRef & {
    statuses?: AgentSessionInteractionStatus[]
  }): Promise<AgentSessionInteractionRecord[]>
  resolveInteraction(params: AgentSessionMessageRef & {
    interactionId: string
    status: Extract<AgentSessionInteractionStatus, 'answered' | 'rejected'>
    answer?: AgentSessionInteractionRecord['answer']
    continuationContext?: AgentSessionInteractionRecord['continuationContext']
  }): Promise<AgentSessionInteractionRecord>
}
