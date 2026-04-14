import {
  type LocalQuestionArgs,
  type QuestionFieldInput,
  type PreparedQuestionFields,
  NOTES_FIELD_ID,
  isNonEmptyString,
  normalizeQuestionFields,
  prepareQuestionFields
} from '../runtime/tools/local/questionContract.js'
import type { QuestionContractWarning } from '../runtime/tools/local/questionInputNormalization.js'
import { createQuestionValueKey } from '../runtime/tools/local/questionValue.js'
import { buildPendingQuestionSummary } from './questionSummary.js'

export type AgentSessionInteractionKind = 'question'
export type AgentSessionInteractionStatus = 'pending' | 'answered' | 'rejected'
export const AWAITING_INTERACTION_TEXT = '需要你的输入后才能继续。'
const DEGRADED_ANSWER_LABEL = '手动回答'
const DEGRADED_ANSWER_PLACEHOLDER = '请根据参考信息手动填写主答案'
const DEFAULT_SELECT_FIELD_LABEL = '请选择'
const GENERIC_SELECT_REQUIRED_ERROR = '请选择后再提交。'
const GENERIC_SELECT_INVALID_OPTION_ERROR = '所选内容无效，请重新选择。'

export interface AgentSessionInteractionRecord {
  interactionId: string
  userId: number
  agentId: string
  sessionId: string
  runId: string
  kind: AgentSessionInteractionKind
  status: AgentSessionInteractionStatus
  payload: QuestionInteractionPayload
  answer: Record<string, unknown> | null
  continuationContext: QuestionInteractionContinuationContext | null
  createdAt: number
  resolvedAt: number | null
}

export interface AgentSessionInteractionView {
  interactionId: string
  runId: string
  kind: AgentSessionInteractionKind
  status: AgentSessionInteractionStatus
  payload: QuestionInteractionPayload
  createdAt: number
  resolvedAt: number | null
}

export interface QuestionInteractionPayload {
  questionId: string
  title: string
  prompt: string
  required: boolean
  fields: QuestionFieldInput[]
  degraded?: {
    reason: string
    referenceOptions: string[]
  }
}

export type QuestionInteractionContinuationContext =
  | {
      type: 'answer'
      interactionId: string
      questionId: string
      prompt: string
      answer: Record<string, unknown>
    }
  | {
      type: 'reject'
      interactionId: string
      questionId: string
      prompt: string
    }

export interface PreparedQuestionInteractionPayload {
  payload: QuestionInteractionPayload
  warnings: QuestionContractWarning[]
}

interface AwaitingInteractionDiagnostics {
  warnings?: QuestionContractWarning[]
  degradedFrom?: {
    normalizedCode: string
    retryHint: string
    error: string
    field?: string
    expected?: string
    actual?: string
    fix?: string
  }
}

export function buildQuestionInteractionPayload(args: LocalQuestionArgs): QuestionInteractionPayload {
  return prepareQuestionInteractionPayload(args).payload
}

export function prepareQuestionInteractionPayload(
  args: LocalQuestionArgs
): PreparedQuestionInteractionPayload {
  const questionId = isNonEmptyString(args.id) ? args.id.trim() : crypto.randomUUID()
  const preparedFields = prepareQuestionFields(args)
  return {
    payload: buildQuestionPayload({
      questionId,
      title: args.title,
      prompt: args.prompt,
      required: args.required,
      fields: preparedFields
    }),
    warnings: preparedFields.warnings
  }
}

export function buildDegradedQuestionInteractionPayload(params: {
  prompt: string
  reason: string
  referenceOptions: string[]
}): QuestionInteractionPayload {
  return {
    questionId: crypto.randomUUID(),
    title: '',
    prompt: params.prompt.trim(),
    required: true,
    fields: [
      {
        id: 'answer',
        label: DEGRADED_ANSWER_LABEL,
        type: 'text',
        placeholder: DEGRADED_ANSWER_PLACEHOLDER,
        required: true
      },
      {
        id: NOTES_FIELD_ID,
        label: '补充说明',
        type: 'text',
        placeholder: '可选，补充特殊情况或备注',
        required: false
      }
    ],
    degraded: {
      reason: params.reason,
      referenceOptions: params.referenceOptions
    }
  }
}

export function validateQuestionInteractionAnswer(
  payload: QuestionInteractionPayload,
  answer: unknown
): Record<string, unknown> {
  if (!isRecord(answer)) {
    throw new QuestionInteractionValidationError('问题回答必须是以字段 id 为键的对象。')
  }
  const fieldMap = new Map(payload.fields.map(field => [field.id || '', field]))
  const orderedAnswer: Record<string, unknown> = {}
  Object.keys(answer).forEach(fieldId => {
    if (!fieldMap.has(fieldId)) {
      throw new QuestionInteractionValidationError(`问题回答包含未知字段：${fieldId}。`)
    }
  })
  payload.fields.forEach(field => {
    const fieldId = field.id || ''
    const value = answer[fieldId]
    if (value === undefined) {
      return
    }
    if (field.type === 'select') {
      if (!Array.isArray(field.options) || !matchesSelectOption(field.options, value)) {
        throw new QuestionInteractionValidationError(buildInvalidOptionError(field))
      }
    }
    orderedAnswer[fieldId] = value
  })
  payload.fields.forEach(field => {
    if (field.required !== true && !(field.required === undefined && payload.required)) {
      return
    }
    const value = orderedAnswer[field.id || '']
    if (!isQuestionValuePresent(value)) {
      throw new QuestionInteractionValidationError(buildRequiredFieldError(field))
    }
  })
  return orderedAnswer
}

export function buildAnswerContinuationContext(
  record: Pick<AgentSessionInteractionRecord, 'interactionId' | 'payload'>,
  answer: Record<string, unknown>
): QuestionInteractionContinuationContext {
  return {
    type: 'answer',
    interactionId: record.interactionId,
    questionId: record.payload.questionId,
    prompt: record.payload.prompt,
    answer
  }
}

export function buildRejectContinuationContext(
  record: Pick<AgentSessionInteractionRecord, 'interactionId' | 'payload'>
): QuestionInteractionContinuationContext {
  return {
    type: 'reject',
    interactionId: record.interactionId,
    questionId: record.payload.questionId,
    prompt: record.payload.prompt
  }
}

export function buildContinuationMessageText(
  context: QuestionInteractionContinuationContext
): string {
  if (context.type === 'answer') {
    return [
      '[INTERACTION CONTEXT]',
      `interaction_id: ${context.interactionId}`,
      `question_id: ${context.questionId}`,
      `prompt: ${context.prompt}`,
      `answer: ${JSON.stringify(context.answer)}`
    ].join('\n')
  }
  return [
    '[INTERACTION CONTEXT]',
    `interaction_id: ${context.interactionId}`,
    `question_id: ${context.questionId}`,
    `prompt: ${context.prompt}`,
    'status: rejected'
  ].join('\n')
}

export function buildAwaitingInteractionToolSummary(
  interaction: AgentSessionInteractionView | QuestionInteractionPayload,
  diagnostics?: AwaitingInteractionDiagnostics
): string {
  const interactionView = toAwaitingInteractionView(interaction)
  const summaryDiagnostics = buildAwaitingInteractionDiagnostics(diagnostics)
  return JSON.stringify({
    kind: 'awaiting-interaction',
    interaction: interactionView,
    text: buildPendingQuestionSummary(interactionView.payload),
    ...(summaryDiagnostics ? { diagnostics: summaryDiagnostics } : {})
  })
}

export function parseAwaitingInteractionToolSummary(summary: string): {
  interaction: AgentSessionInteractionView
  text: string
} | null {
  try {
    const parsed = JSON.parse(summary) as Record<string, unknown>
    if (!isRecord(parsed) || parsed.kind !== 'awaiting-interaction') {
      return null
    }
    if (!isInteractionView(parsed.interaction)) {
      return null
    }
    return {
      interaction: parsed.interaction,
      text: typeof parsed.text === 'string' && parsed.text.trim() ? parsed.text : AWAITING_INTERACTION_TEXT
    }
  } catch {
    return null
  }
}

export function toInteractionView(
  record: AgentSessionInteractionRecord
): AgentSessionInteractionView {
  return {
    interactionId: record.interactionId,
    runId: record.runId,
    kind: record.kind,
    status: record.status,
    payload: record.payload,
    createdAt: record.createdAt,
    resolvedAt: record.resolvedAt
  }
}

export class QuestionInteractionValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QuestionInteractionValidationError'
  }
}

export class PendingQuestionInteractionError extends Error {
  constructor(message = '当前会话有待回答的问题，请先提交或拒绝该问题后再继续。') {
    super(message)
    this.name = 'PendingQuestionInteractionError'
  }
}

function isInteractionView(value: unknown): value is AgentSessionInteractionView {
  if (!isRecord(value)) {
    return false
  }
  return (
    typeof value.interactionId === 'string'
    && typeof value.runId === 'string'
    && value.kind === 'question'
    && isInteractionStatus(value.status)
    && isQuestionInteractionPayload(value.payload)
    && Number.isFinite(value.createdAt)
    && (value.resolvedAt === null || Number.isFinite(value.resolvedAt))
  )
}

function toAwaitingInteractionView(
  interaction: AgentSessionInteractionView | QuestionInteractionPayload
): AgentSessionInteractionView {
  if (isInteractionView(interaction)) {
    return interaction
  }
  return {
    interactionId: 'pending-question',
    runId: 'pending-question',
    kind: 'question',
    status: 'pending',
    payload: interaction,
    createdAt: 0,
    resolvedAt: null
  }
}

function buildAwaitingInteractionDiagnostics(
  diagnostics?: AwaitingInteractionDiagnostics
): AwaitingInteractionDiagnostics | null {
  if (!diagnostics) {
    return null
  }
  if (diagnostics.warnings?.length) {
    return diagnostics
  }
  return diagnostics.degradedFrom ? diagnostics : null
}

function isQuestionInteractionPayload(value: unknown): value is QuestionInteractionPayload {
  if (!isRecord(value) || !Array.isArray(value.fields)) {
    return false
  }
  return (
    typeof value.questionId === 'string'
    && typeof value.title === 'string'
    && typeof value.prompt === 'string'
    && typeof value.required === 'boolean'
  )
}

function isInteractionStatus(value: unknown): value is AgentSessionInteractionStatus {
  return value === 'pending' || value === 'answered' || value === 'rejected'
}

function matchesSelectOption(options: unknown[] | undefined, value: unknown): boolean {
  return Array.isArray(options) && options.some(option => {
    if (!option || typeof option !== 'object' || Array.isArray(option)) {
      return false
    }
    return createQuestionValueKey((option as { value?: unknown }).value) === createQuestionValueKey(value)
  })
}

function isQuestionValuePresent(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0
  }
  if (Array.isArray(value)) {
    return value.length > 0
  }
  return value !== null && value !== undefined
}

function buildInvalidOptionError(field: QuestionFieldInput): string {
  if (isGenericSelectFieldLabel(field)) {
    return GENERIC_SELECT_INVALID_OPTION_ERROR
  }
  return `字段“${field.label}”包含无效选项值。`
}

function buildRequiredFieldError(field: QuestionFieldInput): string {
  if (isGenericSelectFieldLabel(field)) {
    return GENERIC_SELECT_REQUIRED_ERROR
  }
  return `字段“${field.label}”为必填项。`
}

function isGenericSelectFieldLabel(field: QuestionFieldInput): boolean {
  return field.type === 'select' && field.label.trim() === DEFAULT_SELECT_FIELD_LABEL
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function buildQuestionPayload(params: {
  questionId: string
  title?: string
  prompt: string
  required?: boolean
  fields: PreparedQuestionFields
}): QuestionInteractionPayload {
  return {
    questionId: params.questionId,
    title: isNonEmptyString(params.title) ? params.title.trim() : '',
    prompt: params.prompt.trim(),
    required: params.required !== false,
    fields: normalizeQuestionFields(params.fields.fields)
  }
}
