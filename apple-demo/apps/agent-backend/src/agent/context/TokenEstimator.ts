import type { AgentSessionMessage, AgentSessionPart } from '../sessionStore.js'
import type { Tokenizer } from './types.js'
import { serializeSessionPart } from '../sessionParts.js'

const EMPTY_TOKENS = 0
const MIN_TOKENS = 1
const TOOL_PREFIX = '[tool] '

export class TokenEstimator {
  constructor(private readonly tokenizer: Tokenizer) {}

  countText(text: string): number {
    if (!text) return EMPTY_TOKENS
    return Math.max(MIN_TOKENS, this.tokenizer.countTokens(text))
  }

  countMessage(message: AgentSessionMessage): number {
    const serialized = serializeMessage(message)
    return this.countText(serialized)
  }

  countMessages(messages: AgentSessionMessage[]): number {
    return messages.reduce((sum, message) => sum + this.countMessage(message), EMPTY_TOKENS)
  }
}

function serializeMessage(message: AgentSessionMessage): string {
  const segments = message.parts.map(part => serializePart(part))
  return segments.join('\n').trim()
}

function serializePart(part: AgentSessionPart): string {
  const serialized = serializeSessionPart(part)
  return part.type === 'text' ? serialized : `${TOOL_PREFIX}${serialized.slice('[tool] '.length)}`
}
