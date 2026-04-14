import type {
  AgentSessionInteraction,
  QuestionInteractionField,
  QuestionInteractionFieldOption
} from '@/api/types'

const INTERACTION_CONTEXT_HEADER = '[INTERACTION CONTEXT]'
const QUESTION_ID_KEY = 'question_id'
const INTERACTION_ID_KEY = 'interaction_id'
const STATUS_KEY = 'status'
const ANSWER_KEY = 'answer'
const ANSWERED_SUMMARY_PREFIX = '已提交回答'
const REJECTED_SUMMARY_PREFIX = '已拒绝回答'
const DEFAULT_SELECT_FIELD_LABEL = '请选择'

export interface ResolvedQuestionInteractionLookup {
  byInteractionId: Readonly<Record<string, AgentSessionInteraction>>
  byQuestionId: Readonly<Record<string, readonly AgentSessionInteraction[]>>
}

export interface PersistedQuestionRewriteResult {
  text: string
  shouldHideOriginal: boolean
  editable: boolean
}

interface InteractionContextRecord {
  interactionId?: string
  questionId?: string
  status?: string
  answer?: unknown
}

export const EMPTY_RESOLVED_QUESTION_INTERACTION_LOOKUP: ResolvedQuestionInteractionLookup = {
  byInteractionId: Object.freeze({}),
  byQuestionId: Object.freeze({})
}

export function buildResolvedQuestionInteractionLookup(
  interactions: readonly AgentSessionInteraction[]
): ResolvedQuestionInteractionLookup {
  if (!interactions.length) {
    return EMPTY_RESOLVED_QUESTION_INTERACTION_LOOKUP
  }

  const byInteractionId: Record<string, AgentSessionInteraction> = {}
  const byQuestionId: Record<string, AgentSessionInteraction[]> = {}

  for (const interaction of interactions) {
    if (interaction.status !== 'answered' && interaction.status !== 'rejected') {
      continue
    }
    byInteractionId[interaction.interactionId] = interaction
    const questionId = interaction.payload.questionId
    const existing = byQuestionId[questionId] || []
    byQuestionId[questionId] = [...existing, interaction]
  }

  for (const questionId of Object.keys(byQuestionId)) {
    byQuestionId[questionId] = [...byQuestionId[questionId]].sort(compareResolvedInteraction)
  }

  if (!Object.keys(byInteractionId).length) {
    return EMPTY_RESOLVED_QUESTION_INTERACTION_LOOKUP
  }

  return {
    byInteractionId,
    byQuestionId
  }
}

export function rewritePersistedQuestionResponseText(
  text: string,
  lookup: ResolvedQuestionInteractionLookup
): PersistedQuestionRewriteResult | null {
  const legacySummary = rewriteLegacyQuestionResponseText(text)
  if (legacySummary) {
    return {
      text: legacySummary,
      shouldHideOriginal: true,
      editable: false
    }
  }

  const context = parseInteractionContext(text)
  if (!context) {
    return null
  }

  const interaction = resolveInteractionFromContext(context, lookup)
  if (!interaction) {
    return null
  }

  if (interaction.status === 'rejected' || context.status === 'rejected') {
    return {
      text: buildRejectedSummary(interaction),
      shouldHideOriginal: false,
      editable: false
    }
  }

  return {
    text: buildAnsweredSummary(interaction, context.answer),
    shouldHideOriginal: false,
    editable: false
  }
}

function compareResolvedInteraction(
  left: AgentSessionInteraction,
  right: AgentSessionInteraction
): number {
  const leftTimestamp = left.resolvedAt || left.createdAt
  const rightTimestamp = right.resolvedAt || right.createdAt
  return rightTimestamp - leftTimestamp
}

function rewriteLegacyQuestionResponseText(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{')) {
    return null
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    if (!isRecord(parsed) || typeof parsed.questionId !== 'string' || !('answer' in parsed)) {
      return null
    }
    return buildGenericAnswerSummary(parsed.answer)
  } catch {
    return null
  }
}

function parseInteractionContext(text: string): InteractionContextRecord | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith(INTERACTION_CONTEXT_HEADER)) {
    return null
  }

  const record: InteractionContextRecord = {}
  const lines = trimmed.split('\n').slice(1)
  for (const rawLine of lines) {
    const separatorIndex = rawLine.indexOf(':')
    if (separatorIndex < 0) {
      continue
    }
    const key = rawLine.slice(0, separatorIndex).trim()
    const rawValue = rawLine.slice(separatorIndex + 1).trim()
    if (!rawValue) {
      continue
    }

    if (key === INTERACTION_ID_KEY) {
      record.interactionId = rawValue
      continue
    }
    if (key === QUESTION_ID_KEY) {
      record.questionId = rawValue
      continue
    }
    if (key === STATUS_KEY) {
      record.status = rawValue
      continue
    }
    if (key === ANSWER_KEY) {
      record.answer = parseAnswerValue(rawValue)
    }
  }

  if (!record.interactionId && !record.questionId) {
    return null
  }
  return record
}

function parseAnswerValue(rawValue: string): unknown {
  try {
    return JSON.parse(rawValue)
  } catch {
    return rawValue
  }
}

function resolveInteractionFromContext(
  context: InteractionContextRecord,
  lookup: ResolvedQuestionInteractionLookup
): AgentSessionInteraction | null {
  if (context.interactionId && lookup.byInteractionId[context.interactionId]) {
    return lookup.byInteractionId[context.interactionId]
  }
  if (context.questionId && lookup.byQuestionId[context.questionId]?.length) {
    return lookup.byQuestionId[context.questionId][0] || null
  }
  return null
}

function buildRejectedSummary(interaction: AgentSessionInteraction): string {
  const prompt = interaction.payload.prompt.trim()
  return prompt
    ? `${REJECTED_SUMMARY_PREFIX}：${prompt}`
    : REJECTED_SUMMARY_PREFIX
}

function buildAnsweredSummary(
  interaction: AgentSessionInteraction,
  answer: unknown
): string {
  if (typeof answer === 'string' && answer.trim()) {
    return `${ANSWERED_SUMMARY_PREFIX}：${answer.trim()}`
  }
  if (!isRecord(answer)) {
    return ANSWERED_SUMMARY_PREFIX
  }

  const labelMap = buildFieldLabelMap(interaction.payload.fields)
  const fieldMap = buildFieldMap(interaction.payload.fields)
  const parts = Object.entries(answer)
    .filter(([, value]) => isQuestionValuePresent(value))
    .map(([key, value]) => {
      const field = fieldMap[key]
      const label = labelMap[key] || key
      const formattedValue = formatAnsweredValue(value, field)
      if (shouldOmitAnsweredLabel(field, label)) {
        return formattedValue
      }
      return `${label}：${formattedValue}`
    })

  if (!parts.length) {
    return ANSWERED_SUMMARY_PREFIX
  }
  return `${ANSWERED_SUMMARY_PREFIX}：${parts.join('，')}`
}

function buildGenericAnswerSummary(answer: unknown): string {
  if (typeof answer === 'string' && answer.trim()) {
    return `${ANSWERED_SUMMARY_PREFIX}：${answer.trim()}`
  }
  if (!isRecord(answer)) {
    return ANSWERED_SUMMARY_PREFIX
  }

  const parts = Object.entries(answer)
    .filter(([, value]) => isQuestionValuePresent(value))
    .map(([key, value]) => `${key}：${formatQuestionValue(value)}`)

  if (!parts.length) {
    return ANSWERED_SUMMARY_PREFIX
  }
  return `${ANSWERED_SUMMARY_PREFIX}：${parts.join('，')}`
}

function buildFieldLabelMap(
  fields: readonly QuestionInteractionField[]
): Record<string, string> {
  const labels: Record<string, string> = {}
  for (const field of fields) {
    labels[field.id] = field.label
  }
  return labels
}

function buildFieldMap(
  fields: readonly QuestionInteractionField[]
): Record<string, QuestionInteractionField> {
  const fieldMap: Record<string, QuestionInteractionField> = {}
  for (const field of fields) {
    fieldMap[field.id] = field
  }
  return fieldMap
}

function formatAnsweredValue(
  value: unknown,
  field: QuestionInteractionField | undefined
): string {
  if (field?.type === 'select') {
    return findSelectedOptionLabel(field.options, value) || formatQuestionValue(value)
  }
  return formatQuestionValue(value)
}

function shouldOmitAnsweredLabel(
  field: QuestionInteractionField | undefined,
  label: string
): boolean {
  return field?.type === 'select' && label === DEFAULT_SELECT_FIELD_LABEL
}

function findSelectedOptionLabel(
  options: readonly QuestionInteractionFieldOption[],
  value: unknown
): string | null {
  for (const option of options) {
    if (areOptionValuesEqual(option.value, value)) {
      return option.label
    }
  }
  return null
}

function areOptionValuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true
  }
  if (typeof left === 'object' && left && typeof right === 'object' && right) {
    return JSON.stringify(left) === JSON.stringify(right)
  }
  return false
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

function formatQuestionValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.map(item => formatQuestionValue(item)).join('、')
  }
  if (isRecord(value)) {
    return JSON.stringify(value)
  }
  return String(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
