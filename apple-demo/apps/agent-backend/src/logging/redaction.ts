import type { RuntimeLogEntry } from './types.js'

const REDACTED_VALUE = '[REDACTED]'
const SENSITIVE_KEYS = new Set([
  'apiKey',
  'authorization',
  'proxy-authorization',
  'token',
  'x-token',
  'secret',
  'password',
  'set-cookie'
].map(normalizeKey))

const SENSITIVE_PATTERNS = [
  {
    regex: /(["']?(?:apiKey|authorization|proxy-authorization|token|x-token|secret|password|set-cookie)["']?\s*:\s*)("(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^\n,}]+)/gi,
    replace: '$1"[REDACTED]"'
  },
  {
    regex: /((?:^|\n)\s*(?:apiKey|authorization|proxy-authorization|token|x-token|secret|password|set-cookie)\s*:\s*)([^\n]+)/gi,
    replace: '$1[REDACTED]'
  }
] as const

export function redactRuntimeLogEntry(entry: RuntimeLogEntry): RuntimeLogEntry {
  return {
    ...entry,
    message: redactText(entry.message),
    data: entry.data ? redactRecord(entry.data) : undefined
  }
}

function redactRecord(value: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {}
  for (const [key, nested] of Object.entries(value)) {
    redacted[key] = redactValue(key, nested)
  }
  return redacted
}

function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEYS.has(normalizeKey(key))) {
    return REDACTED_VALUE
  }
  if (Array.isArray(value)) {
    return value.map(item => redactNested(item))
  }
  if (isRecord(value)) {
    return redactRecord(value)
  }
  if (typeof value === 'string') {
    return redactText(value)
  }
  return value
}

function redactNested(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => redactNested(item))
  }
  if (isRecord(value)) {
    return redactRecord(value)
  }
  if (typeof value === 'string') {
    return redactText(value)
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}

function redactText(value: string): string {
  return SENSITIVE_PATTERNS.reduce((current, pattern) => current.replace(pattern.regex, pattern.replace), value)
}
