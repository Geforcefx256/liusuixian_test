import type { UiMessage, UiTextMessage, UiToolStepMessage } from '@/stores/workbenchStore'

export interface AssistantProcessDisplayItem {
  kind: 'assistant-process'
  id: string
  mainMessage: UiTextMessage & { role: 'assistant'; status: 'done' }
  collapsedSteps: Array<CompletedAssistantStepMessage>
}

export interface MessageDisplayItem {
  kind: 'message'
  id: string
  message: UiMessage
}

export interface ToolStepGroupDisplayItem {
  kind: 'tool-step-group'
  id: string
  steps: UiToolStepMessage[]
}

export type ConversationDisplayItem = MessageDisplayItem | AssistantProcessDisplayItem | ToolStepGroupDisplayItem

type CompletedAssistantTextMessage = UiTextMessage & { role: 'assistant'; status: 'done' }
type CompletedAssistantToolStepMessage = UiToolStepMessage & { role: 'assistant'; status: 'done' }
type CompletedAssistantStepMessage = CompletedAssistantTextMessage | CompletedAssistantToolStepMessage

export function buildConversationDisplayItems(
  messages: readonly UiMessage[]
): ConversationDisplayItem[] {
  const items: ConversationDisplayItem[] = []
  let index = 0

  while (index < messages.length) {
    const message = messages[index]
    if (!isCompletedAssistantTextMessage(message)) {
      items.push({
        kind: 'message',
        id: message.id,
        message
      })
      index += 1
      continue
    }

    const segment = collectCompletedAssistantSegment(messages, index)
    if (segment.length <= 1) {
      items.push({
        kind: 'message',
        id: message.id,
        message
      })
      index += 1
      continue
    }

    const mainMessage = segment[segment.length - 1]
    if (!mainMessage || mainMessage.kind !== 'text') {
      const allToolSteps = segment.every(step => step.kind === 'tool-step')
      if (allToolSteps) {
        items.push({
          kind: 'tool-step-group',
          id: `tool-step-group-${segment[0].id}`,
          steps: segment as (UiToolStepMessage & { role: 'assistant'; status: 'done' })[]
        })
      } else {
        items.push(...segment.map(step => ({
          kind: 'message' as const,
          id: step.id,
          message: step
        })))
      }
      index += segment.length
      continue
    }
    items.push({
      kind: 'assistant-process',
      id: `assistant-process-${mainMessage.id}`,
      mainMessage,
      collapsedSteps: segment.slice(0, -1)
    })
    index += segment.length
  }

  return items
}

function collectCompletedAssistantSegment(
  messages: readonly UiMessage[],
  startIndex: number
): CompletedAssistantStepMessage[] {
  const segment: CompletedAssistantStepMessage[] = []
  let index = startIndex

  while (index < messages.length) {
    const candidate = messages[index]
    if (!isCompletedAssistantTextMessage(candidate)) {
      break
    }
    segment.push(candidate)
    index += 1
  }

  return segment
}

function isCompletedAssistantTextMessage(
  message: UiMessage
): message is CompletedAssistantStepMessage {
  return (message.kind === 'text' || message.kind === 'tool-step')
    && message.role === 'assistant'
    && message.status === 'done'
}
