export interface QuestionContractWarning {
  code: 'options_json_string_normalized' | 'field_required_inferred_from_optional_text'
  field: string
  message: string
}

interface QuestionOptionShape {
  label: string
  value: unknown
}

interface NormalizeQuestionOptionsResult {
  options: QuestionOptionShape[] | null
  warnings: QuestionContractWarning[]
}

const NORMALIZATION_WARNING_MESSAGE = 'Normalized select options from a JSON string input.'
const LABEL_PATTERN = /["']label["']\s*:\s*(?:"([^"]+)"|'([^']+)')/g

export function normalizeQuestionOptionsInput(
  value: unknown,
  field: string
): NormalizeQuestionOptionsResult {
  if (Array.isArray(value)) {
    return { options: value as QuestionOptionShape[], warnings: [] }
  }
  if (typeof value !== 'string') {
    return { options: null, warnings: [] }
  }
  const parsed = parseOptionArrayString(value)
  if (!parsed) {
    return { options: null, warnings: [] }
  }
  return {
    options: parsed,
    warnings: [{
      code: 'options_json_string_normalized',
      field,
      message: NORMALIZATION_WARNING_MESSAGE
    }]
  }
}

export function extractQuestionReferenceOptions(value: unknown): string[] {
  const extracted = extractOptionLabels(value)
  return Array.from(new Set(extracted.map(item => item.trim()).filter(Boolean)))
}

function parseOptionArrayString(value: string): QuestionOptionShape[] | null {
  try {
    const parsed = JSON.parse(value) as unknown
    return isOptionShapeArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function isOptionShapeArray(value: unknown): value is QuestionOptionShape[] {
  return Array.isArray(value) && value.every(isOptionShape)
}

function isOptionShape(value: unknown): value is QuestionOptionShape {
  return isRecord(value) && typeof value.label === 'string' && 'value' in value
}

function extractOptionLabels(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(extractOptionLabels)
  }
  if (typeof value === 'string') {
    return extractLabelsFromString(value)
  }
  if (isRecord(value)) {
    if (typeof value.label === 'string' && value.label.trim()) {
      return [value.label]
    }
    return Object.values(value).flatMap(extractOptionLabels)
  }
  return []
}

function extractLabelsFromString(value: string): string[] {
  const parsed = tryParseJson(value)
  if (parsed !== null) {
    return extractOptionLabels(parsed)
  }
  return Array.from(value.matchAll(LABEL_PATTERN), match => match[1] || match[2] || '')
}

function tryParseJson(value: string): unknown | null {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
