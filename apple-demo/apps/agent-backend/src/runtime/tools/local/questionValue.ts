export function createQuestionValueKey(value: unknown): string {
  return JSON.stringify(sortQuestionValue(value))
}

function sortQuestionValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortQuestionValue)
  }
  if (!isRecord(value)) {
    return value
  }
  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = sortQuestionValue(value[key])
      return result
    }, {})
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
