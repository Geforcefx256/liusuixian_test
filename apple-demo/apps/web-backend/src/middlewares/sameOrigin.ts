import type { IncomingHttpHeaders } from 'node:http'

import { getAppConfig } from '../config/index.js'
import { isAllowedOrigin, normalizeOrigin } from './originMatcher.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

interface SameOriginRequest {
  headers: IncomingHttpHeaders
  get(name: string): string | undefined
  secure?: boolean
  protocol?: string
  method?: string
}

interface SameOriginResponse {
  status(code: number): {
    json(payload: unknown): void
  }
}

type SameOriginNext = () => void

function resolveExpectedOrigin(req: SameOriginRequest): string | null {
  const host = req.get('x-forwarded-host') || req.get('host')
  if (!host) {
    return null
  }
  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const protocol = forwardedProto || (req.secure ? 'https' : req.protocol || 'http')
  return `${protocol}://${host}`
}

export function requireSameOrigin(req: SameOriginRequest, res: SameOriginResponse, next: SameOriginNext): void {
  const config = getAppConfig().auth.sameOriginProtection
  if (!config.enabled || SAFE_METHODS.has((req.method || 'GET').toUpperCase())) {
    next()
    return
  }

  const requestOrigin =
    normalizeOrigin(req.get('origin') || undefined) ??
    normalizeOrigin(req.get('referer') || undefined)
  const expectedOrigin = resolveExpectedOrigin(req)

  if (
    !requestOrigin ||
    !expectedOrigin ||
    requestOrigin === normalizeOrigin(expectedOrigin) ||
    isAllowedOrigin(requestOrigin, config.allowedOrigins)
  ) {
    next()
    return
  }

  res.status(403).json({
    success: false,
    error: 'Cross-origin state-changing requests are not allowed'
  })
}
