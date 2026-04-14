import { randomUUID } from 'node:crypto'
import type { Request } from 'express'

import {
  getConfiguredAuthMode,
  getOAuthProviderConfig,
  getOAuthRefreshWindowMs,
  isLocalLoginEnabled,
  isOAuthLoginEnabled
} from './config.js'
import * as userRepository from '../repositories/userRepository.js'
import type { AuthMode, AuthenticatedUser, LogoutResult, OAuthTokens, OAuthUserinfo } from '../types/user.js'
import { ConflictError, UnauthorizedError, ValidationError } from '../utils/errors.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import {
  buildOAuthAuthorizeUrl,
  buildOAuthLogoutUrl,
  exchangeCodeForTokens,
  fetchUserinfo,
  refreshTokens
} from './oauthClient.js'
import { decryptOAuthToken, encryptOAuthToken } from './oauthTokenCipher.js'
import { readSessionCookie } from './sessionCookie.js'
import { hashToken } from './sessionTokens.js'
import { consumeOAuthState as consumeIssuedOAuthState, issueOAuthState, resetOAuthStateStore } from './oauthStateStore.js'

const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000
const DEFAULT_REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000
const AUTH_SESSION_REFRESHED = Symbol('auth.sessionRefreshed')
const oauthRefreshLocks = new Map<string, Promise<userRepository.SessionAuthRecord>>()

export { exchangeCodeForTokens, fetchUserinfo }

function assertOAuthEnabled(): void {
  if (!isOAuthLoginEnabled()) {
    throw new ValidationError('OAuth login is not enabled')
  }
}

function assertLocalLoginEnabled(): void {
  if (!isLocalLoginEnabled()) {
    throw new ValidationError('Local login is not enabled')
  }
}

function toIsoTimestamp(valueMs: number): string {
  return new Date(valueMs).toISOString()
}

function resolveAccessTokenExpiresAt(tokens: OAuthTokens, nowMs = Date.now()): string {
  if (tokens.accessTokenExpiresAt && Number.isFinite(tokens.accessTokenExpiresAt)) {
    return toIsoTimestamp(tokens.accessTokenExpiresAt)
  }
  if (tokens.expiresIn && Number.isFinite(tokens.expiresIn)) {
    return toIsoTimestamp(nowMs + tokens.expiresIn * 1000)
  }
  return toIsoTimestamp(nowMs + DEFAULT_SESSION_TTL_MS)
}

function resolveRefreshTokenExpiresAt(tokens: OAuthTokens, nowMs = Date.now(), existingExpiresAt: string | null = null): string | null {
  if (tokens.refreshTokenExpiresAt && Number.isFinite(tokens.refreshTokenExpiresAt)) {
    return toIsoTimestamp(tokens.refreshTokenExpiresAt)
  }
  if (tokens.refreshToken) {
    return toIsoTimestamp(nowMs + DEFAULT_REFRESH_TOKEN_TTL_MS)
  }
  return existingExpiresAt
}

function buildOAuthFallbackUserCode(uuid: string): string {
  return `oauth-${uuid}`
}

function buildOAuthFallbackDisplayName(uuid: string): string {
  const compactUuid = uuid.replace(/[^a-zA-Z0-9]/g, '')
  const suffix = compactUuid.slice(-6) || uuid.slice(-6)
  return `SSO用户-${suffix}`
}

function markSessionRefreshed(auth: AuthenticatedUser): AuthenticatedUser {
  Object.defineProperty(auth, AUTH_SESSION_REFRESHED, {
    value: true,
    enumerable: false
  })
  return auth
}

export function wasSessionRefreshed(auth: AuthenticatedUser): boolean {
  return Boolean((auth as unknown as Record<PropertyKey, unknown>)[AUTH_SESSION_REFRESHED])
}

export function createOAuthLoginUrl(): { url: string; state: string } {
  assertOAuthEnabled()
  const state = issueOAuthState()
  return { url: buildOAuthAuthorizeUrl(state), state }
}

export function getAuthMode(): AuthMode {
  const mode = getConfiguredAuthMode()
  const oauthEnabled = isOAuthLoginEnabled(mode)
  const localEnabled = isLocalLoginEnabled(mode)
  return {
    mode,
    preferred: mode === 'oauth' ? 'oauth' : 'local',
    oauth: {
      enabled: oauthEnabled
    },
    local: {
      enabled: localEnabled
    }
  }
}

export function consumeOAuthState(state: string): boolean {
  return consumeIssuedOAuthState(state)
}

export async function completeOAuthLogin(params: {
  providerCode: string
  userinfo: OAuthUserinfo
  tokens: OAuthTokens
  loginIp?: string
  userAgent?: string
}): Promise<{ token: string; user: AuthenticatedUser['user']; session: AuthenticatedUser['session']; mustChangePassword: boolean }> {
  assertOAuthEnabled()
  if (!params.userinfo.uuid) {
    throw new ValidationError('userinfo.uuid is required')
  }

  let identity = await userRepository.findIdentityByExternalUuid(params.providerCode, params.userinfo.uuid)
  let userId: number

  if (!identity) {
    const account = params.userinfo.uid || params.userinfo.loginName || buildOAuthFallbackUserCode(params.userinfo.uuid)
    const userCode = params.userinfo.uuid
    const displayName = params.userinfo.displayName || account || buildOAuthFallbackDisplayName(params.userinfo.uuid)
    let user = await userRepository.findUserByAccount(account)

    if (!user) {
      user = await userRepository.createUser({
        userCode,
        userAccount: account,
        displayName,
        email: params.userinfo.email ?? undefined,
        phone: params.userinfo.phone ?? undefined,
        avatarUrl: params.userinfo.avatarUrl ?? undefined
      })
      const defaultUserRoleId = await userRepository.getRoleIdByKey('guest')
      if (defaultUserRoleId) {
        await userRepository.replaceUserRoles(user.userId, [defaultUserRoleId])
      }
    }

    identity = await userRepository.createIdentity({
      userId: user.userId,
      providerCode: params.providerCode,
      externalUserUuid: params.userinfo.uuid,
      loginName: params.userinfo.loginName,
      email: params.userinfo.email,
      rawUserinfoJson: JSON.stringify(params.userinfo.raw)
    })
    userId = user.userId
  } else {
    userId = identity.userId
    await userRepository.syncOAuthUserAccount(
      userId,
      params.userinfo.uid || params.userinfo.loginName || null,
      params.userinfo.uuid
    )
    await userRepository.updateIdentityLogin(identity.identityId, params.userinfo.email, JSON.stringify(params.userinfo.raw))
  }

  await userRepository.updateUserLogin(userId)
  const user = await userRepository.getUserDetailById(userId)
  if (!user) {
    throw new ConflictError('Authenticated user could not be loaded')
  }
  if (user.status !== 'active') {
    throw new ConflictError('User is disabled')
  }

  const token = randomUUID()
  const nowMs = Date.now()
  const upstreamExpiresAt = resolveAccessTokenExpiresAt(params.tokens, nowMs)
  const upstreamRefreshExpiresAt = resolveRefreshTokenExpiresAt(params.tokens, nowMs)
  const sessionExpiresAt = upstreamRefreshExpiresAt ?? upstreamExpiresAt
  const session = await userRepository.createSession({
    userId,
    identityId: identity.identityId,
    accessTokenHash: hashToken(token),
    refreshTokenHash: params.tokens.refreshToken ? hashToken(params.tokens.refreshToken) : null,
    upstreamRefreshTokenEncrypted: params.tokens.refreshToken ? encryptOAuthToken(params.tokens.refreshToken) : null,
    upstreamTokenType: params.tokens.tokenType,
    upstreamExpiresAt,
    upstreamRefreshExpiresAt,
    lastRefreshedAt: toIsoTimestamp(nowMs),
    expiresAt: sessionExpiresAt,
    loginIp: params.loginIp,
    userAgent: params.userAgent
  })

  return { token, user, session, mustChangePassword: false }
}

export async function loginWithLocalAccount(params: {
  account: string
  password: string
  loginIp?: string
  userAgent?: string
}): Promise<{ token: string; user: AuthenticatedUser['user']; session: AuthenticatedUser['session']; mustChangePassword: boolean }> {
  assertLocalLoginEnabled()
  const localAuth = await userRepository.findLocalAuthByAccount(params.account)
  if (!localAuth || !verifyPassword(params.password, localAuth.passwordHash)) {
    throw new UnauthorizedError('账号或密码错误')
  }

  await userRepository.updateUserLogin(localAuth.userId)
  const user = await userRepository.getUserDetailById(localAuth.userId)
  if (!user) {
    throw new ConflictError('Authenticated user could not be loaded')
  }
  if (user.status !== 'active') {
    throw new ConflictError('User is disabled')
  }

  const token = randomUUID()
  const session = await userRepository.createSession({
    userId: localAuth.userId,
    identityId: null,
    accessTokenHash: hashToken(token),
    refreshTokenHash: null,
    expiresAt: new Date(Date.now() + DEFAULT_SESSION_TTL_MS).toISOString(),
    loginIp: params.loginIp,
    userAgent: params.userAgent
  })

  return {
    token,
    user,
    session,
    mustChangePassword: false
  }
}

export async function changePasswordForUser(userId: number, currentPassword: string, nextPassword: string): Promise<void> {
  const localAuth = await userRepository.findLocalAuthByUserId(userId)
  if (!localAuth || !verifyPassword(currentPassword, localAuth.passwordHash)) {
    throw new UnauthorizedError('当前密码错误')
  }
  await userRepository.updateUserPassword(userId, hashPassword(nextPassword), false)
}

async function refreshOAuthSession(token: string, record: userRepository.SessionAuthRecord): Promise<userRepository.SessionAuthRecord> {
  const existingRefresh = oauthRefreshLocks.get(record.session.sessionId)
  if (existingRefresh) {
    return existingRefresh
  }

  const refreshPromise = (async () => {
    if (!record.upstreamRefreshTokenEncrypted) {
      throw new ConflictError('Session cannot be refreshed')
    }

    const decryptedRefreshToken = decryptOAuthToken(record.upstreamRefreshTokenEncrypted)
    const refreshedTokens = await refreshTokens(decryptedRefreshToken)
    const nowMs = Date.now()
    const nextRefreshToken = refreshedTokens.refreshToken ?? decryptedRefreshToken
    const upstreamExpiresAt = resolveAccessTokenExpiresAt(refreshedTokens, nowMs)
    const upstreamRefreshExpiresAt = resolveRefreshTokenExpiresAt(
      refreshedTokens,
      nowMs,
      record.upstreamRefreshExpiresAt
    )

    await userRepository.updateSessionOAuthTokens({
      sessionId: record.session.sessionId,
      refreshTokenHash: nextRefreshToken ? hashToken(nextRefreshToken) : null,
      upstreamRefreshTokenEncrypted: nextRefreshToken ? encryptOAuthToken(nextRefreshToken) : null,
      upstreamTokenType: refreshedTokens.tokenType ?? record.upstreamTokenType,
      upstreamExpiresAt,
      upstreamRefreshExpiresAt,
      lastRefreshedAt: toIsoTimestamp(nowMs),
      expiresAt: upstreamRefreshExpiresAt ?? upstreamExpiresAt
    })

    const refreshedRecord = await userRepository.getSessionAuthRecordByTokenHash(hashToken(token))
    if (!refreshedRecord) {
      throw new ConflictError('Session is invalid')
    }
    return refreshedRecord
  })()

  oauthRefreshLocks.set(record.session.sessionId, refreshPromise)
  try {
    return await refreshPromise
  } finally {
    oauthRefreshLocks.delete(record.session.sessionId)
  }
}

async function maybeRefreshAuthenticatedRecord(
  token: string,
  record: userRepository.SessionAuthRecord
): Promise<{ record: userRepository.SessionAuthRecord; refreshed: boolean }> {
  if (!record.upstreamRefreshTokenEncrypted || !record.upstreamExpiresAt) {
    return { record, refreshed: false }
  }

  const nowMs = Date.now()
  const accessExpiresAtMs = Date.parse(record.upstreamExpiresAt)
  if (!Number.isFinite(accessExpiresAtMs)) {
    return { record, refreshed: false }
  }

  const refreshExpiresAtMs = record.upstreamRefreshExpiresAt ? Date.parse(record.upstreamRefreshExpiresAt) : Number.NaN
  if (Number.isFinite(refreshExpiresAtMs) && refreshExpiresAtMs <= nowMs) {
    throw new ConflictError('Session has expired')
  }

  if (accessExpiresAtMs > nowMs + getOAuthRefreshWindowMs()) {
    return { record, refreshed: false }
  }

  try {
    const refreshedRecord = await refreshOAuthSession(token, record)
    return { record: refreshedRecord, refreshed: true }
  } catch {
    await userRepository.revokeSession(record.session.sessionId)
    throw new ConflictError('Session refresh failed')
  }
}

export async function getAuthenticatedUser(token: string): Promise<AuthenticatedUser> {
  const result = await userRepository.getSessionAuthRecordByTokenHash(hashToken(token))
  if (!result) {
    throw new ConflictError('Session is invalid')
  }
  if (result.session.revokedAt) {
    throw new ConflictError('Session has been revoked')
  }
  if (Date.parse(result.session.expiresAt) <= Date.now()) {
    throw new ConflictError('Session has expired')
  }
  if (result.user.status !== 'active') {
    throw new ConflictError('User is disabled')
  }

  const { record, refreshed } = await maybeRefreshAuthenticatedRecord(token, result)
  const authenticatedUser: AuthenticatedUser = {
    user: record.user,
    session: record.session,
    mustChangePassword: false
  }

  return refreshed ? markSessionRefreshed(authenticatedUser) : authenticatedUser
}

export async function logout(token: string | null): Promise<LogoutResult> {
  if (token) {
    const result = await userRepository.getAuthenticatedSessionByTokenHash(hashToken(token))
    if (result) {
      await userRepository.revokeSession(result.session.sessionId)
    }
  }

  return {
    redirectUrl: isOAuthLoginEnabled() ? buildOAuthLogoutUrl() : null
  }
}

export function extractBearerToken(req: Request): string {
  const authorization = req.headers.authorization
  if (!authorization || !authorization.startsWith('Bearer ')) {
    throw new UnauthorizedError('Authentication required')
  }
  return authorization.slice('Bearer '.length).trim()
}

export function extractRequestToken(req: Request): string {
  const sessionToken = readSessionCookie(req)
  if (sessionToken) {
    return sessionToken
  }
  return extractBearerToken(req)
}

export function getOAuthProviderCode(): string {
  return getOAuthProviderConfig().providerCode
}

export function __resetOAuthStateForTests(): void {
  resetOAuthStateStore()
}
