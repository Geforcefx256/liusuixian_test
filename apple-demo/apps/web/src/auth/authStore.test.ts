import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/auth/authApi', () => ({
  authApi: {
    getAuthMode: vi.fn(),
    getLoginUrl: vi.fn(),
    loginWithLocalAccount: vi.fn(),
    completeLoginCallback: vi.fn(),
    getCurrentUser: vi.fn(),
    logout: vi.fn()
  }
}))

import { authApi } from '@/auth/authApi'
import { useAuthStore } from './authStore'

const mockedAuthApi = vi.mocked(authApi)

function buildCurrentUser() {
  return {
    user: {
      userId: 1,
      userCode: 'admin',
      userAccount: 'admin',
      displayName: '管理员',
      email: 'admin@example.com',
      avatarUrl: null,
      roles: [{ roleId: 1, roleKey: 'admin', roleNameCn: '管理员' }]
    },
    session: {
      sessionId: 'session-1',
      expiresAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    },
    mustChangePassword: false
  }
}

describe('authStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    window.sessionStorage.clear()
    window.history.replaceState({}, '', '/')
    delete (window as typeof window & { __agentWebTestRedirect__?: (url: string) => void }).__agentWebTestRedirect__
  })

  it('shows the local login form when no session exists', async () => {
    mockedAuthApi.getCurrentUser.mockRejectedValueOnce(new Error('unauthorized'))
    mockedAuthApi.getAuthMode.mockResolvedValueOnce({
      mode: 'local',
      preferred: 'local',
      oauth: { enabled: false },
      local: { enabled: true }
    })

    const store = useAuthStore()
    await store.initialize('')

    expect(store.isAuthenticated).toBe(false)
    expect(store.authMode).toBe('local')
    expect(store.loginFormVisible).toBe(true)
  })

  it('keeps an authenticated user inside the workbench', async () => {
    mockedAuthApi.getCurrentUser.mockResolvedValueOnce(buildCurrentUser())

    const store = useAuthStore()
    await store.initialize('')

    expect(store.isAuthenticated).toBe(true)
    expect(store.currentUser?.user.displayName).toBe('管理员')
    expect(store.loginFormVisible).toBe(false)
  })

  it('starts oauth login automatically in oauth mode', async () => {
    const redirectSpy = vi.fn()
    ;(window as typeof window & { __agentWebTestRedirect__?: (url: string) => void }).__agentWebTestRedirect__ = redirectSpy
    mockedAuthApi.getCurrentUser.mockRejectedValueOnce(new Error('unauthorized'))
    mockedAuthApi.getAuthMode.mockResolvedValueOnce({
      mode: 'oauth',
      preferred: 'oauth',
      oauth: { enabled: true },
      local: { enabled: false }
    })
    mockedAuthApi.getLoginUrl.mockResolvedValueOnce({
      url: '/oauth-start',
      state: 'state-1'
    })

    const store = useAuthStore()
    await store.initialize('')

    expect(mockedAuthApi.getLoginUrl).toHaveBeenCalledTimes(1)
    expect(redirectSpy).toHaveBeenCalledWith('/oauth-start')
    expect(window.sessionStorage.getItem('agent-web-oauth-redirect-attempted')).toBe('true')
  })

  it('keeps oauth entry on the SSO path after a previous redirect attempt', async () => {
    window.sessionStorage.setItem('agent-web-oauth-redirect-attempted', 'true')
    mockedAuthApi.getCurrentUser.mockRejectedValueOnce(new Error('unauthorized'))
    mockedAuthApi.getAuthMode.mockResolvedValueOnce({
      mode: 'oauth',
      preferred: 'oauth',
      oauth: { enabled: true },
      local: { enabled: false }
    })

    const store = useAuthStore()
    await store.initialize('')

    expect(mockedAuthApi.getLoginUrl).not.toHaveBeenCalled()
    expect(store.authMode).toBe('oauth')
    expect(store.loginFormVisible).toBe(false)
  })

  it('keeps local login hidden in oauth mode when oauth start fails', async () => {
    mockedAuthApi.getCurrentUser.mockRejectedValueOnce(new Error('unauthorized'))
    mockedAuthApi.getAuthMode.mockResolvedValueOnce({
      mode: 'oauth',
      preferred: 'oauth',
      oauth: { enabled: true },
      local: { enabled: false }
    })
    mockedAuthApi.getLoginUrl.mockRejectedValueOnce(new Error('oauth unavailable'))

    const store = useAuthStore()
    await store.initialize('')

    expect(store.authMode).toBe('oauth')
    expect(store.loginFormVisible).toBe(false)
    expect(store.error).toBe('oauth unavailable')
  })

  it('completes the backend-governed callback before loading auth mode', async () => {
    mockedAuthApi.getCurrentUser.mockRejectedValueOnce(new Error('unauthorized'))
    mockedAuthApi.completeLoginCallback.mockResolvedValueOnce(buildCurrentUser())

    const store = useAuthStore()
    await store.initialize('?code=code-1&state=state-1')

    expect(mockedAuthApi.completeLoginCallback).toHaveBeenCalledWith('code-1', 'state-1')
    expect(mockedAuthApi.getAuthMode).not.toHaveBeenCalled()
    expect(store.isAuthenticated).toBe(true)
    expect(window.location.search).toBe('')
  })

  it('honors backend logout redirect completion', async () => {
    const redirectSpy = vi.fn()
    ;(window as typeof window & { __agentWebTestRedirect__?: (url: string) => void }).__agentWebTestRedirect__ = redirectSpy
    mockedAuthApi.logout.mockResolvedValueOnce({
      redirectUrl: '/logged-out'
    })

    const store = useAuthStore()
    store.currentUser = buildCurrentUser()

    await store.logout()

    expect(mockedAuthApi.logout).toHaveBeenCalledTimes(1)
    expect(store.currentUser).toBeNull()
    expect(redirectSpy).toHaveBeenCalledWith('/logged-out')
  })
})
