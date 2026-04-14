import type { AgentSessionInteraction, AgentSessionListItem } from '@/api/types'

export interface SessionAuthoritySnapshot {
  lastAssistantMessageId: number
  pendingInteractionId: string | null
  planStateKey: string | null
}

export function buildSessionAuthoritySnapshot(params: {
  messages: Array<{ messageId?: number; role?: 'user' | 'assistant' }>
  pendingInteraction: AgentSessionInteraction | null
  session: AgentSessionListItem | null
}): SessionAuthoritySnapshot {
  return {
    lastAssistantMessageId: resolveLastAssistantMessageId(params.messages),
    pendingInteractionId: params.pendingInteraction?.interactionId || null,
    planStateKey: resolvePlanStateKey(params.session)
  }
}

export function hasNewAuthoritativeSessionState(
  previous: SessionAuthoritySnapshot,
  next: SessionAuthoritySnapshot
): boolean {
  return next.lastAssistantMessageId > previous.lastAssistantMessageId
    || hasInteractionAdvanced(previous.pendingInteractionId, next.pendingInteractionId)
    || hasPlanStateAdvanced(previous.planStateKey, next.planStateKey)
}

function resolveLastAssistantMessageId(messages: Array<{ messageId?: number; role?: 'user' | 'assistant' }>): number {
  let lastMessageId = 0
  for (const message of messages) {
    if (message.role !== 'assistant') {
      continue
    }
    if (typeof message.messageId !== 'number' || !Number.isFinite(message.messageId)) {
      continue
    }
    lastMessageId = Math.max(lastMessageId, message.messageId)
  }
  return lastMessageId
}

function resolvePlanStateKey(session: AgentSessionListItem | null): string | null {
  const planState = session?.planState
  if (!planState) {
    return null
  }
  return `${planState.planId}:${planState.version}:${planState.status}`
}

function hasInteractionAdvanced(previousId: string | null, nextId: string | null): boolean {
  return nextId !== null && nextId !== previousId
}

function hasPlanStateAdvanced(previousKey: string | null, nextKey: string | null): boolean {
  return nextKey !== null && nextKey !== previousKey
}
