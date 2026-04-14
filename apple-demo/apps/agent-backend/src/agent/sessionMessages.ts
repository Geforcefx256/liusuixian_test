import type {
  AgentSessionMessage,
  AgentSessionMessageAttributes,
  AgentSessionIntermediateMessageAttributes,
  AgentSessionSkillContextMessageAttributes
} from './sessionStoreTypes.js'

const ZERO = 0

export function createSkillContextMessage(params: {
  skillName: string
  text: string
  createdAt: number
}): AgentSessionMessage {
  return {
    role: 'assistant',
    createdAt: params.createdAt,
    parts: [{ type: 'text', text: params.text }],
    attributes: {
      visibility: 'hidden',
      semantic: 'skill-context',
      skillName: params.skillName
    }
  }
}

export function isHiddenSessionMessage(message: AgentSessionMessage): boolean {
  return message.attributes?.visibility === 'hidden'
}

export function isSkillContextMessage(
  message: AgentSessionMessage
): message is AgentSessionMessage & { attributes: AgentSessionSkillContextMessageAttributes } {
  return message.attributes?.semantic === 'skill-context'
}

export function isIntermediateMessage(
  message: AgentSessionMessage
): message is AgentSessionMessage & { attributes: AgentSessionIntermediateMessageAttributes } {
  return message.attributes?.semantic === 'intermediate'
}

export function createIntermediateAttributes(
  toolDisplayNames: string[]
): AgentSessionIntermediateMessageAttributes {
  return {
    visibility: 'internal',
    semantic: 'intermediate',
    toolDisplayNames
  }
}

export function getSkillContextText(message: AgentSessionMessage): string | null {
  if (!isSkillContextMessage(message)) {
    return null
  }
  const text = message.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map(part => part.text)
    .join('\n')
    .trim()
  return text.length > ZERO ? text : null
}

export function describeHiddenMessageAttributes(
  attributes: AgentSessionMessageAttributes | undefined
): Record<string, unknown> | null {
  if (!attributes) {
    return null
  }
  if (attributes.semantic === 'skill-context') {
    return {
      visibility: attributes.visibility,
      semantic: attributes.semantic,
      skillName: attributes.skillName
    }
  }
  if (attributes.semantic === 'intermediate') {
    return {
      visibility: attributes.visibility,
      semantic: attributes.semantic,
      toolDisplayNames: attributes.toolDisplayNames
    }
  }
  return null
}
