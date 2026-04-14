import axios from 'axios'

import { getOAuthProviderConfig, isOAuthLoggingEnabled } from './config.js'
import type { OAuthTokens, OAuthUserinfo } from '../types/user.js'
import { ValidationError } from '../utils/errors.js'

function toLoggableParams(body: URLSearchParams): Record<string, string> {
  return Object.fromEntries(body.entries())
}

function maskSensitiveValue(value: string): string {
  if (value.length <= 8) {
    return '***'
  }

  return `${value.slice(0, 4)}***${value.slice(-4)}`
}

function sanitizeLogPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => sanitizeLogPayload(item))
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => {
      if (['client_secret', 'access_token', 'refresh_token', 'id_token', 'token'].includes(key)) {
        if (typeof nestedValue === 'string' && nestedValue.trim()) {
          return [key, maskSensitiveValue(nestedValue)]
        }
        return [key, '***']
      }

      return [key, sanitizeLogPayload(nestedValue)]
    })

    return Object.fromEntries(entries)
  }

  return value
}

function logSsoInteraction(input: {
  stage: string
  url: string
  requestParams?: Record<string, unknown>
  responseParams?: unknown
}): void {
  if (!isOAuthLoggingEnabled()) {
    return
  }

  console.log(
    `[SSO] ${input.stage}\n${JSON.stringify({
      url: input.url,
      request: sanitizeLogPayload(input.requestParams ?? null),
      response: sanitizeLogPayload(input.responseParams ?? null)
    }, null, 2)}`
  )
}

function logSsoError(input: {
  stage: string
  url: string
  requestParams?: Record<string, unknown>
  error: unknown
}): void {
  if (!isOAuthLoggingEnabled()) {
    return
  }

  if (axios.isAxiosError(input.error)) {
    console.error(
      `[SSO] ${input.stage}:error\n${JSON.stringify({
        url: input.url,
        request: sanitizeLogPayload(input.requestParams ?? null),
        response: sanitizeLogPayload({
          status: input.error.response?.status ?? null,
          statusText: input.error.response?.statusText ?? null,
          data: input.error.response?.data ?? null,
          message: input.error.message
        })
      }, null, 2)}`
    )
    return
  }

  console.error(
    `[SSO] ${input.stage}:error\n${JSON.stringify({
      url: input.url,
      request: sanitizeLogPayload(input.requestParams ?? null),
      response: {
        message: input.error instanceof Error ? input.error.message : String(input.error)
      }
    }, null, 2)}`
  )
}

export function buildOAuthAuthorizeUrl(state: string): string {
  const config = getOAuthProviderConfig()
  const authorizeUrl = config.authorizeUrl || 'http://localhost/oauth/authorize'
  const url = new URL(authorizeUrl)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('scope', config.scope)
  url.searchParams.set('state', state)
  const loginUrl = url.toString()
  logSsoInteraction({
    stage: 'authorize-url',
    url: loginUrl,
    requestParams: Object.fromEntries(url.searchParams.entries()),
    responseParams: { loginUrl }
  })
  return loginUrl
}

function readNumberField(payload: Record<string, unknown>, fieldNames: string[]): number | null {
  for (const fieldName of fieldNames) {
    const value = payload[fieldName]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }
  return null
}

function readStringField(payload: Record<string, unknown>, fieldNames: string[]): string | null {
  for (const fieldName of fieldNames) {
    const value = payload[fieldName]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value)
    }
  }
  return null
}

function mapTokenPayload(payload: Record<string, unknown>): OAuthTokens {
  const expiresIn = readNumberField(payload, ['expires_in'])
  const accessTokenExpiresAt = readNumberField(payload, [
    'expires_at',
    'expiresAt',
    'access_token_expires_at',
    'accessTokenExpiresAt',
    'expire_time',
    'expireTime'
  ])
  const refreshTokenExpiresAt = readNumberField(payload, [
    'refresh_expires_at',
    'refreshExpiresAt',
    'refresh_token_expires_at',
    'refreshTokenExpiresAt',
    'refresh_expire_time',
    'refreshExpireTime'
  ])

  return {
    accessToken: String(payload.access_token ?? ''),
    refreshToken: payload.refresh_token ? String(payload.refresh_token) : null,
    expiresIn,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
    tokenType: payload.token_type ? String(payload.token_type) : null
  }
}

export async function exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
  const config = getOAuthProviderConfig()
  if (!config.tokenUrl || !config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new ValidationError('OAuth configuration is incomplete')
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri
  })

  try {
    const response = await axios.post(config.tokenUrl, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000
    })
    logSsoInteraction({
      stage: 'exchange-code-for-tokens',
      url: config.tokenUrl,
      requestParams: toLoggableParams(body),
      responseParams: response.data
    })
    return mapTokenPayload(response.data as Record<string, unknown>)
  } catch (error) {
    logSsoError({
      stage: 'exchange-code-for-tokens',
      url: config.tokenUrl,
      requestParams: toLoggableParams(body),
      error
    })
    throw error
  }
}

export async function refreshTokens(refreshToken: string): Promise<OAuthTokens> {
  const config = getOAuthProviderConfig()
  if (!config.refreshUrl || !config.clientId || !config.clientSecret) {
    throw new ValidationError('OAuth refresh configuration is incomplete')
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret
  })

  try {
    const response = await axios.post(config.refreshUrl, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000
    })
    logSsoInteraction({
      stage: 'refresh-tokens',
      url: config.refreshUrl,
      requestParams: toLoggableParams(body),
      responseParams: response.data
    })
    return mapTokenPayload(response.data as Record<string, unknown>)
  } catch (error) {
    logSsoError({
      stage: 'refresh-tokens',
      url: config.refreshUrl,
      requestParams: toLoggableParams(body),
      error
    })
    throw error
  }
}

export function buildOAuthLogoutUrl(): string {
  const config = getOAuthProviderConfig()
  if (!config.logoutUrl || !config.clientId || !config.logoutRedirectUrl) {
    throw new ValidationError('OAuth logout configuration is incomplete')
  }

  const url = new URL(config.logoutUrl)
  url.searchParams.set('clientId', config.clientId)
  url.searchParams.set('redirect', config.logoutRedirectUrl)
  const logoutUrl = url.toString()
  logSsoInteraction({
    stage: 'logout-url',
    url: logoutUrl,
    requestParams: Object.fromEntries(url.searchParams.entries()),
    responseParams: { logoutUrl }
  })
  return logoutUrl
}

export async function fetchUserinfo(tokens: OAuthTokens): Promise<OAuthUserinfo> {
  const config = getOAuthProviderConfig()
  if (!config.userinfoUrl || !config.clientId || !config.scope) {
    throw new ValidationError('OAuth userinfo URL is not configured')
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    access_token: tokens.accessToken,
    scope: config.scope
  })

  let payload: Record<string, unknown>
  try {
    const response = await axios.post(config.userinfoUrl, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000
    })
    logSsoInteraction({
      stage: 'fetch-userinfo',
      url: config.userinfoUrl,
      requestParams: toLoggableParams(body),
      responseParams: response.data
    })
    payload = response.data as Record<string, unknown>
  } catch (error) {
    logSsoError({
      stage: 'fetch-userinfo',
      url: config.userinfoUrl,
      requestParams: toLoggableParams(body),
      error
    })
    throw error
  }

  const externalUserUuid = readStringField(payload, ['uuid'])

  return {
    uuid: externalUserUuid ?? '',
    uid: readStringField(payload, ['uid']),
    loginName: readStringField(payload, ['login_name', 'preferred_username', 'username', 'account', 'user_name']),
    email: readStringField(payload, ['email']),
    displayName: readStringField(payload, ['display_name', 'name', 'displayName', 'nickname', 'nick_name']),
    phone: readStringField(payload, ['phone', 'mobile', 'phone_number']),
    avatarUrl: readStringField(payload, ['avatar_url', 'avatar', 'picture']),
    raw: payload
  }
}
