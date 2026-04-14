import type { ApiResponse, AuthenticatedPayload } from '@apple-demo/shared'
import { authEndpoints } from './authConfig.js'

interface AuthContext {
  bearerToken?: string
  cookieHeader?: string
}

function buildAuthHeaders(auth: AuthContext): Record<string, string> | undefined {
  const headers: Record<string, string> = {}

  if (auth.cookieHeader) {
    headers.Cookie = auth.cookieHeader
  }

  if (auth.bearerToken) {
    headers.Authorization = `Bearer ${auth.bearerToken}`
  }

  return Object.keys(headers).length > 0 ? headers : undefined
}

export async function fetchAuthenticatedUser(auth: AuthContext): Promise<{ userId: number; roles: string[] }> {
  const response = await fetch(authEndpoints.currentUser(), {
    headers: buildAuthHeaders(auth)
  })
  if (!response.ok) {
    throw new Error(`Auth request failed: ${response.status}`)
  }
  const payload = await response.json() as ApiResponse<AuthenticatedPayload>
  const userId = payload?.data?.user?.userId
  if (!payload?.success || typeof userId !== 'number' || !Number.isFinite(userId)) {
    throw new Error('Invalid auth response')
  }
  const roles = Array.isArray(payload?.data?.user?.roles)
    ? payload.data.user.roles
      .map(role => typeof role?.roleKey === 'string' ? role.roleKey.trim() : '')
      .filter(Boolean)
    : []
  return { userId, roles }
}
