import { ToolInvocationError } from '../toolInvocationError.js'
import { DeletedSessionWriteError } from '../sessionStore.js'
import type { ModelRequestDiagnostics } from '../modelRequestError.js'
import { isModelRequestError } from '../modelRequestError.js'
import { isAgentExecutionError } from '../executionErrors.js'
import type { RuntimeError, RuntimeErrorCode, RuntimeErrorStage } from '../types.js'
import type { WorkspaceOccupancy } from './types.js'
import { createLogger } from '../../logging/index.js'

const runtimeErrorLogger = createLogger({
  category: 'runtime',
  component: 'runtime_errors'
})

export class WorkspaceOccupancyConflictError extends Error {
  readonly code: 'WORKSPACE_OCCUPIED'
  readonly occupancy: WorkspaceOccupancy

  constructor(message: string, occupancy: WorkspaceOccupancy) {
    super(message)
    this.name = 'WorkspaceOccupancyConflictError'
    this.code = 'WORKSPACE_OCCUPIED'
    this.occupancy = occupancy
  }
}

export function isWorkspaceOccupancyConflictError(
  error: unknown
): error is WorkspaceOccupancyConflictError {
  if (!(error instanceof Error)) {
    return false
  }
  const candidate = error as Error & {
    code?: string
    occupancy?: WorkspaceOccupancy
  }
  return candidate.code === 'WORKSPACE_OCCUPIED' && Boolean(candidate.occupancy)
}

export function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export function isAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.name === 'AbortError' || /aborted|abort/i.test(error.message)
}

export function isToolInvocationError(error: unknown): error is ToolInvocationError {
  return error instanceof ToolInvocationError
}

export function buildRuntimeError(params: {
  message: string
  cancelled: boolean
  runId?: string
  provider?: string
  detail?: string
  failureKind?: RuntimeError['failureKind']
  requestUrl?: string
  modelDiagnostics?: ModelRequestDiagnostics
  retryable?: boolean
  status?: number
  toolCallId?: string
  turnId?: string
  toolName?: string
  isToolError?: boolean
  stopReason?: RuntimeError['stopReason']
  normalizedCode?: string
  chainKey?: string
  attempt?: number
  remainingRecoveryBudget?: number
  runtimeRetryCount?: number
  threshold?: number
  denyOrigin?: string
}): RuntimeError {
  const code = classifyTerminalErrorCode(params.message, params.cancelled, params.failureKind)
  const isToolError = Boolean(params.isToolError)
  const stage: RuntimeErrorStage = code === 'MODEL'
    ? 'model'
    : (isToolError ? 'tool' : 'finalize')
  const retryable = params.retryable ?? (code === 'MODEL' ? isRetryableModelError(params.message) : false)

  return {
    code,
    stage,
    retryable,
    userMessage: resolveUserMessage({
      code,
      message: params.message,
      failureKind: params.failureKind,
      isToolError,
      toolName: params.toolName,
      cancelled: params.cancelled,
      stopReason: params.stopReason
    }),
    runId: params.runId,
    detail: params.detail ?? params.message,
    failureKind: params.failureKind,
    provider: params.provider,
    requestUrl: params.requestUrl,
    modelDiagnostics: params.modelDiagnostics,
    status: params.status,
    toolCallId: params.toolCallId,
    turnId: params.turnId,
    toolName: params.toolName,
    stopReason: params.stopReason,
    normalizedCode: params.normalizedCode,
    chainKey: params.chainKey,
    attempt: params.attempt,
    remainingRecoveryBudget: params.remainingRecoveryBudget,
    runtimeRetryCount: params.runtimeRetryCount,
    threshold: params.threshold,
    denyOrigin: params.denyOrigin
  }
}

export function logRuntimeError(message: string, runtimeError: RuntimeError): void {
  runtimeErrorLogger.warn({
    message: 'runtime error recorded',
    context: {
      runId: runtimeError.runId,
      turnId: runtimeError.turnId
    },
    data: {
      ...buildRuntimeErrorLogMessage(message),
      userMessage: runtimeError.userMessage,
      code: runtimeError.code,
      stage: runtimeError.stage,
      ...(runtimeError.failureKind ? { failureKind: runtimeError.failureKind } : {}),
      ...(runtimeError.requestUrl ? { requestUrl: runtimeError.requestUrl } : {}),
      ...(runtimeError.modelDiagnostics ? { modelDiagnostics: runtimeError.modelDiagnostics } : {}),
      ...(runtimeError.status ? { status: runtimeError.status } : {}),
      ...(runtimeError.toolName ? { toolName: runtimeError.toolName } : {}),
      ...(runtimeError.stopReason ? { stopReason: runtimeError.stopReason } : {}),
      ...(runtimeError.normalizedCode ? { normalizedCode: runtimeError.normalizedCode } : {}),
      ...(runtimeError.chainKey ? { chainKey: runtimeError.chainKey } : {}),
      ...(runtimeError.attempt !== undefined ? { attempt: runtimeError.attempt } : {}),
      ...(runtimeError.remainingRecoveryBudget !== undefined ? { remainingRecoveryBudget: runtimeError.remainingRecoveryBudget } : {}),
      ...(runtimeError.runtimeRetryCount !== undefined ? { runtimeRetryCount: runtimeError.runtimeRetryCount } : {}),
      ...(runtimeError.threshold !== undefined ? { threshold: runtimeError.threshold } : {}),
      ...(runtimeError.denyOrigin ? { denyOrigin: runtimeError.denyOrigin } : {})
    }
  })
}

function buildRuntimeErrorLogMessage(message: string): Record<string, unknown> {
  const lines = message.split('\n')
  if (lines.length === 1) {
    return { message }
  }

  const result: Record<string, unknown> = {
    message: lines[0] ?? message
  }

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    if (line.startsWith('body=')) {
      result.body = line.slice('body='.length)
      continue
    }
    if (line.startsWith('summary=')) {
      const summaryText = [
        line.slice('summary='.length),
        ...lines.slice(index + 1)
      ].join('\n').trim()
      result.summary = parseRuntimeErrorSummary(summaryText)
      break
    }
  }

  return result
}

function parseRuntimeErrorSummary(summaryText: string): unknown {
  try {
    return JSON.parse(summaryText) as Record<string, unknown>
  } catch {
    return summaryText
  }
}

function classifyTerminalErrorCode(
  message: string,
  cancelled: boolean,
  failureKind?: RuntimeError['failureKind']
): RuntimeErrorCode {
  if (cancelled) return 'CANCELLED'
  if (failureKind) return 'MODEL'
  if (isModelErrorMessage(message)) return 'MODEL'
  return 'INTERNAL'
}

function resolveUserMessage(params: {
  code: RuntimeErrorCode
  message: string
  failureKind?: RuntimeError['failureKind']
  isToolError: boolean
  toolName?: string
  cancelled: boolean
  stopReason?: RuntimeError['stopReason']
}): string {
  if (params.code === 'CANCELLED') return '请求已取消。'
  if (params.isToolError) {
    return buildToolErrorSummary(params.message, params.toolName, params.stopReason)
  }
  if (/agent loop exceeded max steps/i.test(params.message)) {
    return '智能体执行步数超过限制，当前运行已停止。'
  }
  if (isLengthTruncationMessage(params.message)) {
    return '模型输出因长度限制被截断，请重试，或调大 maxTokens / 缩短上下文。'
  }
  if (params.code === 'MODEL' && (params.failureKind === 'timeout' || params.failureKind === 'timeout_first_byte')) {
    return '模型首包超时，请重试。'
  }
  if (params.code === 'MODEL' && params.failureKind === 'timeout_idle') {
    return '模型流式响应空闲超时，请重试。'
  }
  if (params.code === 'MODEL' && params.failureKind === 'stream_interrupted') {
    return '模型流式响应中断，请重试。'
  }
  if (params.code === 'MODEL' && !shouldExposeInternalMessage(params.message)) {
    return '模型请求失败，请稍后重试。'
  }
  if (shouldExposeInternalMessage(params.message)) return params.message
  return '执行因内部错误失败。'
}

function isModelErrorMessage(message: string): boolean {
  return /model request failed|api key|unauthorized|empty response|missing model|agent loop exceeded max steps|finish_reason|model output truncated/i.test(message)
}

function isRetryableModelError(message: string): boolean {
  return isLengthTruncationMessage(message) || /timeout|temporar|rate|429|5\d\d/i.test(message)
}

function isLengthTruncationMessage(message: string): boolean {
  return /finish_reason\s*=\s*length|model output truncated/i.test(message)
}

function shouldExposeInternalMessage(message: string): boolean {
  return /[\u4e00-\u9fff]/.test(message)
    || /invalid|expected|missing|required|ambiguous|not found|enoent|outside workspace|command exited|bash|script|payload|agent loop exceeded max steps/i.test(message)
}

function buildToolErrorSummary(
  message: string,
  toolName?: string,
  stopReason?: RuntimeError['stopReason']
): string {
  if (/[\u4e00-\u9fff]/.test(message)) {
    return message
  }
  if (stopReason === 'tool_denied') {
    return toolName
      ? `工具 ${toolName} 被拒绝执行，当前运行已停止。`
      : '工具调用被拒绝，当前运行已停止。'
  }
  if (stopReason === 'no_progress_same_failure' || stopReason === 'no_progress_same_outcome') {
    return toolName
      ? `工具 ${toolName} 连续失败且没有进展，当前运行已停止。`
      : '工具连续失败且没有进展，当前运行已停止。'
  }
  if (stopReason === 'model_recovery_exhausted') {
    return toolName
      ? `工具 ${toolName} 修正尝试已耗尽，当前运行已停止。`
      : '工具修正尝试已耗尽，当前运行已停止。'
  }
  const unknownFileKeyMatch = message.match(/Unknown file key:\s*(.+)$/i)
  if (unknownFileKeyMatch) {
    return `未找到上传文件 key：${unknownFileKeyMatch[1].trim()}。请重新上传文件或提供正确的文件 key。`
  }
  if (/(file not found|no such file|enoent)/i.test(message)) {
    return '文件不存在，请确认路径是否正确，或先用 find_files 查询。'
  }
  if (/(parent directory does not exist|no such directory|directory not found)/i.test(message)) {
    return '目标文件的父目录不存在，请先创建目录或改用已存在的路径。'
  }
  if (/unterminated quotes/i.test(message)) {
    return '命令参数引号不完整，请检查输入格式后重试。'
  }
  if (/(command exited|exit code)/i.test(message)) {
    return '工具执行失败，请检查输入参数或脚本输出后重试。'
  }
  return toolName
    ? `工具 ${toolName} 执行失败，请检查输入后重试。`
    : '工具执行失败，请检查输入后重试。'
}

export function buildRuntimeErrorFromUnknown(params: {
  error: unknown
  cancelled: boolean
  runId?: string
  provider?: string
  toolCallId?: string
  turnId?: string
  toolName?: string
  isToolError?: boolean
}): RuntimeError {
  const modelError = unwrapModelRequestError(params.error)
  if (modelError) {
    return buildRuntimeError({
      message: modelError.message,
      detail: buildModelRequestDetail(modelError),
      cancelled: params.cancelled,
      runId: params.runId,
      provider: params.provider,
      failureKind: modelError.failureKind,
      requestUrl: modelError.metrics.requestUrl,
      modelDiagnostics: modelError.diagnostics,
      retryable: modelError.retryable,
      status: modelError.status,
      toolCallId: params.toolCallId,
      turnId: params.turnId,
      toolName: params.toolName,
      isToolError: params.isToolError,
      stopReason: undefined,
      normalizedCode: undefined,
      chainKey: undefined,
      attempt: undefined,
      remainingRecoveryBudget: undefined,
      runtimeRetryCount: undefined,
      threshold: undefined,
      denyOrigin: undefined
    })
  }

  if (params.error instanceof DeletedSessionWriteError) {
    return {
      code: params.cancelled ? 'CANCELLED' : 'INTERNAL',
      stage: 'persist',
      retryable: false,
      userMessage: '会话已删除，本次运行已终止。',
      runId: params.runId,
      detail: params.error.message,
      provider: params.provider,
      turnId: params.turnId
    }
  }

  const toolError = params.error instanceof ToolInvocationError ? params.error : null
  return buildRuntimeError({
    message: resolveErrorMessage(params.error),
    cancelled: params.cancelled,
    runId: params.runId,
    provider: params.provider,
    toolCallId: params.toolCallId ?? toolError?.toolCallId,
    turnId: params.turnId,
    toolName: params.toolName ?? toolError?.toolName,
    isToolError: params.isToolError
      || Boolean(toolError),
    stopReason: toolError?.stopReason,
    normalizedCode: toolError?.normalizedCode,
    chainKey: toolError?.chainKey,
    attempt: toolError?.attempt,
    remainingRecoveryBudget: toolError?.remainingRecoveryBudget,
    runtimeRetryCount: toolError?.runtimeRetryCount,
    threshold: toolError?.threshold,
    denyOrigin: toolError?.denyOrigin
  })
}

function unwrapModelRequestError(error: unknown) {
  if (isModelRequestError(error)) {
    return error
  }
  if (isAgentExecutionError(error) && isModelRequestError(error.cause)) {
    return error.cause
  }
  return null
}

function buildModelRequestDetail(error: {
  detail: string
  metrics: { requestUrl: string }
  diagnostics?: ModelRequestDiagnostics
}): string {
  if (error.detail.includes('requestUrl=')) {
    return error.detail
  }
  return `${error.detail}; requestUrl=${error.metrics.requestUrl}`
}
