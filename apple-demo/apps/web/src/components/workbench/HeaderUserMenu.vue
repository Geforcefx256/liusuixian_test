<template>
  <div class="header-user-menu">
    <button
      class="header-user-menu__trigger"
      type="button"
      aria-haspopup="true"
      :aria-expanded="menuOpen"
      :aria-label="`${userDisplayName} 账户菜单`"
      @click="menuOpen = !menuOpen"
    >
      <span class="header-user-menu__avatar" aria-hidden="true">
        <img v-if="userAvatarUrl" class="header-user-menu__avatar-image" :src="userAvatarUrl" alt="">
        <span v-else>{{ userInitial }}</span>
      </span>
      <span class="header-user-menu__name">{{ userDisplayName }}</span>
      <svg viewBox="0 0 24 24" class="icon-svg header-user-menu__chevron" :class="{ 'header-user-menu__chevron--open': menuOpen }" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <div v-if="menuOpen" class="header-user-menu__dropdown card-shell">
      <div class="header-user-menu__current">
        <div class="header-user-menu__avatar header-user-menu__avatar--large" aria-hidden="true">
          <img v-if="userAvatarUrl" class="header-user-menu__avatar-image" :src="userAvatarUrl" alt="">
          <span v-else>{{ userInitial }}</span>
        </div>
        <div class="header-user-menu__current-copy">
          <strong>{{ userDisplayName }}</strong>
          <p v-if="roleLabel">{{ roleLabel }}</p>
        </div>
      </div>

      <button v-if="canManageUsers" class="header-user-menu__action" type="button" @click="openUserManagement">
        用户管理
      </button>
      <button class="header-user-menu__action header-user-menu__action--danger" type="button" @click="logout">
        退出登录
      </button>
    </div>

    <UserManagementDrawer :open="userManagementOpen" @close="userManagementOpen = false" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { useAuthStore } from '@/auth/authStore'
import UserManagementDrawer from './UserManagementDrawer.vue'

const authStore = useAuthStore()
const menuOpen = ref(false)
const userManagementOpen = ref(false)

const canManageUsers = computed(() => {
  return (authStore.currentUser?.user.roles || []).some(role => ['admin', 'super_admin'].includes(role.roleKey))
})

const roleLabel = computed(() => {
  const labels = (authStore.currentUser?.user.roles || [])
    .filter(role => role.roleKey !== 'guest')
    .map(role => role.roleNameCn || role.roleKey)
    .filter(Boolean)

  return labels.join(' / ')
})

const userDisplayName = computed(() => {
  return authStore.currentUser?.user.userAccount
    || authStore.currentUser?.user.userCode
    || authStore.currentUser?.user.displayName
    || '账户'
})

const userAvatarUrl = computed(() => {
  return authStore.currentUser?.user.avatarUrl || ''
})

const userInitial = computed(() => {
  const avatarFallbackSource = authStore.currentUser?.user.userAccount
    || authStore.currentUser?.user.userCode
    || authStore.currentUser?.user.displayName
    || '账户'
  return avatarFallbackSource.slice(0, 1).toUpperCase()
})

function openUserManagement(): void {
  menuOpen.value = false
  userManagementOpen.value = true
}

async function logout(): Promise<void> {
  menuOpen.value = false
  await authStore.logout()
}
</script>

<style scoped>
.header-user-menu {
  position: relative;
}

.header-user-menu__trigger,
.header-user-menu__current,
.header-user-menu__action {
  display: flex;
}

.header-user-menu__trigger {
  align-items: center;
  gap: 10px;
  min-height: 38px;
  border: 1px solid var(--line-subtle);
  border-radius: 999px;
  background: var(--surface-panel);
  padding: 4px 10px 4px 6px;
  box-shadow: var(--shadow-sm);
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    box-shadow 0.2s ease;
}

.header-user-menu__avatar {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 50%;
  background: var(--accent-lighter);
  color: var(--accent);
  font-weight: 700;
  flex-shrink: 0;
}

.header-user-menu__avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.header-user-menu__avatar--large {
  width: 48px;
  height: 48px;
}

.header-user-menu__name,
.header-user-menu__current-copy strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-user-menu__name {
  max-width: 120px;
  font-size: var(--font-dense);
  font-weight: 600;
  line-height: var(--line-dense);
  color: var(--text-primary);
}

.header-user-menu__chevron {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--text-muted);
  transition:
    transform 0.2s ease,
    color 0.2s ease;
}

.header-user-menu__chevron--open {
  transform: rotate(180deg);
}

.header-user-menu__trigger:hover,
.header-user-menu__trigger:focus-visible {
  border-color: var(--accent-light);
  background: #fff;
  box-shadow: var(--shadow-md);
}

.header-user-menu__trigger:hover .header-user-menu__chevron,
.header-user-menu__trigger:focus-visible .header-user-menu__chevron {
  color: var(--accent);
}

.header-user-menu__dropdown {
  position: absolute;
  top: calc(100% + 12px);
  right: 0;
  width: 320px;
  display: grid;
  gap: 10px;
  padding: 14px;
  z-index: 30;
}

.header-user-menu__current {
  align-items: center;
  gap: 12px;
  padding: 8px 4px 12px;
  border-bottom: 1px solid var(--line-subtle);
}

.header-user-menu__current-copy {
  min-width: 0;
}

.header-user-menu__current p {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.header-user-menu__current-copy strong {
  font-size: var(--font-title);
  line-height: var(--line-title);
}

.header-user-menu__action {
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  padding: 11px 12px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: var(--surface-subtle);
  color: var(--text-primary);
  font-size: var(--font-dense);
  font-weight: 600;
  line-height: var(--line-dense);
}

.header-user-menu__action:hover {
  border-color: var(--line-subtle);
}

.header-user-menu__action--danger {
  color: var(--danger);
  background: rgba(220, 38, 38, 0.08);
}

@media (max-width: 640px) {
  .header-user-menu__trigger {
    gap: 8px;
    padding-right: 8px;
  }

  .header-user-menu__name {
    display: none;
  }
}
</style>
