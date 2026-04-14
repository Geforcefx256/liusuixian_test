import type {
  AgentSessionMessage,
  AgentSessionPart,
  AgentSessionStructuredPart
} from './sessionStoreTypes.js'
import { parseSkillExecutionOutput } from './skillResult.js'
import type { SkillExecutionOutput } from './types.js'

const SUMMARY_MAX_CHARS = 160

export type StructuredOutput =
  | { kind: 'protocol'; protocol: Record<string, unknown> }
  | { kind: 'domain-result'; domainResult: SkillExecutionOutput }

export function detectStructuredToolOutput(params: {
  toolName: string
  summary: string
}): StructuredOutput | null {
  if (params.toolName !== 'skill:exec') {
    return null
  }
  try {
    return {
      kind: 'domain-result',
      domainResult: parseSkillExecutionOutput(params.summary, {
        label: `tool ${params.toolName}`
      })
    }
  } catch {
    return null
  }
}

export function createStructuredPart(output: StructuredOutput): AgentSessionStructuredPart {
  if (output.kind === 'protocol') {
    return {
      type: 'structured',
      kind: 'protocol',
      protocol: output.protocol
    }
  }
  return {
    type: 'structured',
    kind: 'domain-result',
    domainResult: output.domainResult
  }
}

export function getStructuredOutput(message: Pick<AgentSessionMessage, 'role' | 'parts'>): StructuredOutput | null {
  if (message.role !== 'assistant') {
    return null
  }
  const part = message.parts.find(isStructuredPart)
  if (!part) {
    return null
  }
  if (part.kind === 'protocol') {
    return { kind: 'protocol', protocol: part.protocol }
  }
  return { kind: 'domain-result', domainResult: part.domainResult }
}

export function buildStructuredAssistantParts(params: {
  toolParts: AgentSessionPart[]
  output: StructuredOutput
}): AgentSessionPart[] {
  return [
    { type: 'text', text: buildStructuredSummaryText(params.output) },
    ...params.toolParts,
    createStructuredPart(params.output)
  ]
}

export function buildStructuredSummaryText(output: StructuredOutput): string {
  if (output.kind === 'protocol') {
    return buildProtocolSummary(output.protocol)
  }
  return buildDomainResultSummary(output.domainResult)
}

function buildProtocolSummary(protocol: Record<string, unknown>): string {
  const text = extractProtocolText(protocol)
  if (text) {
    return clampSummary(text)
  }
  if (hasProtocolForm(protocol)) {
    return '需要补充信息后才能继续。'
  }
  return '需要继续交互后才能继续。'
}

function extractProtocolText(protocol: Record<string, unknown>): string {
  const components = Array.isArray(protocol.components) ? protocol.components : []
  for (const component of components) {
    if (!component || typeof component !== 'object' || Array.isArray(component)) {
      continue
    }
    const value = component as { type?: unknown; content?: unknown }
    if (value.type !== 'text' || typeof value.content !== 'string') {
      continue
    }
    const content = value.content.trim()
    if (content) {
      return content
    }
  }
  return ''
}

function hasProtocolForm(protocol: Record<string, unknown>): boolean {
  const components = Array.isArray(protocol.components) ? protocol.components : []
  return components.some(component => {
    if (!component || typeof component !== 'object' || Array.isArray(component)) {
      return false
    }
    return (component as { type?: unknown }).type === 'form'
  })
}

function buildDomainResultSummary(result: SkillExecutionOutput): string {
  if (result.kind === 'notice') {
    return clampSummary(result.data.message || '已生成通知结果。')
  }
  if (result.kind === 'rows_result') {
    return `已生成 ${result.data.rows.length} 行结构化结果。`
  }
  if (result.kind === 'sheet_snapshot') {
    const sheetName = result.data.sheetName.trim()
    return sheetName ? `已生成工作表快照：${sheetName}。` : '已生成工作表快照。'
  }
  const label = resolveArtifactLabel(result.data)
  return label ? `已生成产物：${label}。` : '已生成产物结果。'
}

function resolveArtifactLabel(data: Record<string, unknown>): string {
  const rawLabel = data.fileName ?? data.fileId ?? data.fileKey ?? data.path
  return typeof rawLabel === 'string' ? rawLabel.trim() : ''
}

function clampSummary(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= SUMMARY_MAX_CHARS) {
    return normalized
  }
  return `${normalized.slice(0, SUMMARY_MAX_CHARS - 1)}…`
}

function isStructuredPart(part: AgentSessionPart): part is AgentSessionStructuredPart {
  return part.type === 'structured'
}
