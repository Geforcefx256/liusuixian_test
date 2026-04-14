export interface AgentPresentation {
  title: string
  summary: string
  role: string
  capabilities: string[]
}

const SECTION_TITLE_ALIASES = ['能力范围', 'Capabilities']
const MAX_CAPABILITIES = 3

function normalizeLine(line: string): string {
  return line.trim().replace(/\r/g, '')
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#+\s*/, '')
    .replace(/^[-*]\s+/, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .trim()
}

function extractRole(body: string): string {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map(section => section.trim())
    .filter(Boolean)

  const roleParagraph = paragraphs.find(paragraph => {
    const lines = paragraph.split('\n').map(normalizeLine).filter(Boolean)
    if (lines.length === 0) return false
    return lines.every(line => !line.startsWith('#') && !line.startsWith('-') && !line.startsWith('*'))
  })

  return roleParagraph
    ? stripMarkdown(roleParagraph.replace(/\s+/g, ' '))
    : ''
}

function extractCapabilityLines(body: string): string[] {
  const lines = body.split('\n').map(normalizeLine)
  let inCapabilitySection = false
  const capabilities: string[] = []

  for (const line of lines) {
    if (!inCapabilitySection && /^##\s+/.test(line)) {
      const title = stripMarkdown(line)
      inCapabilitySection = SECTION_TITLE_ALIASES.includes(title)
      continue
    }

    if (inCapabilitySection && /^##\s+/.test(line)) {
      break
    }

    if (inCapabilitySection && /^[-*]\s+/.test(line)) {
      capabilities.push(stripMarkdown(line))
    }
  }

  return capabilities
}

export function buildAgentPresentation(params: {
  name: string
  description: string
  instructions: string
  fallbackCapabilities: string[]
}): AgentPresentation {
  const capabilities = extractCapabilityLines(params.instructions)
  const effectiveCapabilities = (
    capabilities.length > 0 ? capabilities : params.fallbackCapabilities
  ).filter(Boolean).slice(0, MAX_CAPABILITIES)

  return {
    title: params.name,
    summary: params.description,
    role: extractRole(params.instructions),
    capabilities: effectiveCapabilities
  }
}
