import { defineComponent, reactive, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const authStore = reactive({
  isBootstrapping: false,
  isAuthenticated: true,
  initialize: vi.fn(),
  currentUser: null
})

const workbenchStore = reactive({
  initialize: vi.fn(),
  reset: vi.fn()
})

vi.mock('@/auth/LoginView.vue', () => ({
  default: defineComponent({
    name: 'LoginViewStub',
    template: '<div class="login-view-stub" />'
  })
}))

vi.mock('@/components/workbench/WorkbenchShell.vue', () => ({
  default: defineComponent({
    name: 'WorkbenchShellStub',
    template: '<div class="workbench-shell-stub" />'
  })
}))

vi.mock('@/auth/authStore', () => ({
  useAuthStore: () => authStore
}))

vi.mock('@/stores/workbenchStore', () => ({
  useWorkbenchStore: () => workbenchStore
}))

import App from './App.vue'

describe('App', () => {
  beforeEach(() => {
    authStore.isBootstrapping = false
    authStore.isAuthenticated = true
    authStore.initialize.mockReset()
    workbenchStore.initialize.mockReset()
    workbenchStore.reset.mockReset()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('initializes the workbench without auto-opening the latest session', async () => {
    mount(App)
    await nextTick()

    expect(authStore.initialize).toHaveBeenCalledTimes(1)
    expect(workbenchStore.initialize).toHaveBeenCalledTimes(1)
    expect(workbenchStore.initialize).toHaveBeenCalledWith()
    expect(workbenchStore.initialize).not.toHaveBeenCalledWith({ autoOpenFirstSession: true })
  })
})
