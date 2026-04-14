import type { AgentSessionMessage } from '../sessionStoreTypes.js'
import { TokenEstimator } from './TokenEstimator.js'
import { compressToolPart } from '../sessionParts.js'

const ZERO = 0
const PROTECTED_USER_TURNS = 2

export function pruneToolMessagesForBudget(
  messages: AgentSessionMessage[],
  estimator: TokenEstimator,
  budget: number
): AgentSessionMessage[] {
  if (messages.length === ZERO) return messages
  let nextMessages = messages
  let total = estimator.countMessages(nextMessages)
  if (total <= budget) return messages

  const protectedStartIndex = findProtectedStartIndex(messages)

  for (let messageIndex = 0; messageIndex < nextMessages.length; messageIndex += 1) {
    if (messageIndex >= protectedStartIndex) {
      continue
    }
    const message = nextMessages[messageIndex]
    let changed = false
    const nextParts = message.parts.map(part => {
      if (part.type !== 'tool' || part.compressed) {
        return part
      }
      changed = true
      return compressToolPart(part)
    })
    if (!changed) {
      continue
    }
    nextMessages = [
      ...nextMessages.slice(0, messageIndex),
      { ...message, parts: nextParts },
      ...nextMessages.slice(messageIndex + 1)
    ]
    total = estimator.countMessages(nextMessages)
    if (total <= budget) {
      return nextMessages
    }
  }

  return nextMessages
}

function findProtectedStartIndex(messages: AgentSessionMessage[]): number {
  let remainingTurns = PROTECTED_USER_TURNS
  for (let index = messages.length - 1; index >= ZERO; index -= 1) {
    if (messages[index]?.role !== 'user') continue
    remainingTurns -= 1
    if (remainingTurns === ZERO) {
      return index
    }
  }
  return ZERO
}
