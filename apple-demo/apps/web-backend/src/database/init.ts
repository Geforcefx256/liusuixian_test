import { getDatabase, saveDatabase } from './connection.js'
import { hashPassword } from '../utils/password.js'

export const MML_AGENT_USER_DB = 'MML_AGENT_USER_DB'
export const DEFAULT_LOCAL_ADMIN_PASSWORD = 'Admin@123456'

interface DefaultRoleSeed {
  roleKey: string
  roleNameCn: string
  roleNameEn: string
  roleDesc: string
  isActive: number
}

const DEFAULT_ROLES: DefaultRoleSeed[] = [
  { roleKey: 'super_admin', roleNameCn: '超级管理员', roleNameEn: 'super_admin', roleDesc: '系统全部权限', isActive: 1 },
  { roleKey: 'admin', roleNameCn: '管理员', roleNameEn: 'admin', roleDesc: '用户与会话管理', isActive: 1 },
  { roleKey: 'user', roleNameCn: '普通用户', roleNameEn: 'user', roleDesc: '工作台使用权限', isActive: 1 },
  { roleKey: 'guest', roleNameCn: '访客', roleNameEn: 'guest', roleDesc: '默认低权限角色', isActive: 1 }
]

async function ensureColumn(tableName: string, columnName: string, definition: string): Promise<void> {
  const db = await getDatabase(MML_AGENT_USER_DB)
  const result = db.exec(`PRAGMA table_info(${tableName})`)
  const columns = result.length > 0 ? result[0].values.map((row: unknown[]) => String(row[1])) : []
  if (!columns.includes(columnName)) {
    db.run(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`)
  }
}

export async function initDatabase(): Promise<void> {
  const db = await getDatabase(MML_AGENT_USER_DB)

  db.run(`
    CREATE TABLE IF NOT EXISTS MML_AGENT_ROLE_B (
      ROLE_ID INTEGER PRIMARY KEY AUTOINCREMENT,
      ROLE_KEY TEXT,
      ROLE_NAME_CN TEXT NOT NULL,
      ROLE_NAME_EN TEXT NOT NULL,
      ROLE_DESC TEXT DEFAULT '',
      IS_ACTIVE INTEGER DEFAULT 1,
      CREATED_AT TEXT DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS MML_AGENT_USER_T (
      USER_ID INTEGER PRIMARY KEY AUTOINCREMENT,
      USER_CODE TEXT,
      USER_ACCOUNT TEXT NOT NULL UNIQUE,
      DISPLAY_NAME TEXT,
      USER_NAME TEXT,
      EMAIL TEXT,
      PHONE TEXT,
      AVATAR_URL TEXT,
      AVATAR TEXT,
      STATUS INTEGER DEFAULT 1,
      LAST_LOGIN_AT TEXT,
      PASSWORD_HASH TEXT,
      FORCE_PASSWORD_CHANGE INTEGER DEFAULT 0,
      PASSWORD_UPDATED_AT TEXT,
      CREATED_AT TEXT DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TEXT DEFAULT CURRENT_TIMESTAMP,
      IS_DELETED INTEGER DEFAULT 0
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS MML_AGENT_USER_ROLE_R (
      ID INTEGER PRIMARY KEY AUTOINCREMENT,
      USER_ID INTEGER NOT NULL,
      ROLE_ID INTEGER NOT NULL,
      CREATED_AT TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS MML_AGENT_USER_IDENTITY_T (
      IDENTITY_ID INTEGER PRIMARY KEY AUTOINCREMENT,
      USER_ID INTEGER NOT NULL,
      PROVIDER_CODE TEXT NOT NULL,
      EXTERNAL_USER_UUID TEXT NOT NULL,
      LOGIN_NAME TEXT,
      EMAIL TEXT,
      RAW_USERINFO_JSON TEXT,
      LAST_LOGIN_AT TEXT,
      CREATED_AT TEXT DEFAULT CURRENT_TIMESTAMP,
      UPDATED_AT TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS MML_AGENT_SESSION_T (
      SESSION_ID TEXT PRIMARY KEY,
      USER_ID INTEGER NOT NULL,
      IDENTITY_ID INTEGER,
      ACCESS_TOKEN_HASH TEXT NOT NULL,
      REFRESH_TOKEN_HASH TEXT,
      UPSTREAM_REFRESH_TOKEN_ENC TEXT,
      UPSTREAM_TOKEN_TYPE TEXT,
      UPSTREAM_EXPIRES_AT TEXT,
      UPSTREAM_REFRESH_EXPIRES_AT TEXT,
      LAST_REFRESHED_AT TEXT,
      EXPIRES_AT TEXT NOT NULL,
      REVOKED_AT TEXT,
      LOGIN_IP TEXT,
      USER_AGENT TEXT,
      CREATED_AT TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS MML_AGENT_OAUTH_LOGIN_T (
      STATE TEXT PRIMARY KEY,
      RETURN_TO TEXT,
      EXPIRES_AT TEXT NOT NULL,
      CONSUMED_AT TEXT,
      CREATED_AT TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await ensureColumn('MML_AGENT_ROLE_B', 'ROLE_KEY', 'ROLE_KEY TEXT')
  await ensureColumn('MML_AGENT_USER_T', 'USER_CODE', 'USER_CODE TEXT')
  await ensureColumn('MML_AGENT_USER_T', 'DISPLAY_NAME', 'DISPLAY_NAME TEXT')
  await ensureColumn('MML_AGENT_USER_T', 'USER_NAME', 'USER_NAME TEXT')
  await ensureColumn('MML_AGENT_USER_T', 'AVATAR_URL', 'AVATAR_URL TEXT')
  await ensureColumn('MML_AGENT_USER_T', 'AVATAR', 'AVATAR TEXT')
  await ensureColumn('MML_AGENT_USER_T', 'PASSWORD_HASH', 'PASSWORD_HASH TEXT')
  await ensureColumn('MML_AGENT_USER_T', 'FORCE_PASSWORD_CHANGE', 'FORCE_PASSWORD_CHANGE INTEGER DEFAULT 0')
  await ensureColumn('MML_AGENT_USER_T', 'PASSWORD_UPDATED_AT', 'PASSWORD_UPDATED_AT TEXT')
  await ensureColumn('MML_AGENT_SESSION_T', 'UPSTREAM_REFRESH_TOKEN_ENC', 'UPSTREAM_REFRESH_TOKEN_ENC TEXT')
  await ensureColumn('MML_AGENT_SESSION_T', 'UPSTREAM_TOKEN_TYPE', 'UPSTREAM_TOKEN_TYPE TEXT')
  await ensureColumn('MML_AGENT_SESSION_T', 'UPSTREAM_EXPIRES_AT', 'UPSTREAM_EXPIRES_AT TEXT')
  await ensureColumn('MML_AGENT_SESSION_T', 'UPSTREAM_REFRESH_EXPIRES_AT', 'UPSTREAM_REFRESH_EXPIRES_AT TEXT')
  await ensureColumn('MML_AGENT_SESSION_T', 'LAST_REFRESHED_AT', 'LAST_REFRESHED_AT TEXT')

  db.run(`UPDATE MML_AGENT_ROLE_B SET ROLE_KEY = LOWER(COALESCE(ROLE_NAME_EN, ROLE_NAME_CN)) WHERE ROLE_KEY IS NULL OR ROLE_KEY = ''`)
  db.run(`UPDATE MML_AGENT_USER_T SET USER_CODE = COALESCE(NULLIF(USER_CODE, ''), USER_ACCOUNT)`)
  db.run(`UPDATE MML_AGENT_USER_T SET DISPLAY_NAME = COALESCE(NULLIF(DISPLAY_NAME, ''), USER_NAME, USER_ACCOUNT)`)
  db.run(`UPDATE MML_AGENT_USER_T SET AVATAR_URL = COALESCE(NULLIF(AVATAR_URL, ''), AVATAR)`)
  db.run(`UPDATE MML_AGENT_USER_T SET FORCE_PASSWORD_CHANGE = COALESCE(FORCE_PASSWORD_CHANGE, 0)`)

  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_role_key ON MML_AGENT_ROLE_B(ROLE_KEY)`)
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_account ON MML_AGENT_USER_T(USER_ACCOUNT)`)
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_code ON MML_AGENT_USER_T(USER_CODE)`)
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_role_unique ON MML_AGENT_USER_ROLE_R(USER_ID, ROLE_ID)`)
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_provider_uuid ON MML_AGENT_USER_IDENTITY_T(PROVIDER_CODE, EXTERNAL_USER_UUID)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_session_token_hash ON MML_AGENT_SESSION_T(ACCESS_TOKEN_HASH)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_session_user_expires ON MML_AGENT_SESSION_T(USER_ID, EXPIRES_AT)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_oauth_login_expires_at ON MML_AGENT_OAUTH_LOGIN_T(EXPIRES_AT)`)

  saveDatabase(MML_AGENT_USER_DB)
}

export async function initDefaultRoles(): Promise<void> {
  const db = await getDatabase(MML_AGENT_USER_DB)

  for (const role of DEFAULT_ROLES) {
    const existing = db.exec(`SELECT ROLE_ID FROM MML_AGENT_ROLE_B WHERE ROLE_KEY = ?`, [role.roleKey])
    if (existing.length === 0 || existing[0].values.length === 0) {
      db.run(
        `
          INSERT INTO MML_AGENT_ROLE_B (
            ROLE_KEY, ROLE_NAME_CN, ROLE_NAME_EN, ROLE_DESC, IS_ACTIVE
          ) VALUES (?, ?, ?, ?, ?)
        `,
        [role.roleKey, role.roleNameCn, role.roleNameEn, role.roleDesc, role.isActive]
      )
    }
  }

  saveDatabase(MML_AGENT_USER_DB)
}

export async function initDefaultAdminUser(): Promise<void> {
  const db = await getDatabase(MML_AGENT_USER_DB)
  const now = new Date().toISOString()
  const existing = db.exec(`SELECT USER_ID FROM MML_AGENT_USER_T WHERE USER_ACCOUNT = ? AND IS_DELETED = 0`, ['admin'])
  let userId = Number(existing[0]?.values?.[0]?.[0] ?? 0)

  if (userId <= 0) {
    db.run(
      `
        INSERT INTO MML_AGENT_USER_T (
          USER_CODE, USER_ACCOUNT, DISPLAY_NAME, USER_NAME, EMAIL, STATUS,
          PASSWORD_HASH, FORCE_PASSWORD_CHANGE, PASSWORD_UPDATED_AT,
          CREATED_AT, UPDATED_AT, IS_DELETED
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        'admin',
        'admin',
        '系统管理员',
        '系统管理员',
        null,
        1,
        hashPassword(DEFAULT_LOCAL_ADMIN_PASSWORD),
        0,
        now,
        now,
        now,
        0
      ]
    )
    userId = Number(db.exec('SELECT last_insert_rowid() AS id')[0]?.values?.[0]?.[0] ?? 0)
  }

  if (userId > 0) {
    db.run(
      `
        UPDATE MML_AGENT_USER_T
        SET FORCE_PASSWORD_CHANGE = 0,
            UPDATED_AT = ?
        WHERE USER_ID = ?
      `,
      [now, userId]
    )
  }

  const requiredRoleKeys = ['super_admin', 'admin']
  for (const roleKey of requiredRoleKeys) {
    const roleId = Number(db.exec(`SELECT ROLE_ID FROM MML_AGENT_ROLE_B WHERE ROLE_KEY = ? LIMIT 1`, [roleKey])[0]?.values?.[0]?.[0] ?? 0)
    if (userId > 0 && roleId > 0) {
      db.run(
        `INSERT OR IGNORE INTO MML_AGENT_USER_ROLE_R (USER_ID, ROLE_ID, CREATED_AT) VALUES (?, ?, ?)`,
        [userId, roleId, now]
      )
    }
  }

  saveDatabase(MML_AGENT_USER_DB)
}
