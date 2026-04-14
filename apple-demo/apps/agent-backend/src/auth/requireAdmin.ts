import type { NextFunction, Response } from 'express'
import type { AuthenticatedRequest } from './requireUser.js'

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const roles = req.auth?.roles || []
  if (roles.includes('admin')) {
    next()
    return
  }
  res.status(403).json({ error: 'Admin access required' })
}
