import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createApp, initializeAppData } from '../src/app.js'
import { closeAllConnections } from '../src/database/connection.js'
import { DEFAULT_LOCAL_ADMIN_PASSWORD } from '../src/database/init.js'
import { getServiceRoot } from '../src/config/runtimePaths.js'
import { hashPassword } from '../src/utils/password.js'
import * as userRepository from '../src/repositories/userRepository.js'
import { invokeApp } from './httpHarness.js'

const SQLITE_ROOT = path.join(getServiceRoot(), 'SQLite')

function extractCookie(setCookieHeader: string | string[] | undefined): string {
  const rawHeader = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader
  if (!rawHeader) {
    throw new Error('Missing set-cookie header')
  }
  return rawHeader.split(';')[0]
}

async function login(account: string, password: string): Promise<string> {
  const response = await invokeApp(createApp(), {
    method: 'POST',
    path: '/web/api/auth/login',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:5175'
    },
    body: JSON.stringify({ account, password })
  })

  if (response.status !== 200) {
    throw new Error(`Login failed: ${response.status}`)
  }

  return extractCookie(response.headers['set-cookie'])
}

beforeEach(async () => {
  closeAllConnections()
  fs.rmSync(SQLITE_ROOT, { recursive: true, force: true })
  await initializeAppData()
})

afterEach(() => {
  closeAllConnections()
  fs.rmSync(SQLITE_ROOT, { recursive: true, force: true })
})

describe('user and role management routes', () => {
  it('lists users for an admin actor', async () => {
    const roleId = await userRepository.getRoleIdByKey('user')
    const user = await userRepository.createUser({
      userCode: 'alice',
      userAccount: 'alice',
      displayName: 'Alice'
    })
    if (roleId) {
      await userRepository.replaceUserRoles(user.userId, [roleId])
    }

    const cookie = await login('admin', DEFAULT_LOCAL_ADMIN_PASSWORD)
    const response = await invokeApp(createApp(), {
      path: '/web/api/users?page=1&pageSize=20',
      headers: { Cookie: cookie }
    })
    expect(response.status).toBe(200)
    const payload = response.json<{
      success: boolean
      data: { items: Array<{ userAccount: string }> }
    }>()
    expect(payload.data.items.some(item => item.userAccount === 'alice')).toBe(true)
  })

  it('lets an admin replace a user role binding', async () => {
    const userRoleId = await userRepository.getRoleIdByKey('user')
    const adminRoleId = await userRepository.getRoleIdByKey('admin')
    const user = await userRepository.createUser({
      userCode: 'bob',
      userAccount: 'bob',
      displayName: 'Bob'
    })
    if (userRoleId) {
      await userRepository.replaceUserRoles(user.userId, [userRoleId])
    }

    const cookie = await login('admin', DEFAULT_LOCAL_ADMIN_PASSWORD)
    const response = await invokeApp(createApp(), {
      method: 'PUT',
      path: `/web/api/users/${user.userId}/roles`,
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        Origin: 'http://localhost:5175'
      },
      body: JSON.stringify({
        roleIds: adminRoleId ? [adminRoleId] : []
      })
    })
    expect(response.status).toBe(200)
    const payload = response.json<{
      success: boolean
      data: { roles: Array<{ roleKey: string }> }
    }>()
    expect(payload.data.roles.map(role => role.roleKey)).toEqual(['admin'])
  })

  it('prevents a non-super-admin admin from assigning super_admin', async () => {
    const adminRoleId = await userRepository.getRoleIdByKey('admin')
    const userRoleId = await userRepository.getRoleIdByKey('user')
    const superAdminRoleId = await userRepository.getRoleIdByKey('super_admin')
    const actor = await userRepository.createUser({
      userCode: 'ops-admin',
      userAccount: 'ops-admin',
      displayName: 'Ops Admin'
    })
    await userRepository.updateUserPassword(actor.userId, hashPassword('OpsAdmin@123'), false)
    if (adminRoleId) {
      await userRepository.replaceUserRoles(actor.userId, [adminRoleId])
    }

    const target = await userRepository.createUser({
      userCode: 'sso-user',
      userAccount: 'sso-user',
      displayName: 'SSO User'
    })
    if (userRoleId) {
      await userRepository.replaceUserRoles(target.userId, [userRoleId])
    }

    const cookie = await login('ops-admin', 'OpsAdmin@123')
    const response = await invokeApp(createApp(), {
      method: 'PUT',
      path: `/web/api/users/${target.userId}/roles`,
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        Origin: 'http://localhost:5175'
      },
      body: JSON.stringify({
        roleIds: superAdminRoleId ? [superAdminRoleId] : []
      })
    })
    expect(response.status).toBe(403)
    const payload = response.json<{ success: boolean; error: string }>()
    expect(payload.error).toContain('super_admin')
  })
})
