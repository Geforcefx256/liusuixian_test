import type {
  RowsResultSkillExecutionOutput,
  SkillExecutionOutput
} from './types.js'

const SUPPORTED_RESULT_KINDS = new Set<SkillExecutionOutput['kind']>([
  'notice',
  'rows_result',
  'sheet_snapshot',
  'artifact_ref'
])

const DEFAULT_SOURCE_LABEL = 'assistant response'

export interface SkillOutputSourceContext {
  label?: string
}

export function parseSkillExecutionOutput(
  text: string,
  source?: SkillOutputSourceContext
): SkillExecutionOutput {
  const sourceLabel = resolveSourceLabel(source)
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error(`E_SKILL_OUTPUT_INVALID: empty output from ${sourceLabel}`)
  }

  const parsed = parseJsonValue(trimmed, sourceLabel)

  if (isSkillExecutionOutput(parsed)) {
    return parsed
  }

  if (Array.isArray(parsed)) {
    return toRowsResultFromArray(parsed)
  }

  throw new Error(`E_SKILL_OUTPUT_INVALID: unsupported output shape from ${sourceLabel}`)
}

function resolveSourceLabel(source?: SkillOutputSourceContext): string {
  const label = source?.label?.trim()
  if (!label) return DEFAULT_SOURCE_LABEL
  return label
}

function parseJsonValue(text: string, sourceLabel: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`E_SKILL_OUTPUT_INVALID: expected JSON output from ${sourceLabel}`)
  }
}

function isSkillExecutionOutput(value: unknown): value is SkillExecutionOutput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as { kind?: unknown; data?: unknown }
  return typeof candidate.kind === 'string'
    && SUPPORTED_RESULT_KINDS.has(candidate.kind as SkillExecutionOutput['kind'])
    && candidate.data !== undefined
}

function toRowsResultFromArray(value: unknown[]): RowsResultSkillExecutionOutput {
  const firstRow = value[0]
  if (!firstRow || typeof firstRow !== 'object' || Array.isArray(firstRow)) {
    throw new Error('E_SKILL_OUTPUT_INVALID: array output must contain object rows')
  }

  const columns = Object.keys(firstRow as Record<string, unknown>)
  const rows = value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('E_SKILL_OUTPUT_INVALID: array output must contain object rows')
    }
    return item as Record<string, unknown>
  })

  return {
    kind: 'rows_result',
    data: {
      columns,
      rows
    }
  }
}
