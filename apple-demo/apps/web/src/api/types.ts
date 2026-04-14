export type {
  AuthMode,
  AuthRole,
  AuthSession,
  AuthUser,
  AuthenticatedPayload,
  LogoutPayload,
  OAuthLoginStartPayload,
  PaginatedPayload
} from '@apple-demo/shared'

export interface UserAdminIdentity {
  identityId: number
  userId: number
  providerCode: string
  externalUserUuid: string
  loginName: string | null
  email: string | null
  rawUserinfoJson: string | null
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export interface UserAdminRole {
  roleId: number
  roleKey: string
  roleNameCn: string
  roleNameEn: string
  roleDesc: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface UserAdminUser {
  userId: number
  userCode: string
  userAccount: string
  displayName: string
  email: string | null
  phone: string | null
  avatarUrl: string | null
  status: 'active' | 'disabled'
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
  isDeleted: boolean
  roles: UserAdminRole[]
  identities: UserAdminIdentity[]
}

interface SkillMetadataMirror {
  whenToUse?: string
  inputExample?: string
  outputExample?: string
  allowedTools?: string[]
  userInvocable?: boolean
  disableModelInvocation?: boolean
  model?: string
  effort?: string
  context?: string
}

export interface AgentCatalogSkill extends SkillMetadataMirror {
  id: string
  name: string
  description: string
  starterSummary?: string
  lifecycle?: 'draft' | 'published'
  intentGroup?: 'planning' | 'configuration-authoring' | 'verification'
  starterEnabled?: boolean
  starterPriority?: number
}

export type ManagedSkillLifecycle = 'draft' | 'published'
export type ManagedSkillIntentGroup =
  | 'planning'
  | 'configuration-authoring'
  | 'verification'
export type ManagedSkillIntentGroupValue = ManagedSkillIntentGroup | (string & {})

export interface ManagedSkillAgentBinding {
  agentId: string
}

export interface ManagedSkillRecord extends SkillMetadataMirror {
  skillId: string
  canonicalName: string
  canonicalDescription: string
  displayName: string
  displayDescription: string
  starterSummary?: string
  ownerAgentId: string
  sourceAgentId: string
  sourcePath: string
  lifecycle: ManagedSkillLifecycle
  intentGroup?: ManagedSkillIntentGroupValue
  starterEnabled: boolean
  starterPriority: number
  agentBindings: ManagedSkillAgentBinding[]
  importedAt: number
  updatedAt: number
}

export interface SkillUploadValidationIssue {
  code: string
  message: string
  path?: string
  field?: string
}

export interface SkillUploadConflict {
  reason: 'id' | 'name'
  skillId: string
  canonicalName: string
  lifecycle: ManagedSkillLifecycle
  boundAgents: string[]
}

export interface UploadManagedSkillResult {
  replaced: boolean
  skill: ManagedSkillRecord
}

export interface AgentCatalogSummary {
  id: string
  name: string
  description: string
  version: string
  skillCount: number
}

export interface AgentPresentation {
  title: string
  summary: string
  role: string
  capabilities: string[]
}

export interface AgentRuntimeInfo {
  provider?: string
  modelName?: string
  apiEndpoint?: string
  maxTokens?: number
  stream?: boolean
  hasApiKey?: boolean
  hasCustomHeaders?: boolean
  source?: 'agent' | 'default' | 'active'
}

export interface AgentCatalogDetail extends AgentCatalogSummary {
  presentation?: AgentPresentation
  runtime: AgentRuntimeInfo
  skills: AgentCatalogSkill[]
}

export interface AdminSkillsListPayload {
  skills: ManagedSkillRecord[]
  agents: AgentCatalogSummary[]
}

export interface ManagedSkillUpdateRequest {
  displayName?: string
  displayDescription?: string
  starterSummary?: string
  lifecycle?: ManagedSkillLifecycle
  intentGroup?: ManagedSkillIntentGroup | null
  starterEnabled?: boolean
  starterPriority?: number
  agentBindings?: ManagedSkillAgentBinding[]
}

export interface GatewayToolManifest {
  id: string
  server: string
  name: string
  description: string
  tags?: string[]
}

export interface RuntimeBootstrapPayload {
  agent: AgentCatalogDetail
  workspaceAgent: {
    plannerEnabled: boolean
    defaultPrimaryAgent: 'plan' | 'build'
  }
  workspaceOccupancy: {
    occupied: boolean
    state: 'idle' | 'running' | 'stop-pending' | 'awaiting-question'
    ownerSessionId: string | null
    runId: string | null
  }
  toolDisplayNames: Record<string, string>
  gateway: {
    configSource: string
    tools: GatewayToolManifest[]
  }
  configVersion?: string
  configChecksum?: string
}

export interface WorkspacePlanSnapshot {
  planId: string
  version: number
  status: 'draft' | 'awaiting_approval' | 'approved' | 'superseded'
  title: string
  summary: string
  filePath: string
  approvedSkillIds: string[]
}

export interface AgentPlanRecord extends WorkspacePlanSnapshot {
  goal?: string
  steps: string[]
  risks: string[]
  openQuestions: string[]
}

export interface AgentSessionListItem {
  userId: number
  agentId: string
  sessionId: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
  preview: string
  activity: {
    active: boolean
    state: 'idle' | 'running' | 'stop-pending' | 'awaiting-question'
    runId: string | null
  }
  activePrimaryAgent: 'plan' | 'build'
  planState: WorkspacePlanSnapshot | null
}

export interface AgentSessionUsageSummary {
  userId: number
  agentId: string
  sessionId: string
  totalTokens: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  assistantMessageCount: number
}

interface WorkspaceSidebarEntryBase {
  nodeId: string
  path: string
  fileName: string
  relativePath: string
  groupId: 'upload' | 'project'
  nodeType: 'file' | 'folder'
  addedAt: number
}

export interface WorkspaceSidebarFileItem extends WorkspaceSidebarEntryBase {
  nodeType: 'file'
  fileId: string
  fileKey: string
  source: 'upload' | 'project'
  writable: boolean
}

export interface WorkspaceSidebarFolderItem extends WorkspaceSidebarEntryBase {
  nodeType: 'folder'
  folderKey: string
  source: 'project'
  writable: true
}

export type WorkspaceSidebarEntry = WorkspaceSidebarFileItem | WorkspaceSidebarFolderItem

export interface WorkspaceSidebarGroup {
  id: 'upload' | 'project'
  label: string
  entries: WorkspaceSidebarEntry[]
}

export interface WorkspaceSidebarTask {
  id: string
  label: string
  groups: WorkspaceSidebarGroup[]
}

export interface AgentWorkspacePayload {
  agentId: string
  title: string
  tasks: WorkspaceSidebarTask[]
}

export interface AgentSessionMessageView {
  messageId: number
  role: 'user' | 'assistant'
  text: string
  createdAt: number
  kind: 'text' | 'protocol' | 'result' | 'tool-step'
  protocol?: ProtocolPayload
  domainResult?: SkillExecutionOutput
  protocolState?: Record<string, unknown> | null
  toolDisplayNames?: string[]
}

export interface QuestionInteractionFieldOption {
  label: string
  value: unknown
}

export interface QuestionInteractionTextField {
  id: string
  label: string
  type: 'text'
  placeholder?: string
  required?: boolean
}

export interface QuestionInteractionSelectField {
  id: string
  label: string
  type: 'select'
  placeholder?: string
  required?: boolean
  options: QuestionInteractionFieldOption[]
}

export type QuestionInteractionField =
  | QuestionInteractionTextField
  | QuestionInteractionSelectField

export interface QuestionInteractionPayload {
  questionId: string
  title: string
  prompt: string
  required: boolean
  fields: QuestionInteractionField[]
  degraded?: {
    reason: string
    referenceOptions: string[]
  }
}

export interface AgentSessionInteraction {
  interactionId: string
  runId: string
  kind: 'question'
  status: 'pending' | 'answered' | 'rejected'
  payload: QuestionInteractionPayload
  createdAt: number
  resolvedAt: number | null
}

export interface AgentRunRequest {
  runId?: string
  agentId: string
  sessionId: string
  input: string
  editContext?: {
    messageId: number
  }
  continuation?: {
    interactionId: string
  }
  invocationContext?: {
    activeFile?: {
      path: string
      fileName: string
      source: 'upload' | 'project'
      writable: boolean
    }
  }
}

export interface ProtocolAction {
  id: string
  label: string
  type: string
  tool?: string
  toolInput?: Record<string, unknown>
  disabled?: boolean
}

export interface ProtocolPayload {
  version: string
  components: Array<Record<string, unknown>>
  actions?: ProtocolAction[]
  data?: Record<string, unknown>
  meta?: Record<string, unknown>
}

export interface NoticeSkillExecutionOutput {
  kind: 'notice'
  data: {
    message: string
  }
}

export interface RowsResultSkillExecutionOutput {
  kind: 'rows_result'
  data: {
    columns: string[]
    rows: Array<Record<string, unknown>>
  }
}

export interface SheetSnapshotSkillExecutionOutput {
  kind: 'sheet_snapshot'
  data: {
    sheetName: string
    columns: string[]
    rows: Array<Record<string, unknown>>
  }
}

export interface ArtifactRefSkillExecutionOutput {
  kind: 'artifact_ref'
  data: Record<string, unknown>
}

export type SkillExecutionOutput =
  | NoticeSkillExecutionOutput
  | RowsResultSkillExecutionOutput
  | SheetSnapshotSkillExecutionOutput
  | ArtifactRefSkillExecutionOutput

export interface AgentRunOutput {
  kind: 'text' | 'protocol' | 'domain-result' | 'awaiting-interaction'
  text: string
  protocol?: ProtocolPayload
  domainResult?: SkillExecutionOutput
  interaction?: AgentSessionInteraction
}

export type RuntimeErrorCode = 'MODEL' | 'CANCELLED' | 'INTERNAL'
export type RuntimeErrorStage = 'prepare' | 'model' | 'tool' | 'persist' | 'finalize'
export type ToolStopReason =
  | 'tool_terminal'
  | 'model_recovery_exhausted'
  | 'no_progress_same_failure'
  | 'no_progress_same_outcome'
  | 'tool_denied'
export type ToolRetryHint = 'retry' | 'correct_input' | 'do_not_retry'

export interface RuntimeError {
  code: RuntimeErrorCode
  stage: RuntimeErrorStage
  retryable: boolean
  userMessage: string
  runId?: string
  detail?: string
  failureKind?: 'transport' | 'http' | 'timeout' | 'timeout_first_byte' | 'timeout_idle' | 'protocol' | 'stream_interrupted'
  provider?: string
  requestUrl?: string
  modelDiagnostics?: object
  status?: number
  toolCallId?: string
  turnId?: string
  toolName?: string
  stopReason?: ToolStopReason
  normalizedCode?: string
  chainKey?: string
  attempt?: number
  remainingRecoveryBudget?: number
  runtimeRetryCount?: number
  threshold?: number
  denyOrigin?: string
}

export interface RunMetrics {
  model?: {
    provider: string
    modelName: string
    latencyMs: number
    inputTokens: number
    outputTokens: number
    totalTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
    finishReason: string | null
  }
  tools: Array<{
    provider: string
    tool: string
    latencyMs: number
    success: boolean
    toolCallId?: string
  }>
  totalLatencyMs: number
  failures: Array<{
    stage: RuntimeErrorStage
    provider?: string
    toolCallId?: string
    message: string
  }>
}

export interface AgentRunResult {
  runId: string
  sessionId: string
  agentId: string
  assistantMessageId?: number
  output: AgentRunOutput
  text: string
  continuationOfInteractionId?: string
  skillTriggered?: string
  skillMode?: 'forced' | 'implicit' | 'none'
  skillExecutionMode?: 'script' | 'llm'
  error?: string
  runtimeError?: RuntimeError
  metrics?: RunMetrics
  completedAt: number
}

export interface AgentRunCancelResponse {
  ok: true
  runId: string
  cancelled: boolean
}

export type AgentStreamEvent =
  | { type: 'lifecycle.start'; runId: string; agentId: string; sessionId: string; startedAt: number }
  | { type: 'lifecycle.queued'; runId: string; agentId: string; sessionId: string; queuedAt: number; message?: string }
  | { type: 'assistant.delta'; runId: string; delta: string }
  | { type: 'assistant.final'; runId: string; text: string }
  | { type: 'lifecycle.error'; runId: string; endedAt: number; error: string; runtimeError?: RuntimeError }
  | { type: 'metrics.run'; runId: string; metrics: RunMetrics }
  | {
      type: 'tool.started'
      runId: string
      agentId: string
      sessionId: string
      toolCallId: string
      tool: string
      displayName: string
      toolKind: 'skill' | 'tool'
      startedAt: number
    }
  | {
      type: 'tool.failed'
      runId: string
      agentId: string
      sessionId: string
      toolCallId: string
      tool: string
      displayName: string
      toolKind: 'skill' | 'tool'
      startedAt: number
      failedAt: number
      statusMessage: string
      recoveryMode: 'retrying' | 'recovering'
      normalizedCode?: string
      stopReason?: ToolStopReason
      retryHint?: ToolRetryHint
      chainKey?: string
      attempt?: number
      remainingRecoveryBudget?: number
      runtimeRetryCount?: number
      threshold?: number
    }
  | {
      type: 'context.log'
      runId: string
      agentId: string
      sessionId: string
      loggedAt: number
      level: 'info' | 'warn' | 'error'
      message: string
      data?: Record<string, unknown>
    }
  | { type: 'plan.awaiting_decision'; runId: string; agentId: string; sessionId: string; planId: string; version: number }
  | {
      type: 'plan.snapshot'
      runId: string
      agentId: string
      sessionId: string
      plan: AgentPlanRecord
    }
  | {
      type: 'plan.delegation'
      runId: string
      agentId: string
      sessionId: string
      subagent: 'explore' | 'general'
      status: 'completed'
      data: Record<string, unknown>
    }
  | {
      type: 'agent.handoff'
      runId: string
      agentId: string
      sessionId: string
      from: 'build' | 'plan'
      to: 'build' | 'plan'
      reason: string
      plan?: AgentPlanRecord | null
    }
  | {
      type: 'run.completed'
      runId: string
      status: 'success' | 'awaiting-interaction' | 'error' | 'cancelled'
      result: AgentRunResult
      endedAt: number
      error?: { code: RuntimeErrorCode; message: string; runtimeError?: RuntimeError }
    }

export interface UploadedFile {
  fileKey: string
  originalName: string
  path: string
  source: 'upload'
  writable: true
  replaced: boolean
}

export interface DecidePlanResponse {
  session: AgentSessionListItem
  plan: AgentPlanRecord
}

export interface ClearHistorySessionsResponse {
  deletedCount: number
  excludedSessionId: string | null
  skippedActiveSessionIds: string[]
}

export type WorkspaceEditorMode = 'text' | 'markdown' | 'csv' | 'mml'

export interface WorkspaceMmlMetadata {
  networkType: string
  networkVersion: string
}

export interface MmlTypeVersionOptions {
  networkTypes: string[]
  networkVersionsByType: Record<string, string[]>
}

export type MmlSchemaValueType = 'string' | 'number' | 'enum' | 'token'
export type MmlSchemaControlType = 'text' | 'select' | 'composite'
export type MmlSchemaRequiredMode = 'required' | 'optional' | 'conditional_required' | 'conditional_optional'
export type MmlSchemaValueFormat =
  | 'string'
  | 'integer'
  | 'ipv4'
  | 'ipv6'
  | 'enum'
  | 'password'
  | 'composite_flag_set'
  | 'token'

export interface MmlSchemaConditionRule {
  expression: string
  sourceParamId: number | null
  operator: '='
  expectedValue: string
  requiredMode: 'required' | 'optional'
}

export interface MmlSchemaNumberConstraints {
  minValue: number | null
  maxValue: number | null
  interval: string | null
}

export interface MmlSchemaLengthConstraints {
  minLength: number | null
  maxLength: number | null
  exactLength: number | null
}

export interface MmlSchemaParameter {
  paramName: string
  label: string
  valueType: MmlSchemaValueType
  controlType: MmlSchemaControlType
  required: boolean
  requiredMode?: MmlSchemaRequiredMode
  orderParamId: number
  enumValues: string[]
  defaultValue: string | null
  editable: boolean
  valueFormat?: MmlSchemaValueFormat
  conditions?: MmlSchemaConditionRule[]
  compositeFlagSetOptions?: string[]
  numberConstraints?: MmlSchemaNumberConstraints | null
  lengthConstraints?: MmlSchemaLengthConstraints | null
  caseSensitive?: boolean
  source?: Record<string, unknown>
}

export interface MmlSchemaCommand {
  commandName: string
  params: MmlSchemaParameter[]
}

export interface MmlSchemaResponse {
  networkType: string
  networkVersion: string
  commands: MmlSchemaCommand[]
}

export interface WorkspaceFileDescriptor {
  fileKey: string
  fileId: string
  fileName: string
  path: string
  source: 'upload' | 'project'
  writable: boolean
  mode: WorkspaceEditorMode
  content: string
  mmlMetadata: WorkspaceMmlMetadata | null
}

export interface ProjectFolderDescriptor {
  nodeId: string
  folderKey: string
  fileName: string
  relativePath: string
  path: string
  source: 'project'
  groupId: 'project'
  nodeType: 'folder'
  writable: true
  addedAt: number
}
