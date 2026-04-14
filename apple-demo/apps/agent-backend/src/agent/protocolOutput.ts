export interface ProtocolOutputParseResult {
  protocol: Record<string, unknown> | null
}

export function parseProtocolOutput(text: string): ProtocolOutputParseResult {
  const payload = extractJson(text)
  if (!isProtocolMessage(payload)) {
    return { protocol: null }
  }

  return { protocol: payload }
}

function extractJson(input: string): unknown {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }

  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i)
  const jsonSource = codeBlockMatch ? codeBlockMatch[1].trim() : trimmed

  try {
    return JSON.parse(jsonSource) as unknown
  } catch {
    return null
  }
}

function isProtocolMessage(payload: unknown): payload is Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return false
  }

  const candidate = payload as {
    version?: unknown
    components?: unknown
  }

  return typeof candidate.version === 'string' && Array.isArray(candidate.components)
}
