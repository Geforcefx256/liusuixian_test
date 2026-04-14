import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/userAdminApi', () => ({
  userAdminApi: {
    listUsers: vi.fn(),
    getUser: vi.fn(),
    updateUser: vi.fn(),
    updateUserStatus: vi.fn(),
    replaceUserRoles: vi.fn(),
    listRoles: vi.fn(),
    updateRole: vi.fn()
  }
}))

import { userAdminApi } from '@/api/userAdminApi'
import type { UserAdminUser } from '@/api/types'
import { useAuthStore } from '@/auth/authStore'
import UserManagementDrawer from './UserManagementDrawer.vue'
import userManagementDrawerSource from './UserManagementDrawer.vue?raw'

const mockedUserAdminApi = vi.mocked(userAdminApi)

function buildRole(roleId: number, roleKey: string, roleNameCn: string) {
  return {
    roleId,
    roleKey,
    roleNameCn,
    roleNameEn: roleKey,
    roleDesc: `${roleNameCn}描述`,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

function buildUser(overrides: Partial<UserFixture> = {}) {
  return {
    ...baseUser(),
    ...overrides
  }
}

type UserFixture = UserAdminUser

function baseUser(): UserFixture {
  return {
    userId: 2,
    userCode: 'alice',
    userAccount: 'alice',
    displayName: 'Alice',
    email: 'alice@example.com',
    phone: null,
    avatarUrl: null,
    status: 'active' as const,
    lastLoginAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDeleted: false,
    roles: [buildRole(3, 'user', '普通用户')],
    identities: []
  }
}

describe('UserManagementDrawer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    document.body.innerHTML = ''

    const authStore = useAuthStore()
    authStore.currentUser = {
      user: {
        userId: 1,
        userCode: 'admin',
        userAccount: 'admin',
        displayName: '管理员',
        email: 'admin@example.com',
        avatarUrl: null,
        roles: [buildRole(2, 'admin', '管理员')]
      },
      session: {
        sessionId: 'session-1',
        expiresAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      },
      mustChangePassword: false
    }

    mockedUserAdminApi.listRoles.mockResolvedValue([
      buildRole(2, 'admin', '管理员'),
      buildRole(3, 'user', '普通用户')
    ])
    mockedUserAdminApi.listUsers.mockResolvedValue({
      items: [buildUser()],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1
    })
    mockedUserAdminApi.getUser.mockResolvedValue(buildUser())
    mockedUserAdminApi.replaceUserRoles.mockResolvedValue(buildUser({
      roles: [buildRole(2, 'admin', '管理员'), buildRole(3, 'user', '普通用户')]
    }))
    mockedUserAdminApi.updateRole.mockResolvedValue({
      ...buildRole(2, 'admin', '管理员'),
      roleDesc: '更新后的描述'
    })
    mockedUserAdminApi.updateUser.mockResolvedValue(buildUser())
    mockedUserAdminApi.updateUserStatus.mockResolvedValue(buildUser({ status: 'disabled' }))
  })

  it('saves updated user role bindings', async () => {
    const wrapper = mount(UserManagementDrawer, {
      props: { open: true },
      attachTo: document.body
    })
    await flushPromises()

    const body = new DOMWrapper(document.body)
    const checkboxes = body.findAll('.user-management-drawer__role-option input[type="checkbox"]')
    await checkboxes[0].setValue(true)
    await body.get('.user-management-drawer__card .primary-btn').trigger('click')

    expect(mockedUserAdminApi.replaceUserRoles).toHaveBeenCalledWith(2, [3, 2])
    wrapper.unmount()
  })

  it('saves role metadata changes from the roles tab', async () => {
    const wrapper = mount(UserManagementDrawer, {
      props: { open: true },
      attachTo: document.body
    })
    await flushPromises()

    const body = new DOMWrapper(document.body)
    await body.get('.user-management-drawer__tab:nth-child(2)').trigger('click')
    const textarea = body.get('textarea')
    await textarea.setValue('更新后的描述')
    await body.get('.user-management-drawer__actions .primary-btn').trigger('click')

    expect(mockedUserAdminApi.updateRole).toHaveBeenCalledWith(2, expect.objectContaining({
      roleDesc: '更新后的描述'
    }))
    wrapper.unmount()
  })

  it('uses governed title dense and meta typography roles across the drawer chrome', () => {
    expect(userManagementDrawerSource).toContain('font-size: var(--font-title);')
    expect(userManagementDrawerSource).toContain('font-size: var(--font-dense);')
    expect(userManagementDrawerSource).toContain('font-size: var(--font-meta);')
  })
})
