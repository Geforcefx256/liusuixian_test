import type { MmlSchemaConditionRule } from './contracts.js'

const FULL_WIDTH_QUOTES = /[“”]/g
const FULL_WIDTH_COMMA = /，/g
const FULL_WIDTH_COLON = /：/g

export function parseConditionRules(input: unknown): MmlSchemaConditionRule[] {
  const normalized = normalizeJsonLikeString(input)
  if (!normalized) {
    return []
  }

  try {
    const parsed = JSON.parse(normalized) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return []
    }

    const rules: MmlSchemaConditionRule[] = []
    for (const [expression, rawMode] of Object.entries(parsed)) {
      const condition = parseExpression(expression)
      const requiredMode = normalizeConditionalRequiredMode(rawMode)
      if (!condition || !requiredMode) {
        continue
      }
      rules.push({
        expression: condition.expression,
        sourceParamId: condition.sourceParamId,
        operator: '=',
        expectedValue: condition.expectedValue,
        requiredMode
      })
    }
    return rules
  } catch {
    return []
  }
}

function parseExpression(expression: string): {
  expression: string
  sourceParamId: number | null
  expectedValue: string
} | null {
  const trimmed = expression.trim()
  const match = trimmed.match(/^(\d+)\s*=\s*(.+)$/)
  if (!match) {
    return null
  }

  const sourceParamId = Number.parseInt(match[1], 10)
  const expectedValue = match[2].trim()
  if (!Number.isFinite(sourceParamId) || !expectedValue) {
    return null
  }

  return {
    expression: `${sourceParamId}=${expectedValue}`,
    sourceParamId,
    expectedValue
  }
}

function normalizeConditionalRequiredMode(value: unknown): 'required' | 'optional' | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (trimmed === '必选') return 'required'
  if (trimmed === '可选') return 'optional'
  return null
}

function normalizeJsonLikeString(input: unknown): string {
  if (typeof input !== 'string') {
    return ''
  }

  return input
    .trim()
    .replace(FULL_WIDTH_QUOTES, '"')
    .replace(FULL_WIDTH_COMMA, ',')
    .replace(FULL_WIDTH_COLON, ':')
}
