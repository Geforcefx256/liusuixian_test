import type {
  AgentSessionMessage,
  AgentSessionPart,
  AgentSessionStructuredPart,
  AgentSessionStructuredDomainResultPart,
  AgentSessionToolPart
} from './sessionStoreTypes.js'

export const CLEARED_TOOL_OUTPUT = '[Old tool result content cleared]'

export function parseAgentSessionParts(raw: string): AgentSessionPart[] {
  const parsed = JSON.parse(raw) as unknown
  if (!Array.isArray(parsed)) {
    throw new Error('Invalid session message parts payload.')
  }
  return parsed.map(parseSessionPart)
}

export function createToolPart(params: {
  id: string
  name: string
  input: Record<string, unknown>
  status: AgentSessionToolPart['status']
  output: string
  compressed?: boolean
}): AgentSessionToolPart {
  return {
    type: 'tool',
    id: params.id,
    name: params.name,
    input: params.input,
    status: params.status,
    output: params.output,
    ...(params.compressed ? { compressed: true } : {})
  }
}

export function compressToolPart(part: AgentSessionToolPart): AgentSessionToolPart {
  return {
    ...part,
    output: CLEARED_TOOL_OUTPUT,
    compressed: true
  }
}

export function getToolParts(message: AgentSessionMessage): AgentSessionToolPart[] {
  return message.parts.filter(isToolPart)
}

export function serializeSessionPart(part: AgentSessionPart): string {
  if (part.type === 'text') return part.text
  if (part.type === 'structured') return ''
  return `[tool] ${part.name} ${JSON.stringify(part.input)} => ${part.output}`
}

export function renderSessionPart(part: AgentSessionPart): string {
  if (part.type === 'text') return part.text
  if (part.type === 'structured') return ''
  return `[tool] ${part.name}`
}

function parseSessionPart(part: unknown): AgentSessionPart {
  if (!part || typeof part !== 'object' || Array.isArray(part)) {
    throw new Error('Invalid session message part.')
  }
  const value = part as Record<string, unknown>
  const type = value.type
  if (type === 'text') {
    if (typeof value.text !== 'string') {
      throw new Error('Invalid text session part.')
    }
    return { type: 'text', text: value.text }
  }
  if (type === 'tool') {
    return parseToolPart(value)
  }
  if (type === 'structured') {
    return parseStructuredPart(value)
  }
  if (type === 'tool_use' || type === 'tool_result') {
    throw new Error('Unsupported legacy session message format; start a new session.')
  }
  throw new Error('Unknown session message part type.')
}

function parseToolPart(value: Record<string, unknown>): AgentSessionToolPart {
  if (
    typeof value.id !== 'string'
    || typeof value.name !== 'string'
    || !isObjectRecord(value.input)
    || (value.status !== 'success' && value.status !== 'error')
    || typeof value.output !== 'string'
  ) {
    throw new Error('Invalid tool session part.')
  }
  return {
    type: 'tool',
    id: value.id,
    name: value.name,
    input: value.input,
    status: value.status,
    output: value.output,
    ...(value.compressed === true ? { compressed: true } : {})
  }
}

function parseStructuredPart(value: Record<string, unknown>): AgentSessionStructuredPart {
  if (value.kind === 'protocol' && isObjectRecord(value.protocol)) {
    return {
      type: 'structured',
      kind: 'protocol',
      protocol: value.protocol
    }
  }
  if (value.kind === 'domain-result' && isObjectRecord(value.domainResult)) {
    return {
      type: 'structured',
      kind: 'domain-result',
      domainResult: value.domainResult as unknown as AgentSessionStructuredDomainResultPart['domainResult']
    }
  }
  throw new Error('Invalid structured session part.')
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isToolPart(part: AgentSessionPart): part is AgentSessionToolPart {
  return part.type === 'tool'
}
