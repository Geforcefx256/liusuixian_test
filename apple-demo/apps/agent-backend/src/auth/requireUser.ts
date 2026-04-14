import type { NextFunction, Request, Response } from 'express'
import { fetchAuthenticatedUser } from './authClient.js'

export interface AuthenticatedRequest extends Request {
  auth?: {
    userId: number
    roles: string[]
  }
}

function extractBearerToken(req: Request): string {
  const authorization = req.get('authorization') || req.get('Authorization') || ''
  if (!authorization.startsWith('Bearer ')) {
    throw new Error('Missing bearer token')
  }
  return authorization.slice('Bearer '.length).trim()
}

function extractCookieHeader(req: Request): string | undefined {
  const cookieHeader = req.get('cookie') || req.get('Cookie') || ''
  return cookieHeader.trim() || undefined
}

export async function requireUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const cookieHeader = extractCookieHeader(req)
    const bearerToken = cookieHeader ? undefined : extractBearerToken(req)
    const auth = await fetchAuthenticatedUser({ cookieHeader, bearerToken })
    req.auth = auth
    next()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized'
    const status = message.includes('auth.baseUrl') ? 500 : 401
    res.status(status).json({ error: message })
  }
}
