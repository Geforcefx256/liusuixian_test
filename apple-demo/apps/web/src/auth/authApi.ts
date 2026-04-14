import { getWebApiBase } from '@/config/apiConfig'
import type {
  ApiResponse,
  AuthMode,
  AuthenticatedPayload,
  LogoutPayload,
  OAuthLoginStartPayload
} from '@apple-demo/shared'

const AUTH_API_BASE = `${getWebApiBase()}/auth`

async function readAuthResponse<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json() as ApiResponse<T>
  if (!response.ok || !payload.success || typeof payload.data === 'undefined') {
    throw new Error(payload.error || fallback)
  }
  return payload.data
}

function withCredentials(init?: RequestInit): RequestInit {
  return {
    ...(init || {}),
    credentials: 'include'
  }
}

export const authApi = {
  async getAuthMode(): Promise<AuthMode> {
    const response = await fetch(`${AUTH_API_BASE}/mode`, withCredentials())
    return readAuthResponse(response, `Failed to load auth mode: ${response.status}`)
  },

  async getLoginUrl(): Promise<OAuthLoginStartPayload> {
    const response = await fetch(`${AUTH_API_BASE}/login-url`, withCredentials())
    return readAuthResponse(response, `Failed to start OAuth login: ${response.status}`)
  },

  async loginWithLocalAccount(account: string, password: string): Promise<AuthenticatedPayload> {
    const response = await fetch(`${AUTH_API_BASE}/login`, withCredentials({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account, password })
    }))
    return readAuthResponse(response, `Failed to login: ${response.status}`)
  },

  async completeLoginCallback(code: string, state: string): Promise<AuthenticatedPayload> {
    const query = new URLSearchParams({ code, state })
    const response = await fetch(`${AUTH_API_BASE}/callback?${query.toString()}`, withCredentials())
    return readAuthResponse(response, `Failed to complete login: ${response.status}`)
  },

  async getCurrentUser(): Promise<AuthenticatedPayload> {
    const response = await fetch(`${AUTH_API_BASE}/me`, withCredentials())
    return readAuthResponse(response, `Failed to load current user: ${response.status}`)
  },

  async logout(): Promise<LogoutPayload> {
    const response = await fetch(`${AUTH_API_BASE}/logout`, withCredentials({
      method: 'POST'
    }))
    return readAuthResponse(response, `Failed to logout: ${response.status}`)
  }
}
