import {
  buildContinuationMessageText,
  parseAwaitingInteractionToolSummary,
  type QuestionInteractionContinuationContext
} from './interactions.js'
import type { AgentSessionMessage } from './sessionStoreTypes.js'

export function buildResolvedInteractionMessage(params: {
  context: QuestionInteractionContinuationContext
  createdAt: number
}): AgentSessionMessage {
  return {
    role: 'user',
    parts: [{
      type: 'text',
      text: buildContinuationMessageText(params.context)
    }],
    createdAt: params.createdAt
  }
}

export function filterReplayMessages(messages: AgentSessionMessage[]): AgentSessionMessage[] {
  return messages.flatMap(message => {
    const nextMessage = filterReplayMessage(message)
    return nextMessage ? [nextMessage] : []
  })
}

function filterReplayMessage(message: AgentSessionMessage): AgentSessionMessage | null {
  if (message.role !== 'assistant') {
    return message
  }
  if (hasAwaitingInteractionMarker(message)) {
    return null
  }
  return message
}

function hasAwaitingInteractionMarker(message: AgentSessionMessage): boolean {
  return message.parts.some(part => {
    return part.type === 'tool'
      && parseAwaitingInteractionToolSummary(part.output) !== null
  })
}
