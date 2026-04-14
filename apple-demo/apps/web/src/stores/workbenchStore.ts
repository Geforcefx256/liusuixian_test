import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { agentApi } from '@/api/agentApi'
import starterGroupMeta from '../config/starterGroups.json'
import {
  resolveAssistantTextPresentation,
  type AssistantTextDisplayMode
} from './assistantTextPresentation'
import type {
  AgentWorkspacePayload,
  AgentCatalogDetail,
  AgentCatalogSkill,
  AgentCatalogSummary,
  AgentRunResult,
  AgentRunRequest,
  AgentSessionInteraction,
  AgentSessionListItem,
  AgentSessionMessageView,
  AgentSessionUsageSummary,
  AgentStreamEvent,
  DecidePlanResponse,
  ProtocolAction,
  ProtocolPayload,
  RuntimeBootstrapPayload,
  RuntimeError,
  SkillExecutionOutput,
  ProjectFolderDescriptor,
  WorkspaceEditorMode,
  WorkspaceSidebarEntry,
  WorkspaceSidebarFolderItem,
  WorkspaceFileDescriptor,
  WorkspaceMmlMetadata,
  WorkspaceSidebarFileItem
} from '@/api/types'
import {
  buildComposerUploadError,
  splitComposerUploadFiles
} from '@/components/workbench/composerUpload'
import {
  buildSessionAuthoritySnapshot,
  hasNewAuthoritativeSessionState,
  type SessionAuthoritySnapshot
} from './sessionAuthority'
import {
  buildConvergedProtocolMessage,
  buildProtocolActionContext,
  buildRedirectedProtocolMessage,
  getRenderedProtocolPayload,
  getWorkbookCompatibilityMessage,
  isEditablePersistedUserText,
  normalizeProtocolState,
  resolveProtocolPlaceholders,
  summarizeQuestionResponseAnswer,
  type ProtocolMessageState,
  validateQuestionResponse,
  withProtocolValidationErrors
} from '@/components/workbench/protocolRuntime'
import {
  buildResolvedQuestionInteractionLookup,
  EMPTY_RESOLVED_QUESTION_INTERACTION_LOOKUP,
  rewritePersistedQuestionResponseText,
  type PersistedQuestionRewriteResult,
  type ResolvedQuestionInteractionLookup
} from '@/components/workbench/questionHistorySummary'
import { buildWorkspaceRenameTarget } from './workspaceRename'

const FIRST_SESSION_INDEX = 0

interface InitializeOptions {
  autoOpenFirstSession?: boolean
}

interface UiMessageBase {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt: number
  status: 'done' | 'streaming' | 'error'
  messageId?: number
  editable?: boolean
  assistantHeader?: UiAssistantHeader | null
}

export interface UiAssistantHeader {
  label: string
  tone: 'progress' | 'summary' | 'error'
  liveMode?: 'polite' | 'assertive'
}

export interface UiTextMessage extends UiMessageBase {
  kind: 'text'
  readingModeEligible: boolean
  displayMode: AssistantTextDisplayMode
}

type UiTextMessageInput = Omit<UiTextMessage, 'readingModeEligible' | 'displayMode'>

export interface UiProtocolMessage extends UiMessageBase {
  kind: 'protocol'
  protocol: ProtocolPayload
  protocolState: Record<string, unknown> | null
}

export interface UiResultMessage extends UiMessageBase {
  kind: 'result'
  result: SkillExecutionOutput
}

export interface UiToolStepMessage extends UiMessageBase {
  role: 'assistant'
  kind: 'tool-step'
  status: 'done'
  toolDisplayNames: string[]
}

export interface UiErrorMessage extends UiMessageBase {
  kind: 'error'
  runtimeError: RuntimeError | null
}

export interface UiQuestionMessage extends UiMessageBase {
  role: 'assistant'
  kind: 'question'
  status: 'done'
  interaction: AgentSessionInteraction
}

export type UiMessage =
  | UiTextMessage
  | UiProtocolMessage
  | UiResultMessage
  | UiToolStepMessage
  | UiErrorMessage
  | UiQuestionMessage

export interface StarterSkillView extends AgentCatalogSkill {
  governedTitleText: string
  governedDescriptionText: string
  starterPrompt: string
  starterSummaryText: string
}

export interface StarterGroupView {
  id: 'planning' | 'configuration-authoring' | 'verification'
  title: string
  subtitle: string
  icon: string
  discoveryQuery: string
  emptyTitle: string
  emptyDescription: string
  previewSkills: StarterSkillView[]
}

export type StarterGroupId = StarterGroupView['id']

export interface WorkspaceEditorFileState extends WorkspaceFileDescriptor {
  isDirty: boolean
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  saveError: string | null
}

export interface EditRerunTarget {
  messageId: number
  text: string
}

interface SessionViewState {
  messages: UiMessage[]
  composerDraft: string
  pendingInteraction: AgentSessionInteraction | null
  resolvedQuestionInteractionLookup: ResolvedQuestionInteractionLookup
  latestStatus: string
  latestPlanSummary: string
}

interface ActiveRunState {
  runId: string | null
  sessionId: string
  assistantMessageId: string | null
  stopRequested: boolean
  authoritySnapshot: SessionAuthoritySnapshot | null
}

interface SessionActivityViewState {
  active: boolean
  state: RuntimeBootstrapPayload['workspaceOccupancy']['state']
  runId: string | null
}

interface WorkspaceOccupancyViewState {
  occupied: boolean
  state: RuntimeBootstrapPayload['workspaceOccupancy']['state']
  ownerSessionId: string | null
  runId: string | null
}

export interface UploadConflictConfirmationView {
  conflictPath: string
  fileName: string
}

interface PendingUploadConflictState extends UploadConflictConfirmationView {
  agentId: string
  file: File
  relativePath?: string
}

interface LocalRunContext {
  assistantMessageId: string
  sessionId: string
  authoritySnapshot: SessionAuthoritySnapshot
  terminalStatus: 'success' | 'awaiting-interaction' | 'error' | 'cancelled' | null
}

function createClientRunId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `run-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

interface DeletedSessionRollbackState {
  session: AgentSessionListItem
  index: number
  state: SessionViewState | null
  hydrationGeneration: number | null
  activity: SessionActivityViewState | null
  run: ActiveRunState | null
  wasActive: boolean
}

interface SessionUsageState {
  loading: boolean
  summary: AgentSessionUsageSummary | null
  error: string | null
}

export type WorkspaceSidebarTab = 'workspace' | 'templates'

const DEFAULT_WORKSPACE_STATUS = '准备就绪'
const MAX_SUMMARY_TOOL_NAMES = 2
const MAX_STARTER_PREVIEW_SKILLS = 3
const TOOL_SUMMARY_SEPARATOR = ' · '
const SKILL_TOOL_NAME = 'skill:skill'
const QUESTION_TOOL_NAME = 'local:question'
const THINKING_ASSISTANT_HEADER = createAssistantHeader('思考中', 'progress')
const QUEUED_ASSISTANT_HEADER = createAssistantHeader('排队中', 'progress')
const GENERATING_ASSISTANT_HEADER = createAssistantHeader('正在生成回复', 'progress')
const WAITING_CONFIRMATION_ASSISTANT_HEADER = createAssistantHeader('等待你确认', 'summary')
const ANSWERED_ASSISTANT_HEADER = createAssistantHeader('已回答', 'summary')
const RESULT_READY_ASSISTANT_HEADER = createAssistantHeader('生成结果', 'summary')
const DIRECT_RESPONSE_ASSISTANT_HEADER = createAssistantHeader('直接回答', 'summary')
const STOPPED_ASSISTANT_HEADER = createAssistantHeader('已停止', 'summary')
const REJECTED_QUESTION_ENDED_ASSISTANT_HEADER = createAssistantHeader('任务已结束', 'summary')
const FAILED_ASSISTANT_HEADER = createAssistantHeader('执行失败', 'error')
const PENDING_INTERACTION_BLOCKED_CODE = 'PENDING_INTERACTION_BLOCKED'
const PENDING_INTERACTION_BLOCKED_MESSAGE = '当前会话正在等待问题回答，请先提交或拒绝该问题。'
const REJECTED_QUESTION_ENDED_MESSAGE = '你已跳过当前问题，当前任务已结束。你可以继续发送新消息。'
const SESSION_INTERACTION_STATUSES: Array<'pending' | 'answered' | 'rejected'> = [
  'pending',
  'answered',
  'rejected'
]
const IDLE_WORKSPACE_OCCUPANCY: WorkspaceOccupancyViewState = {
  occupied: false,
  state: 'idle',
  ownerSessionId: null,
  runId: null
}
const IDLE_SESSION_ACTIVITY: SessionActivityViewState = {
  active: false,
  state: 'idle',
  runId: null
}
const STARTER_GROUP_META =
  starterGroupMeta as Array<Omit<StarterGroupView, 'skill' | 'previewSkills'>>

function createAssistantHeader(
  label: string,
  tone: UiAssistantHeader['tone'],
  options: { liveMode?: UiAssistantHeader['liveMode'] } = {}
): UiAssistantHeader {
  return {
    label,
    tone,
    ...(options.liveMode ? { liveMode: options.liveMode } : {})
  }
}

function buildAssistantHeaderField(
  role: UiMessageBase['role'],
  assistantHeader?: UiAssistantHeader | null
): { assistantHeader?: UiAssistantHeader } {
  return role === 'assistant' && assistantHeader ? { assistantHeader } : {}
}

function buildPersistedMessageBase(
  message: AgentSessionMessageView,
  text: string,
  options: {
    assistantHeader?: UiAssistantHeader | null
    editable?: boolean
  } = {}
) {
  return {
    id: `persisted-${message.messageId}`,
    messageId: message.messageId,
    role: message.role,
    text,
    createdAt: message.createdAt,
    status: 'done' as const,
    ...(typeof options.editable === 'boolean' ? { editable: options.editable } : {}),
    ...buildAssistantHeaderField(message.role, options.assistantHeader)
  }
}

function normalizeToolDisplayName(tool: string): string {
  const segments = tool
    .split(':')
    .map(segment => segment.trim())
    .filter(Boolean)
  if (segments.length <= 1) {
    return tool.trim()
  }
  return segments.slice(1).join(':')
}

function resolveToolDisplayName(
  tool: string,
  toolDisplayNames?: Record<string, string>
): string {
  const normalizedTool = tool.trim()
  const configuredDisplayName = toolDisplayNames?.[normalizedTool]?.trim()
  return configuredDisplayName || normalizeToolDisplayName(normalizedTool)
}

function collectToolSummaryNames(
  result: AgentRunResult,
  toolDisplayNames?: Record<string, string>,
  options: { excludeSkillTool?: boolean; excludeQuestionTool?: boolean } = {}
): string[] {
  const names = new Set<string>()
  for (const metric of result.metrics?.tools || []) {
    const toolName = metric.tool.trim()
    if (options.excludeSkillTool && toolName === SKILL_TOOL_NAME) {
      continue
    }
    if (options.excludeQuestionTool && toolName === QUESTION_TOOL_NAME) {
      continue
    }
    if (toolName) {
      names.add(resolveToolDisplayName(toolName, toolDisplayNames))
    }
  }
  return [...names]
}

function buildToolSummaryLabel(
  result: AgentRunResult,
  toolDisplayNames?: Record<string, string>,
  options: { excludeSkillTool?: boolean; excludeQuestionTool?: boolean } = {}
): string | null {
  const toolNames = collectToolSummaryNames(result, toolDisplayNames, options)
  if (!toolNames.length) return null

  const visibleTools = toolNames.slice(0, MAX_SUMMARY_TOOL_NAMES)
  const suffix = toolNames.length > MAX_SUMMARY_TOOL_NAMES ? ' 等' : ''
  return `使用 Tools: ${visibleTools.join(', ')}${suffix}`
}

function buildExecutionSummaryLabel(
  result: AgentRunResult,
  toolDisplayNames?: Record<string, string>,
  skills?: readonly AgentCatalogSkill[]
): string | null {
  const segments: string[] = []
  const skillId = resolveTriggeredSkillSummaryName(result, skills)
  const excludesQuestionTool = shouldExcludeQuestionToolFromSummary(result)
  if (skillId) {
    segments.push(`使用 Skill: ${skillId}`)
  }
  const toolSummary = buildToolSummaryLabel(result, toolDisplayNames, {
    excludeSkillTool: Boolean(skillId),
    excludeQuestionTool: excludesQuestionTool
  })
  if (toolSummary) {
    segments.push(toolSummary)
  }
  return segments.join(TOOL_SUMMARY_SEPARATOR) || null
}

function shouldExcludeQuestionToolFromSummary(result: AgentRunResult): boolean {
  return result.output.kind === 'protocol' || result.output.kind === 'awaiting-interaction'
}

function resolveTriggeredSkillSummaryName(
  result: AgentRunResult,
  skills?: readonly AgentCatalogSkill[]
): string {
  const skillName = result.skillTriggered?.trim() || ''
  if (!skillName) return ''
  const governedSkillName = skills?.find(skill => skill.id === skillName)?.name?.trim()
  return governedSkillName || skillName
}

function buildOutcomeSummaryLabel(result: AgentRunResult): string | null {
  if (result.output.kind === 'protocol') {
    return WAITING_CONFIRMATION_ASSISTANT_HEADER.label
  }
  if (result.output.kind === 'awaiting-interaction') {
    return WAITING_CONFIRMATION_ASSISTANT_HEADER.label
  }
  if (result.output.kind === 'domain-result') {
    return RESULT_READY_ASSISTANT_HEADER.label
  }
  return null
}

function buildToolStartedAssistantHeader(
  event: Extract<AgentStreamEvent, { type: 'tool.started' }>
): UiAssistantHeader {
  const label = event.toolKind === 'skill'
    ? `正在调用 Skill: ${event.displayName}`
    : `正在调用 Tool: ${event.displayName}`
  return createAssistantHeader(label, 'progress')
}

function buildToolFailureAssistantHeader(
  event: Extract<AgentStreamEvent, { type: 'tool.failed' }>
): UiAssistantHeader {
  return createAssistantHeader(event.statusMessage, 'progress', {
    liveMode: 'polite'
  })
}

function buildFailedAssistantHeader(runtimeError?: RuntimeError | null): UiAssistantHeader {
  if (runtimeError?.stage === 'tool') {
    return createAssistantHeader('工具执行失败', 'error')
  }
  return FAILED_ASSISTANT_HEADER
}

function buildRuntimeErrorConversationStatus(runtimeError?: RuntimeError | null): string {
  if (runtimeError?.stage === 'tool') {
    return '工具执行失败'
  }
  if (runtimeError?.stage === 'model') {
    return '模型请求失败'
  }
  return '运行时错误'
}

function buildCompletedAssistantHeader(
  result: AgentRunResult,
  toolDisplayNames?: Record<string, string>,
  skills?: readonly AgentCatalogSkill[]
): UiAssistantHeader {
  if (result.runtimeError || result.error) {
    return buildFailedAssistantHeader(result.runtimeError)
  }
  const executionSummary = buildExecutionSummaryLabel(result, toolDisplayNames, skills)
  const outcomeSummary = buildOutcomeSummaryLabel(result)
  if (executionSummary && outcomeSummary) {
    return createAssistantHeader(`${executionSummary}${TOOL_SUMMARY_SEPARATOR}${outcomeSummary}`, 'summary')
  }
  if (executionSummary) {
    return createAssistantHeader(executionSummary, 'summary')
  }
  if (outcomeSummary) {
    return createAssistantHeader(outcomeSummary, 'summary')
  }
  return DIRECT_RESPONSE_ASSISTANT_HEADER
}

function isPersistedMessageId(messageId: number | undefined): messageId is number {
  return typeof messageId === 'number' && Number.isFinite(messageId) && messageId > 0
}

function isEditableUserUiMessage(message: UiMessage): message is UiTextMessage & { role: 'user'; messageId: number } {
  return message.kind === 'text'
    && message.role === 'user'
    && message.editable !== false
    && isPersistedMessageId(message.messageId)
    && isEditablePersistedUserText(message.text)
}

function applyAssistantTextPresentation(
  message: UiTextMessageInput,
  override: AssistantTextDisplayMode | null = null
): UiTextMessage {
  return {
    ...message,
    ...resolveAssistantTextPresentation(message, override)
  }
}

function mapPersistedMessage(
  message: AgentSessionMessageView,
  resolvedQuestionLookup: ResolvedQuestionInteractionLookup,
  assistantHeader?: UiAssistantHeader | null,
  textViewOverride: AssistantTextDisplayMode | null = null
): UiMessage | null {
  const questionRewrite = resolvePersistedQuestionRewrite(message, resolvedQuestionLookup)
  if (shouldHidePersistedMessage(message, questionRewrite)) {
    return null
  }
  const displayText = getDisplayTextForMessage(message, questionRewrite)
  const baseOptions = {
    assistantHeader,
    ...(questionRewrite ? { editable: questionRewrite.editable } : {})
  }

  if (message.kind === 'protocol' && message.protocol) {
    return {
      ...buildPersistedMessageBase(message, displayText, baseOptions),
      kind: 'protocol',
      protocol: getRenderedProtocolPayload(message.protocol, message.protocolState),
      protocolState: message.protocolState || null
    }
  }

  if (message.kind === 'result' && message.domainResult) {
    return {
      ...buildPersistedMessageBase(message, displayText, baseOptions),
      kind: 'result',
      result: message.domainResult
    }
  }

  if (message.kind === 'tool-step') {
    return {
      ...buildPersistedMessageBase(message, '', baseOptions),
      role: 'assistant',
      kind: 'tool-step',
      status: 'done',
      toolDisplayNames: message.toolDisplayNames || []
    }
  }

  return {
    ...buildPersistedMessageBase(message, displayText, baseOptions),
    kind: 'text',
    ...resolveAssistantTextPresentation({
      role: message.role,
      kind: 'text',
      status: 'done',
      text: displayText
    }, textViewOverride)
  }
}

function resolvePersistedQuestionRewrite(
  message: Pick<AgentSessionMessageView, 'role' | 'text'>,
  resolvedQuestionLookup: ResolvedQuestionInteractionLookup
): PersistedQuestionRewriteResult | null {
  if (message.role !== 'user') {
    return null
  }
  return rewritePersistedQuestionResponseText(message.text, resolvedQuestionLookup)
}

function getDisplayTextForMessage(
  message: Pick<AgentSessionMessageView, 'text'>,
  questionRewrite: PersistedQuestionRewriteResult | null
): string {
  return questionRewrite?.text || message.text
}

function shouldHidePersistedMessage(
  message: AgentSessionMessageView,
  questionRewrite: PersistedQuestionRewriteResult | null
): boolean {
  if (questionRewrite?.shouldHideOriginal) {
    return true
  }
  if (message.kind !== 'protocol' || !message.protocol) {
    return false
  }
  return (message.protocol.actions || []).some(action => action.tool === 'question_response')
}

function createLocalTextMessage(params: {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt: number
  status: UiMessage['status']
  assistantHeader?: UiAssistantHeader | null
}): UiTextMessage {
  return applyAssistantTextPresentation({
    kind: 'text',
    id: params.id,
    role: params.role,
    text: params.text,
    createdAt: params.createdAt,
    status: params.status,
    ...buildAssistantHeaderField(params.role, params.assistantHeader)
  })
}

function createLocalErrorMessage(params: {
  id: string
  role: 'assistant'
  text: string
  createdAt: number
  messageId?: number
  runtimeError?: RuntimeError | null
  assistantHeader?: UiAssistantHeader | null
}): UiErrorMessage {
  return {
    kind: 'error',
    id: params.id,
    role: params.role,
    text: params.text,
    createdAt: params.createdAt,
    messageId: params.messageId,
    status: 'error',
    runtimeError: params.runtimeError || null,
    ...buildAssistantHeaderField(params.role, params.assistantHeader)
  }
}

function buildQuestionMessage(interaction: AgentSessionInteraction): UiQuestionMessage {
  return {
    id: interaction.interactionId,
    role: 'assistant',
    kind: 'question',
    text: interaction.payload.prompt,
    createdAt: interaction.createdAt,
    status: 'done',
    interaction
  }
}

function removeQuestionMessage(messages: UiMessage[], interactionId: string | null): UiMessage[] {
  if (!interactionId) {
    return messages
  }
  return messages.filter(message => message.id !== interactionId)
}

function appendPendingQuestionMessage(
  messages: UiMessage[],
  interaction: AgentSessionInteraction | null
): UiMessage[] {
  if (!interaction) {
    return messages
  }
  return [...removeQuestionMessage(messages, interaction.interactionId), buildQuestionMessage(interaction)]
}

function isCancelledRuntimeError(runtimeError: RuntimeError | null | undefined): boolean {
  return runtimeError?.code === 'CANCELLED'
}

function buildSkillPrompt(skill: AgentCatalogDetail['skills'][number]): string {
  if (skill.inputExample) {
    return `请帮我处理这个任务：${skill.inputExample}`
  }
  return `请帮我使用“${skill.name}”处理当前任务。`
}

function resolveStarterSkillSummary(skill: AgentCatalogSkill): string {
  const candidates = [
    skill.starterSummary,
    skill.description,
    skill.inputExample
  ]
  for (const candidate of candidates) {
    const text = typeof candidate === 'string' ? candidate.trim() : ''
    if (text) return text
  }
  return '使用该技能开始处理任务。'
}

function buildSkillSearchIndex(skill: AgentCatalogSkill): string {
  const groupKeywords = {
    planning: '方案 制作 planning',
    'configuration-authoring': '配置 生成 authoring',
    verification: '配置 核查 verification'
  } as const

  return [
    skill.id,
    skill.name,
    skill.description,
    skill.starterSummary || '',
    skill.intentGroup ? groupKeywords[skill.intentGroup] : ''
  ]
    .join(' ')
    .toLowerCase()
}

function compareStarterSkills(left: AgentCatalogSkill, right: AgentCatalogSkill): number {
  const priorityDelta = (right.starterPriority || 0) - (left.starterPriority || 0)
  if (priorityDelta !== 0) return priorityDelta
  return left.name.localeCompare(right.name, 'zh-CN')
}

function normalizeSearchQuery(value: string): string[] {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

function filterSkillsBySearchQuery(
  skills: readonly StarterSkillView[],
  searchQuery: string
): StarterSkillView[] {
  const tokens = normalizeSearchQuery(searchQuery)
  if (!tokens.length) {
    return [...skills]
  }
  return skills.filter(skill => {
    const haystack = buildSkillSearchIndex(skill)
    return tokens.every(token => haystack.includes(token))
  })
}

function isPendingInteractionBlockedError(error: unknown): error is Error & { code?: string } {
  return error instanceof Error && (error as { code?: string }).code === PENDING_INTERACTION_BLOCKED_CODE
}

function mergeWorkspaceEntries(
  existing: WorkspaceSidebarEntry[],
  incoming: WorkspaceSidebarEntry[]
): WorkspaceSidebarEntry[] {
  const byKey = new Map<string, WorkspaceSidebarEntry>()
  for (const entry of [...existing, ...incoming]) {
    const key = entry.nodeType === 'folder' ? entry.folderKey : entry.fileKey
    if (!key.trim() || !entry.fileName.trim()) continue
    byKey.set(key, entry)
  }
  return [...byKey.values()].sort((left, right) => left.addedAt - right.addedAt)
}

function buildWorkspaceEditorFileState(file: WorkspaceFileDescriptor, sidebarFileId = file.fileId): WorkspaceEditorFileState {
  return {
    ...file,
    fileId: sidebarFileId,
    isDirty: false,
    saveStatus: 'idle',
    saveError: null
  }
}

function resolveWorkspaceLeafName(fileName: string): string {
  return fileName.split('/').filter(Boolean).at(-1) || fileName
}

function buildRunningActionBlockedMessage(
  actionLabel: '删除' | '重命名',
  targetType: 'file' | 'folder'
): string {
  return `当前会话正在运行，暂不支持${actionLabel}工作区${targetType === 'folder' ? '文件夹' : '文件'}。`
}

function buildClearHistoryStatus(deletedCount: number, skippedActiveCount = 0): string {
  if (skippedActiveCount > 0) {
    return `已清空 ${deletedCount} 条历史会话，保留 ${skippedActiveCount} 条活跃会话`
  }
  return `已清空 ${deletedCount} 条历史会话`
}

function buildDirtyActionBlockedMessage(
  actionLabel: '删除' | '重命名',
  fileName: string
): string {
  return `文件“${fileName}”有未保存修改，请先保存后再${actionLabel}。`
}

function buildDirtyFolderActionBlockedMessage(
  actionLabel: '删除' | '重命名',
  folderName: string,
  fileName: string
): string {
  return `文件夹“${folderName}”内的文件“${fileName}”有未保存修改，请先保存后再${actionLabel}。`
}

function isRelativePathWithin(relativePath: string, parentPath: string): boolean {
  return relativePath === parentPath || relativePath.startsWith(`${parentPath}/`)
}

function mergeSidebarMetadataIntoEditor(
  file: WorkspaceEditorFileState,
  sidebarFile: WorkspaceSidebarFileItem
): WorkspaceEditorFileState {
  return {
    ...file,
    fileId: sidebarFile.fileId,
    fileKey: sidebarFile.fileKey,
    fileName: sidebarFile.fileName,
    path: sidebarFile.path,
    source: sidebarFile.source,
    writable: sidebarFile.writable
  }
}

function mergeRenamedDescriptorIntoEditor(
  file: WorkspaceEditorFileState,
  descriptor: WorkspaceFileDescriptor,
  sidebarFileId: string
): WorkspaceEditorFileState {
  return {
    ...file,
    fileId: sidebarFileId,
    fileKey: descriptor.fileKey,
    fileName: descriptor.fileName,
    path: descriptor.path,
    source: descriptor.source,
    writable: descriptor.writable,
    mode: descriptor.mode,
    mmlMetadata: descriptor.mmlMetadata
  }
}

function triggerWorkspaceFileDownload(download: { blob: Blob; fileName: string }): void {
  const objectUrl = URL.createObjectURL(download.blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = download.fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

function resolveUploadRelativePath(file: File): string | undefined {
  const candidate = (file as File & { webkitRelativePath?: string }).webkitRelativePath
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : undefined
}

function resolveUploadConflictPath(
  file: File,
  relativePath: string | undefined,
  conflictPath?: string
): string {
  return conflictPath || relativePath || file.name
}

function buildUploadCompletionStatus(uploadedCount: number): string {
  return uploadedCount > 0 ? `已上传 ${uploadedCount} 个文件` : '未上传任何文件'
}

function parseMmlMetadata(content: string): WorkspaceMmlMetadata | null {
  const match = content.match(/^(\s*\/\*\s*ME TYPE=([^,\r\n*]+),\s*Version=([^*\r\n]+?)\s*\*\/)/i)
  if (!match) return null
  return {
    networkType: match[2]?.trim() || '',
    networkVersion: match[3]?.trim() || ''
  }
}

function buildWorkspacePayload(
  agentId: string,
  title: string,
  entries: WorkspaceSidebarEntry[]
): AgentWorkspacePayload {
  const merged = mergeWorkspaceEntries([], entries)
  return {
    agentId,
    title,
    tasks: [
      {
        id: `workspace-${agentId || 'unknown'}`,
        label: '工作目录',
        groups: [
          {
            id: 'upload',
            label: 'upload',
            entries: merged.filter(entry => entry.groupId === 'upload')
          },
          {
            id: 'project',
            label: 'project',
            entries: merged.filter(entry => entry.groupId === 'project')
          }
        ]
      }
    ]
  }
}

function flattenWorkspaceFiles(payload: AgentWorkspacePayload | null): WorkspaceSidebarFileItem[] {
  if (!payload) return []
  return payload.tasks.flatMap(task => task.groups.flatMap(group => group.entries))
    .filter((entry): entry is WorkspaceSidebarFileItem => entry.nodeType === 'file')
}

function upsertSessionListItem(
  sessions: AgentSessionListItem[],
  nextSession: AgentSessionListItem
): AgentSessionListItem[] {
  const filtered = sessions.filter(session => session.sessionId !== nextSession.sessionId)
  return [nextSession, ...filtered].sort((left, right) => right.updatedAt - left.updatedAt)
}

function createEmptySessionViewState(): SessionViewState {
  return {
    messages: [],
    composerDraft: '',
    pendingInteraction: null,
    resolvedQuestionInteractionLookup: EMPTY_RESOLVED_QUESTION_INTERACTION_LOOKUP,
    latestStatus: DEFAULT_WORKSPACE_STATUS,
    latestPlanSummary: ''
  }
}

function createSessionUsageState(
  summary: AgentSessionUsageSummary | null = null,
  options: {
    loading?: boolean
    error?: string | null
  } = {}
): SessionUsageState {
  return {
    loading: options.loading ?? false,
    summary,
    error: options.error ?? null
  }
}

function buildSessionUsageRevision(
  session: Pick<AgentSessionListItem, 'updatedAt' | 'messageCount'> | null | undefined
): string {
  if (!session) {
    return ''
  }
  return `${session.updatedAt}:${session.messageCount}`
}

export const useWorkbenchStore = defineStore('workbench', () => {
  const isInitializing = ref(false)
  const isUploading = ref(false)
  const error = ref<string | null>(null)
  const workspaceStatus = ref(DEFAULT_WORKSPACE_STATUS)
  const agents = ref<AgentCatalogSummary[]>([])
  const activeAgentId = ref('')
  const activeAgent = ref<AgentCatalogDetail | null>(null)
  const runtimeBootstrap = ref<RuntimeBootstrapPayload | null>(null)
  const sessions = ref<AgentSessionListItem[]>([])
  const activeSessionId = ref<string | null>(null)
  const draftMessages = ref<UiMessage[]>([])
  const blankComposerDraft = ref('')
  const sessionStateById = ref<Record<string, SessionViewState>>({})
  const sessionUsageById = ref<Record<string, SessionUsageState>>({})
  const sessionUsageRevisionById = ref<Record<string, string>>({})
  const sessionHydrationGenerationById = ref<Record<string, number>>({})
  const assistantHeaderOverlays = ref<Record<string, UiAssistantHeader>>({})
  const assistantTextViewOverrides = ref<Record<string, AssistantTextDisplayMode>>({})
  const awaitingQuestionMessageIdBySession = ref<Record<string, number>>({})
  const sessionActivityById = ref<Record<string, SessionActivityViewState>>({})
  const sessionRunById = ref<Record<string, ActiveRunState>>({})
  const deletedSessionIds = ref<Record<string, true>>({})
  const deletedSessionRollbackById = ref<Record<string, DeletedSessionRollbackState>>({})
  const editRerunTarget = ref<EditRerunTarget | null>(null)
  const agentWorkspace = ref<AgentWorkspacePayload | null>(null)
  const skillSearchQuery = ref('')
  const selectedStarterSkillId = ref<string | null>(null)
  const workspaceSidebarTab = ref<WorkspaceSidebarTab>('workspace')
  const workspaceSidebarCollapsed = ref(false)
  const selectedWorkspaceFileId = ref<string | null>(null)
  const openWorkspaceFileIds = ref<string[]>([])
  const activeWorkspaceFileId = ref<string | null>(null)
  const workspaceEditorOpen = ref(false)
  const workspaceEditorFiles = ref<Record<string, WorkspaceEditorFileState>>({})
  const pendingUploadConflict = ref<PendingUploadConflictState | null>(null)
  let initializePromise: Promise<void> | null = null
  let resolveUploadConflictDecision: ((confirmed: boolean) => void) | null = null

  const activeSession = computed(() => {
    return sessions.value.find(item => item.sessionId === activeSessionId.value) || null
  })

  const activeSessionState = computed<SessionViewState | null>(() => {
    if (!activeSessionId.value) {
      return null
    }
    return sessionStateById.value[activeSessionId.value] || createEmptySessionViewState()
  })

  const messages = computed(() => {
    return activeSessionId.value
      ? (activeSessionState.value?.messages || [])
      : draftMessages.value
  })
  const composerDraft = computed(() => {
    if (!activeSessionId.value) {
      return blankComposerDraft.value
    }
    return activeSessionState.value?.composerDraft || ''
  })
  const latestStatus = computed(() => {
    if (!activeSessionId.value) {
      return workspaceStatus.value
    }
    return readSessionState(activeSessionId.value).latestStatus
  })
  const latestPlanSummary = computed(() => {
    if (!activeSessionId.value) {
      return ''
    }
    return readSessionState(activeSessionId.value).latestPlanSummary
  })

  const visibleSkills = computed<StarterSkillView[]>(() => {
    if (!activeAgent.value) return []
    return [...activeAgent.value.skills]
      .filter(skill => skill.lifecycle !== 'draft')
      .sort(compareStarterSkills)
      .map(skill => ({
        ...skill,
        governedTitleText: skill.name,
        governedDescriptionText: skill.description,
        starterPrompt: buildSkillPrompt(skill),
        starterSummaryText: resolveStarterSkillSummary(skill)
      }))
  })

  const starterGroups = computed<StarterGroupView[]>(() => {
    return STARTER_GROUP_META.map(group => {
      const groupedSkills = visibleSkills.value
        .filter(skill => skill.intentGroup === group.id)
        .slice(0, MAX_STARTER_PREVIEW_SKILLS)

      return {
        ...group,
        previewSkills: groupedSkills
      }
    })
  })

  const searchableSkills = computed<StarterSkillView[]>(() => {
    return filterSkillsBySearchQuery(
      visibleSkills.value,
      skillSearchQuery.value
    )
  })

  const currentWorkspace = computed<AgentWorkspacePayload>(() => {
    return agentWorkspace.value || buildWorkspacePayload(
      activeAgentId.value || 'unknown-agent',
      '共享工作区',
      []
    )
  })

  const workspaceTasks = computed(() => currentWorkspace.value.tasks)
  const workspaceEntries = computed(() => currentWorkspace.value.tasks.flatMap(task => task.groups.flatMap(group => group.entries)))
  const workspaceFiles = computed(() => flattenWorkspaceFiles(currentWorkspace.value))
  const workspaceEntriesById = computed(() => {
    return new Map(workspaceEntries.value.map(entry => [entry.nodeId, entry]))
  })
  const workspaceEntriesByFileId = computed(() => {
    return new Map(
      workspaceEntries.value
        .filter((entry): entry is WorkspaceSidebarFileItem => entry.nodeType === 'file')
        .map(entry => [entry.fileId, entry])
    )
  })
  const workspaceFilesById = computed(() => {
    return new Map(workspaceFiles.value.map(file => [file.fileId, file]))
  })
  const workspaceDirtyFileIds = computed(() => {
    return Object.entries(workspaceEditorFiles.value)
      .filter(([, file]) => file.isDirty)
      .map(([fileId]) => fileId)
  })
  const workspaceOpen = computed(() => workspaceEditorOpen.value)
  const uploadConflictConfirmation = computed<UploadConflictConfirmationView | null>(() => {
    if (!pendingUploadConflict.value) {
      return null
    }
    const { conflictPath, fileName } = pendingUploadConflict.value
    return { conflictPath, fileName }
  })
  const openedWorkspaceFiles = computed(() => {
    return openWorkspaceFileIds.value
      .map(fileId => workspaceEditorFiles.value[fileId] || null)
      .filter((file): file is WorkspaceEditorFileState => Boolean(file))
  })
  const activeWorkspaceFile = computed(() => {
    return activeWorkspaceFileId.value ? workspaceEditorFiles.value[activeWorkspaceFileId.value] || null : null
  })
  const latestAssistantMessage = computed(() => {
    return [...messages.value].reverse().find(message => message.role === 'assistant') || null
  })
  const activePendingInteraction = computed(() => activeSessionState.value?.pendingInteraction || null)
  const activeSessionActivity = computed(() => readSessionActivity(activeSessionId.value))
  const activeRunState = computed(() => readSessionRunState(activeSessionId.value))
  const isRunning = computed(() => isSessionActivityRunning(activeSessionActivity.value))
  const workspaceOccupancy = computed<WorkspaceOccupancyViewState>(() => {
    if (!activeSessionId.value || !activeSessionActivity.value.active) {
      return IDLE_WORKSPACE_OCCUPANCY
    }
    return {
      occupied: true,
      state: activeSessionActivity.value.state,
      ownerSessionId: activeSessionId.value,
      runId: activeSessionActivity.value.runId
    }
  })
  const workspaceOwnerSession = computed(() => {
    return sessions.value.find(session => session.sessionId === workspaceOccupancy.value.ownerSessionId) || null
  })
  const activeRunId = computed(() => {
    return activeSessionActivity.value.runId || activeRunState.value?.runId || null
  })
  const isActiveSessionRunning = computed(() => {
    return isRunning.value
  })
  const canStopActiveRun = computed(() => {
    return Boolean(activeRunId.value && isActiveSessionRunning.value)
  })
  const isStopPending = computed(() => {
    return activeSessionActivity.value.state === 'stop-pending' || Boolean(activeRunState.value?.stopRequested)
  })
  const isSessionInputBlocked = computed(() => {
    return Boolean(activeSessionId.value && activePendingInteraction.value)
  })
  const isWorkspaceOccupiedByAnotherSession = computed(() => false)
  const sharedWorkspaceLockReason = computed(() => null)
  const composerLockReason = computed(() => null)
  const historyLockReason = computed(() => null)
  const lastEditableUserMessage = computed(() => {
    if (!activeSessionId.value) return null
    return [...(activeSessionState.value?.messages || [])].reverse().find(isEditableUserUiMessage) || null
  })
  const editableUserMessageId = computed(() => {
    if (
      !activeSessionId.value
      || isActiveSessionRunning.value
      || isSessionInputBlocked.value
    ) {
      return null
    }
    return lastEditableUserMessage.value?.messageId || null
  })

  function clearAssistantHeaderOverlays(): void {
    assistantHeaderOverlays.value = {}
    awaitingQuestionMessageIdBySession.value = {}
  }

  function setAwaitingQuestionMessageId(sessionId: string, messageId: number): void {
    awaitingQuestionMessageIdBySession.value = {
      ...awaitingQuestionMessageIdBySession.value,
      [sessionId]: messageId
    }
  }

  function consumeAwaitingQuestionMessageId(sessionId: string): number | null {
    const id = awaitingQuestionMessageIdBySession.value[sessionId]
    if (!id) return null
    const next = { ...awaitingQuestionMessageIdBySession.value }
    delete next[sessionId]
    awaitingQuestionMessageIdBySession.value = next
    return id
  }

  function clearAssistantTextViewOverrides(): void {
    assistantTextViewOverrides.value = {}
  }

  function isSessionDeletedLocally(sessionId: string | null): boolean {
    return Boolean(sessionId && deletedSessionIds.value[sessionId])
  }

  function markSessionDeletedLocally(sessionId: string): void {
    deletedSessionIds.value = {
      ...deletedSessionIds.value,
      [sessionId]: true
    }
  }

  function restoreDeletedSessionId(sessionId: string): void {
    if (!deletedSessionIds.value[sessionId]) {
      return
    }
    const nextDeletedSessionIds = { ...deletedSessionIds.value }
    delete nextDeletedSessionIds[sessionId]
    deletedSessionIds.value = nextDeletedSessionIds
  }

  function rememberDeletedSessionRollback(snapshot: DeletedSessionRollbackState): void {
    deletedSessionRollbackById.value = {
      ...deletedSessionRollbackById.value,
      [snapshot.session.sessionId]: snapshot
    }
  }

  function clearDeletedSessionRollback(sessionId: string): void {
    if (!deletedSessionRollbackById.value[sessionId]) {
      return
    }
    const nextRollbacks = { ...deletedSessionRollbackById.value }
    delete nextRollbacks[sessionId]
    deletedSessionRollbackById.value = nextRollbacks
  }

  function readSessionState(sessionId: string): SessionViewState {
    return sessionStateById.value[sessionId] || createEmptySessionViewState()
  }

  function updateSessionState(sessionId: string, updater: (state: SessionViewState) => SessionViewState): void {
    if (isSessionDeletedLocally(sessionId)) {
      return
    }
    sessionStateById.value = {
      ...sessionStateById.value,
      [sessionId]: updater(readSessionState(sessionId))
    }
  }

  function setWorkspaceStatus(status: string): void {
    workspaceStatus.value = status
  }

  function setSessionConversationStatus(sessionId: string, status: string): void {
    updateSessionState(sessionId, state => ({
      ...state,
      latestStatus: status
    }))
  }

  function setSessionPlanSummary(sessionId: string, summary: string): void {
    updateSessionState(sessionId, state => ({
      ...state,
      latestPlanSummary: summary
    }))
  }

  function setConversationStatus(status: string, sessionId: string | null = activeSessionId.value): void {
    if (!sessionId) {
      setWorkspaceStatus(status)
      return
    }
    setSessionConversationStatus(sessionId, status)
  }

  function syncSessionPlanSummary(sessionId: string): void {
    const summary = sessions.value.find(item => item.sessionId === sessionId)?.planState?.summary || ''
    setSessionPlanSummary(sessionId, summary)
  }

  function syncSessionPlanSummaries(nextSessions: AgentSessionListItem[]): void {
    for (const session of nextSessions) {
      const shouldSync = Boolean(sessionStateById.value[session.sessionId]) || Boolean(session.planState?.summary)
      if (!shouldSync) {
        continue
      }
      setSessionPlanSummary(session.sessionId, session.planState?.summary || '')
    }
  }

  function beginSessionHydration(sessionId: string): number {
    const nextGeneration = (sessionHydrationGenerationById.value[sessionId] || 0) + 1
    sessionHydrationGenerationById.value = {
      ...sessionHydrationGenerationById.value,
      [sessionId]: nextGeneration
    }
    return nextGeneration
  }

  function isLatestSessionHydration(sessionId: string, generation: number): boolean {
    return sessionHydrationGenerationById.value[sessionId] === generation
  }

  function clearSessionHydration(sessionId: string): void {
    const nextGenerations = { ...sessionHydrationGenerationById.value }
    delete nextGenerations[sessionId]
    sessionHydrationGenerationById.value = nextGenerations
  }

  function ensureSessionOpenStatus(sessionId: string): void {
    const session = sessions.value.find(item => item.sessionId === sessionId)
    const nextStatus = `已打开会话：${session?.title || '历史会话'}`
    const currentStatus = readSessionState(sessionId).latestStatus
    if (currentStatus !== DEFAULT_WORKSPACE_STATUS) {
      return
    }
    setSessionConversationStatus(sessionId, nextStatus)
  }

  function setSessionMessages(sessionId: string, nextMessages: UiMessage[]): void {
    updateSessionState(sessionId, state => ({
      ...state,
      messages: nextMessages
    }))
  }

  function setComposerDraft(value: string, sessionId: string | null = activeSessionId.value): void {
    if (!sessionId) {
      blankComposerDraft.value = value
      return
    }
    updateSessionState(sessionId, state => ({
      ...state,
      composerDraft: value
    }))
  }

  function setSessionInteractions(sessionId: string, interactions: AgentSessionInteraction[]): void {
    updateSessionState(sessionId, state => {
      const pendingInteraction = interactions.find(interaction => interaction.status === 'pending') || null
      const baseMessages = removeQuestionMessage(state.messages, state.pendingInteraction?.interactionId || null)
      return {
        ...state,
        messages: appendPendingQuestionMessage(baseMessages, pendingInteraction),
        pendingInteraction,
        resolvedQuestionInteractionLookup: buildResolvedQuestionInteractionLookup(interactions)
      }
    })
  }

  function clearSessionInteractions(sessionId = activeSessionId.value): void {
    if (!sessionId) {
      return
    }
    updateSessionState(sessionId, state => ({
      ...state,
      messages: removeQuestionMessage(state.messages, state.pendingInteraction?.interactionId || null),
      pendingInteraction: null,
      resolvedQuestionInteractionLookup: EMPTY_RESOLVED_QUESTION_INTERACTION_LOOKUP
    }))
  }

  function rememberResolvedQuestionInteraction(sessionId: string, interaction: AgentSessionInteraction): void {
    if (interaction.status !== 'answered' && interaction.status !== 'rejected') {
      return
    }
    const existing = Object.values(readSessionState(sessionId).resolvedQuestionInteractionLookup.byInteractionId)
    updateSessionState(sessionId, state => ({
      ...state,
      messages: removeQuestionMessage(state.messages, state.pendingInteraction?.interactionId || null),
      pendingInteraction: null,
      resolvedQuestionInteractionLookup: buildResolvedQuestionInteractionLookup([
        ...existing,
        interaction
      ])
    }))
  }

  function clearEditRerunState(): void {
    editRerunTarget.value = null
  }

  function readSessionActivity(sessionId: string | null): SessionActivityViewState {
    if (!sessionId) {
      return IDLE_SESSION_ACTIVITY
    }
    return sessionActivityById.value[sessionId] || IDLE_SESSION_ACTIVITY
  }

  function readSessionRunState(sessionId: string | null): ActiveRunState | null {
    if (!sessionId) {
      return null
    }
    return sessionRunById.value[sessionId] || null
  }

  function isSessionActivityRunning(activity: SessionActivityViewState): boolean {
    return activity.state === 'running' || activity.state === 'stop-pending'
  }

  function syncSessionListActivity(sessionId: string, activity: SessionActivityViewState): void {
    sessions.value = sessions.value.map(session => {
      if (session.sessionId !== sessionId) {
        return session
      }
      return {
        ...session,
        activity: {
          active: activity.active,
          state: activity.state,
          runId: activity.runId
        }
      }
    })
  }

  function setSessionActivity(sessionId: string, activity: SessionActivityViewState): void {
    if (isSessionDeletedLocally(sessionId)) {
      return
    }
    sessionActivityById.value = {
      ...sessionActivityById.value,
      [sessionId]: activity
    }
    syncSessionListActivity(sessionId, activity)
  }

  function clearSessionActivity(sessionId: string): void {
    const nextActivities = { ...sessionActivityById.value }
    delete nextActivities[sessionId]
    sessionActivityById.value = nextActivities
    syncSessionListActivity(sessionId, IDLE_SESSION_ACTIVITY)
  }

  function syncSessionRuntimeFromSessions(nextSessions: AgentSessionListItem[]): void {
    const visibleSessions = nextSessions.filter(session => !isSessionDeletedLocally(session.sessionId))
    const nextSessionIdSet = new Set(visibleSessions.map(session => session.sessionId))
    const nextActivities = visibleSessions.reduce<Record<string, SessionActivityViewState>>((result, session) => {
      result[session.sessionId] = { ...session.activity }
      return result
    }, {})
    const nextRuns = Object.entries(sessionRunById.value).reduce<Record<string, ActiveRunState>>((result, [sessionId, run]) => {
      if (nextSessionIdSet.has(sessionId)) {
        result[sessionId] = run
      }
      return result
    }, {})

    for (const session of visibleSessions) {
      const existingRun = nextRuns[session.sessionId]
      if (!session.activity.active || !session.activity.runId) {
        delete nextRuns[session.sessionId]
        continue
      }
      nextRuns[session.sessionId] = {
        runId: session.activity.runId,
        sessionId: session.sessionId,
        assistantMessageId: existingRun?.assistantMessageId || null,
        stopRequested: existingRun?.stopRequested || session.activity.state === 'stop-pending',
        authoritySnapshot: existingRun?.authoritySnapshot || null
      }
    }

    sessionActivityById.value = nextActivities
    sessionRunById.value = nextRuns
    syncSessionPlanSummaries(visibleSessions)
  }

  function syncBootstrapSessionActivity(
    sessionId: string | null,
    nextOccupancy?: RuntimeBootstrapPayload['workspaceOccupancy'] | null
  ): void {
    if (!sessionId || isSessionDeletedLocally(sessionId)) {
      return
    }
    if (!nextOccupancy?.occupied) {
      if (readSessionActivity(sessionId).active) {
        return
      }
      clearSessionActivity(sessionId)
      clearSessionRun(sessionId)
      return
    }
    setSessionActivity(sessionId, {
      active: true,
      state: nextOccupancy.state,
      runId: nextOccupancy.runId
    })
    if (!nextOccupancy.runId) {
      clearSessionRun(sessionId)
      return
    }
    const existingRun = readSessionRunState(sessionId)
    sessionRunById.value = {
      ...sessionRunById.value,
      [sessionId]: {
        runId: nextOccupancy.runId,
        sessionId,
        assistantMessageId: existingRun?.assistantMessageId || null,
        stopRequested: existingRun?.stopRequested || nextOccupancy.state === 'stop-pending',
        authoritySnapshot: existingRun?.authoritySnapshot || null
      }
    }
  }

  function clearSessionRun(sessionId: string, runId?: string | null): void {
    const existingRun = readSessionRunState(sessionId)
    if (!existingRun) {
      return
    }
    if (runId && existingRun.runId && existingRun.runId !== runId) {
      return
    }
    const nextRuns = { ...sessionRunById.value }
    delete nextRuns[sessionId]
    sessionRunById.value = nextRuns
  }

  function deleteSessionLocalState(sessionId: string): void {
    const nextStates = { ...sessionStateById.value }
    delete nextStates[sessionId]
    sessionStateById.value = nextStates
    const nextUsage = { ...sessionUsageById.value }
    delete nextUsage[sessionId]
    sessionUsageById.value = nextUsage
    const nextUsageRevisions = { ...sessionUsageRevisionById.value }
    delete nextUsageRevisions[sessionId]
    sessionUsageRevisionById.value = nextUsageRevisions
    clearSessionHydration(sessionId)
    clearSessionRun(sessionId)
    clearSessionActivity(sessionId)
  }

  function createDeletedSessionRollback(sessionId: string): DeletedSessionRollbackState | null {
    const session = sessions.value.find(item => item.sessionId === sessionId)
    if (!session) {
      return null
    }
    return {
      session,
      index: sessions.value.findIndex(item => item.sessionId === sessionId),
      state: sessionStateById.value[sessionId] || null,
      hydrationGeneration: sessionHydrationGenerationById.value[sessionId] ?? null,
      activity: sessionActivityById.value[sessionId] || null,
      run: sessionRunById.value[sessionId] || null,
      wasActive: activeSessionId.value === sessionId
    }
  }

  function restoreDeletedSession(snapshot: DeletedSessionRollbackState): void {
    restoreDeletedSessionId(snapshot.session.sessionId)
    clearDeletedSessionRollback(snapshot.session.sessionId)
    const nextSessions = [...sessions.value]
    nextSessions.splice(snapshot.index, 0, snapshot.session)
    sessions.value = nextSessions

    if (snapshot.state) {
      sessionStateById.value = {
        ...sessionStateById.value,
        [snapshot.session.sessionId]: snapshot.state
      }
    }
    if (snapshot.hydrationGeneration !== null) {
      sessionHydrationGenerationById.value = {
        ...sessionHydrationGenerationById.value,
        [snapshot.session.sessionId]: snapshot.hydrationGeneration
      }
    }
    if (snapshot.activity) {
      sessionActivityById.value = {
        ...sessionActivityById.value,
        [snapshot.session.sessionId]: snapshot.activity
      }
    }
    if (snapshot.run) {
      sessionRunById.value = {
        ...sessionRunById.value,
        [snapshot.session.sessionId]: snapshot.run
      }
    }
    if (snapshot.wasActive) {
      activeSessionId.value = snapshot.session.sessionId
      ensureSessionOpenStatus(snapshot.session.sessionId)
      reconcileEditRerunState()
      reconcileWorkspaceState()
    }
  }

  function removeSessionFromList(sessionId: string): void {
    sessions.value = sessions.value.filter(session => session.sessionId !== sessionId)
  }

  function clearSessionForDeletion(sessionId: string): void {
    markSessionDeletedLocally(sessionId)
    removeSessionFromList(sessionId)
    deleteSessionLocalState(sessionId)
  }

  function resolveAssistantHeaderOverlay(messageId: number | undefined): UiAssistantHeader | null {
    if (!isPersistedMessageId(messageId)) return null
    return assistantHeaderOverlays.value[String(messageId)] || null
  }

  function resolveAssistantTextViewOverride(messageId: string): AssistantTextDisplayMode | null {
    return assistantTextViewOverrides.value[messageId] || null
  }

  function rememberAssistantHeaderOverlay(
    messageId: number | undefined,
    assistantHeader: UiAssistantHeader | null
  ): void {
    if (!assistantHeader || !isPersistedMessageId(messageId)) return
    assistantHeaderOverlays.value = {
      ...assistantHeaderOverlays.value,
      [String(messageId)]: assistantHeader
    }
    updateDisplayedMessage(
      `persisted-${messageId}`,
      message => ({ ...message, assistantHeader })
    )
  }

  function rememberAssistantTextViewOverride(
    message: UiTextMessage,
    displayMode: AssistantTextDisplayMode
  ): void {
    const defaultDisplayMode = message.readingModeEligible ? 'reading' : 'raw'
    const nextOverrides = { ...assistantTextViewOverrides.value }
    if (displayMode === defaultDisplayMode) {
      delete nextOverrides[message.id]
    } else {
      nextOverrides[message.id] = displayMode
    }
    assistantTextViewOverrides.value = nextOverrides
  }

  function mapSessionHistory(
    history: AgentSessionMessageView[],
    resolvedLookup: ResolvedQuestionInteractionLookup
  ): UiMessage[] {
    return history
      .map(message => mapPersistedMessage(
        message,
        resolvedLookup,
        resolveAssistantHeaderOverlay(message.messageId),
        resolveAssistantTextViewOverride(`persisted-${message.messageId}`)
      ))
      .filter((message): message is UiMessage => Boolean(message))
  }

  function hasAuthoritativeAssistantForActiveRun(
    history: AgentSessionMessageView[],
    runState: ActiveRunState
  ): boolean {
    const lastMessage = history.at(-1)
    if (!lastMessage || lastMessage.role !== 'assistant' || !isPersistedMessageId(lastMessage.messageId)) {
      return false
    }
    const previousAssistantMessageId = runState.authoritySnapshot?.lastAssistantMessageId ?? 0
    return lastMessage.messageId > previousAssistantMessageId
  }

  function buildHydratedSessionMessages(
    sessionId: string,
    history: AgentSessionMessageView[]
  ): UiMessage[] {
    const sessionState = readSessionState(sessionId)
    const authoritativeMessages = mapSessionHistory(history, sessionState.resolvedQuestionInteractionLookup)
    const runState = readSessionRunState(sessionId)
    if (!runState?.assistantMessageId || !isSessionActivityRunning(readSessionActivity(sessionId))) {
      return appendPendingQuestionMessage(authoritativeMessages, sessionState.pendingInteraction)
    }
    if (hasAuthoritativeAssistantForActiveRun(history, runState)) {
      return appendPendingQuestionMessage(authoritativeMessages, sessionState.pendingInteraction)
    }
    const transientAssistant = findDisplayedMessage(runState.assistantMessageId, sessionId)
    if (
      !transientAssistant
      || transientAssistant.role !== 'assistant'
      || transientAssistant.status !== 'streaming'
      || isPersistedMessageId(transientAssistant.messageId)
    ) {
      return appendPendingQuestionMessage(authoritativeMessages, sessionState.pendingInteraction)
    }
    return appendPendingQuestionMessage(
      [...authoritativeMessages, transientAssistant],
      sessionState.pendingInteraction
    )
  }

  function captureSessionAuthority(sessionId: string): SessionAuthoritySnapshot {
    const sessionState = readSessionState(sessionId)
    return buildSessionAuthoritySnapshot({
      messages: sessionState.messages,
      pendingInteraction: sessionState.pendingInteraction,
      session: sessions.value.find(item => item.sessionId === sessionId) || null
    })
  }

  function registerActiveRun(event: Extract<AgentStreamEvent, { type: 'lifecycle.start' }>, context: LocalRunContext): void {
    sessionRunById.value = {
      ...sessionRunById.value,
      [event.sessionId]: {
        runId: event.runId,
        sessionId: event.sessionId,
        assistantMessageId: context.assistantMessageId,
        stopRequested: false,
        authoritySnapshot: context.authoritySnapshot
      }
    }
    setSessionActivity(event.sessionId, {
      active: true,
      state: 'running',
      runId: event.runId
    })
  }

  function updateActiveRunStopRequested(sessionId: string, stopRequested: boolean): void {
    const runState = readSessionRunState(sessionId)
    if (!runState) {
      return
    }
    sessionRunById.value = {
      ...sessionRunById.value,
      [sessionId]: {
        ...runState,
        stopRequested
      }
    }
    setSessionActivity(sessionId, {
      active: true,
      state: stopRequested ? 'stop-pending' : 'running',
      runId: runState.runId
    })
  }

  function findDisplayedMessage(messageId: string, sessionId: string | null = activeSessionId.value): UiMessage | null {
    const targetMessages = sessionId ? readSessionState(sessionId).messages : draftMessages.value
    return targetMessages.find(message => message.id === messageId) || null
  }

  function createStoppedAssistantMessage(message: UiMessage): UiTextMessage {
    const text = message.text.trim() || STOPPED_ASSISTANT_HEADER.label
    return createLocalTextMessage({
      id: message.id,
      role: 'assistant',
      text,
      createdAt: message.createdAt,
      status: 'done',
      assistantHeader: STOPPED_ASSISTANT_HEADER
    })
  }

  function createLocalStoppedAssistantMessage(createdAt = Date.now()): UiTextMessage {
    return createLocalTextMessage({
      id: `local-stopped-${createdAt}`,
      role: 'assistant',
      text: STOPPED_ASSISTANT_HEADER.label,
      createdAt,
      status: 'done',
      assistantHeader: STOPPED_ASSISTANT_HEADER
    })
  }

  function createRejectedQuestionEndedMessage(createdAt = Date.now()): UiTextMessage {
    return createLocalTextMessage({
      id: `local-question-ended-${createdAt}`,
      role: 'assistant',
      text: REJECTED_QUESTION_ENDED_MESSAGE,
      createdAt,
      status: 'done',
      assistantHeader: REJECTED_QUESTION_ENDED_ASSISTANT_HEADER
    })
  }

  async function convergeCancelledRun(
    sessionId: string,
    runState: ActiveRunState | null
  ): Promise<void> {
    if (!runState) {
      setConversationStatus('运行已取消', sessionId)
      return
    }

    const stoppedSource = runState.assistantMessageId
      ? findDisplayedMessage(runState.assistantMessageId, sessionId)
      : null
    await reloadSessionState(sessionId)

    if (runState.authoritySnapshot && hasNewAuthoritativeSessionState(
      runState.authoritySnapshot,
      captureSessionAuthority(sessionId)
    )) {
      setConversationStatus(
        readSessionState(sessionId).pendingInteraction ? '等待问题回答' : '已恢复会话状态',
        sessionId
      )
      return
    }

    if (!stoppedSource || stoppedSource.role !== 'assistant') {
      setConversationStatus('已停止', sessionId)
      return
    }

    setSessionMessages(sessionId, [
      ...readSessionState(sessionId).messages,
      createStoppedAssistantMessage(stoppedSource)
    ])
    setConversationStatus('已停止', sessionId)
  }

  function buildFailedRunOverlayMessage(
    assistantMessageId: string,
    result: AgentRunResult,
    sessionId: string
  ): UiErrorMessage | null {
    const message = findDisplayedMessage(assistantMessageId, sessionId)
    if (!message || message.role !== 'assistant') {
      return null
    }
    if (message.kind === 'error') {
      return message
    }
    return createLocalErrorMessage({
      id: message.id,
      role: 'assistant',
      text: result.runtimeError?.userMessage || result.error || result.text || message.text,
      createdAt: message.createdAt,
      messageId: message.messageId,
      runtimeError: result.runtimeError || null,
      assistantHeader: buildFailedAssistantHeader(result.runtimeError)
    })
  }

  async function syncDisplayedSessionAfterRun(params: {
    assistantMessageId: string
    sessionId: string
    result: AgentRunResult
    reloadOnSuccess?: boolean
  }): Promise<void> {
    if (isCancelledRuntimeError(params.result.runtimeError)) {
      return
    }
    const shouldReload = params.result.error || params.result.runtimeError
      ? true
      : params.reloadOnSuccess !== false
    if (!shouldReload) {
      return
    }

    const failureOverlay = params.result.error || params.result.runtimeError
      ? buildFailedRunOverlayMessage(params.assistantMessageId, params.result, params.sessionId)
      : null

    await reloadSessionState(params.sessionId)
    if (!failureOverlay) {
      await refreshOpenWorkspaceFilesAfterRun()
      return
    }

    setSessionMessages(params.sessionId, [
      ...readSessionState(params.sessionId).messages,
      failureOverlay
    ])
  }

  async function stopCurrentRun(): Promise<void> {
    const sessionId = activeSessionId.value
    const runState = readSessionRunState(sessionId)
    if (!sessionId || !runState?.runId) {
      return
    }

    error.value = null
    updateActiveRunStopRequested(sessionId, true)
    setConversationStatus('正在请求停止...', sessionId)

    try {
      const response = await agentApi.cancelRun(runState.runId)
      if (response.cancelled) {
        setConversationStatus('停止请求已发送', sessionId)
        return
      }
      setConversationStatus('停止请求已确认，等待运行结束', sessionId)
    } catch (err) {
      updateActiveRunStopRequested(sessionId, false)
      error.value = `停止失败：${(err as Error).message}`
      setConversationStatus('停止失败', sessionId)
    }
  }

  async function initialize(options: InitializeOptions = {}): Promise<void> {
    if (initializePromise) return initializePromise
    initializePromise = (async () => {
      isInitializing.value = true
      error.value = null
      try {
        await loadAgents(options)
      } finally {
        isInitializing.value = false
        initializePromise = null
      }
    })()
    return initializePromise
  }

  function reset(): void {
    cancelUploadConflict()
    error.value = null
    workspaceStatus.value = DEFAULT_WORKSPACE_STATUS
    agents.value = []
    activeAgentId.value = ''
    activeAgent.value = null
    runtimeBootstrap.value = null
    sessions.value = []
    activeSessionId.value = null
    draftMessages.value = []
    blankComposerDraft.value = ''
    sessionStateById.value = {}
    sessionUsageById.value = {}
    sessionUsageRevisionById.value = {}
    sessionHydrationGenerationById.value = {}
    sessionActivityById.value = {}
    sessionRunById.value = {}
    deletedSessionIds.value = {}
    deletedSessionRollbackById.value = {}
    clearAssistantHeaderOverlays()
    clearAssistantTextViewOverrides()
    clearEditRerunState()
    agentWorkspace.value = null
    skillSearchQuery.value = ''
    selectedStarterSkillId.value = null

    workspaceSidebarTab.value = 'workspace'
    workspaceSidebarCollapsed.value = false
    selectedWorkspaceFileId.value = null
    openWorkspaceFileIds.value = []
    activeWorkspaceFileId.value = null
    workspaceEditorOpen.value = false
    workspaceEditorFiles.value = {}
    isUploading.value = false
  }

  function settleUploadConflictDecision(confirmed: boolean): PendingUploadConflictState | null {
    const conflict = pendingUploadConflict.value
    pendingUploadConflict.value = null
    const resolver = resolveUploadConflictDecision
    resolveUploadConflictDecision = null
    resolver?.(confirmed)
    return conflict
  }

  function confirmUploadConflict(): void {
    settleUploadConflictDecision(true)
  }

  function cancelUploadConflict(): void {
    settleUploadConflictDecision(false)
  }

  function requestUploadConflictDecision(
    agentId: string,
    file: File,
    relativePath: string | undefined,
    conflictPath?: string
  ): Promise<boolean> {
    if (pendingUploadConflict.value) {
      throw new Error('Upload conflict confirmation already pending')
    }
    pendingUploadConflict.value = {
      agentId,
      file,
      relativePath,
      conflictPath: resolveUploadConflictPath(file, relativePath, conflictPath),
      fileName: file.name
    }
    return new Promise(resolve => {
      resolveUploadConflictDecision = resolve
    })
  }

  async function loadAgents(options: InitializeOptions): Promise<void> {
    const summaries = await agentApi.listAgents()
    agents.value = summaries
    if (!summaries.length) {
      activeAgentId.value = ''
      activeAgent.value = null
      runtimeBootstrap.value = null
      sessions.value = []
      agentWorkspace.value = null
      return
    }
    await selectAgent(activeAgentId.value || summaries[0].id, options)
  }

  async function selectAgent(agentId: string, options: InitializeOptions = {}): Promise<void> {
    activeAgentId.value = agentId
    activeSessionId.value = null
    draftMessages.value = []
    blankComposerDraft.value = ''
    sessionStateById.value = {}
    sessionUsageById.value = {}
    sessionUsageRevisionById.value = {}
    sessionHydrationGenerationById.value = {}
    sessionActivityById.value = {}
    sessionRunById.value = {}
    deletedSessionIds.value = {}
    deletedSessionRollbackById.value = {}
    clearAssistantHeaderOverlays()
    clearAssistantTextViewOverrides()
    clearEditRerunState()
    agentWorkspace.value = null
    workspaceStatus.value = DEFAULT_WORKSPACE_STATUS
    error.value = null
    skillSearchQuery.value = ''
    selectedStarterSkillId.value = null

    resetWorkspaceShellState()

    const [agent, bootstrap, nextSessions, workspace] = await Promise.all([
      agentApi.getAgent(agentId),
      agentApi.bootstrap(agentId, null),
      agentApi.listSessions(agentId),
      agentApi.getWorkspace(agentId)
    ])

    activeAgent.value = agent
    runtimeBootstrap.value = bootstrap
    sessions.value = nextSessions
    syncSessionRuntimeFromSessions(nextSessions)
    agentWorkspace.value = workspace
    if (options.autoOpenFirstSession && nextSessions.length > FIRST_SESSION_INDEX) {
      await selectSession(nextSessions[FIRST_SESSION_INDEX].sessionId)
      return
    }
    setWorkspaceStatus(`已加载 ${agent.name}`)
    reconcileWorkspaceState()
  }

  async function refreshSessions(): Promise<void> {
    if (!activeAgentId.value) return
    const nextSessions = (await agentApi.listSessions(activeAgentId.value))
      .filter(session => !isSessionDeletedLocally(session.sessionId))
    sessions.value = nextSessions
    syncSessionRuntimeFromSessions(nextSessions)
  }

  async function loadSessionUsage(sessionId: string): Promise<void> {
    if (!activeAgentId.value || !sessionId || isSessionDeletedLocally(sessionId)) {
      return
    }
    const sessionRevision = buildSessionUsageRevision(
      sessions.value.find(session => session.sessionId === sessionId)
    )
    const existing = sessionUsageById.value[sessionId]
    if (existing?.loading) {
      return
    }
    if (existing?.summary && sessionUsageRevisionById.value[sessionId] === sessionRevision) {
      return
    }
    const stableSummary = sessionUsageRevisionById.value[sessionId] === sessionRevision
      ? existing?.summary || null
      : null
    sessionUsageById.value = {
      ...sessionUsageById.value,
      [sessionId]: createSessionUsageState(stableSummary, { loading: true })
    }
    try {
      const summary = await agentApi.getSessionUsageSummary(activeAgentId.value, sessionId)
      if (isSessionDeletedLocally(sessionId)) {
        return
      }
      sessionUsageRevisionById.value = {
        ...sessionUsageRevisionById.value,
        [sessionId]: sessionRevision
      }
      sessionUsageById.value = {
        ...sessionUsageById.value,
        [sessionId]: createSessionUsageState(summary)
      }
    } catch (err) {
      if (isSessionDeletedLocally(sessionId)) {
        return
      }
      sessionUsageRevisionById.value = {
        ...sessionUsageRevisionById.value,
        [sessionId]: sessionRevision
      }
      sessionUsageById.value = {
        ...sessionUsageById.value,
        [sessionId]: createSessionUsageState(null, { error: (err as Error).message })
      }
    }
  }

  async function refreshActiveAgentGovernance(): Promise<void> {
    const targetAgentId = activeAgentId.value
    if (!targetAgentId) return
    const [agent, bootstrap] = await Promise.all([
      agentApi.getAgent(targetAgentId),
      agentApi.bootstrap(targetAgentId, activeSessionId.value)
    ])
    if (activeAgentId.value !== targetAgentId) return
    activeAgent.value = agent
    runtimeBootstrap.value = bootstrap
    syncBootstrapSessionActivity(activeSessionId.value, bootstrap.workspaceOccupancy)
  }

  function hydrateSessionHistory(sessionId: string, history: AgentSessionMessageView[], workspace: AgentWorkspacePayload): void {
    if (isSessionDeletedLocally(sessionId)) {
      return
    }
    setSessionMessages(sessionId, buildHydratedSessionMessages(sessionId, history))
    agentWorkspace.value = workspace
    syncSessionPlanSummary(sessionId)
    if (activeSessionId.value !== sessionId) {
      return
    }
    reconcileEditRerunState()
    reconcileWorkspaceState()
  }

  async function reloadSessionMessages(sessionId: string): Promise<void> {
    if (!activeAgentId.value || isSessionDeletedLocally(sessionId)) return
    const generation = beginSessionHydration(sessionId)
    const [history, workspace] = await Promise.all([
      agentApi.getSessionMessages(activeAgentId.value, sessionId),
      agentApi.getWorkspace(activeAgentId.value)
    ])
    if (!isLatestSessionHydration(sessionId, generation)) return
    hydrateSessionHistory(sessionId, history, workspace)
  }

  async function reloadSessionState(sessionId: string): Promise<void> {
    if (!activeAgentId.value || isSessionDeletedLocally(sessionId)) return
    const generation = beginSessionHydration(sessionId)
    const [history, interactions, workspace] = await Promise.all([
      agentApi.getSessionMessages(activeAgentId.value, sessionId),
      agentApi.listSessionInteractions(activeAgentId.value, sessionId, SESSION_INTERACTION_STATUSES),
      agentApi.getWorkspace(activeAgentId.value)
    ])
    if (!isLatestSessionHydration(sessionId, generation)) return
    setSessionInteractions(sessionId, interactions)
    hydrateSessionHistory(sessionId, history, workspace)
  }

  async function selectSession(sessionId: string): Promise<void> {
    if (!activeAgentId.value || isSessionDeletedLocally(sessionId)) return
    clearAssistantHeaderOverlays()
    clearAssistantTextViewOverrides()
    clearEditRerunState()
    activeSessionId.value = sessionId
    error.value = null
    const generation = beginSessionHydration(sessionId)

    const [history, interactions] = await Promise.all([
      agentApi.getSessionMessages(activeAgentId.value, sessionId),
      agentApi.listSessionInteractions(activeAgentId.value, sessionId, SESSION_INTERACTION_STATUSES)
    ])

    if (!isLatestSessionHydration(sessionId, generation)) return

    setSessionInteractions(sessionId, interactions)
    setSessionMessages(sessionId, buildHydratedSessionMessages(sessionId, history))
    syncSessionPlanSummary(sessionId)
    ensureSessionOpenStatus(sessionId)
    if (activeSessionId.value === sessionId) {
      reconcileEditRerunState()
      reconcileWorkspaceState()
      void refreshActiveAgentGovernance()
    }
  }

  function activateBlankConversation(status: string): void {
    const shouldResetBlankDraft = activeSessionId.value === null
    activeSessionId.value = null
    draftMessages.value = []
    if (shouldResetBlankDraft) {
      blankComposerDraft.value = ''
    }
    clearAssistantHeaderOverlays()
    clearAssistantTextViewOverrides()
    clearEditRerunState()
    error.value = null
    skillSearchQuery.value = ''
    selectedStarterSkillId.value = null

    setWorkspaceStatus(status)
  }

  function startNewConversation(): void {
    activateBlankConversation('已返回空白对话')
    void refreshActiveAgentGovernance()
  }

  async function sendPrompt(input: string): Promise<void> {
    const trimmed = input.trim()
    if (!trimmed || !activeAgentId.value) return
    if (isSessionInputBlocked.value) {
      error.value = PENDING_INTERACTION_BLOCKED_MESSAGE
      setConversationStatus('请先回答当前问题')
      return
    }
    if (isActiveSessionRunning.value) {
      error.value = '当前会话还在处理中，请等它结束后再发送。'
      setConversationStatus('当前会话运行中')
      return
    }

    await runConversationInput({
      input: trimmed,
      displayInput: trimmed,
      seedTitle: trimmed.slice(0, 24)
    })
  }

  function startEditRerun(messageId: number): void {
    if (editableUserMessageId.value !== messageId) {
      return
    }
    const target = lastEditableUserMessage.value
    if (!target || target.messageId !== messageId) {
      return
    }
    editRerunTarget.value = {
      messageId,
      text: target.text
    }
    setComposerDraft(target.text, activeSessionId.value)
    error.value = null
    setConversationStatus('正在编辑最后一条用户消息')
  }

  function cancelEditRerun(): void {
    clearEditRerunState()
    setComposerDraft('', activeSessionId.value)
    if (activeSessionId.value) {
      setConversationStatus('已取消编辑并重跑', activeSessionId.value)
    }
  }

  async function submitEditRerun(input: string): Promise<void> {
    const target = editRerunTarget.value
    const sessionId = activeSessionId.value
    const trimmed = input.trim()
    if (!target || !sessionId || !trimmed) {
      return
    }
    if (isSessionInputBlocked.value) {
      error.value = PENDING_INTERACTION_BLOCKED_MESSAGE
      setConversationStatus('请先回答当前问题', sessionId)
      return
    }
    if (isActiveSessionRunning.value) {
      error.value = '当前会话还在处理中，请等它结束后再发送。'
      setConversationStatus('当前会话运行中', sessionId)
      return
    }

    clearEditRerunState()
    truncateDisplayedSessionMessages(target.messageId)
    const run = await runConversationInput({
      input: trimmed,
      displayInput: trimmed,
      editContextMessageId: target.messageId,
      clearComposerDraft: false
    })
    if (run && !run.result.error && !run.result.runtimeError) {
      setComposerDraft('', sessionId)
      setConversationStatus('已完成编辑并重跑', sessionId)
      return
    }
    if (!run && activeSessionId.value === sessionId) {
      await reloadSessionState(sessionId)
    }
  }

  async function runConversationInput(params: {
    input: string
    displayInput?: string | null
    seedTitle?: string
    reloadOnSuccess?: boolean
    editContextMessageId?: number
    continuationInteractionId?: string
    clearComposerDraft?: boolean
    suppressDisplayedUserMessage?: boolean
  }): Promise<{ sessionId: string; result: AgentRunResult } | null> {
    if (!activeAgentId.value) return null

    error.value = null

    const timestamp = Date.now()
    const assistantMessage = createLocalTextMessage({
      id: `local-assistant-${timestamp}`,
      role: 'assistant',
      text: '',
      createdAt: timestamp + 1,
      status: 'streaming',
      assistantHeader: THINKING_ASSISTANT_HEADER
    })

    appendDisplayedMessages([
      ...(!params.suppressDisplayedUserMessage && params.displayInput
        ? [createLocalTextMessage({
            id: `local-user-${timestamp}`,
            role: 'user',
            text: params.displayInput,
            createdAt: timestamp,
            status: 'done'
          })]
        : []),
      assistantMessage
    ])
    let ownedSessionId: string | null = activeSessionId.value

    try {
      if (!ownedSessionId) {
        ownedSessionId = await createSessionFromDraft(params.seedTitle || (params.displayInput || '').slice(0, 24))
      }
      const localRunId = createClientRunId()
      setConversationStatus('智能体处理中...', ownedSessionId)
      sessionRunById.value = {
        ...sessionRunById.value,
        [ownedSessionId]: {
          runId: localRunId,
          sessionId: ownedSessionId,
          assistantMessageId: assistantMessage.id,
          stopRequested: false,
          authoritySnapshot: null
        }
      }
      setSessionActivity(ownedSessionId, {
        active: true,
        state: 'running',
        runId: localRunId
      })
      if (params.clearComposerDraft !== false) {
        setComposerDraft('', ownedSessionId)
      }

      const runContext: LocalRunContext = {
        assistantMessageId: assistantMessage.id,
        sessionId: ownedSessionId,
        authoritySnapshot: captureSessionAuthority(ownedSessionId),
        terminalStatus: null
      }

      const request: AgentRunRequest = {
        runId: localRunId,
        agentId: activeAgentId.value,
        sessionId: ownedSessionId,
        input: params.input,
        ...(params.editContextMessageId
          ? {
              editContext: {
                messageId: params.editContextMessageId
              }
            }
          : {}),
        ...(params.continuationInteractionId
          ? {
              continuation: {
                interactionId: params.continuationInteractionId
              }
            }
          : {}),
        invocationContext: (workspaceFiles.value.length || activeWorkspaceFile.value)
          ? {
              activeFile: activeWorkspaceFile.value
                ? {
                    path: activeWorkspaceFile.value.path,
                    fileName: activeWorkspaceFile.value.fileName,
                    source: activeWorkspaceFile.value.source,
                    writable: activeWorkspaceFile.value.writable
                  }
                : undefined
            }
          : undefined
      }

      const result = await agentApi.runStream(request, event => handleStreamEvent(event, runContext))
      await refreshSessions()
      if (runContext.terminalStatus === 'cancelled' || isCancelledRuntimeError(result.runtimeError)) {
        await convergeCancelledRun(ownedSessionId, readSessionRunState(ownedSessionId) || {
          runId: result.runId,
          sessionId: ownedSessionId,
          assistantMessageId: assistantMessage.id,
          stopRequested: false,
          authoritySnapshot: runContext.authoritySnapshot
        })
        clearSessionRun(ownedSessionId, result.runId)
        clearSessionActivity(ownedSessionId)
        return {
          sessionId: ownedSessionId,
          result
        }
      }

      applyRunResultToDisplayedMessage(assistantMessage.id, result, ownedSessionId)
      await syncDisplayedSessionAfterRun({
        assistantMessageId: assistantMessage.id,
        sessionId: ownedSessionId,
        result,
        reloadOnSuccess: params.reloadOnSuccess
      })
      setConversationStatus(
        result.error || result.runtimeError
          ? '执行结束'
          : result.output.kind === 'awaiting-interaction'
            ? '等待问题回答'
            : '已完成本轮对话',
        ownedSessionId
      )
      return {
        sessionId: ownedSessionId,
        result
      }
    } catch (err) {
      if (ownedSessionId && isPendingInteractionBlockedError(err)) {
        await reloadSessionState(ownedSessionId)
        error.value = err.message || PENDING_INTERACTION_BLOCKED_MESSAGE
        setConversationStatus('请先回答当前问题', ownedSessionId)
        return null
      }
      if ((err as Error & { code?: string }).code === 'WORKSPACE_OCCUPIED') {
        await refreshActiveAgentGovernance()
        error.value = (err as Error).message
        setConversationStatus('当前会话运行中', ownedSessionId)
        return null
      }
      error.value = (err as Error).message
      updateDisplayedMessage(assistantMessage.id, message => createLocalErrorMessage({
        id: message.id,
        role: 'assistant',
        text: message.text || `请求失败：${error.value}`,
        createdAt: message.createdAt,
        messageId: message.messageId,
        assistantHeader: FAILED_ASSISTANT_HEADER
      }), ownedSessionId)
      if (ownedSessionId) {
        clearSessionRun(ownedSessionId)
        clearSessionActivity(ownedSessionId)
        setConversationStatus('执行失败', ownedSessionId)
      } else {
        setWorkspaceStatus('执行失败')
      }
      return null
    }
  }

  function handleStreamEvent(event: AgentStreamEvent, context: LocalRunContext): void {
    if (isSessionDeletedLocally(context.sessionId)) {
      return
    }
    switch (event.type) {
      case 'lifecycle.start':
        registerActiveRun(event, context)
        break
      case 'lifecycle.queued':
        updateDisplayedMessage(context.assistantMessageId, message => ({
          ...message,
          ...buildAssistantHeaderField(message.role, QUEUED_ASSISTANT_HEADER)
        }), context.sessionId)
        break
      case 'assistant.delta':
        updateDisplayedMessage(context.assistantMessageId, message => ({
          ...message,
          text: message.text + event.delta,
          ...buildAssistantHeaderField(message.role, GENERATING_ASSISTANT_HEADER)
        }), context.sessionId)
        break
      case 'assistant.final':
        updateDisplayedMessage(context.assistantMessageId, message => ({
          ...message,
          status: 'done',
          text: event.text,
          ...buildAssistantHeaderField(message.role, GENERATING_ASSISTANT_HEADER)
        }), context.sessionId)
        break
      case 'tool.started':
        updateDisplayedMessage(context.assistantMessageId, message => ({
          ...message,
          ...buildAssistantHeaderField(message.role, buildToolStartedAssistantHeader(event))
        }), context.sessionId)
        break
      case 'tool.failed':
        updateDisplayedMessage(context.assistantMessageId, message => ({
          ...message,
          ...buildAssistantHeaderField(message.role, buildToolFailureAssistantHeader(event))
        }), context.sessionId)
        setConversationStatus(event.statusMessage, context.sessionId)
        break
      case 'plan.snapshot':
        setSessionPlanSummary(context.sessionId, event.plan.summary)
        setConversationStatus(`计划已生成：${event.plan.title}`, context.sessionId)
        break
      case 'plan.awaiting_decision':
        setConversationStatus(`计划待确认：${event.planId}`, context.sessionId)
        break
      case 'lifecycle.error':
        if (isCancelledRuntimeError(event.runtimeError)) {
          setConversationStatus(
            readSessionRunState(context.sessionId)?.stopRequested ? '正在等待停止结果' : '运行已取消',
            context.sessionId
          )
          break
        }
        updateDisplayedMessage(context.assistantMessageId, message => createLocalErrorMessage({
          id: message.id,
          role: 'assistant',
          text: event.runtimeError?.userMessage || event.error,
          createdAt: message.createdAt,
          messageId: message.messageId,
          runtimeError: event.runtimeError || null,
          assistantHeader: buildFailedAssistantHeader(event.runtimeError)
        }), context.sessionId)
        setConversationStatus(buildRuntimeErrorConversationStatus(event.runtimeError), context.sessionId)
        break
      case 'run.completed':
        context.terminalStatus = event.status
        if (event.status === 'awaiting-interaction') {
          clearSessionRun(context.sessionId, event.runId)
          if (event.result.assistantMessageId) {
            setAwaitingQuestionMessageId(context.sessionId, event.result.assistantMessageId)
          }
          setSessionActivity(context.sessionId, {
            active: true,
            state: 'awaiting-question',
            runId: null
          })
        } else {
          clearSessionRun(context.sessionId, event.runId)
          clearSessionActivity(context.sessionId)
        }
        if (event.status === 'cancelled') {
          setConversationStatus('正在收敛停止结果', context.sessionId)
          break
        }
        setConversationStatus(
          event.status === 'awaiting-interaction'
            ? '等待问题回答'
            : event.status === 'success'
              ? '执行完成'
              : '执行结束',
          context.sessionId
        )
        break
      default:
        break
    }
  }

  function applyRunResultToDisplayedMessage(
    messageId: string,
    result: AgentRunResult,
    sessionId: string
  ): void {
    const assistantHeader = buildCompletedAssistantHeader(
      result,
      runtimeBootstrap.value?.toolDisplayNames,
      activeAgent.value?.skills
    )
    updateDisplayedMessage(messageId, message => {
      if (result.runtimeError || result.error) {
        return createLocalErrorMessage({
          id: message.id,
          role: 'assistant',
          text: result.runtimeError?.userMessage || result.error || result.text || message.text,
          createdAt: message.createdAt,
          messageId: result.assistantMessageId,
          runtimeError: result.runtimeError || null,
          assistantHeader
        })
      }

      if (result.output.kind === 'protocol' && result.output.protocol) {
        return {
          id: message.id,
          messageId: result.assistantMessageId,
          role: 'assistant',
          text: result.text,
          createdAt: message.createdAt,
          status: 'done',
          assistantHeader,
          kind: 'protocol',
          protocol: result.output.protocol,
          protocolState: null
        } satisfies UiProtocolMessage
      }

      if (result.output.kind === 'awaiting-interaction') {
        return applyAssistantTextPresentation({
          id: message.id,
          messageId: result.assistantMessageId,
          role: message.role,
          kind: 'text',
          text: result.text,
          createdAt: message.createdAt,
          status: 'done',
          ...buildAssistantHeaderField(message.role, assistantHeader)
        })
      }

      if (result.output.kind === 'domain-result' && result.output.domainResult) {
        return {
          id: message.id,
          messageId: result.assistantMessageId,
          role: 'assistant',
          text: result.text,
          createdAt: message.createdAt,
          status: 'done',
          assistantHeader,
          kind: 'result',
          result: result.output.domainResult
        } satisfies UiResultMessage
      }

      return applyAssistantTextPresentation({
        id: message.id,
        messageId: result.assistantMessageId,
        role: message.role,
        kind: 'text',
        text: result.text,
        createdAt: message.createdAt,
        status: 'done',
        ...buildAssistantHeaderField(message.role, assistantHeader)
      })
    }, sessionId)
    rememberAssistantHeaderOverlay(result.assistantMessageId, assistantHeader)
  }

  async function executeProtocolAction(messageId: string, action: ProtocolAction): Promise<void> {
    if (!activeAgentId.value || !activeSessionId.value) return
    const message = messages.value.find(item => item.id === messageId)
    if (!message || message.kind !== 'protocol') return

    if (action.tool === 'question_response' && (action.type === 'submit' || action.type === 'tool')) {
      await handleProtocolSubmitAction(messageId, message, {
        ...action,
        type: 'submit'
      })
      return
    }

    switch (action.type) {
      case 'submit':
        await handleProtocolSubmitAction(messageId, message, action)
        return
      case 'cancel':
        await handleProtocolCancelAction(messageId, message, action)
        return
      case 'redirect':
        await handleProtocolRedirectAction(messageId, message, action)
        return
      case 'delegate':
        await handleProtocolDelegateAction(messageId, message, action)
        return
      case 'tool':
        await handleProtocolToolAction(messageId, message, action)
        return
      default:
        await applyProtocolState(messageId, {
          ...normalizeProtocolState(message.protocolState),
          lastActionId: action.id,
          actionStatus: 'error',
          note: `暂不支持协议动作类型：${action.type}`,
          updatedAt: Date.now()
        })
        setConversationStatus('协议动作暂不支持')
        return
    }
  }

  async function applyProtocolState(
    messageId: string,
    protocolState: ProtocolMessageState
  ): Promise<void> {
    updateProtocolMessageState(messageId, protocolState)
    try {
      await persistProtocolStateForMessage(messageId, protocolState)
    } catch (err) {
      error.value = (err as Error).message
      setConversationStatus('协议状态保存失败')
    }
  }

  async function handleProtocolSubmitAction(
    messageId: string,
    message: UiProtocolMessage,
    action: ProtocolAction
  ): Promise<void> {
    const protocol = getRenderedProtocolPayload(message.protocol, message.protocolState)

    if (action.tool !== 'question_response') {
      await applyProtocolState(messageId, {
        ...normalizeProtocolState(message.protocolState),
        lastActionId: action.id,
        actionStatus: 'error',
        note: `暂不支持提交类协议动作：${action.tool || action.id}`,
        updatedAt: Date.now()
      })
      setConversationStatus('协议提交暂不支持')
      return
    }

    const validationErrors = validateQuestionResponse(protocol, message.protocolState)
    if (Object.keys(validationErrors).length > 0) {
      await applyProtocolState(
        messageId,
        withProtocolValidationErrors(message.protocolState, validationErrors, '请补全必填信息后再提交。')
      )
      setConversationStatus('协议表单未完成')
      return
    }

    const submittingState: ProtocolMessageState = {
      ...normalizeProtocolState(message.protocolState),
      lastActionId: action.id,
      actionStatus: 'submitting',
      validationErrors: {},
      updatedAt: Date.now()
    }
    await applyProtocolState(messageId, submittingState)

    const resolvedInput = resolveProtocolPlaceholders(
      action.toolInput || {},
      buildProtocolActionContext(protocol, submittingState)
    ) as Record<string, unknown>
    const displayInput = summarizeQuestionResponseAnswer(protocol, resolvedInput.answer)
    const run = await runConversationInput({
      input: JSON.stringify(resolvedInput),
      displayInput,
      reloadOnSuccess: false
    })

    if (!run || run.result.error || run.result.runtimeError) {
      await applyProtocolState(messageId, {
        ...normalizeProtocolState(submittingState),
        lastActionId: action.id,
        actionStatus: 'error',
        note: run?.result.runtimeError?.userMessage || run?.result.error || error.value || '问题提交失败',
        updatedAt: Date.now()
      })
      setConversationStatus('问题提交失败')
      return
    }

    const resolvedState: ProtocolMessageState = {
      ...normalizeProtocolState(submittingState),
      actionStatus: 'done',
      note: '问题已提交，等待继续处理。',
      message: buildConvergedProtocolMessage(protocol, {
        removeActionIds: [action.id],
        readonlyForms: true,
        readonlyTables: true
      }),
      updatedAt: Date.now()
    }

    await applyProtocolState(messageId, resolvedState)
    if (activeSessionId.value === run.sessionId) {
      await reloadSessionState(run.sessionId)
    }
    setConversationStatus('已提交问题回答', run.sessionId)
  }

  async function replyPendingInteraction(answer: Record<string, unknown>): Promise<void> {
    const interaction = activePendingInteraction.value
    if (!activeAgentId.value || !activeSessionId.value || !interaction || interaction.kind !== 'question') {
      return
    }
    await agentApi.replySessionInteraction(activeAgentId.value, activeSessionId.value, interaction.interactionId, answer)
    const answeredMessageId = consumeAwaitingQuestionMessageId(activeSessionId.value)
    if (answeredMessageId) {
      rememberAssistantHeaderOverlay(answeredMessageId, ANSWERED_ASSISTANT_HEADER)
    }
    clearSessionInteractions(activeSessionId.value)
    setConversationStatus('问题已回答，继续执行')
    await runConversationInput({
      input: '',
      displayInput: null,
      reloadOnSuccess: false,
      continuationInteractionId: interaction.interactionId,
      suppressDisplayedUserMessage: true
    })
    if (activeSessionId.value) {
      await reloadSessionState(activeSessionId.value)
    }
  }

  async function rejectPendingInteraction(): Promise<void> {
    const interaction = activePendingInteraction.value
    const sessionId = activeSessionId.value
    if (!activeAgentId.value || !sessionId || !interaction || interaction.kind !== 'question') {
      return
    }
    const rejectedInteraction = await agentApi.rejectSessionInteraction(
      activeAgentId.value,
      sessionId,
      interaction.interactionId
    )
    rememberResolvedQuestionInteraction(sessionId, rejectedInteraction)
    const rejectedMessageId = consumeAwaitingQuestionMessageId(sessionId)
    if (rejectedMessageId) {
      rememberAssistantHeaderOverlay(rejectedMessageId, REJECTED_QUESTION_ENDED_ASSISTANT_HEADER)
    }
    clearSessionRun(sessionId)
    clearSessionActivity(sessionId)
    try {
      await Promise.all([
        reloadSessionMessages(sessionId),
        refreshSessions()
      ])
    } finally {
      appendDisplayedMessages([createRejectedQuestionEndedMessage()], sessionId)
      setConversationStatus('任务已结束', sessionId)
    }
  }

  async function handleProtocolCancelAction(
    messageId: string,
    message: UiProtocolMessage,
    action: ProtocolAction
  ): Promise<void> {
    const protocol = getRenderedProtocolPayload(message.protocol, message.protocolState)
    const toolInput = action.toolInput || {}
    const note = typeof toolInput.note === 'string' && toolInput.note.trim()
      ? toolInput.note
      : '已取消当前协议操作。'
    await applyProtocolState(messageId, {
      ...normalizeProtocolState(message.protocolState),
      lastActionId: action.id,
      actionStatus: 'done',
      note,
      validationErrors: {},
      message: buildConvergedProtocolMessage(protocol, {
        removeActionIds: [action.id],
        readonlyForms: true,
        readonlyTables: true
      }),
      updatedAt: Date.now()
    })
    setConversationStatus('已取消协议动作')
  }

  async function handleProtocolRedirectAction(
    messageId: string,
    message: UiProtocolMessage,
    action: ProtocolAction
  ): Promise<void> {
    const protocol = getRenderedProtocolPayload(message.protocol, message.protocolState)
    const redirected = buildRedirectedProtocolMessage(protocol, action)
    const toolInput = action.toolInput || {}
    await applyProtocolState(messageId, {
      ...normalizeProtocolState(message.protocolState),
      lastActionId: action.id,
      actionStatus: redirected ? 'done' : 'error',
      note: typeof toolInput.note === 'string' && toolInput.note.trim()
        ? toolInput.note
        : redirected
          ? '协议视图已更新。'
          : '协议重定向缺少可渲染的目标内容。',
      message: redirected || protocol,
      updatedAt: Date.now()
    })
    setConversationStatus(redirected ? '协议视图已切换' : '协议重定向失败')
  }

  async function handleProtocolDelegateAction(
    messageId: string,
    message: UiProtocolMessage,
    action: ProtocolAction
  ): Promise<void> {
    const note = '当前工作台尚未提供子代理进度视图，delegate 协议动作先以兼容性提示呈现。'
    await applyProtocolState(messageId, {
      ...normalizeProtocolState(message.protocolState),
      lastActionId: action.id,
      actionStatus: 'blocked',
      compatibility: {
        tool: action.tool,
        status: 'missing_context',
        message: note
      },
      note,
      updatedAt: Date.now()
    })
    setConversationStatus('delegate 动作需要兼容性处理')
  }

  async function handleProtocolToolAction(
    messageId: string,
    message: UiProtocolMessage,
    action: ProtocolAction
  ): Promise<void> {
    if (action.tool === 'plan_decision') {
      await handlePlanDecisionAction(messageId, message, action)
      return
    }

    const compatibilityMessage = getWorkbookCompatibilityMessage(action.tool)
    if (compatibilityMessage) {
      await applyProtocolState(messageId, {
        ...normalizeProtocolState(message.protocolState),
        lastActionId: action.id,
        actionStatus: 'blocked',
        compatibility: {
          tool: action.tool,
          status: 'missing_context',
          message: compatibilityMessage
        },
        note: compatibilityMessage,
        updatedAt: Date.now()
      })
      setConversationStatus('协议动作需要当前工作台兼容上下文')
      return
    }

    await applyProtocolState(messageId, {
      ...normalizeProtocolState(message.protocolState),
      lastActionId: action.id,
      actionStatus: 'error',
      note: `暂不支持协议动作：${action.tool || action.type}`,
      updatedAt: Date.now()
    })
    setConversationStatus('协议动作暂不支持')
  }

  async function handlePlanDecisionAction(
    messageId: string,
    message: UiProtocolMessage,
    action: ProtocolAction
  ): Promise<void> {
    const sessionId = activeSessionId.value
    if (!activeAgentId.value || !sessionId) return

    const decision = action.toolInput?.decision === 'approve' ? 'approve' : 'revise'
    const submittingState: ProtocolMessageState = {
      ...normalizeProtocolState(message.protocolState),
      lastActionId: action.id,
      actionStatus: 'submitting',
      decision,
      updatedAt: Date.now()
    }
    await applyProtocolState(messageId, submittingState)

    try {
      const result = await agentApi.decidePlan(
        activeAgentId.value,
        sessionId,
        decision,
        typeof action.toolInput?.planId === 'string' ? action.toolInput.planId : undefined
      )
      const resolvedState = buildPlanProtocolState(action, result, message.protocol, message.protocolState)
      updateProtocolMessageState(messageId, resolvedState)
      await persistProtocolStateForMessage(messageId, resolvedState)
      sessions.value = upsertSessionListItem(sessions.value, result.session)
      syncSessionPlanSummary(sessionId)
      setSessionPlanSummary(sessionId, result.plan.summary)
      setConversationStatus(decision === 'approve' ? '计划已批准' : '计划保持待修改', sessionId)
      await reloadSessionState(sessionId)
    } catch (err) {
      const failedState: ProtocolMessageState = {
        ...normalizeProtocolState(message.protocolState),
        lastActionId: action.id,
        actionStatus: 'error',
        decision,
        note: (err as Error).message,
        updatedAt: Date.now()
      }
      await applyProtocolState(messageId, failedState)
      setConversationStatus(decision === 'approve' ? '计划批准受阻' : '计划修改失败', sessionId)
      throw err
    }
  }

  function buildPlanProtocolState(
    action: ProtocolAction,
    result: DecidePlanResponse,
    protocol: UiProtocolMessage['protocol'],
    protocolState: UiProtocolMessage['protocolState']
  ): ProtocolMessageState {
    const decision = action.toolInput?.decision === 'approve' ? 'approve' : 'revise'
    const renderedProtocol = getRenderedProtocolPayload(protocol, protocolState)
    return {
      lastActionId: action.id,
      actionStatus: 'done',
      decision,
      note: decision === 'approve'
        ? '计划已批准，切换到 build。'
        : '计划保持在 plan，可继续修改。',
      message: buildConvergedProtocolMessage(renderedProtocol, {
        removeActionIds: [action.id]
      }),
      planId: result.plan.planId,
      planStatus: result.plan.status,
      updatedAt: Date.now()
    }
  }

  function updateProtocolMessageState(messageId: string, protocolState: ProtocolMessageState): void {
    updateDisplayedMessage(messageId, message => {
      if (message.kind !== 'protocol') return message
      return {
        ...message,
        protocol: getRenderedProtocolPayload(message.protocol, protocolState),
        protocolState
      }
    })
  }

  async function persistProtocolStateForMessage(
    messageId: string,
    protocolState: ProtocolMessageState
  ): Promise<void> {
    if (!activeAgentId.value || !activeSessionId.value) return
    const message = messages.value.find(item => item.id === messageId)
    if (!message || message.kind !== 'protocol' || typeof message.messageId !== 'number') return
    await agentApi.updateProtocolState(
      activeAgentId.value,
      activeSessionId.value,
      message.messageId,
      protocolState
    )
  }

  async function uploadFiles(fileList: FileList | File[]): Promise<void> {
    const { acceptedFiles, rejectedFiles } = splitComposerUploadFiles(Array.from(fileList))
    if (rejectedFiles.length > 0) {
      error.value = buildComposerUploadError(rejectedFiles)
      setWorkspaceStatus('文件上传失败')
      return
    }
    if (!acceptedFiles.length || !activeAgentId.value) return
    if (isSessionInputBlocked.value) {
      error.value = PENDING_INTERACTION_BLOCKED_MESSAGE
      setWorkspaceStatus('请先回答当前问题')
      return
    }
    if (isActiveSessionRunning.value) {
      error.value = '当前会话还在处理中，请等它结束后再上传文件。'
      setWorkspaceStatus('当前会话运行中')
      return
    }

    isUploading.value = true
    error.value = null
    setWorkspaceStatus('正在上传文件...')

    try {
      let uploadedCount = 0
      for (const file of acceptedFiles) {
        uploadedCount += Number(await uploadWorkspaceFileWithConfirmation(activeAgentId.value, file))
      }
      if (uploadedCount > 0 && activeAgentId.value) {
        agentWorkspace.value = await agentApi.getWorkspace(activeAgentId.value)
      }
      selectedWorkspaceFileId.value = workspaceFiles.value.at(-1)?.fileId || selectedWorkspaceFileId.value
      reconcileWorkspaceState()
      setWorkspaceStatus(buildUploadCompletionStatus(uploadedCount))
    } catch (err) {
      error.value = (err as Error).message
      setWorkspaceStatus('文件上传失败')
    } finally {
      isUploading.value = false
    }
  }

  async function deleteWorkspaceFile(fileId: string): Promise<void> {
    if (!activeAgentId.value) return
    const entry = resolveWorkspaceEntryById(fileId)
    if (!entry) return

    const blockMessage = resolveWorkspaceActionBlock(fileId, '删除')
    if (blockMessage) {
      blockWorkspaceAction(blockMessage)
      return
    }

    error.value = null
    setWorkspaceStatus(entry.nodeType === 'folder' ? '正在删除文件夹...' : '正在删除文件...')

    try {
      const fileKey = entry.nodeType === 'folder' ? entry.folderKey : entry.fileKey
      await agentApi.deleteWorkspaceFile(activeAgentId.value, fileKey)
      agentWorkspace.value = await agentApi.getWorkspace(activeAgentId.value)
      reconcileWorkspaceState()
      setWorkspaceStatus(`已删除 ${resolveWorkspaceLeafName(entry.fileName)}`)
    } catch (err) {
      error.value = (err as Error).message
      setWorkspaceStatus(entry.nodeType === 'folder' ? '文件夹删除失败' : '文件删除失败')
    }
  }

  async function renameWorkspaceFile(fileId: string, nextFileName: string): Promise<boolean> {
    if (!activeAgentId.value) return false
    const sidebarFile = workspaceFilesById.value.get(fileId)
    if (!sidebarFile) return false
    const normalizedFileName = nextFileName.trim()

    const blockMessage = resolveWorkspaceActionBlock(fileId, '重命名')
    if (blockMessage) {
      blockWorkspaceAction(blockMessage)
      return false
    }

    try {
      buildWorkspaceRenameTarget(normalizedFileName, '')
    } catch (err) {
      error.value = (err as Error).message
      setWorkspaceStatus('文件重命名失败')
      return false
    }

    if (normalizedFileName === sidebarFile.fileName) {
      return true
    }

    error.value = null
    setWorkspaceStatus('正在重命名文件...')

    try {
      const renamedFile = await agentApi.renameWorkspaceFile(activeAgentId.value, sidebarFile.fileKey, normalizedFileName)
      applyRenamedWorkspaceFile(fileId, renamedFile)
      agentWorkspace.value = await agentApi.getWorkspace(activeAgentId.value)
      reconcileWorkspaceState()
      setWorkspaceStatus(`已重命名为 ${resolveWorkspaceLeafName(renamedFile.fileName)}`)
      return true
    } catch (err) {
      error.value = (err as Error).message
      setWorkspaceStatus('文件重命名失败')
      return false
    }
  }

  function resolveSelectedWorkspaceEntry(): WorkspaceSidebarEntry | null {
    if (!selectedWorkspaceFileId.value) {
      return null
    }
    return workspaceEntriesById.value.get(selectedWorkspaceFileId.value)
      || workspaceEntriesByFileId.value.get(selectedWorkspaceFileId.value)
      || null
  }

  function resolveWorkspaceEntryById(entryId: string): WorkspaceSidebarEntry | null {
    return workspaceEntriesById.value.get(entryId)
      || workspaceEntriesByFileId.value.get(entryId)
      || null
  }

  function resolveSelectedProjectParentPath(): string {
    const selectedEntry = resolveSelectedWorkspaceEntry()
    if (!selectedEntry || selectedEntry.groupId !== 'project') {
      return ''
    }
    if (selectedEntry.nodeType === 'folder') {
      return selectedEntry.relativePath
    }
    const segments = selectedEntry.relativePath.split('/').filter(Boolean)
    segments.pop()
    return segments.join('/')
  }

  function resolveCreateProjectParentPath(parentPath?: string | null): string {
    if (parentPath === null) {
      return ''
    }
    if (typeof parentPath === 'string') {
      return parentPath
    }
    return resolveSelectedProjectParentPath()
  }

  async function createProjectEntry(
    kind: 'folder' | 'txt' | 'md',
    fileName: string,
    parentPath?: string | null
  ): Promise<boolean> {
    if (!activeAgentId.value) return false
    const label = kind === 'folder' ? '文件夹' : kind.toUpperCase()
    const normalizedFileName = fileName.trim()
    if (!normalizedFileName) {
      return false
    }

    error.value = null
    setWorkspaceStatus(`正在创建${label}...`)

    try {
      const created = await agentApi.createProjectEntry(activeAgentId.value, {
        kind,
        fileName: normalizedFileName,
        parentPath: resolveCreateProjectParentPath(parentPath) || undefined
      })
      agentWorkspace.value = await agentApi.getWorkspace(activeAgentId.value)
      reconcileWorkspaceState()
      if ('fileKey' in created) {
        await openWorkspaceFile(created.fileId)
      } else {
        selectedWorkspaceFileId.value = created.nodeId
      }
      setWorkspaceStatus(`已创建${label}`)
      return true
    } catch (err) {
      error.value = (err as Error).message
      setWorkspaceStatus(`创建${label}失败`)
      return false
    }
  }

  async function renameProjectFolder(folderKey: string, nextFolderName: string): Promise<boolean> {
    if (!activeAgentId.value) return false
    const entry = workspaceEntriesById.value.get(folderKey)
    if (!entry || entry.nodeType !== 'folder') return false

    const blockMessage = resolveWorkspaceActionBlock(folderKey, '重命名')
    if (blockMessage) {
      blockWorkspaceAction(blockMessage)
      return false
    }

    try {
      buildWorkspaceRenameTarget(nextFolderName.trim(), '')
    } catch (err) {
      error.value = (err as Error).message
      setWorkspaceStatus('文件夹重命名失败')
      return false
    }

    error.value = null
    setWorkspaceStatus('正在重命名文件夹...')

    try {
      await agentApi.renameProjectFolder(activeAgentId.value, folderKey, nextFolderName.trim())
      agentWorkspace.value = await agentApi.getWorkspace(activeAgentId.value)
      reconcileWorkspaceState()
      selectedWorkspaceFileId.value = folderKey
      setWorkspaceStatus(`已重命名为 ${resolveWorkspaceLeafName(nextFolderName)}`)
      return true
    } catch (err) {
      error.value = (err as Error).message
      setWorkspaceStatus('文件夹重命名失败')
      return false
    }
  }

  async function downloadWorkspaceFile(fileId: string): Promise<void> {
    if (!activeAgentId.value) return
    const sidebarFile = workspaceFilesById.value.get(fileId)
    if (!sidebarFile) return

    error.value = null
    setWorkspaceStatus('正在下载文件...')

    try {
      const download = await agentApi.downloadWorkspaceFile(activeAgentId.value, sidebarFile.fileKey)
      triggerWorkspaceFileDownload(download)
      setWorkspaceStatus(`已下载 ${download.fileName}`)
    } catch (err) {
      error.value = (err as Error).message
      setWorkspaceStatus('文件下载失败')
    }
  }

  async function copyWorkspaceFileName(fileId: string): Promise<void> {
    const sidebarFile = workspaceFilesById.value.get(fileId)
    if (!sidebarFile) return

    error.value = null
    setWorkspaceStatus('正在复制文件名...')

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('当前环境不支持剪贴板写入。')
      }
      await navigator.clipboard.writeText(sidebarFile.fileName)
      setWorkspaceStatus(`已复制文件名 ${sidebarFile.fileName}`)
    } catch (err) {
      error.value = (err as Error).message
      setWorkspaceStatus('复制文件名失败')
    }
  }

  async function deleteSession(sessionId: string): Promise<void> {
    if (!activeAgentId.value) return
    const rollback = createDeletedSessionRollback(sessionId)
    if (!rollback) {
      return
    }

    error.value = null
    rememberDeletedSessionRollback(rollback)
    clearSessionForDeletion(sessionId)
    if (rollback.wasActive) {
      activateBlankConversation('已删除当前会话')
    }

    try {
      await agentApi.deleteSession(activeAgentId.value, sessionId)
      clearDeletedSessionRollback(sessionId)
      if (rollback.wasActive) {
        void refreshActiveAgentGovernance()
        return
      }
      setWorkspaceStatus('已删除会话')
    } catch (err) {
      restoreDeletedSession(rollback)
      error.value = (err as Error).message
      setWorkspaceStatus('会话删除失败')
    }
  }

  async function clearHistorySessions(): Promise<void> {
    if (!activeAgentId.value) {
      return
    }
    const preservedSessionId = activeSessionId.value
    const deletableSessionIds = new Set(
      sessions.value
        .filter(session => session.sessionId !== preservedSessionId && !session.activity.active)
        .map(session => session.sessionId)
    )
    if (deletableSessionIds.size === 0) {
      setWorkspaceStatus('暂无可清空历史会话')
      return
    }

    const result = await agentApi.clearHistorySessions(activeAgentId.value, preservedSessionId)
    const deletedSessionIds = new Set(
      [...deletableSessionIds].filter(sessionId => !result.skippedActiveSessionIds.includes(sessionId))
    )
    for (const sessionId of deletedSessionIds) {
      clearSessionForDeletion(sessionId)
    }
    setWorkspaceStatus(buildClearHistoryStatus(result.deletedCount, result.skippedActiveSessionIds.length))
  }

  function setSkillSearchQuery(value: string): void {
    skillSearchQuery.value = value
  }

  function selectStarterSkill(id: string | null): void {
    selectedStarterSkillId.value = id
  }

  const selectedStarterSkill = computed<StarterSkillView | null>(() => {
    if (!selectedStarterSkillId.value) return null
    return visibleSkills.value.find(skill => skill.id === selectedStarterSkillId.value) || null
  })

  function resolveWorkspaceActionBlock(
    fileId: string,
    actionLabel: '删除' | '重命名'
  ): string | null {
    const entry = resolveWorkspaceEntryById(fileId)
    if (isRunning.value) {
      return buildRunningActionBlockedMessage(actionLabel, entry?.nodeType === 'folder' ? 'folder' : 'file')
    }
    if (!entry) {
      return null
    }
    if (entry.nodeType === 'file') {
      const file = workspaceEditorFiles.value[entry.fileId]
      if (file?.isDirty) {
        return buildDirtyActionBlockedMessage(actionLabel, file.fileName)
      }
      return null
    }

    const dirtyFile = workspaceFiles.value.find(file => {
      if (!workspaceEditorFiles.value[file.fileId]?.isDirty) {
        return false
      }
      return isRelativePathWithin(file.relativePath, entry.relativePath)
    })
    if (dirtyFile) {
      return buildDirtyFolderActionBlockedMessage(
        actionLabel,
        resolveWorkspaceLeafName(entry.fileName),
        resolveWorkspaceLeafName(dirtyFile.fileName)
      )
    }
    return null
  }

  function blockWorkspaceAction(message: string): void {
    error.value = message
    setWorkspaceStatus(message)
    window.alert(message)
  }

  function syncWorkspaceEditorMetadata(): void {
    workspaceEditorFiles.value = Object.fromEntries(
      Object.entries(workspaceEditorFiles.value).map(([fileId, file]) => {
        const sidebarFile = workspaceFilesById.value.get(fileId)
        return [fileId, sidebarFile ? mergeSidebarMetadataIntoEditor(file, sidebarFile) : file]
      })
    )
  }

  function applyRenamedWorkspaceFile(fileId: string, renamedFile: WorkspaceFileDescriptor): void {
    const current = workspaceEditorFiles.value[fileId]
    if (!current) return
    workspaceEditorFiles.value = {
      ...workspaceEditorFiles.value,
      [fileId]: mergeRenamedDescriptorIntoEditor(current, renamedFile, fileId)
    }
  }

  function selectWorkspaceFile(fileId: string): void {
    if (workspaceEntriesById.value.has(fileId) || workspaceEntriesByFileId.value.has(fileId)) {
      selectedWorkspaceFileId.value = fileId
    }
  }

  async function reloadWorkspaceEditorFile(fileId: string): Promise<WorkspaceEditorFileState | null> {
    const sidebarFile = workspaceFilesById.value.get(fileId)
    if (!sidebarFile) return null

    try {
      const openedFile = await agentApi.openWorkspaceFile(sidebarFile.fileKey)
      const state = buildWorkspaceEditorFileState(openedFile, fileId)
      workspaceEditorFiles.value = {
        ...workspaceEditorFiles.value,
        [fileId]: state
      }
      return state
    } catch (err) {
      error.value = (err as Error).message
      setWorkspaceStatus('文件打开失败')
      return null
    }
  }

  async function ensureWorkspaceFileLoaded(fileId: string): Promise<WorkspaceEditorFileState | null> {
    if (workspaceEditorFiles.value[fileId]) {
      return workspaceEditorFiles.value[fileId]
    }
    return reloadWorkspaceEditorFile(fileId)
  }

  async function refreshOpenWorkspaceFilesAfterRun(): Promise<void> {
    const openFileIds = [...openWorkspaceFileIds.value]
    for (const fileId of openFileIds) {
      const current = workspaceEditorFiles.value[fileId]
      if (!current || current.isDirty) {
        continue
      }
      await reloadWorkspaceEditorFile(fileId)
    }
  }

  async function openWorkspaceFile(fileId: string): Promise<void> {
    if (!workspaceFilesById.value.has(fileId)) {
      error.value = '文件不可用或已过期'
      setWorkspaceStatus('无法打开引用文件')
      return
    }
    if (activeWorkspaceFileId.value && activeWorkspaceFileId.value !== fileId && workspaceEditorFiles.value[activeWorkspaceFileId.value]?.isDirty) {
      await saveWorkspaceFile(activeWorkspaceFileId.value)
      if (workspaceEditorFiles.value[activeWorkspaceFileId.value]?.saveStatus === 'error') {
        return
      }
    }
    selectedWorkspaceFileId.value = fileId
    if (!openWorkspaceFileIds.value.includes(fileId)) {
      openWorkspaceFileIds.value = [...openWorkspaceFileIds.value, fileId]
    }
    activeWorkspaceFileId.value = fileId
    workspaceEditorOpen.value = true
    const loaded = await ensureWorkspaceFileLoaded(fileId)
    if (!loaded) {
      await closeWorkspaceFile(fileId)
      error.value = error.value || '文件不可用'
    }
  }

  async function closeWorkspaceFile(fileId: string): Promise<void> {
    if (workspaceEditorFiles.value[fileId]?.isDirty) {
      await saveWorkspaceFile(fileId)
      if (workspaceEditorFiles.value[fileId]?.saveStatus === 'error') {
        return
      }
    }
    openWorkspaceFileIds.value = openWorkspaceFileIds.value.filter(id => id !== fileId)
    if (selectedWorkspaceFileId.value === fileId) {
      selectedWorkspaceFileId.value = activeWorkspaceFileId.value === fileId ? openWorkspaceFileIds.value.at(-1) || null : null
    }
    if (activeWorkspaceFileId.value === fileId) {
      activeWorkspaceFileId.value = openWorkspaceFileIds.value.at(-1) || null
    }
    reconcileWorkspaceEditorState()
  }

  function updateWorkspaceFileContent(fileId: string, content: string): void {
    const current = workspaceEditorFiles.value[fileId]
    if (!current) return
    const nextMetadata = current.mode === 'mml'
      ? (parseMmlMetadata(content) || current.mmlMetadata)
      : current.mmlMetadata
    workspaceEditorFiles.value = {
      ...workspaceEditorFiles.value,
      [fileId]: {
        ...current,
        content,
        mmlMetadata: nextMetadata,
        isDirty: true,
        saveStatus: 'idle',
        saveError: null
      }
    }
  }

  function updateWorkspaceMmlMetadata(fileId: string, metadata: WorkspaceMmlMetadata): void {
    const current = workspaceEditorFiles.value[fileId]
    if (!current) return
    workspaceEditorFiles.value = {
      ...workspaceEditorFiles.value,
      [fileId]: {
        ...current,
        mode: 'mml',
        mmlMetadata: metadata,
        isDirty: true,
        saveStatus: 'idle',
        saveError: null
      }
    }
  }

  async function saveWorkspaceFile(fileId = activeWorkspaceFileId.value): Promise<void> {
    if (!fileId) return
    const current = workspaceEditorFiles.value[fileId]
    if (!current) return
    workspaceEditorFiles.value = {
      ...workspaceEditorFiles.value,
      [fileId]: {
        ...current,
        saveStatus: 'saving',
        saveError: null
      }
    }

    try {
      const savedFile = await agentApi.saveWorkspaceFile(current.fileKey, {
        content: current.content,
        mode: current.mode,
        mmlMetadata: current.mmlMetadata
      })
      workspaceEditorFiles.value = {
        ...workspaceEditorFiles.value,
        [fileId]: {
          ...buildWorkspaceEditorFileState(savedFile, fileId),
          saveStatus: 'saved'
        }
      }
      setWorkspaceStatus(`已保存 ${savedFile.fileName}`)
    } catch (err) {
      const message = (err as Error).message
      workspaceEditorFiles.value = {
        ...workspaceEditorFiles.value,
        [fileId]: {
          ...current,
          saveStatus: 'error',
          saveError: message
        }
      }
      error.value = message
      setWorkspaceStatus('文件保存失败')
    }
  }

  async function continueProcessingCurrentFile(): Promise<void> {
    const activeFileId = activeWorkspaceFileId.value
    if (!activeFileId) return
    if (workspaceEditorFiles.value[activeFileId]?.isDirty) {
      await saveWorkspaceFile(activeFileId)
      if (workspaceEditorFiles.value[activeFileId]?.saveStatus === 'error') {
        return
      }
    }
    await runConversationInput({
      input: '请基于当前活动文件的最新内容继续处理。',
      displayInput: '继续处理当前文件'
    })
  }

  function setWorkspaceSidebarCollapsed(nextValue: boolean): void {
    workspaceSidebarCollapsed.value = nextValue
  }

  function setWorkspaceSidebarTab(nextTab: WorkspaceSidebarTab): void {
    workspaceSidebarTab.value = nextTab
  }

  async function autoSaveWorkspaceFile(fileId: string): Promise<void> {
    if (!workspaceEditorFiles.value[fileId]?.isDirty) return
    await saveWorkspaceFile(fileId)
  }

  async function uploadWorkspaceFileWithConfirmation(agentId: string, file: File): Promise<boolean> {
    const relativePath = resolveUploadRelativePath(file)
    try {
      await agentApi.uploadFile(agentId, file, false, relativePath)
      return true
    } catch (err) {
      const conflict = err as Error & { code?: string; path?: string }
      if (conflict.code !== 'UPLOAD_CONFLICT') {
        throw err
      }
      const confirmed = await requestUploadConflictDecision(agentId, file, relativePath, conflict.path)
      if (!confirmed) {
        return false
      }
      await agentApi.uploadFile(agentId, file, true, relativePath)
      return true
    }
  }

  async function createSessionFromDraft(seedTitle?: string): Promise<string> {
    if (!activeAgentId.value) {
      throw new Error('No active agent available')
    }

    const session = await agentApi.createSession(activeAgentId.value, seedTitle)
    sessions.value = upsertSessionListItem(sessions.value, session)
    syncSessionRuntimeFromSessions(sessions.value)
    activeSessionId.value = session.sessionId
    setSessionMessages(session.sessionId, [...draftMessages.value])
    draftMessages.value = []
    blankComposerDraft.value = ''
    setConversationStatus(`已创建会话：${session.title}`, session.sessionId)
    reconcileWorkspaceState()
    return session.sessionId
  }

  function appendDisplayedMessages(nextMessages: UiMessage[], sessionId: string | null = activeSessionId.value): void {
    if (sessionId) {
      if (isSessionDeletedLocally(sessionId)) {
        return
      }
      setSessionMessages(sessionId, [
        ...readSessionState(sessionId).messages,
        ...nextMessages
      ])
      return
    }
    draftMessages.value = [...draftMessages.value, ...nextMessages]
  }

  function updateDisplayedMessage(
    id: string,
    updater: (message: UiMessage) => UiMessage,
    sessionId: string | null = activeSessionId.value
  ): void {
    if (sessionId) {
      if (isSessionDeletedLocally(sessionId)) {
        return
      }
      setSessionMessages(
        sessionId,
        readSessionState(sessionId).messages.map(message => message.id === id ? updater(message) : message)
      )
      return
    }
    draftMessages.value = draftMessages.value.map(message => message.id === id ? updater(message) : message)
  }

  function toggleAssistantReadingMode(messageId: string): void {
    const currentMessage = messages.value.find(message => message.id === messageId)
    if (!currentMessage || currentMessage.kind !== 'text') return
    if (!currentMessage.readingModeEligible || currentMessage.role !== 'assistant') return

    const nextDisplayMode: AssistantTextDisplayMode = currentMessage.displayMode === 'reading'
      ? 'raw'
      : 'reading'
    rememberAssistantTextViewOverride(currentMessage, nextDisplayMode)
    updateDisplayedMessage(messageId, message => {
      if (message.kind !== 'text') return message
      return applyAssistantTextPresentation(message, nextDisplayMode)
    })
  }

  function resetWorkspaceShellState(): void {
    workspaceSidebarTab.value = 'workspace'
    workspaceSidebarCollapsed.value = false
    selectedWorkspaceFileId.value = null
    openWorkspaceFileIds.value = []
    activeWorkspaceFileId.value = null
    workspaceEditorOpen.value = false
    workspaceEditorFiles.value = {}
  }

  function reconcileWorkspaceEditorState(): void {
    if (!workspaceEditorOpen.value) return
    if (!openWorkspaceFileIds.value.length || !activeWorkspaceFileId.value) {
      workspaceEditorOpen.value = false
    }
  }

  function reconcileWorkspaceState(): void {
    const availableFileIds = new Set(workspaceFiles.value.map(file => file.fileId))
    const availableNodeIds = new Set(workspaceEntries.value.map(entry => entry.nodeId))
    openWorkspaceFileIds.value = openWorkspaceFileIds.value.filter(fileId => availableFileIds.has(fileId))
    workspaceEditorFiles.value = Object.fromEntries(
      Object.entries(workspaceEditorFiles.value).filter(([fileId]) => availableFileIds.has(fileId))
    )
    syncWorkspaceEditorMetadata()
    if (selectedWorkspaceFileId.value && !availableNodeIds.has(selectedWorkspaceFileId.value)) {
      selectedWorkspaceFileId.value = activeWorkspaceFileId.value && availableFileIds.has(activeWorkspaceFileId.value)
        ? activeWorkspaceFileId.value
        : openWorkspaceFileIds.value.at(-1) || workspaceFiles.value[0]?.fileId || null
    }
    if (activeWorkspaceFileId.value && !availableFileIds.has(activeWorkspaceFileId.value)) {
      activeWorkspaceFileId.value = openWorkspaceFileIds.value.at(-1) || null
    }
    if (!selectedWorkspaceFileId.value && activeWorkspaceFileId.value && availableFileIds.has(activeWorkspaceFileId.value)) {
      selectedWorkspaceFileId.value = activeWorkspaceFileId.value
    }
    reconcileWorkspaceEditorState()
  }

  function reconcileEditRerunState(): void {
    const target = editRerunTarget.value
    if (!target) return
    const lastEditable = lastEditableUserMessage.value
    if (!lastEditable || lastEditable.messageId !== target.messageId) {
      clearEditRerunState()
    }
  }

  function truncateDisplayedSessionMessages(messageId: number): void {
    if (!activeSessionId.value) {
      return
    }
    setSessionMessages(activeSessionId.value, readSessionState(activeSessionId.value).messages.filter(message => {
      if (!isPersistedMessageId(message.messageId)) {
        return false
      }
      return message.messageId < messageId
    }))
  }

  return {
    isInitializing,
    isRunning,
    isUploading,
    error,
    workspaceStatus,
    latestStatus,
    latestPlanSummary,
    agents,
    activeAgentId,
    activeAgent,
    runtimeBootstrap,
    sessions,
    sessionUsageById,
    activeSessionId,
    activeSession,
    messages,
    composerDraft,
    skillSearchQuery,
    selectedStarterSkillId,
    selectedStarterSkill,
    starterGroups,
    searchableSkills,
    currentWorkspace,
    workspaceTasks,
    workspaceFiles,
    workspaceDirtyFileIds,
    workspaceOpen,
    uploadConflictConfirmation,
    workspaceSidebarTab,
    workspaceSidebarCollapsed,
    selectedWorkspaceFileId,
    openedWorkspaceFiles,
    activeWorkspaceFileId,
    activeWorkspaceFile,
    latestAssistantMessage,
    workspaceOccupancy,
    workspaceOwnerSession,
    isWorkspaceOccupiedByAnotherSession,
    composerLockReason,
    historyLockReason,
    sharedWorkspaceLockReason,
    activeRunId,
    isActiveSessionRunning,
    canStopActiveRun,
    isStopPending,
    pendingInteraction: activePendingInteraction,
    isSessionInputBlocked,
    editableUserMessageId,
    editRerunTarget,
    initialize,
    reset,
    selectAgent,
    refreshActiveAgentGovernance,
    refreshSessions,
    loadSessionUsage,
    selectSession,
    startNewConversation,
    sendPrompt,
    stopCurrentRun,
    startEditRerun,
    cancelEditRerun,
    submitEditRerun,
    toggleAssistantReadingMode,
    replyPendingInteraction,
    rejectPendingInteraction,
    applyProtocolState,
    executeProtocolAction,
    confirmUploadConflict,
    cancelUploadConflict,
    uploadFiles,
    createProjectEntry,
    renameWorkspaceFile,
    renameProjectFolder,
    copyWorkspaceFileName,
    downloadWorkspaceFile,
    deleteWorkspaceFile,
    deleteSession,
    clearHistorySessions,
    setComposerDraft,
    setSkillSearchQuery,
    selectStarterSkill,
    selectWorkspaceFile,
    openWorkspaceFile,
    updateWorkspaceFileContent,
    updateWorkspaceMmlMetadata,
    saveWorkspaceFile,
    autoSaveWorkspaceFile,
    continueProcessingCurrentFile,
    closeWorkspaceFile,
    setWorkspaceSidebarCollapsed,
    setWorkspaceSidebarTab
  }
})
