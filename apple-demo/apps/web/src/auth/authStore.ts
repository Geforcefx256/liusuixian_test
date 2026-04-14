import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import type { AuthMode, AuthenticatedPayload } from '@apple-demo/shared'

import { authApi } from '@/auth/authApi'

const OAUTH_REDIRECT_MARKER = 'agent-web-oauth-redirect-attempted'
const TEST_REDIRECT_HANDLER = '__agentWebTestRedirect__'

function hasAttemptedOAuthRedirect(): boolean {
  return typeof window !== 'undefined' && window.sessionStorage.getItem(OAUTH_REDIRECT_MARKER) === 'true'
}

function markOAuthRedirectAttempted(): void {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(OAUTH_REDIRECT_MARKER, 'true')
  }
}

function clearOAuthRedirectAttempted(): void {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(OAUTH_REDIRECT_MARKER)
  }
}

function clearAuthQueryParams(): void {
  if (typeof window === 'undefined') return
  const nextUrl = `${window.location.pathname}${window.location.hash || ''}`
  window.history.replaceState({}, document.title, nextUrl)
}

function redirectTo(url: string): void {
  if (typeof window !== 'undefined') {
    const redirectHandler = (window as typeof window & {
      [TEST_REDIRECT_HANDLER]?: ((nextUrl: string) => void) | undefined
    })[TEST_REDIRECT_HANDLER]
    if (typeof redirectHandler === 'function') {
      redirectHandler(url)
      return
    }
    window.location.assign(url)
  }
}

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<AuthenticatedPayload | null>(null)
  const authMode = ref<AuthMode['mode'] | 'unknown'>('unknown')
  const oauthLoginEnabled = ref(false)
  const localLoginEnabled = ref(false)
  const loginFormVisible = ref(false)
  const isLoading = ref(false)
  const isBootstrapping = ref(true)
  const error = ref<string | null>(null)
  let initializePromise: Promise<void> | null = null

  const isAuthenticated = computed(() => Boolean(currentUser.value))

  async function loadCurrentUser(options: { silent?: boolean } = {}): Promise<void> {
    if (!options.silent) {
      isLoading.value = true
      error.value = null
    }
    try {
      currentUser.value = await authApi.getCurrentUser()
    } catch (err) {
      currentUser.value = null
      if (!options.silent) {
        error.value = (err as Error).message
      }
    } finally {
      if (!options.silent) {
        isLoading.value = false
      }
    }
  }

  async function initialize(search = typeof window !== 'undefined' ? window.location.search : ''): Promise<void> {
    if (initializePromise) return initializePromise

    initializePromise = (async () => {
      isBootstrapping.value = true
      error.value = null

      const params = new URLSearchParams(search)
      const code = params.get('code')
      const state = params.get('state')

      await loadCurrentUser({ silent: true })
      if (currentUser.value) {
        clearOAuthRedirectAttempted()
        loginFormVisible.value = false
        isBootstrapping.value = false
        initializePromise = null
        return
      }

      if (code && state) {
        try {
          isLoading.value = true
          currentUser.value = await authApi.completeLoginCallback(code, state)
          clearAuthQueryParams()
          clearOAuthRedirectAttempted()
          loginFormVisible.value = false
          isBootstrapping.value = false
          initializePromise = null
          return
        } catch (err) {
          error.value = (err as Error).message
        } finally {
          isLoading.value = false
        }
      }

      try {
        const mode = await authApi.getAuthMode()
        authMode.value = mode.mode
        oauthLoginEnabled.value = mode.oauth.enabled
        localLoginEnabled.value = mode.local.enabled
        loginFormVisible.value = mode.preferred === 'local' && mode.local.enabled

        if (mode.preferred === 'oauth' && mode.oauth.enabled && !hasAttemptedOAuthRedirect()) {
          await startOAuthLogin()
          return
        }
      } catch (err) {
        authMode.value = 'local'
        oauthLoginEnabled.value = false
        localLoginEnabled.value = true
        loginFormVisible.value = true
        error.value = (err as Error).message
      } finally {
        isBootstrapping.value = false
        initializePromise = null
      }
    })()

    return initializePromise
  }

  async function loginWithLocalAccount(account: string, password: string): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      currentUser.value = await authApi.loginWithLocalAccount(account, password)
      loginFormVisible.value = false
      authMode.value = 'local'
      localLoginEnabled.value = true
      oauthLoginEnabled.value = false
      clearOAuthRedirectAttempted()
    } catch (err) {
      error.value = (err as Error).message
      loginFormVisible.value = localLoginEnabled.value
    } finally {
      isLoading.value = false
    }
  }

  async function startOAuthLogin(): Promise<void> {
    if (!oauthLoginEnabled.value) return

    isLoading.value = true
    error.value = null

    try {
      const { url } = await authApi.getLoginUrl()
      markOAuthRedirectAttempted()
      redirectTo(url)
    } catch (err) {
      error.value = (err as Error).message
      loginFormVisible.value = authMode.value === 'local'
    } finally {
      isLoading.value = false
    }
  }

  async function logout(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const result = await authApi.logout()
      currentUser.value = null
      loginFormVisible.value = false
      clearOAuthRedirectAttempted()
      if (result.redirectUrl) {
        redirectTo(result.redirectUrl)
        return
      }
      await initialize('')
    } catch (err) {
      error.value = (err as Error).message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  return {
    currentUser,
    authMode,
    oauthLoginEnabled,
    loginFormVisible,
    isLoading,
    isBootstrapping,
    error,
    isAuthenticated,
    initialize,
    loginWithLocalAccount,
    loadCurrentUser,
    startOAuthLogin,
    logout
  }
})
