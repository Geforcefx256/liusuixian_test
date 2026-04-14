import { z } from 'zod'
import type {
  AuthMode as SharedAuthMode,
  AuthRole as SharedAuthRole,
  AuthSession as SharedAuthSession,
  AuthUser as SharedAuthUser,
  AuthenticatedPayload as SharedAuthenticatedPayload,
  LogoutPayload
} from '@apple-demo/shared'

export interface Role extends SharedAuthRole {
  roleNameEn: string
  roleDesc: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface UserIdentity {
  identityId: number
  userId: number
  providerCode: string
  externalUserUuid: string
  loginName: string | null
  email: string | null
  rawUserinfoJson: string | null
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export interface User extends Omit<SharedAuthUser, 'roles'> {
  phone: string | null
  status: 'active' | 'disabled'
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
  isDeleted: boolean
}

export interface UserDetail extends User {
  roles: Role[]
  identities: UserIdentity[]
}

export interface LocalAuthRecord {
  userId: number
  passwordHash: string
  forcePasswordChange: boolean
}

export interface Session extends SharedAuthSession {
  userId: number
  identityId: number | null
  revokedAt: string | null
  loginIp: string | null
  userAgent: string | null
}

export interface AuthenticatedUser extends Omit<SharedAuthenticatedPayload, 'user' | 'session'> {
  user: UserDetail
  session: Session
}

export type AuthModeSetting = SharedAuthMode['mode']

export interface AuthMode extends SharedAuthMode {}

export interface OAuthLoginTransaction {
  state: string
  returnTo: string | null
  expiresAt: string
  consumedAt: string | null
  createdAt: string
}

export interface OAuthUserinfo {
  uuid: string
  uid?: string | null
  loginName?: string | null
  email?: string | null
  displayName?: string | null
  phone?: string | null
  avatarUrl?: string | null
  raw: Record<string, unknown>
}

export interface OAuthTokens {
  accessToken: string
  refreshToken: string | null
  expiresIn: number | null
  accessTokenExpiresAt: number | null
  refreshTokenExpiresAt: number | null
  tokenType: string | null
}

export type LogoutResult = LogoutPayload

export const UserStatusSchema = z.enum(['active', 'disabled'])

export const ListUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: UserStatusSchema.optional(),
  roleKey: z.string().trim().min(1).optional(),
  keyword: z.string().trim().min(1).optional()
})

export type ListUsersQuery = z.infer<typeof ListUsersQuerySchema>

export const UpdateUserSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().trim().max(32).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable()
})

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>

export const UpdateUserStatusSchema = z.object({
  status: UserStatusSchema
})

export type UpdateUserStatusInput = z.infer<typeof UpdateUserStatusSchema>

export const ReplaceUserRolesSchema = z.object({
  roleIds: z.array(z.number().int().positive())
})

export type ReplaceUserRolesInput = z.infer<typeof ReplaceUserRolesSchema>

export const ListRolesQuerySchema = z.object({
  includeInactive: z.coerce.boolean().default(false)
})

export type ListRolesQuery = z.infer<typeof ListRolesQuerySchema>

export const UpdateRoleSchema = z.object({
  roleNameCn: z.string().trim().min(1).max(100).optional(),
  roleNameEn: z.string().trim().min(1).max(100).optional(),
  roleDesc: z.string().trim().max(4000).optional(),
  isActive: z.coerce.boolean().optional()
})

export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>

export const OAuthCallbackQuerySchema = z.object({
  code: z.string().trim().min(1),
  state: z.string().trim().min(1)
})

export const LocalLoginSchema = z.object({
  account: z.string().trim().min(1).max(128),
  password: z.string().min(1).max(256)
})

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  nextPassword: z.string().min(8).max(256)
})
