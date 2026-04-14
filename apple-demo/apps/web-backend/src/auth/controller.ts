import type { Request, Response } from 'express'

import { LocalLoginSchema, OAuthCallbackQuerySchema } from '../types/user.js'
import type { AuthenticatedRequest } from './middleware.js'
import { asyncHandler } from '../middlewares/error.js'
import * as authService from './service.js'
import { clearSessionCookie, setSessionCookie } from './sessionCookie.js'
import { ValidationError } from '../utils/errors.js'
import { success } from '../utils/response.js'

type SessionCookieRequest = Parameters<typeof setSessionCookie>[0]
type SessionCookieResponse = Parameters<typeof setSessionCookie>[1]

export const getLoginUrl = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  res.status(200).json(success(await authService.createOAuthLoginUrl()))
})

export const getAuthMode = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  res.status(200).json(success(authService.getAuthMode()))
})

export const handleCallback = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = OAuthCallbackQuerySchema.parse(req.query)
  if (!authService.consumeOAuthState(query.state)) {
    throw new ValidationError('Invalid OAuth state')
  }

  const tokens = await authService.exchangeCodeForTokens(query.code)
  const userinfo = await authService.fetchUserinfo(tokens)
  const result = await authService.completeOAuthLogin({
    providerCode: authService.getOAuthProviderCode(),
    userinfo,
    tokens,
    loginIp: req.ip,
    userAgent: req.get('user-agent') || undefined
  })

  setSessionCookie(req as SessionCookieRequest, res as SessionCookieResponse, result.token, result.session.expiresAt)
  const { token: _token, ...payload } = result
  res.status(200).json(success(payload))
})

export const localLogin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = LocalLoginSchema.parse(req.body)
  const result = await authService.loginWithLocalAccount({
    account: input.account,
    password: input.password,
    loginIp: req.ip,
    userAgent: req.get('user-agent') || undefined
  })
  setSessionCookie(req as SessionCookieRequest, res as SessionCookieResponse, result.token, result.session.expiresAt)
  const { token: _token, ...payload } = result
  res.status(200).json(success(payload))
})

export const getMe = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.status(200).json(success(req.auth))
})

export const changePassword = asyncHandler(async (_req: AuthenticatedRequest, _res: Response): Promise<void> => {
  throw new ValidationError('Password change is not supported')
})

export const logout = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  let token: string | null = null
  try {
    token = authService.extractRequestToken(req)
  } catch {
    token = null
  }

  const result = await authService.logout(token)
  clearSessionCookie(req as SessionCookieRequest, res as SessionCookieResponse)
  res.status(200).json(success(result))
})
