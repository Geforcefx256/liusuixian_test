const ORIGIN_PATTERN_SHAPE = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]+$/i
const TRAILING_SLASH_PATTERN = /\/+$/

function stripTrailingSlashes(value: string): string {
  return value.replace(TRAILING_SLASH_PATTERN, '')
}

export function normalizeOrigin(value: string | undefined): string | null {
  if (!value) {
    return null
  }

  try {
    return new URL(value).origin.toLowerCase()
  } catch {
    return null
  }
}

function normalizeOriginPattern(value: string): string | null {
  const trimmed = stripTrailingSlashes(value.trim())
  if (!trimmed) {
    return null
  }

  if (!trimmed.includes('*')) {
    return normalizeOrigin(trimmed)
  }

  if (!ORIGIN_PATTERN_SHAPE.test(trimmed)) {
    return null
  }

  return trimmed.toLowerCase()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildOriginPatternRegExp(pattern: string): RegExp {
  return new RegExp(`^${escapeRegExp(pattern).replace(/\\\*/g, '.*')}$`, 'i')
}

export function isAllowedOrigin(requestOrigin: string | null, allowedOrigins: string[]): boolean {
  if (!requestOrigin) {
    return false
  }

  const normalizedRequestOrigin = normalizeOrigin(requestOrigin)
  if (!normalizedRequestOrigin) {
    return false
  }

  return allowedOrigins.some(originPattern => {
    const normalizedPattern = normalizeOriginPattern(originPattern)
    if (!normalizedPattern) {
      return false
    }

    if (!normalizedPattern.includes('*')) {
      return normalizedPattern === normalizedRequestOrigin
    }

    return buildOriginPatternRegExp(normalizedPattern).test(normalizedRequestOrigin)
  })
}
