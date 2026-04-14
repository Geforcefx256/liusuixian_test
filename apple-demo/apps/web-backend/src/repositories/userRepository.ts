import { randomUUID } from 'node:crypto'

import type { Database } from 'sql.js'

import { getDatabase, saveDatabase } from '../database/connection.js'
import { MML_AGENT_USER_DB } from '../database/init.js'
import type {
  AuthenticatedUser,
  ListRolesQuery,
  ListUsersQuery,
  LocalAuthRecord,
  OAuthLoginTransaction,
  Role,
  Session,
  UpdateRoleInput,
  UpdateUserInput,
  User,
  UserDetail,
  UserIdentity
} from '../types/user.js'
import { ConflictError, DatabaseError, NotFoundError } from '../utils/errors.js'

export interface SessionAuthRecord {
  session: Session
  user: UserDetail
  upstreamRefreshTokenEncrypted: string | null
  upstreamTokenType: string | null
  upstreamExpiresAt: string | null
  upstreamRefreshExpiresAt: string | null
  lastRefreshedAt: string | null
}

function toObjects(result: { columns: string[]; values: unknown[][] } | undefined): Record<string, unknown>[] {
  if (!result) {
    return []
  }
  return result.values.map(row => {
    const item: Record<string, unknown> = {}
    result.columns.forEach((column, index) => {
      item[column] = row[index]
    })
    return item
  })
}

function mapRole(row: Record<string, unknown>): Role {
  return {
    roleId: Number(row.ROLE_ID ?? 0),
    roleKey: String(row.ROLE_KEY ?? ''),
    roleNameCn: String(row.ROLE_NAME_CN ?? ''),
    roleNameEn: String(row.ROLE_NAME_EN ?? ''),
    roleDesc: String(row.ROLE_DESC ?? ''),
    isActive: Number(row.IS_ACTIVE ?? 0) === 1,
    createdAt: String(row.CREATED_AT ?? ''),
    updatedAt: String(row.UPDATED_AT ?? '')
  }
}

function mapUser(row: Record<string, unknown>): User {
  return {
    userId: Number(row.USER_ID ?? 0),
    userCode: String(row.USER_CODE ?? row.USER_ACCOUNT ?? ''),
    userAccount: String(row.USER_ACCOUNT ?? row.USER_CODE ?? ''),
    displayName: String(row.DISPLAY_NAME ?? row.USER_NAME ?? row.USER_ACCOUNT ?? ''),
    email: (row.EMAIL as string | null) ?? null,
    phone: (row.PHONE as string | null) ?? null,
    avatarUrl: ((row.AVATAR_URL as string | null) ?? (row.AVATAR as string | null) ?? null),
    status: Number(row.STATUS ?? 0) === 1 ? 'active' : 'disabled',
    lastLoginAt: (row.LAST_LOGIN_AT as string | null) ?? null,
    createdAt: String(row.CREATED_AT ?? ''),
    updatedAt: String(row.UPDATED_AT ?? ''),
    isDeleted: Number(row.IS_DELETED ?? 0) === 1
  }
}

function mapIdentity(row: Record<string, unknown>): UserIdentity {
  return {
    identityId: Number(row.IDENTITY_ID ?? 0),
    userId: Number(row.USER_ID ?? 0),
    providerCode: String(row.PROVIDER_CODE ?? ''),
    externalUserUuid: String(row.EXTERNAL_USER_UUID ?? ''),
    loginName: (row.LOGIN_NAME as string | null) ?? null,
    email: (row.EMAIL as string | null) ?? null,
    rawUserinfoJson: (row.RAW_USERINFO_JSON as string | null) ?? null,
    lastLoginAt: (row.LAST_LOGIN_AT as string | null) ?? null,
    createdAt: String(row.CREATED_AT ?? ''),
    updatedAt: String(row.UPDATED_AT ?? '')
  }
}

function mapSession(row: Record<string, unknown>): Session {
  return {
    sessionId: String(row.SESSION_ID ?? ''),
    userId: Number(row.USER_ID ?? 0),
    identityId: (row.IDENTITY_ID as number | null) ?? null,
    expiresAt: String(row.EXPIRES_AT ?? ''),
    revokedAt: (row.REVOKED_AT as string | null) ?? null,
    loginIp: (row.LOGIN_IP as string | null) ?? null,
    userAgent: (row.USER_AGENT as string | null) ?? null,
    createdAt: String(row.CREATED_AT ?? '')
  }
}

function mapOAuthLoginTransaction(row: Record<string, unknown>): OAuthLoginTransaction {
  return {
    state: String(row.STATE ?? ''),
    returnTo: (row.RETURN_TO as string | null) ?? null,
    expiresAt: String(row.EXPIRES_AT ?? ''),
    consumedAt: (row.CONSUMED_AT as string | null) ?? null,
    createdAt: String(row.CREATED_AT ?? '')
  }
}

async function getUserDb(): Promise<Database> {
  return getDatabase(MML_AGENT_USER_DB)
}

async function loadRolesForUser(db: Database, userId: number): Promise<Role[]> {
  const result = db.exec(
    `
      SELECT r.*
      FROM MML_AGENT_USER_ROLE_R ur
      JOIN MML_AGENT_ROLE_B r ON r.ROLE_ID = ur.ROLE_ID
      WHERE ur.USER_ID = ?
      ORDER BY r.ROLE_ID ASC
    `,
    [userId]
  )
  return toObjects(result[0]).map(mapRole)
}

async function loadIdentitiesForUser(db: Database, userId: number): Promise<UserIdentity[]> {
  const result = db.exec(
    `SELECT * FROM MML_AGENT_USER_IDENTITY_T WHERE USER_ID = ? ORDER BY IDENTITY_ID ASC`,
    [userId]
  )
  return toObjects(result[0]).map(mapIdentity)
}

export async function getUserById(userId: number): Promise<User | null> {
  const db = await getUserDb()
  const result = db.exec(
    `SELECT * FROM MML_AGENT_USER_T WHERE USER_ID = ? AND IS_DELETED = 0 LIMIT 1`,
    [userId]
  )
  const rows = toObjects(result[0])
  return rows.length > 0 ? mapUser(rows[0]) : null
}

export async function getUserDetailById(userId: number): Promise<UserDetail | null> {
  const db = await getUserDb()
  const user = await getUserById(userId)
  if (!user) {
    return null
  }
  return {
    ...user,
    roles: await loadRolesForUser(db, userId),
    identities: await loadIdentitiesForUser(db, userId)
  }
}

export async function listUsers(query: ListUsersQuery): Promise<{ items: UserDetail[]; total: number }> {
  const db = await getUserDb()
  const clauses = ['u.IS_DELETED = 0']
  const params: unknown[] = []

  if (query.status) {
    clauses.push('u.STATUS = ?')
    params.push(query.status === 'active' ? 1 : 0)
  }

  if (query.keyword) {
    clauses.push('(u.USER_CODE LIKE ? OR u.USER_ACCOUNT LIKE ? OR u.DISPLAY_NAME LIKE ? OR u.USER_NAME LIKE ? OR u.EMAIL LIKE ?)')
    const keyword = `%${query.keyword}%`
    params.push(keyword, keyword, keyword, keyword, keyword)
  }

  if (query.roleKey) {
    clauses.push(`
      EXISTS (
        SELECT 1 FROM MML_AGENT_USER_ROLE_R ur
        JOIN MML_AGENT_ROLE_B r ON r.ROLE_ID = ur.ROLE_ID
        WHERE ur.USER_ID = u.USER_ID AND r.ROLE_KEY = ?
      )
    `)
    params.push(query.roleKey)
  }

  const whereSql = `WHERE ${clauses.join(' AND ')}`
  const countResult = db.exec(`SELECT COUNT(*) AS total FROM MML_AGENT_USER_T u ${whereSql}`, params)
  const total = Number(countResult[0]?.values?.[0]?.[0] ?? 0)
  const offset = (query.page - 1) * query.pageSize
  const rows = db.exec(
    `
      SELECT * FROM MML_AGENT_USER_T u
      ${whereSql}
      ORDER BY u.UPDATED_AT DESC, u.USER_ID DESC
      LIMIT ? OFFSET ?
    `,
    [...params, query.pageSize, offset]
  )

  const users = toObjects(rows[0]).map(mapUser)
  const items = await Promise.all(users.map(user => getUserDetailById(user.userId)))
  return {
    items: items.filter((item): item is UserDetail => item !== null),
    total
  }
}

export async function findLocalAuthByAccount(account: string): Promise<LocalAuthRecord | null> {
  const db = await getUserDb()
  const result = db.exec(
    `
      SELECT USER_ID, PASSWORD_HASH, FORCE_PASSWORD_CHANGE
      FROM MML_AGENT_USER_T
      WHERE USER_ACCOUNT = ? AND IS_DELETED = 0
      LIMIT 1
    `,
    [account]
  )
  const rows = toObjects(result[0])
  if (rows.length === 0 || !rows[0].PASSWORD_HASH) {
    return null
  }

  return {
    userId: Number(rows[0].USER_ID ?? 0),
    passwordHash: String(rows[0].PASSWORD_HASH ?? ''),
    forcePasswordChange: Number(rows[0].FORCE_PASSWORD_CHANGE ?? 0) === 1
  }
}

export async function findLocalAuthByUserId(userId: number): Promise<LocalAuthRecord | null> {
  const db = await getUserDb()
  const result = db.exec(
    `
      SELECT USER_ID, PASSWORD_HASH, FORCE_PASSWORD_CHANGE
      FROM MML_AGENT_USER_T
      WHERE USER_ID = ? AND IS_DELETED = 0
      LIMIT 1
    `,
    [userId]
  )
  const rows = toObjects(result[0])
  if (rows.length === 0 || !rows[0].PASSWORD_HASH) {
    return null
  }

  return {
    userId: Number(rows[0].USER_ID ?? 0),
    passwordHash: String(rows[0].PASSWORD_HASH ?? ''),
    forcePasswordChange: Number(rows[0].FORCE_PASSWORD_CHANGE ?? 0) === 1
  }
}

export async function findUserByAccount(account: string): Promise<User | null> {
  const db = await getUserDb()
  const result = db.exec(
    `SELECT * FROM MML_AGENT_USER_T WHERE USER_ACCOUNT = ? AND IS_DELETED = 0 LIMIT 1`,
    [account]
  )
  const rows = toObjects(result[0])
  return rows.length > 0 ? mapUser(rows[0]) : null
}

export async function updateUserLogin(userId: number): Promise<void> {
  const db = await getUserDb()
  const now = new Date().toISOString()
  db.run(
    `UPDATE MML_AGENT_USER_T SET LAST_LOGIN_AT = ?, UPDATED_AT = ? WHERE USER_ID = ?`,
    [now, now, userId]
  )
  db.run(
    `UPDATE MML_AGENT_USER_IDENTITY_T SET LAST_LOGIN_AT = ?, UPDATED_AT = ? WHERE USER_ID = ?`,
    [now, now, userId]
  )
  saveDatabase(MML_AGENT_USER_DB)
}

export async function createSession(input: {
  userId: number
  identityId: number | null
  accessTokenHash: string
  refreshTokenHash?: string | null
  upstreamRefreshTokenEncrypted?: string | null
  upstreamTokenType?: string | null
  upstreamExpiresAt?: string | null
  upstreamRefreshExpiresAt?: string | null
  lastRefreshedAt?: string | null
  expiresAt: string
  loginIp?: string
  userAgent?: string
}): Promise<Session> {
  const db = await getUserDb()
  const sessionId = randomUUID()
  db.run(
    `
      INSERT INTO MML_AGENT_SESSION_T (
        SESSION_ID, USER_ID, IDENTITY_ID, ACCESS_TOKEN_HASH, REFRESH_TOKEN_HASH,
        UPSTREAM_REFRESH_TOKEN_ENC, UPSTREAM_TOKEN_TYPE, UPSTREAM_EXPIRES_AT, UPSTREAM_REFRESH_EXPIRES_AT, LAST_REFRESHED_AT,
        EXPIRES_AT, REVOKED_AT, LOGIN_IP, USER_AGENT, CREATED_AT
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      sessionId,
      input.userId,
      input.identityId,
      input.accessTokenHash,
      input.refreshTokenHash ?? null,
      input.upstreamRefreshTokenEncrypted ?? null,
      input.upstreamTokenType ?? null,
      input.upstreamExpiresAt ?? null,
      input.upstreamRefreshExpiresAt ?? null,
      input.lastRefreshedAt ?? null,
      input.expiresAt,
      null,
      input.loginIp ?? null,
      input.userAgent ?? null,
      new Date().toISOString()
    ]
  )
  saveDatabase(MML_AGENT_USER_DB)

  const result = db.exec(`SELECT * FROM MML_AGENT_SESSION_T WHERE SESSION_ID = ? LIMIT 1`, [sessionId])
  return mapSession(toObjects(result[0])[0] ?? {})
}

export async function getAuthenticatedSessionByTokenHash(
  tokenHash: string
): Promise<{ user: UserDetail; session: Session } | null> {
  const db = await getUserDb()
  const sessionResult = db.exec(
    `SELECT * FROM MML_AGENT_SESSION_T WHERE ACCESS_TOKEN_HASH = ? LIMIT 1`,
    [tokenHash]
  )
  const sessionRows = toObjects(sessionResult[0])
  if (sessionRows.length === 0) {
    return null
  }

  const session = mapSession(sessionRows[0])
  const user = await getUserDetailById(session.userId)
  if (!user) {
    return null
  }

  return { user, session }
}

export async function getSessionAuthRecordByTokenHash(tokenHash: string): Promise<SessionAuthRecord | null> {
  const db = await getUserDb()
  const result = db.exec(
    `SELECT * FROM MML_AGENT_SESSION_T WHERE ACCESS_TOKEN_HASH = ? LIMIT 1`,
    [tokenHash]
  )
  const rows = toObjects(result[0])
  if (rows.length === 0) {
    return null
  }

  const session = mapSession(rows[0])
  const user = await getUserDetailById(session.userId)
  if (!user) {
    return null
  }

  return {
    session,
    user,
    upstreamRefreshTokenEncrypted: (rows[0].UPSTREAM_REFRESH_TOKEN_ENC as string | null) ?? null,
    upstreamTokenType: (rows[0].UPSTREAM_TOKEN_TYPE as string | null) ?? null,
    upstreamExpiresAt: (rows[0].UPSTREAM_EXPIRES_AT as string | null) ?? null,
    upstreamRefreshExpiresAt: (rows[0].UPSTREAM_REFRESH_EXPIRES_AT as string | null) ?? null,
    lastRefreshedAt: (rows[0].LAST_REFRESHED_AT as string | null) ?? null
  }
}

export async function updateSessionOAuthTokens(input: {
  sessionId: string
  refreshTokenHash?: string | null
  upstreamRefreshTokenEncrypted?: string | null
  upstreamTokenType?: string | null
  upstreamExpiresAt?: string | null
  upstreamRefreshExpiresAt?: string | null
  lastRefreshedAt?: string | null
  expiresAt: string
}): Promise<void> {
  const db = await getUserDb()
  db.run(
    `
      UPDATE MML_AGENT_SESSION_T
      SET REFRESH_TOKEN_HASH = ?,
          UPSTREAM_REFRESH_TOKEN_ENC = ?,
          UPSTREAM_TOKEN_TYPE = ?,
          UPSTREAM_EXPIRES_AT = ?,
          UPSTREAM_REFRESH_EXPIRES_AT = ?,
          LAST_REFRESHED_AT = ?,
          EXPIRES_AT = ?
      WHERE SESSION_ID = ?
    `,
    [
      input.refreshTokenHash ?? null,
      input.upstreamRefreshTokenEncrypted ?? null,
      input.upstreamTokenType ?? null,
      input.upstreamExpiresAt ?? null,
      input.upstreamRefreshExpiresAt ?? null,
      input.lastRefreshedAt ?? null,
      input.expiresAt,
      input.sessionId
    ]
  )
  saveDatabase(MML_AGENT_USER_DB)
}

export async function revokeSession(sessionId: string): Promise<void> {
  const db = await getUserDb()
  db.run(
    `UPDATE MML_AGENT_SESSION_T SET REVOKED_AT = ? WHERE SESSION_ID = ? AND REVOKED_AT IS NULL`,
    [new Date().toISOString(), sessionId]
  )
  saveDatabase(MML_AGENT_USER_DB)
}

export async function revokeSessionsForUser(userId: number): Promise<void> {
  const db = await getUserDb()
  db.run(
    `UPDATE MML_AGENT_SESSION_T SET REVOKED_AT = ? WHERE USER_ID = ? AND REVOKED_AT IS NULL`,
    [new Date().toISOString(), userId]
  )
  saveDatabase(MML_AGENT_USER_DB)
}

export async function updateUserPassword(userId: number, passwordHash: string, forcePasswordChange: boolean): Promise<void> {
  const db = await getUserDb()
  const now = new Date().toISOString()
  db.run(
    `
      UPDATE MML_AGENT_USER_T
      SET PASSWORD_HASH = ?, FORCE_PASSWORD_CHANGE = ?, PASSWORD_UPDATED_AT = ?, UPDATED_AT = ?
      WHERE USER_ID = ?
    `,
    [passwordHash, forcePasswordChange ? 1 : 0, now, now, userId]
  )
  saveDatabase(MML_AGENT_USER_DB)
}

export async function updateUserStatus(userId: number, status: 'active' | 'disabled'): Promise<void> {
  const db = await getUserDb()
  const now = new Date().toISOString()
  db.run(
    `
      UPDATE MML_AGENT_USER_T
      SET STATUS = ?, UPDATED_AT = ?
      WHERE USER_ID = ?
    `,
    [status === 'active' ? 1 : 0, now, userId]
  )
  saveDatabase(MML_AGENT_USER_DB)
}

export async function updateUser(userId: number, updates: UpdateUserInput): Promise<User> {
  const db = await getUserDb()
  const existing = await getUserById(userId)
  if (!existing) {
    throw new NotFoundError(`User ${userId} not found`)
  }

  const fields: string[] = ['UPDATED_AT = ?']
  const params: unknown[] = [new Date().toISOString()]

  if (updates.displayName !== undefined) {
    fields.push('DISPLAY_NAME = ?', 'USER_NAME = ?')
    params.push(updates.displayName, updates.displayName)
  }
  if (updates.email !== undefined) {
    fields.push('EMAIL = ?')
    params.push(updates.email)
  }
  if (updates.phone !== undefined) {
    fields.push('PHONE = ?')
    params.push(updates.phone)
  }
  if (updates.avatarUrl !== undefined) {
    fields.push('AVATAR_URL = ?', 'AVATAR = ?')
    params.push(updates.avatarUrl, updates.avatarUrl)
  }

  params.push(userId)
  db.run(`UPDATE MML_AGENT_USER_T SET ${fields.join(', ')} WHERE USER_ID = ?`, params)
  saveDatabase(MML_AGENT_USER_DB)

  const user = await getUserById(userId)
  if (!user) {
    throw new DatabaseError('Failed to load updated user')
  }
  return user
}

export async function findIdentityByExternalUuid(
  providerCode: string,
  externalUserUuid: string
): Promise<UserIdentity | null> {
  const db = await getUserDb()
  const result = db.exec(
    `
      SELECT *
      FROM MML_AGENT_USER_IDENTITY_T
      WHERE PROVIDER_CODE = ? AND EXTERNAL_USER_UUID = ?
      LIMIT 1
    `,
    [providerCode, externalUserUuid]
  )
  const rows = toObjects(result[0])
  return rows.length > 0 ? mapIdentity(rows[0]) : null
}

export async function createUser(input: {
  userCode: string
  userAccount?: string
  displayName: string
  email?: string
  phone?: string
  avatarUrl?: string
}): Promise<User> {
  const db = await getUserDb()
  const now = new Date().toISOString()
  const account = input.userAccount || input.userCode

  try {
    db.run(
      `
        INSERT INTO MML_AGENT_USER_T (
          USER_CODE, USER_ACCOUNT, DISPLAY_NAME, USER_NAME, EMAIL, PHONE, AVATAR_URL, AVATAR,
          STATUS, LAST_LOGIN_AT, CREATED_AT, UPDATED_AT, IS_DELETED
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.userCode,
        account,
        input.displayName,
        input.displayName,
        input.email ?? null,
        input.phone ?? null,
        input.avatarUrl ?? null,
        input.avatarUrl ?? null,
        1,
        null,
        now,
        now,
        0
      ]
    )
    saveDatabase(MML_AGENT_USER_DB)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/unique/i.test(message)) {
      throw new ConflictError(`User '${account}' already exists`)
    }
    throw new DatabaseError(`Failed to create user: ${message}`)
  }

  const userId = Number(db.exec('SELECT last_insert_rowid() AS id')[0]?.values?.[0]?.[0] ?? 0)
  const user = (userId > 0 ? await getUserById(userId) : null) ?? await findUserByAccount(account)
  if (!user) {
    throw new DatabaseError('Failed to load created user')
  }
  return user
}

export async function getRoleIdByKey(roleKey: string): Promise<number | null> {
  const db = await getUserDb()
  const result = db.exec(`SELECT ROLE_ID FROM MML_AGENT_ROLE_B WHERE ROLE_KEY = ? AND IS_ACTIVE = 1 LIMIT 1`, [roleKey])
  const roleId = result[0]?.values?.[0]?.[0]
  return typeof roleId === 'number' ? roleId : roleId != null ? Number(roleId) : null
}

export async function listRoles(query: ListRolesQuery = { includeInactive: false }): Promise<Role[]> {
  const db = await getUserDb()
  const whereSql = query.includeInactive ? '' : 'WHERE IS_ACTIVE = 1'
  const result = db.exec(`SELECT * FROM MML_AGENT_ROLE_B ${whereSql} ORDER BY ROLE_ID ASC`)
  return toObjects(result[0]).map(mapRole)
}

export async function getRoleById(roleId: number): Promise<Role | null> {
  const db = await getUserDb()
  const result = db.exec(`SELECT * FROM MML_AGENT_ROLE_B WHERE ROLE_ID = ? LIMIT 1`, [roleId])
  const rows = toObjects(result[0])
  return rows.length > 0 ? mapRole(rows[0]) : null
}

export async function updateRole(roleId: number, updates: UpdateRoleInput): Promise<Role> {
  const db = await getUserDb()
  const fields: string[] = ['UPDATED_AT = ?']
  const params: unknown[] = [new Date().toISOString()]

  if (updates.roleNameCn !== undefined) {
    fields.push('ROLE_NAME_CN = ?')
    params.push(updates.roleNameCn)
  }
  if (updates.roleNameEn !== undefined) {
    fields.push('ROLE_NAME_EN = ?')
    params.push(updates.roleNameEn)
  }
  if (updates.roleDesc !== undefined) {
    fields.push('ROLE_DESC = ?')
    params.push(updates.roleDesc)
  }
  if (updates.isActive !== undefined) {
    fields.push('IS_ACTIVE = ?')
    params.push(updates.isActive ? 1 : 0)
  }

  params.push(roleId)
  db.run(`UPDATE MML_AGENT_ROLE_B SET ${fields.join(', ')} WHERE ROLE_ID = ?`, params)
  saveDatabase(MML_AGENT_USER_DB)

  const role = await getRoleById(roleId)
  if (!role) {
    throw new NotFoundError(`Role ${roleId} not found`)
  }
  return role
}

export async function replaceUserRoles(userId: number, roleIds: number[]): Promise<void> {
  const db = await getUserDb()
  db.run(`DELETE FROM MML_AGENT_USER_ROLE_R WHERE USER_ID = ?`, [userId])
  const now = new Date().toISOString()
  for (const roleId of roleIds) {
    db.run(
      `INSERT OR IGNORE INTO MML_AGENT_USER_ROLE_R (USER_ID, ROLE_ID, CREATED_AT) VALUES (?, ?, ?)`,
      [userId, roleId, now]
    )
  }
  saveDatabase(MML_AGENT_USER_DB)
}

export async function createIdentity(input: {
  userId: number
  providerCode: string
  externalUserUuid: string
  loginName?: string | null
  email?: string | null
  rawUserinfoJson?: string | null
}): Promise<UserIdentity> {
  const db = await getUserDb()
  const now = new Date().toISOString()
    db.run(
      `
        INSERT INTO MML_AGENT_USER_IDENTITY_T (
        USER_ID, PROVIDER_CODE, EXTERNAL_USER_UUID, LOGIN_NAME, EMAIL,
        RAW_USERINFO_JSON, LAST_LOGIN_AT, CREATED_AT, UPDATED_AT
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.userId,
      input.providerCode,
      input.externalUserUuid,
      input.loginName ?? null,
      input.email ?? null,
      input.rawUserinfoJson ?? null,
      now,
      now,
      now
    ]
  )
  saveDatabase(MML_AGENT_USER_DB)

  const identityId = Number(db.exec('SELECT last_insert_rowid() AS id')[0]?.values?.[0]?.[0] ?? 0)
  const result = db.exec(`SELECT * FROM MML_AGENT_USER_IDENTITY_T WHERE IDENTITY_ID = ? LIMIT 1`, [identityId])
  return mapIdentity(toObjects(result[0])[0] ?? {})
}

export async function updateIdentityLogin(
  identityId: number,
  email: string | null | undefined,
  rawUserinfoJson: string
): Promise<void> {
  const db = await getUserDb()
  const now = new Date().toISOString()
  db.run(
    `
      UPDATE MML_AGENT_USER_IDENTITY_T
      SET EMAIL = ?, RAW_USERINFO_JSON = ?, LAST_LOGIN_AT = ?, UPDATED_AT = ?
      WHERE IDENTITY_ID = ?
    `,
    [email ?? null, rawUserinfoJson, now, now, identityId]
  )
  saveDatabase(MML_AGENT_USER_DB)
}

export async function syncOAuthUserAccount(
  userId: number,
  account: string | null,
  uuid: string
): Promise<void> {
  const normalizedAccount = account?.trim() || null
  const db = await getUserDb()
  const now = new Date().toISOString()
  db.run(
    `
      UPDATE MML_AGENT_USER_T
      SET USER_ACCOUNT = COALESCE(?, USER_ACCOUNT), USER_CODE = ?, UPDATED_AT = ?
      WHERE USER_ID = ?
    `,
    [normalizedAccount, uuid, now, userId]
  )
  saveDatabase(MML_AGENT_USER_DB)
}

export async function createOAuthLoginTransaction(input: {
  state: string
  expiresAt: string
  returnTo?: string | null
}): Promise<OAuthLoginTransaction> {
  const db = await getUserDb()
  db.run(
    `
      INSERT INTO MML_AGENT_OAUTH_LOGIN_T (
        STATE, RETURN_TO, EXPIRES_AT, CONSUMED_AT, CREATED_AT
      ) VALUES (?, ?, ?, ?, ?)
    `,
    [
      input.state,
      input.returnTo ?? null,
      input.expiresAt,
      null,
      new Date().toISOString()
    ]
  )
  saveDatabase(MML_AGENT_USER_DB)

  const result = db.exec(`SELECT * FROM MML_AGENT_OAUTH_LOGIN_T WHERE STATE = ? LIMIT 1`, [input.state])
  return mapOAuthLoginTransaction(toObjects(result[0])[0] ?? {})
}

export async function getOAuthLoginTransactionByState(state: string): Promise<OAuthLoginTransaction | null> {
  const db = await getUserDb()
  const result = db.exec(`SELECT * FROM MML_AGENT_OAUTH_LOGIN_T WHERE STATE = ? LIMIT 1`, [state])
  const rows = toObjects(result[0])
  return rows.length > 0 ? mapOAuthLoginTransaction(rows[0]) : null
}

export async function consumeOAuthLoginTransaction(state: string): Promise<boolean> {
  const db = await getUserDb()
  const now = new Date().toISOString()
  db.run(
    `
      UPDATE MML_AGENT_OAUTH_LOGIN_T
      SET CONSUMED_AT = ?
      WHERE STATE = ? AND CONSUMED_AT IS NULL
    `,
    [now, state]
  )
  saveDatabase(MML_AGENT_USER_DB)

  const result = db.exec(`SELECT CONSUMED_AT FROM MML_AGENT_OAUTH_LOGIN_T WHERE STATE = ? LIMIT 1`, [state])
  const consumedAt = result[0]?.values?.[0]?.[0]
  return typeof consumedAt === 'string' && consumedAt.length > 0
}
