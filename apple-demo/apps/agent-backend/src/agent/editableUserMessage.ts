import type { AgentSessionMessage } from './sessionStoreTypes.js'
import { extractTextParts } from './sessionStoreUtils.js'

const INTERACTION_CONTEXT_PREFIX = '[INTERACTION CONTEXT]'

export function isEditableUserMessage(message: AgentSessionMessage): boolean {
  if (message.role !== 'user') {
    return false
  }
  return isEditableUserText(extractTextParts(message).join('\n'))
}

export function isEditableUserText(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) {
    return false
  }
  if (trimmed.startsWith(INTERACTION_CONTEXT_PREFIX)) {
    return false
  }
  return parseHiddenQuestionResponse(text) === null
}

function parseHiddenQuestionResponse(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{')) {
    return null
  }
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    if (typeof parsed.questionId !== 'string' || !('answer' in parsed)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}
