import type { NextFunction, Request, Response } from 'express'
import { loadConfig } from '../memory/ConfigLoader.js'
import { isAllowedOrigin, normalizeOrigin } from './originMatcher.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function resolveExpectedOrigin(req: Request): string | null {
  const host = req.get('x-forwarded-host') || req.get('host')
  if (!host) {
    return null
  }

  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const protocol = forwardedProto || (req.secure ? 'https' : req.protocol || 'http')
  return `${protocol}://${host}`
}

function getProtectionConfig() {
  return loadConfig().auth.sameOriginProtection
}

export function requireSameOrigin(req: Request, res: Response, next: NextFunction): void {
  const config = getProtectionConfig()
  if (!config.enabled) {
    next()
    return
  }

  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    next()
    return
  }

  const requestOrigin = normalizeOrigin(req.get('origin') || undefined)
    ?? normalizeOrigin(req.get('referer') || undefined)
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

  res.status(403).json({ error: 'Cross-origin state-changing requests are not allowed' })
}
