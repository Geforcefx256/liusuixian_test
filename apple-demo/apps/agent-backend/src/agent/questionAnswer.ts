import type { AgentSessionMessage } from './sessionStoreTypes.js'
import { getStructuredOutput } from './structuredOutput.js'
import { createQuestionValueKey } from '../runtime/tools/local/questionValue.js'

interface QuestionResponsePayload {
  questionId: string
  answer: unknown
}

interface QuestionFieldContract {
  id: string
  label: string
  type: 'text' | 'select'
  required?: boolean
  options?: unknown[]
}

interface QuestionContract {
  questionId: string
  required: boolean
  fields: QuestionFieldContract[]
}

export class QuestionAnswerValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'QuestionAnswerValidationError'
  }
}

export function normalizeConversationInput(params: {
  input: string
  history: AgentSessionMessage[]
}): string {
  const payload = parseQuestionResponsePayload(params.input)
  if (!payload) {
    return params.input
  }
  const contract = findLatestPendingQuestionContract(params.history)
  if (!contract) {
    throw new QuestionAnswerValidationError('当前会话中没有待回答的问题。')
  }
  if (payload.questionId !== contract.questionId) {
    throw new QuestionAnswerValidationError('问题回答的 questionId 与当前待回答问题不匹配。')
  }
  const answer = validateQuestionAnswer(contract, payload.answer)
  return JSON.stringify({
    questionId: contract.questionId,
    answer
  })
}

export function parseQuestionResponsePayload(input: string): QuestionResponsePayload | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith('{')) {
    return null
  }
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    if (!isRecord(parsed) || typeof parsed.questionId !== 'string' || !('answer' in parsed)) {
      return null
    }
    return {
      questionId: parsed.questionId,
      answer: parsed.answer
    }
  } catch {
    return null
  }
}

export function findLatestPendingQuestionContract(
  history: AgentSessionMessage[]
): QuestionContract | null {
  const answeredQuestionIds = new Set<string>()
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (!message) {
      continue
    }
    if (message.role === 'user') {
      const payload = parseQuestionResponsePayload(getMessageText(message))
      if (payload) {
        answeredQuestionIds.add(payload.questionId)
      }
      continue
    }
    const contract = extractQuestionContract(message)
    if (contract && !answeredQuestionIds.has(contract.questionId)) {
      return contract
    }
  }
  return null
}

function extractQuestionContract(message: AgentSessionMessage): QuestionContract | null {
  const structured = getStructuredOutput(message)
  if (!structured || structured.kind !== 'protocol') {
    return null
  }
  const protocol = structured.protocol
  const questionId = resolveProtocolQuestionId(protocol)
  const fields = extractProtocolFields(protocol)
  if (!questionId || fields.length === 0) {
    return null
  }
  const data = isRecord(protocol.data) ? protocol.data : {}
  const content = isRecord(data.content) ? data.content : {}
  return {
    questionId,
    required: content.required === true,
    fields
  }
}

function resolveProtocolQuestionId(protocol: Record<string, unknown>): string | null {
  const actions = Array.isArray(protocol.actions) ? protocol.actions : []
  for (const action of actions) {
    if (!isRecord(action) || action.tool !== 'question_response') {
      continue
    }
    const input = isRecord(action.toolInput) ? action.toolInput : {}
    if (typeof input.questionId === 'string' && input.questionId.trim().length > 0) {
      return input.questionId
    }
  }
  const data = isRecord(protocol.data) ? protocol.data : {}
  const content = isRecord(data.content) ? data.content : {}
  if (typeof content.questionId === 'string' && content.questionId.trim().length > 0) {
    return content.questionId
  }
  return null
}

function extractProtocolFields(protocol: Record<string, unknown>): QuestionFieldContract[] {
  const components = Array.isArray(protocol.components) ? protocol.components : []
  const fields: QuestionFieldContract[] = []
  components.forEach(component => {
    if (!isRecord(component) || component.type !== 'form' || !Array.isArray(component.fields)) {
      return
    }
    component.fields.forEach(field => {
      const contract = extractProtocolField(field)
      if (contract) {
        fields.push(contract)
      }
    })
  })
  return fields
}

function extractProtocolField(field: unknown): QuestionFieldContract | null {
  if (!isRecord(field) || typeof field.id !== 'string' || typeof field.label !== 'string') {
    return null
  }
  if (field.type !== 'text' && field.type !== 'select') {
    return null
  }
  if (field.type === 'select' && !Array.isArray(field.options)) {
    return null
  }
  const selectOptions = field.type === 'select' ? field.options as unknown[] : null
  return {
    id: field.id,
    label: field.label,
    type: field.type,
    ...(typeof field.required === 'boolean' ? { required: field.required } : {}),
    ...(field.type === 'select'
      ? {
          options: (selectOptions || [])
            .map((option: unknown) => isRecord(option) ? option.value : undefined)
            .filter((option): option is string => typeof option === 'string')
        }
      : {})
  }
}

function validateQuestionAnswer(
  contract: QuestionContract,
  answer: unknown
): Record<string, unknown> {
  if (!isRecord(answer)) {
    throw new QuestionAnswerValidationError('问题回答必须是以字段 id 为键的对象。')
  }
  const fieldMap = new Map(contract.fields.map(field => [field.id, field]))
  const orderedAnswer: Record<string, unknown> = {}
  Object.keys(answer).forEach(fieldId => {
    if (!fieldMap.has(fieldId)) {
      throw new QuestionAnswerValidationError(`问题回答包含未知字段：${fieldId}。`)
    }
  })
  contract.fields.forEach(field => {
    const value = answer[field.id]
    if (value === undefined) {
      return
    }
    if (field.type === 'select' && !matchesSelectOption(field.options || [], value)) {
      throw new QuestionAnswerValidationError(`字段“${field.label}”包含无效选项值。`)
    }
    orderedAnswer[field.id] = value
  })
  contract.fields.forEach(field => {
    if (!resolveFieldRequired(field.required, contract.required)) {
      return
    }
    if (!isQuestionValuePresent(orderedAnswer[field.id])) {
      throw new QuestionAnswerValidationError(`字段“${field.label}”为必填项。`)
    }
  })
  return orderedAnswer
}

function matchesSelectOption(options: unknown[], value: unknown): boolean {
  return options.some(option => createQuestionValueKey(option) === createQuestionValueKey(value))
}

function resolveFieldRequired(fieldRequired: boolean | undefined, questionRequired: boolean): boolean {
  return fieldRequired ?? questionRequired
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

function getMessageText(message: AgentSessionMessage): string {
  return message.parts
    .filter((part): part is Extract<AgentSessionMessage['parts'][number], { type: 'text' }> => part.type === 'text')
    .map(part => part.text)
    .join('\n')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
