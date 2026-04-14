import type { IncomingHttpHeaders } from 'node:http'

export const SESSION_COOKIE_NAME = 'mml_session'

interface SessionCookieRequest {
  headers: IncomingHttpHeaders
  get(name: string): string | undefined
  secure?: boolean
  protocol?: string
}

interface SessionCookieResponse {
  cookie?: (name: string, value: string, options: Record<string, unknown>) => void
  clearCookie?: (name: string, options: Record<string, unknown>) => void
}

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {}
  }

  return cookieHeader
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((cookies, pair) => {
      const separatorIndex = pair.indexOf('=')
      if (separatorIndex <= 0) {
        return cookies
      }

      const name = pair.slice(0, separatorIndex).trim()
      const rawValue = pair.slice(separatorIndex + 1).trim()
      cookies[name] = decodeURIComponent(rawValue)
      return cookies
    }, {})
}

function isSecureRequest(req: SessionCookieRequest): boolean {
  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim()
  return req.secure || forwardedProto === 'https'
}

function normalizeSite(origin: string | undefined): string | null {
  if (!origin) {
    return null
  }

  try {
    const url = new URL(origin)
    return `${url.protocol}//${url.hostname}`.toLowerCase()
  } catch {
    return null
  }
}

function resolveExpectedOrigin(req: SessionCookieRequest): string | null {
  const host = req.get('x-forwarded-host') || req.get('host')
  if (!host) {
    return null
  }

  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const protocol = forwardedProto || (req.secure ? 'https' : req.protocol || 'http')
  return normalizeSite(`${protocol}://${host}`)
}

function resolveRequestOrigin(req: SessionCookieRequest): string | null {
  return normalizeSite(req.get('origin')) ?? normalizeSite(req.get('referer'))
}

function getSessionCookieOptions(req: SessionCookieRequest, maxAge?: number): Record<string, unknown> {
  const secureRequest = isSecureRequest(req)
  const expectedOrigin = resolveExpectedOrigin(req)
  const requestOrigin = resolveRequestOrigin(req)
  const isCrossOrigin = Boolean(requestOrigin && expectedOrigin && requestOrigin !== expectedOrigin)
  const secure = isCrossOrigin ? true : secureRequest

  return {
    httpOnly: true,
    sameSite: isCrossOrigin ? 'none' : 'lax',
    secure,
    path: '/',
    ...(typeof maxAge === 'number' ? { maxAge } : {})
  }
}

export function readSessionCookie(req: SessionCookieRequest): string | null {
  const cookies = parseCookieHeader(req.headers.cookie)
  return cookies[SESSION_COOKIE_NAME] || null
}

export function setSessionCookie(req: SessionCookieRequest, res: SessionCookieResponse, token: string, expiresAt: string): void {
  const expiresAtMs = Date.parse(expiresAt)
  const maxAge = Number.isFinite(expiresAtMs) ? Math.max(0, expiresAtMs - Date.now()) : undefined

  res.cookie?.(SESSION_COOKIE_NAME, token, getSessionCookieOptions(req, maxAge))
}

export function clearSessionCookie(req: SessionCookieRequest, res: SessionCookieResponse): void {
  res.clearCookie?.(SESSION_COOKIE_NAME, getSessionCookieOptions(req))
}
