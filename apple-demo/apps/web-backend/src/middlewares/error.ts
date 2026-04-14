import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'

import { AppError } from '../utils/errors.js'
import { error } from '../utils/response.js'

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(`[web-backend] ${err.message}`, err.stack)

  if (err instanceof ZodError) {
    res.status(400).json(error(err.issues.map(issue => issue.message).join('; '), { code: 'VALIDATION_ERROR' }))
    return
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json(error(err.message, { code: err.code }))
    return
  }

  res.status(500).json(error('Internal server error'))
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
