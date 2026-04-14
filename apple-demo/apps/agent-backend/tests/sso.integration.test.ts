import fs from 'node:fs'
import path from 'node:path'

import express from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/memory/ConfigLoader.js', () => ({
  loadConfig: () => ({
    auth: {
      baseUrl: 'http://web-backend.test',
      sameOriginProtection: {
        enabled: true,
        allowedOrigins: ['http://localhost:517*']
      }
    }
  })
}))

import { createAgentRouter } from '../src/routes/agent.js'
import { requireSameOrigin } from '../src/http/sameOrigin.js'
import { createApp as createWebApp, initializeAppData } from '../../web-backend/src/app.js'
import {
  __resetAuthModeForTests,
  __resetOAuthProviderConfigForTests,
  __setAuthModeForTests,
  __setOAuthProviderConfigForTests
} from '../../web-backend/src/auth/config.js'
import { closeAllConnections } from '../../web-backend/src/database/connection.js'
import { getServiceRoot } from '../../web-backend/src/config/runtimePaths.js'
import * as authService from '../../web-backend/src/auth/service.js'
import { invokeApp } from '../../web-backend/tests/httpHarness.js'

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
  redirectUri: 'http://localhost:5175',
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

function createAgentApp() {
  const service = {
    createSession: vi.fn(async (userId: number, agentId: string, title?: string) => ({
      sessionId: 'session-1',
      userId,
      agentId,
      title
    })),
    listSessions: vi.fn(async () => []),
    deleteSession: vi.fn(async () => true),
    listWorkspaceFiles: vi.fn(() => []),
    getSessionMeta: vi.fn(async () => null),
    getWorkspaceFiles: vi.fn(async () => []),
    replaceWorkspaceFiles: vi.fn(async () => null)
  }

  const app = express()
  app.use(express.json())
  app.use(requireSameOrigin)
  app.use('/agent/api/agent', createAgentRouter(service as never))
  return { app, service }
}

function buildFetchResponse(status: number, body: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return JSON.parse(body)
    }
  }
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

describe('sso integration', () => {
  it('preserves the authenticated session across web and agent flows until logout', async () => {
    __setAuthModeForTests('oauth')
    __setOAuthProviderConfigForTests(OAUTH_CONFIG)
    vi.spyOn(authService, 'exchangeCodeForTokens').mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
      tokenType: 'Bearer'
    })
    vi.spyOn(authService, 'fetchUserinfo').mockResolvedValue({
      uuid: 'oauth-user-1',
      loginName: 'alice',
      email: 'alice@example.com',
      displayName: 'Alice',
      raw: { sub: 'oauth-user-1' }
    })

    const webApp = createWebApp()
    const { app: agentApp, service } = createAgentApp()

    const loginUrlResponse = await invokeApp(webApp, {
      path: '/web/api/auth/login-url'
    })
    const loginUrlPayload = loginUrlResponse.json<{ data: { state: string } }>()
    const callbackResponse = await invokeApp(webApp, {
      path: `/web/api/auth/callback?code=auth-code&state=${encodeURIComponent(loginUrlPayload.data.state)}`
    })
    const cookie = extractCookie(callbackResponse.headers['set-cookie'])

    const meResponse = await invokeApp(webApp, {
      path: '/web/api/auth/me',
      headers: {
        Cookie: cookie
      }
    })
    expect(meResponse.status).toBe(200)
    const mePayload = meResponse.json<{ data: { user: { userAccount: string; userId: number } } }>()
    expect(mePayload.data.user.userAccount).toBe('alice')

    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (!url.startsWith('http://web-backend.test/')) {
        throw new Error(`Unexpected fetch target: ${url}`)
      }
      const cookieHeader = new Headers(init?.headers).get('cookie') || undefined
      const response = await invokeApp(webApp, {
        path: new URL(url).pathname,
        headers: cookieHeader ? { Cookie: cookieHeader } : {}
      })
      return buildFetchResponse(response.status, response.text)
    })

    const agentResponse = await invokeApp(agentApp, {
      method: 'POST',
      path: '/agent/api/agent/sessions',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5175',
        Cookie: cookie
      },
      body: JSON.stringify({
        agentId: 'workspace-agent',
        title: 'SSO Session'
      })
    })
    expect(agentResponse.status).toBe(200)
    expect(agentResponse.json<{ session: { userId: number } }>().session.userId).toBe(mePayload.data.user.userId)
    expect(service.createSession).toHaveBeenCalledWith(mePayload.data.user.userId, 'workspace-agent', 'SSO Session')

    const logoutResponse = await invokeApp(webApp, {
      method: 'POST',
      path: '/web/api/auth/logout',
      headers: {
        Cookie: cookie,
        Origin: 'http://localhost:5175'
      }
    })
    expect(logoutResponse.status).toBe(200)
    expect(logoutResponse.json<{ data: { redirectUrl: string | null } }>().data.redirectUrl).toContain('logout')

    const afterLogout = await invokeApp(agentApp, {
      method: 'POST',
      path: '/agent/api/agent/sessions',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5175',
        Cookie: cookie
      },
      body: JSON.stringify({
        agentId: 'workspace-agent',
        title: 'Blocked Session'
      })
    })
    expect(afterLogout.status).toBe(401)
  })
})
