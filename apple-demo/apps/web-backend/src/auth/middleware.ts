import type { NextFunction, Request, Response } from 'express'

import * as authService from './service.js'
import { setSessionCookie } from './sessionCookie.js'
import type { AuthenticatedUser } from '../types/user.js'
import { ForbiddenError } from '../utils/errors.js'

export interface AuthenticatedRequest extends Request {
  auth?: AuthenticatedUser
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = authService.extractRequestToken(req)
    req.auth = await authService.getAuthenticatedUser(token)
    if (authService.wasSessionRefreshed(req.auth)) {
      setSessionCookie(req, res as Parameters<typeof setSessionCookie>[1], token, req.auth.session.expiresAt)
    }
    next()
  } catch (error) {
    next(error)
  }
}

export function requireRole(roleKeys: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    const roles = req.auth?.user.roles.map(role => role.roleKey) ?? []
    if (roleKeys.some(roleKey => roles.includes(roleKey))) {
      next()
      return
    }
    next(new ForbiddenError('Insufficient role permissions'))
  }
}
