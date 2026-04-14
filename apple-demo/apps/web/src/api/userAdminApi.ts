import { getWebApiBase } from '@/config/apiConfig'
import type { PaginatedPayload, UserAdminRole, UserAdminUser } from './types'

const WEB_API_BASE = getWebApiBase()
const USERS_API_BASE = `${WEB_API_BASE}/users`
const ROLES_API_BASE = `${WEB_API_BASE}/roles`

interface ApiSuccess<T> {
  success: boolean
  data: T
  error?: string
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...(init || {}),
    credentials: 'include'
  })
  const payload = await response.json() as ApiSuccess<T>
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || `HTTP ${response.status}`)
  }
  return payload.data
}

export const userAdminApi = {
  async listUsers(params: {
    page?: number
    pageSize?: number
    status?: 'active' | 'disabled' | ''
    roleKey?: string
    keyword?: string
  } = {}): Promise<PaginatedPayload<UserAdminUser>> {
    const query = new URLSearchParams()
    query.set('page', String(params.page ?? 1))
    query.set('pageSize', String(params.pageSize ?? 20))
    if (params.status) query.set('status', params.status)
    if (params.roleKey) query.set('roleKey', params.roleKey)
    if (params.keyword?.trim()) query.set('keyword', params.keyword.trim())
    return requestJson(`${USERS_API_BASE}?${query.toString()}`)
  },

  async getUser(userId: number): Promise<UserAdminUser> {
    return requestJson(`${USERS_API_BASE}/${userId}`)
  },

  async updateUser(userId: number, payload: {
    displayName?: string
    email?: string | null
    phone?: string | null
    avatarUrl?: string | null
  }): Promise<UserAdminUser> {
    return requestJson(`${USERS_API_BASE}/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  },

  async updateUserStatus(userId: number, status: 'active' | 'disabled'): Promise<UserAdminUser> {
    return requestJson(`${USERS_API_BASE}/${userId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
  },

  async replaceUserRoles(userId: number, roleIds: number[]): Promise<UserAdminUser> {
    return requestJson(`${USERS_API_BASE}/${userId}/roles`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleIds })
    })
  },

  async listRoles(includeInactive = true): Promise<UserAdminRole[]> {
    const query = new URLSearchParams({ includeInactive: String(includeInactive) })
    return requestJson(`${ROLES_API_BASE}?${query.toString()}`)
  },

  async updateRole(roleId: number, payload: {
    roleNameCn?: string
    roleNameEn?: string
    roleDesc?: string
    isActive?: boolean
  }): Promise<UserAdminRole> {
    return requestJson(`${ROLES_API_BASE}/${roleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  }
}
