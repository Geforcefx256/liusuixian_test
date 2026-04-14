import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createApp, initializeAppData } from '../src/app.js'
import {
  __resetAuthModeForTests,
  __resetOAuthProviderConfigForTests,
  __setAuthModeForTests,
  __setOAuthProviderConfigForTests
} from '../src/auth/config.js'
import { closeAllConnections } from '../src/database/connection.js'
import { DEFAULT_LOCAL_ADMIN_PASSWORD, initDatabase, initDefaultAdminUser, initDefaultRoles } from '../src/database/init.js'
import { getServiceRoot } from '../src/config/runtimePaths.js'
import * as authService from '../src/auth/service.js'
import * as userRepository from '../src/repositories/userRepository.js'
import { invokeApp } from './httpHarness.js'

const SQLITE_ROOT = path.join(getServiceRoot(), 'SQLite')
const OAUTH_CONFIG = {
  providerCode: 'corp',
  authorizeUrl: 'https://sso.example.com/oauth/authorize',
  tokenUrl: 'https://sso.example.com/oauth/token',
  refreshUrl: 'https://sso.example.com/oauth/token/refresh',
  userinfoUrl: 'https://sso.example.com/oauth/userinfo',
  logoutUrl: 'https://sso.example.com/oauth/logout',
  logoutRedirectUrl: 'http://localhost:5175/logout-complete',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'http://localhost:3200/web/api/auth/callback',
  scope: 'openid profile email',
  tokenEncryptionKey: 'test-oauth-token-encryption-key',
  enableLogs: false
}

function extractCookie(setCookieHeader: string | string[] | undefined): string {
  const rawHeader = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader
  if (!rawHeader) {
    throw new Error('Missing set-cookie header')
  }
  return rawHeader.split(';')[0]
}

beforeEach(async () => {
  __resetAuthModeForTests()
  __resetOAuthProviderConfigForTests()
  closeAllConnections()
  fs.rmSync(SQLITE_ROOT, { recursive: true, force: true })
  await initializeAppData()
})

afterEach(() => {
  __resetAuthModeForTests()
  __resetOAuthProviderConfigForTests()
  vi.restoreAllMocks()
  closeAllConnections()
  fs.rmSync(SQLITE_ROOT, { recursive: true, force: true })
})

describe('auth routes', () => {
  it('returns local auth mode by default', async () => {
    const response = await invokeApp(createApp(), {
      path: '/web/api/auth/mode'
    })
    expect(response.status).toBe(200)
    const payload = response.json<{
      success: boolean
      data: {
        mode: string
        preferred: string
        local: { enabled: boolean }
        oauth: { enabled: boolean }
      }
    }>()
    expect(payload.success).toBe(true)
    expect(payload.data.mode).toBe('local')
    expect(payload.data.preferred).toBe('local')
    expect(payload.data.local.enabled).toBe(true)
    expect(payload.data.oauth.enabled).toBe(false)
    expect('loginUrl' in payload.data.oauth).toBe(false)
  })

  it('returns oauth auth mode when oauth is enabled', async () => {
    __setAuthModeForTests('oauth')
    __setOAuthProviderConfigForTests(OAUTH_CONFIG)

    const response = await invokeApp(createApp(), {
      path: '/web/api/auth/mode'
    })
    expect(response.status).toBe(200)
    const payload = response.json<{
      success: boolean
      data: {
        mode: string
        preferred: string
        local: { enabled: boolean }
        oauth: { enabled: boolean }
      }
    }>()

    expect(payload.data.mode).toBe('oauth')
    expect(payload.data.preferred).toBe('oauth')
    expect(payload.data.local.enabled).toBe(false)
    expect(payload.data.oauth.enabled).toBe(true)
  })

  it('rejects local password login in oauth mode', async () => {
    __setAuthModeForTests('oauth')
    __setOAuthProviderConfigForTests(OAUTH_CONFIG)

    const response = await invokeApp(createApp(), {
      method: 'POST',
      path: '/web/api/auth/login',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5175'
      },
      body: JSON.stringify({
        account: 'admin',
        password: DEFAULT_LOCAL_ADMIN_PASSWORD
      })
    })

    expect(response.status).toBe(400)
    const payload = response.json<{ success: boolean; error: string }>()
    expect(payload.success).toBe(false)
    expect(payload.error).toContain('Local login is not enabled')
  })

  it('still bootstraps a default local admin in oauth mode', async () => {
    __setAuthModeForTests('oauth')
    closeAllConnections()
    fs.rmSync(SQLITE_ROOT, { recursive: true, force: true })

    await initDatabase()
    await initDefaultRoles()
    await initDefaultAdminUser()

    const admin = await userRepository.findUserByAccount('admin')
    expect(admin?.userAccount).toBe('admin')
  })

  it('supports login, me, logout, and login invalidation through cookie sessions', async () => {
    const app = createApp()
    const loginResponse = await invokeApp(app, {
      method: 'POST',
      path: '/web/api/auth/login',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5175'
      },
      body: JSON.stringify({
        account: 'admin',
        password: DEFAULT_LOCAL_ADMIN_PASSWORD
      })
    })

    expect(loginResponse.status).toBe(200)
    const cookie = extractCookie(loginResponse.headers['set-cookie'])
    const loginPayload = loginResponse.json<{
      success: boolean
      data: {
        user: {
          userAccount: string
          roles: Array<{ roleKey: string }>
        }
      }
    }>()
    expect(loginPayload.success).toBe(true)
    expect(loginPayload.data.user.userAccount).toBe('admin')
    expect(loginPayload.data.user.roles.map(role => role.roleKey)).toContain('admin')

    const meResponse = await invokeApp(app, {
      path: '/web/api/auth/me',
      headers: {
        Cookie: cookie
      }
    })
    expect(meResponse.status).toBe(200)
    const mePayload = meResponse.json<{
      success: boolean
      data: {
        user: {
          userAccount: string
          roles: Array<{ roleKey: string }>
        }
      }
    }>()
    expect(mePayload.data.user.userAccount).toBe('admin')
    expect(mePayload.data.user.roles.map(role => role.roleKey)).toContain('admin')

    const logoutResponse = await invokeApp(app, {
      method: 'POST',
      path: '/web/api/auth/logout',
      headers: {
        Cookie: cookie,
        Origin: 'http://localhost:5175'
      }
    })
    expect(logoutResponse.status).toBe(200)
    const logoutPayload = logoutResponse.json<{
      success: boolean
      data: {
        redirectUrl: string | null
      }
    }>()
    expect(logoutPayload.data.redirectUrl).toBeNull()

    const afterLogout = await invokeApp(app, {
      path: '/web/api/auth/me',
      headers: {
        Cookie: cookie
      }
    })
    expect(afterLogout.status).toBe(409)
  })

  it('returns upstream logout completion intent for oauth-backed sessions', async () => {
    __setAuthModeForTests('oauth')
    __setOAuthProviderConfigForTests(OAUTH_CONFIG)
    vi.spyOn(authService, 'extractRequestToken').mockReturnValue('oauth-session-token')
    vi.spyOn(authService, 'getAuthenticatedUser').mockResolvedValue({
      user: {
        userId: 1,
        userCode: 'oauth-user',
        userAccount: 'oauth-user',
        displayName: 'OAuth User',
        email: null,
        phone: null,
        avatarUrl: null,
        status: 'active',
        lastLoginAt: null,
        createdAt: '',
        updatedAt: '',
        isDeleted: false,
        roles: [{ roleId: 1, roleKey: 'user', roleNameCn: '用户', roleNameEn: 'user', roleDesc: '', isActive: true, createdAt: '', updatedAt: '' }],
        identities: []
      },
      session: {
        sessionId: 'oauth-session',
        userId: 1,
        identityId: 1,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        revokedAt: null,
        loginIp: null,
        userAgent: null,
        createdAt: ''
      },
      mustChangePassword: false
    })
    vi.spyOn(authService, 'logout').mockResolvedValue({
      redirectUrl: 'https://sso.example.com/oauth/logout?clientId=client-id&redirect=http%3A%2F%2Flocalhost%3A5175%2Flogout-complete'
    })

    const response = await invokeApp(createApp(), {
      method: 'POST',
      path: '/web/api/auth/logout',
      headers: {
        Cookie: 'mml_session=oauth-session-token',
        Origin: 'http://localhost:5175'
      }
    })
    expect(response.status).toBe(200)
    const payload = response.json<{
      success: boolean
      data: { redirectUrl: string | null }
    }>()
    expect(payload.data.redirectUrl).toContain('logout')
  })

  it('rejects password change requests across auth modes', async () => {
    const app = createApp()

    const loginResponse = await invokeApp(app, {
      method: 'POST',
      path: '/web/api/auth/login',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5175'
      },
      body: JSON.stringify({
        account: 'admin',
        password: DEFAULT_LOCAL_ADMIN_PASSWORD
      })
    })

    const cookie = extractCookie(loginResponse.headers['set-cookie'])
    const changeResponse = await invokeApp(app, {
      method: 'POST',
      path: '/web/api/auth/change-password',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        Origin: 'http://localhost:5175'
      },
      body: JSON.stringify({
        currentPassword: DEFAULT_LOCAL_ADMIN_PASSWORD,
        nextPassword: 'Admin@654321'
      })
    })

    expect(changeResponse.status).toBe(400)
    const changePayload = changeResponse.json<{ success: boolean; error: string }>()
    expect(changePayload.success).toBe(false)
    expect(changePayload.error).toContain('Password change is not supported')

    const currentPasswordLogin = await invokeApp(app, {
      method: 'POST',
      path: '/web/api/auth/login',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5175'
      },
      body: JSON.stringify({
        account: 'admin',
        password: DEFAULT_LOCAL_ADMIN_PASSWORD
      })
    })
    expect(currentPasswordLogin.status).toBe(200)
  })

  it('rejects existing sessions when the user is disabled', async () => {
    const app = createApp()
    const loginResponse = await invokeApp(app, {
      method: 'POST',
      path: '/web/api/auth/login',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5175'
      },
      body: JSON.stringify({
        account: 'admin',
        password: DEFAULT_LOCAL_ADMIN_PASSWORD
      })
    })

    const cookie = extractCookie(loginResponse.headers['set-cookie'])
    const loginPayload = loginResponse.json<{ data: { user: { userId: number } } }>()
    await userRepository.updateUserStatus(loginPayload.data.user.userId, 'disabled')

    const meResponse = await invokeApp(app, {
      path: '/web/api/auth/me',
      headers: {
        Cookie: cookie
      }
    })

    expect(meResponse.status).toBe(409)
  })

  it('issues persisted oauth login transactions and consumes them once', async () => {
    __setAuthModeForTests('oauth')
    __setOAuthProviderConfigForTests(OAUTH_CONFIG)

    const exchangeSpy = vi.spyOn(authService, 'exchangeCodeForTokens').mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: null,
      expiresIn: 3600,
      tokenType: 'Bearer'
    })
    const userinfoSpy = vi.spyOn(authService, 'fetchUserinfo').mockResolvedValue({
      uuid: 'oauth-user-1',
      loginName: 'alice',
      email: 'alice@example.com',
      displayName: 'Alice',
      raw: { sub: 'oauth-user-1' }
    })

    const app = createApp()
    const loginUrlResponse = await invokeApp(app, {
      path: '/web/api/auth/login-url'
    })
    expect(loginUrlResponse.status).toBe(200)
    const loginUrlPayload = loginUrlResponse.json<{ success: boolean; data: { url: string; state: string } }>()
    expect(loginUrlPayload.success).toBe(true)
    expect(loginUrlPayload.data.url).toContain(`state=${loginUrlPayload.data.state}`)
    expect(loginUrlPayload.data.url).toContain(encodeURIComponent(OAUTH_CONFIG.redirectUri))

    const callbackResponse = await invokeApp(app, {
      path: `/web/api/auth/callback?code=auth-code&state=${encodeURIComponent(loginUrlPayload.data.state)}`
    })
    expect(callbackResponse.status).toBe(200)
    expect(extractCookie(callbackResponse.headers['set-cookie'])).toContain('mml_session=')
    const callbackPayload = callbackResponse.json<{
      success: boolean
      data: {
        user: {
          roles: Array<{ roleKey: string }>
        }
      }
    }>()
    expect(callbackPayload.data.user.roles.map(role => role.roleKey)).toContain('guest')
    expect(exchangeSpy).toHaveBeenCalledWith('auth-code')
    expect(userinfoSpy).toHaveBeenCalled()

    const secondCallback = await invokeApp(app, {
      path: `/web/api/auth/callback?code=auth-code&state=${encodeURIComponent(loginUrlPayload.data.state)}`
    })
    expect(secondCallback.status).toBe(400)
  })

  it('binds first-time oauth login to an existing local account instead of creating a duplicate', async () => {
    __setAuthModeForTests('oauth')
    __setOAuthProviderConfigForTests(OAUTH_CONFIG)
    await userRepository.createUser({
      userCode: 'alice',
      userAccount: 'alice',
      displayName: 'Existing Alice'
    })

    vi.spyOn(authService, 'exchangeCodeForTokens').mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: null,
      expiresIn: 3600,
      tokenType: 'Bearer'
    })
    vi.spyOn(authService, 'fetchUserinfo').mockResolvedValue({
      uuid: 'oauth-user-2',
      loginName: 'alice',
      email: 'alice@example.com',
      displayName: 'Alice',
      raw: { sub: 'oauth-user-2' }
    })

    const app = createApp()
    const loginUrlResponse = await invokeApp(app, {
      path: '/web/api/auth/login-url'
    })
    const loginUrlPayload = loginUrlResponse.json<{ data: { state: string } }>()

    const callbackResponse = await invokeApp(app, {
      path: `/web/api/auth/callback?code=auth-code&state=${encodeURIComponent(loginUrlPayload.data.state)}`
    })
    expect(callbackResponse.status).toBe(200)
    const payload = callbackResponse.json<{
      success: boolean
      data: {
        user: {
          userAccount: string
        }
      }
    }>()
    expect(payload.success).toBe(true)
    expect(payload.data.user.userAccount).toBe('alice')
  })

  it('uses uuid for userCode and uid for account-facing fallback in sparse internal sso payloads', async () => {
    __setAuthModeForTests('oauth')
    __setOAuthProviderConfigForTests(OAUTH_CONFIG)

    vi.spyOn(authService, 'exchangeCodeForTokens').mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: null,
      expiresIn: 3600,
      tokenType: 'Bearer'
    })
    vi.spyOn(authService, 'fetchUserinfo').mockResolvedValue({
      uuid: 'user-uuid-1',
      loginName: 'x3008892398',
      displayName: null,
      email: null,
      phone: null,
      avatarUrl: null,
      raw: {
        uuid: 'user-uuid-1',
        uid: 'x3008892398'
      }
    })

    const app = createApp()
    const loginUrlResponse = await invokeApp(app, {
      path: '/web/api/auth/login-url'
    })
    const loginUrlPayload = loginUrlResponse.json<{ data: { state: string } }>()

    const callbackResponse = await invokeApp(app, {
      path: `/web/api/auth/callback?code=auth-code&state=${encodeURIComponent(loginUrlPayload.data.state)}`
    })

    expect(callbackResponse.status).toBe(200)
    const payload = callbackResponse.json<{
      success: boolean
      data: {
        user: {
          userCode: string
          userAccount: string
          displayName: string
        }
      }
    }>()
    expect(payload.success).toBe(true)
    expect(payload.data.user.userCode).toBe('user-uuid-1')
    expect(payload.data.user.userAccount).toBe('x3008892398')
    expect(payload.data.user.displayName).toBe('x3008892398')
  })

  it('reissues the session cookie when an authenticated session is refreshed', async () => {
    const app = createApp()
    vi.spyOn(authService, 'extractRequestToken').mockReturnValue('refreshed-session-token')
    vi.spyOn(authService, 'getAuthenticatedUser').mockResolvedValue({
      user: {
        userId: 1,
        userCode: 'oauth-user',
        userAccount: 'oauth-user',
        displayName: 'OAuth User',
        email: null,
        phone: null,
        avatarUrl: null,
        status: 'active',
        lastLoginAt: null,
        createdAt: '',
        updatedAt: '',
        isDeleted: false,
        roles: [{ roleId: 1, roleKey: 'user', roleNameCn: '用户', roleNameEn: 'user', roleDesc: '', isActive: true, createdAt: '', updatedAt: '' }],
        identities: []
      },
      session: {
        sessionId: 'oauth-session',
        userId: 1,
        identityId: 1,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        revokedAt: null,
        loginIp: null,
        userAgent: null,
        createdAt: ''
      },
      mustChangePassword: false
    })
    vi.spyOn(authService, 'wasSessionRefreshed').mockReturnValue(true)

    const response = await invokeApp(app, {
      path: '/web/api/auth/me',
      headers: {
        Cookie: 'mml_session=refreshed-session-token'
      }
    })

    expect(response.status).toBe(200)
    expect(extractCookie(response.headers['set-cookie'])).toContain('mml_session=refreshed-session-token')
  })
})
