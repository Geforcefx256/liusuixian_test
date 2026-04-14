import type { AgentLoopToolCall, ToolInvocationSignal } from './loopTypes.js'

const SKILL_TOOL_NAME = 'skill:skill'

interface ToolDisplayNameContext {
  tool: string
  skillName?: string
  agentId?: string
}

export type ToolDisplayNameResolver = (context: ToolDisplayNameContext) => string

export function createToolDisplayNameResolver(
  displayNames: Record<string, string>,
  resolveGovernedSkillName?: (skillName: string, agentId?: string) => string | null
): ToolDisplayNameResolver {
  return ({ tool, skillName, agentId }: ToolDisplayNameContext) => {
    const normalizedTool = tool.trim()
    if (normalizedTool === SKILL_TOOL_NAME) {
      const normalizedSkillName = skillName?.trim() || ''
      const governedSkillName = normalizedSkillName
        ? resolveGovernedSkillName?.(normalizedSkillName, agentId)?.trim()
        : ''
      return governedSkillName || normalizedSkillName || normalizeToolDisplayName(normalizedTool)
    }
    const configuredDisplayName = displayNames[normalizedTool]?.trim()
    return configuredDisplayName || normalizeToolDisplayName(normalizedTool)
  }
}

export function buildToolInvocationSignal(
  toolCall: AgentLoopToolCall,
  startedAt: number,
  resolveDisplayName: ToolDisplayNameResolver = defaultToolDisplayNameResolver,
  agentId?: string
): ToolInvocationSignal {
  const skillName = resolveTriggeredSkillName(toolCall)
  return {
    toolCallId: toolCall.id,
    tool: toolCall.name,
    displayName: resolveDisplayName({
      tool: toolCall.name,
      skillName: skillName || undefined,
      agentId
    }),
    toolKind: isSkillToolCall(toolCall.name) ? 'skill' : 'tool',
    startedAt
  }
}

export function resolveTriggeredSkillName(toolCall: AgentLoopToolCall): string | null {
  if (!isSkillToolCall(toolCall.name)) return null
  const rawName = typeof toolCall.input.name === 'string' ? toolCall.input.name.trim() : ''
  return rawName || null
}

export function resolveTriggeredSkillDisplayName(
  toolCall: AgentLoopToolCall,
  resolveDisplayName: ToolDisplayNameResolver = defaultToolDisplayNameResolver,
  agentId?: string
): string | null {
  const skillName = resolveTriggeredSkillName(toolCall)
  if (!skillName) return null
  return resolveDisplayName({
    tool: toolCall.name,
    skillName,
    agentId
  })
}

export function normalizeToolDisplayName(tool: string): string {
  const segments = tool
    .split(':')
    .map(segment => segment.trim())
    .filter(Boolean)
  if (segments.length <= 1) {
    return tool.trim()
  }
  return segments.slice(1).join(':')
}

function isSkillToolCall(tool: string): boolean {
  return tool.trim() === SKILL_TOOL_NAME
}

function defaultToolDisplayNameResolver(context: ToolDisplayNameContext): string {
  if (context.skillName?.trim()) {
    return context.skillName.trim()
  }
  return normalizeToolDisplayName(context.tool)
}
