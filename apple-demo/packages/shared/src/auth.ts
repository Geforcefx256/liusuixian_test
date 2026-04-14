export interface AuthRole {
  roleId: number
  roleKey: string
  roleNameCn: string
  roleNameEn?: string
}

export interface AuthUser {
  userId: number
  userCode: string
  userAccount: string
  displayName: string
  email: string | null
  avatarUrl: string | null
  roles: AuthRole[]
}

export interface AuthSession {
  sessionId: string
  expiresAt: string
  createdAt: string
}

export interface AuthenticatedPayload {
  user: AuthUser
  session: AuthSession
  mustChangePassword: boolean
}

export interface AuthMode {
  mode: 'local' | 'oauth'
  preferred: 'oauth' | 'local'
  oauth: {
    enabled: boolean
  }
  local: {
    enabled: boolean
  }
}

export interface OAuthLoginStartPayload {
  url: string
  state: string
}

export interface LogoutPayload {
  redirectUrl: string | null
}

export interface PaginatedPayload<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
