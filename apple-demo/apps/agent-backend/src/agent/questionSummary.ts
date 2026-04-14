import {
  NOTES_FIELD_ID,
  isNonEmptyString,
  type QuestionFieldInput
} from '../runtime/tools/local/questionContract.js'
import type { QuestionInteractionPayload } from './interactions.js'

const GENERIC_SINGLE_FIELD_PROMPTS = new Set([
  '补充信息',
  '请补充信息',
  '需要补充信息',
  '请提供信息',
  '请填写信息',
  '请回答问题',
  '请回答以下问题',
  '请确认后继续',
  '需要你的输入后才能继续'
])
const TEXT_CONTINUATION_CUE = '填写后我会继续。'
const SELECT_CONTINUATION_CUE = '选择后我会继续。'
const MULTI_FIELD_CONTINUATION_CUE = '补充后我会继续。'

export function buildPendingQuestionSummary(
  payload: Pick<QuestionInteractionPayload, 'prompt' | 'fields'>
): string {
  const prompt = normalizePrompt(payload.prompt)
  const primaryFields = getPrimaryFields(payload.fields)
  if (primaryFields.length === 0) {
    return prompt ? withContinuationCue(prompt, MULTI_FIELD_CONTINUATION_CUE) : '需要你的输入后才能继续。'
  }
  if (primaryFields.length === 1) {
    return buildSingleFieldSummary(prompt, primaryFields[0]!)
  }
  return buildMultiFieldSummary(prompt, primaryFields)
}

function buildSingleFieldSummary(
  prompt: string,
  field: QuestionFieldInput
): string {
  const label = normalizeLabel(field.label)
  const isSelectField = field.type === 'select'
  const continuationCue = isSelectField
    ? SELECT_CONTINUATION_CUE
    : TEXT_CONTINUATION_CUE
  if (prompt && !isGenericSingleFieldPrompt(prompt)) {
    return withContinuationCue(prompt, continuationCue)
  }
  if (!label) {
    return prompt ? withContinuationCue(prompt, continuationCue) : '需要你的输入后才能继续。'
  }
  return isSelectField
    ? `请选择「${label}」，${continuationCue}`
    : `请提供「${label}」，${continuationCue}`
}

function buildMultiFieldSummary(
  prompt: string,
  fields: QuestionFieldInput[]
): string {
  const labels = fields
    .map(field => normalizeLabel(field.label))
    .filter((label): label is string => Boolean(label))
  if (!prompt && labels.length === 0) {
    return '需要你的输入后才能继续。'
  }
  if (!prompt) {
    return `请补充以下信息：${labels.join('、')}。${MULTI_FIELD_CONTINUATION_CUE}`
  }
  if (labels.length === 0) {
    return withContinuationCue(prompt, MULTI_FIELD_CONTINUATION_CUE)
  }
  return withContinuationCue(`${prompt}（需补充：${labels.join('、')}）`, MULTI_FIELD_CONTINUATION_CUE)
}

function getPrimaryFields(fields: readonly QuestionFieldInput[]): QuestionFieldInput[] {
  const nonNotesFields = fields.filter(field => !isNotesField(field))
  return nonNotesFields.length > 0 ? [...nonNotesFields] : [...fields]
}

function isNotesField(field: QuestionFieldInput): boolean {
  return field.id === NOTES_FIELD_ID
}

function isGenericSingleFieldPrompt(prompt: string): boolean {
  return GENERIC_SINGLE_FIELD_PROMPTS.has(normalizePromptToken(prompt))
}

function normalizePrompt(prompt: string): string {
  if (!isNonEmptyString(prompt)) {
    return ''
  }
  return prompt.trim().replace(/[：:。！？?!]+$/u, '')
}

function normalizeLabel(label: string): string {
  return isNonEmptyString(label) ? label.trim() : ''
}

function normalizePromptToken(prompt: string): string {
  return prompt
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]/gu, '')
    .replace(/[：:。！？?!,.，；;、“”"'‘’]/gu, '')
}

function withContinuationCue(base: string, cue: string): string {
  return `${base}，${cue}`
}
