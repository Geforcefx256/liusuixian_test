import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/auth/authApi', () => ({
  authApi: {
    getAuthMode: vi.fn(),
    getLoginUrl: vi.fn(),
    loginWithLocalAccount: vi.fn(),
    completeLoginCallback: vi.fn(),
    getCurrentUser: vi.fn(),
    logout: vi.fn()
  }
}))

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
import { useAuthStore } from '@/auth/authStore'
import HeaderUserMenu from './HeaderUserMenu.vue'
import headerUserMenuSource from './HeaderUserMenu.vue?raw'

const mockedUserAdminApi = vi.mocked(userAdminApi)

function buildCurrentUser(
  roleKey: 'user' | 'admin' | 'super_admin' | 'guest' = 'admin',
  overrides: Partial<{
    displayName: string
    userAccount: string
    userCode: string
    avatarUrl: string | null
    roleNameCn: string
  }> = {}
) {
  return {
    user: {
      userId: 1,
      userCode: overrides.userCode ?? 'uuid-alice',
      userAccount: overrides.userAccount ?? 'admin',
      displayName: overrides.displayName ?? 'Alice',
      email: 'admin@example.com',
      avatarUrl: overrides.avatarUrl ?? null,
      roles: [
        {
          roleId: 1,
          roleKey,
          roleNameCn: overrides.roleNameCn ?? roleKey
        }
      ]
    },
    session: {
      sessionId: 'session-1',
      expiresAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    },
    mustChangePassword: false
  }
}

function buildRole(roleId: number, roleKey: string, roleNameCn: string) {
  return {
    roleId,
    roleKey,
    roleNameCn,
    roleNameEn: roleKey,
    roleDesc: `${roleNameCn} description`,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

function buildUser() {
  return {
    userId: 2,
    userCode: 'uuid-alice',
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
    roles: [buildRole(3, 'user', 'user')],
    identities: []
  }
}

describe('HeaderUserMenu', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    document.body.innerHTML = ''

    mockedUserAdminApi.listRoles.mockResolvedValue([
      buildRole(1, 'super_admin', 'super_admin'),
      buildRole(2, 'admin', 'admin'),
      buildRole(3, 'user', 'user')
    ])
    mockedUserAdminApi.listUsers.mockResolvedValue({
      items: [buildUser()],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1
    })
    mockedUserAdminApi.getUser.mockResolvedValue(buildUser())
  })

  it('uses userAccount as the visible name and hides user management for non-admin users', async () => {
    const authStore = useAuthStore()
    authStore.currentUser = buildCurrentUser('user', {
      userAccount: 'member01',
      displayName: 'Alice',
      roleNameCn: 'user'
    })

    const wrapper = mount(HeaderUserMenu, {
      attachTo: document.body
    })
    const trigger = wrapper.get('.header-user-menu__trigger')

    expect(trigger.text()).toContain('member01')
    expect(trigger.text()).not.toContain('Alice')
    expect(trigger.attributes('aria-label')).toContain('member01')

    await trigger.trigger('click')

    const actions = wrapper.findAll('.header-user-menu__action')
    expect(actions).toHaveLength(1)
    expect(actions[0]?.classes()).toContain('header-user-menu__action--danger')
    expect(wrapper.get('.header-user-menu__current').text()).toContain('user')
    wrapper.unmount()
  })

  it('opens the user-management drawer from the account menu for admin users', async () => {
    const authStore = useAuthStore()
    authStore.currentUser = buildCurrentUser('admin', {
      userAccount: 'admin01',
      roleNameCn: 'admin'
    })

    const wrapper = mount(HeaderUserMenu, {
      attachTo: document.body
    })
    await wrapper.get('.header-user-menu__trigger').trigger('click')
    await wrapper.get('.header-user-menu__action').trigger('click')
    await flushPromises()

    expect(document.body.querySelector('.user-management-drawer__backdrop')).not.toBeNull()
    expect(mockedUserAdminApi.listUsers).toHaveBeenCalled()
    expect(mockedUserAdminApi.listRoles).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('renders an avatar image when avatarUrl is available', () => {
    const authStore = useAuthStore()
    authStore.currentUser = buildCurrentUser('admin', {
      avatarUrl: 'https://example.com/avatar.png'
    })

    const wrapper = mount(HeaderUserMenu)
    const image = wrapper.get('.header-user-menu__trigger .header-user-menu__avatar-image')

    expect(image.attributes('src')).toBe('https://example.com/avatar.png')
    expect(wrapper.find('.header-user-menu__trigger .header-user-menu__avatar').text()).toBe('')
    wrapper.unmount()
  })

  it('falls back to the first account letter when avatarUrl is missing', () => {
    const authStore = useAuthStore()
    authStore.currentUser = buildCurrentUser('admin', {
      displayName: 'Bob',
      userAccount: 'bob'
    })

    const wrapper = mount(HeaderUserMenu)

    expect(wrapper.find('.header-user-menu__trigger .header-user-menu__avatar-image').exists()).toBe(false)
    expect(wrapper.get('.header-user-menu__trigger .header-user-menu__avatar').text()).toContain('B')
    wrapper.unmount()
  })

  it('falls back to the account identifier and hides guest-only role labels for sparse sso users', async () => {
    const authStore = useAuthStore()
    authStore.currentUser = buildCurrentUser('guest', {
      displayName: '',
      userAccount: 'x3008892398',
      userCode: 'uuid-x3008892398',
      avatarUrl: null,
      roleNameCn: 'guest'
    })

    const wrapper = mount(HeaderUserMenu, {
      attachTo: document.body
    })

    expect(wrapper.get('.header-user-menu__trigger').text()).toContain('x3008892398')
    expect(wrapper.get('.header-user-menu__trigger .header-user-menu__avatar').text()).toContain('X')

    await wrapper.get('.header-user-menu__trigger').trigger('click')

    expect(wrapper.get('.header-user-menu__current-copy').text()).toContain('x3008892398')
    expect(wrapper.find('.header-user-menu__current-copy p').exists()).toBe(false)
    wrapper.unmount()
  })

  it('keeps menu trigger copy on governed dense title and meta roles', () => {
    expect(headerUserMenuSource).toContain('font-size: var(--font-dense);')
    expect(headerUserMenuSource).toContain('font-size: var(--font-title);')
    expect(headerUserMenuSource).toContain('font-size: var(--font-meta);')
  })
})
