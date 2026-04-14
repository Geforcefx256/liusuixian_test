<template>
  <Teleport to="body">
    <div v-if="open" class="user-management-drawer">
      <button class="user-management-drawer__backdrop" type="button" aria-label="关闭用户管理抽屉" @click="$emit('close')"></button>
      <aside class="user-management-drawer__panel" aria-label="用户与角色管理">
        <header class="user-management-drawer__header">
          <div>
            <p class="panel-eyebrow">账户治理</p>
            <h2>用户与角色管理</h2>
            <p>管理已存在用户的状态与角色绑定。</p>
          </div>
          <button class="icon-button" type="button" aria-label="关闭用户管理" @click="$emit('close')">
            <svg viewBox="0 0 24 24" class="icon-svg">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div class="user-management-drawer__tabs" role="tablist" aria-label="用户与角色管理标签">
          <button
            class="user-management-drawer__tab"
            :class="{ 'user-management-drawer__tab--active': activeTab === 'users' }"
            type="button"
            @click="activeTab = 'users'"
          >
            用户
          </button>
          <button
            class="user-management-drawer__tab"
            :class="{ 'user-management-drawer__tab--active': activeTab === 'roles' }"
            type="button"
            @click="activeTab = 'roles'"
          >
            角色
          </button>
        </div>

        <p v-if="error" class="user-management-drawer__error" role="alert">{{ error }}</p>

        <section v-if="activeTab === 'users'" class="user-management-drawer__section">
          <div class="user-management-drawer__toolbar card-shell">
            <label class="user-management-drawer__search">
              <span>搜索用户</span>
              <input v-model="searchKeyword" type="search" placeholder="按姓名、账号、邮箱搜索" @keydown.enter.prevent="loadUsers()" />
            </label>
            <label class="user-management-drawer__field">
              <span>状态</span>
              <select v-model="statusFilter" @change="loadUsers()">
                <option value="">全部</option>
                <option value="active">启用</option>
                <option value="disabled">禁用</option>
              </select>
            </label>
            <label class="user-management-drawer__field">
              <span>角色</span>
              <select v-model="roleFilter" @change="loadUsers()">
                <option value="">全部</option>
                <option v-for="role in activeRoles" :key="role.roleId" :value="role.roleKey">
                  {{ role.roleNameCn || role.roleKey }}
                </option>
              </select>
            </label>
            <button class="secondary-btn" type="button" :disabled="isUsersLoading" @click="loadUsers()">
              {{ isUsersLoading ? '加载中...' : '刷新' }}
            </button>
          </div>

          <div class="user-management-drawer__content">
            <aside class="user-management-drawer__list card-shell">
              <div class="user-management-drawer__list-head">
                <div>
                  <p class="panel-eyebrow">用户列表</p>
                  <h3>{{ users.length }} 位用户</h3>
                </div>
                <span class="status-pill">{{ totalUsers }} 总数</span>
              </div>

              <div v-if="!users.length" class="user-management-drawer__empty">暂无匹配用户。</div>
              <div v-else class="user-management-drawer__items">
                <button
                  v-for="user in users"
                  :key="user.userId"
                  class="user-management-drawer__item"
                  :class="{ 'user-management-drawer__item--active': user.userId === selectedUserId }"
                  type="button"
                  @click="selectUser(user.userId)"
                >
                  <div class="user-management-drawer__item-head">
                    <strong>{{ user.displayName }}</strong>
                    <span :class="['status-pill', user.status === 'active' ? 'status-pill--success' : 'status-pill--danger']">
                      {{ user.status === 'active' ? '启用' : '禁用' }}
                    </span>
                  </div>
                  <p>{{ user.userAccount }}</p>
                  <small>{{ formatRoleNames(user.roles) }}</small>
                </button>
              </div>
            </aside>

            <section class="user-management-drawer__detail card-shell">
              <div v-if="selectedUser" class="user-management-drawer__detail-body">
                <div class="user-management-drawer__detail-head">
                  <div>
                    <p class="panel-eyebrow">用户详情</p>
                    <h3>{{ selectedUser.displayName }}</h3>
                  </div>
                  <div class="user-management-drawer__detail-actions">
                    <button class="secondary-btn" type="button" @click="toggleUserEdit">
                      {{ isEditingUser ? '取消编辑' : '编辑基础信息' }}
                    </button>
                    <button
                      class="secondary-btn"
                      type="button"
                      :class="{ 'user-management-drawer__danger-btn': selectedUser.status === 'active' }"
                      :disabled="isSavingUserStatus"
                      @click="toggleUserStatus"
                    >
                      {{ isSavingUserStatus ? '处理中...' : selectedUser.status === 'active' ? '禁用用户' : '启用用户' }}
                    </button>
                  </div>
                </div>

                <div class="user-management-drawer__profile-grid">
                  <label class="user-management-drawer__field">
                    <span>显示名称</span>
                    <input v-model="userForm.displayName" type="text" :disabled="!isEditingUser || isSavingUserProfile">
                  </label>
                  <label class="user-management-drawer__field">
                    <span>邮箱</span>
                    <input v-model="userForm.email" type="email" :disabled="!isEditingUser || isSavingUserProfile">
                  </label>
                  <label class="user-management-drawer__field">
                    <span>手机</span>
                    <input v-model="userForm.phone" type="text" :disabled="!isEditingUser || isSavingUserProfile">
                  </label>
                  <label class="user-management-drawer__field">
                    <span>头像 URL</span>
                    <input v-model="userForm.avatarUrl" type="url" :disabled="!isEditingUser || isSavingUserProfile">
                  </label>
                  <div class="user-management-drawer__meta">
                    <span>账号</span>
                    <strong>{{ selectedUser.userAccount }}</strong>
                  </div>
                  <div class="user-management-drawer__meta">
                    <span>编码</span>
                    <strong>{{ selectedUser.userCode }}</strong>
                  </div>
                  <div class="user-management-drawer__meta">
                    <span>来源</span>
                    <strong>{{ identitySourceLabel(selectedUser) }}</strong>
                  </div>
                  <div class="user-management-drawer__meta">
                    <span>最近登录</span>
                    <strong>{{ formatDateTime(selectedUser.lastLoginAt) }}</strong>
                  </div>
                </div>

                <div v-if="isEditingUser" class="user-management-drawer__actions">
                  <button class="secondary-btn" type="button" @click="resetUserForm">重置</button>
                  <button class="primary-btn" type="button" :disabled="isSavingUserProfile" @click="saveUserProfile">
                    {{ isSavingUserProfile ? '保存中...' : '保存基础信息' }}
                  </button>
                </div>

                <section class="user-management-drawer__card">
                  <div class="user-management-drawer__card-head">
                    <div>
                      <p class="panel-eyebrow">角色绑定</p>
                      <h4>修改用户角色</h4>
                    </div>
                    <span class="status-pill">{{ selectedRoleIds.length }} 个角色</span>
                  </div>
                  <div class="user-management-drawer__role-grid">
                    <label
                      v-for="role in assignableRoles"
                      :key="role.roleId"
                      class="user-management-drawer__role-option"
                      :class="{ 'user-management-drawer__role-option--disabled': isRoleDisabled(role) }"
                    >
                      <input
                        :checked="selectedRoleIds.includes(role.roleId)"
                        type="checkbox"
                        :disabled="isRoleDisabled(role) || isSavingUserRoles"
                        @change="toggleRole(role.roleId, ($event.target as HTMLInputElement).checked)"
                      >
                      <div>
                        <strong>{{ role.roleNameCn || role.roleKey }}</strong>
                        <small>{{ role.roleDesc || role.roleKey }}</small>
                      </div>
                    </label>
                  </div>
                  <p class="user-management-drawer__hint">保存后将覆盖该用户当前角色绑定。</p>
                  <div class="user-management-drawer__actions">
                    <button class="secondary-btn" type="button" @click="resetUserRoles">取消变更</button>
                    <button class="primary-btn" type="button" :disabled="isSavingUserRoles" @click="saveUserRoles">
                      {{ isSavingUserRoles ? '保存中...' : '保存角色修改' }}
                    </button>
                  </div>
                </section>
              </div>

              <div v-else class="user-management-drawer__empty user-management-drawer__empty--detail">
                请选择一位用户查看详情。
              </div>
            </section>
          </div>
        </section>

        <section v-else class="user-management-drawer__section">
          <div class="user-management-drawer__content">
            <aside class="user-management-drawer__list card-shell">
              <div class="user-management-drawer__list-head">
                <div>
                  <p class="panel-eyebrow">角色列表</p>
                  <h3>{{ roles.length }} 个角色</h3>
                </div>
                <button class="secondary-btn" type="button" :disabled="isRolesLoading" @click="loadRoles()">
                  {{ isRolesLoading ? '加载中...' : '刷新' }}
                </button>
              </div>

              <div class="user-management-drawer__items">
                <button
                  v-for="role in roles"
                  :key="role.roleId"
                  class="user-management-drawer__item"
                  :class="{ 'user-management-drawer__item--active': role.roleId === selectedRoleId }"
                  type="button"
                  @click="selectRole(role.roleId)"
                >
                  <div class="user-management-drawer__item-head">
                    <strong>{{ role.roleNameCn }}</strong>
                    <span :class="['status-pill', role.isActive ? 'status-pill--success' : 'status-pill--danger']">
                      {{ role.isActive ? '启用' : '停用' }}
                    </span>
                  </div>
                  <p>{{ role.roleKey }}</p>
                  <small>{{ role.roleDesc || role.roleNameEn }}</small>
                </button>
              </div>
            </aside>

            <section class="user-management-drawer__detail card-shell">
              <div v-if="selectedRole" class="user-management-drawer__detail-body">
                <div class="user-management-drawer__detail-head">
                  <div>
                    <p class="panel-eyebrow">角色详情</p>
                    <h3>{{ selectedRole.roleNameCn }}</h3>
                  </div>
                  <span class="status-pill">{{ selectedRole.roleKey }}</span>
                </div>

                <div class="user-management-drawer__profile-grid">
                  <div class="user-management-drawer__meta">
                    <span>角色标识</span>
                    <strong>{{ selectedRole.roleKey }}</strong>
                  </div>
                  <label class="user-management-drawer__field">
                    <span>中文名</span>
                    <input v-model="roleForm.roleNameCn" type="text" :disabled="isSavingRole">
                  </label>
                  <label class="user-management-drawer__field">
                    <span>英文名</span>
                    <input v-model="roleForm.roleNameEn" type="text" :disabled="isSavingRole">
                  </label>
                  <label class="user-management-drawer__field user-management-drawer__field--full">
                    <span>描述</span>
                    <textarea v-model="roleForm.roleDesc" rows="4" :disabled="isSavingRole"></textarea>
                  </label>
                  <label class="user-management-drawer__toggle">
                    <input v-model="roleForm.isActive" type="checkbox" :disabled="isSavingRole">
                    <span>角色启用</span>
                  </label>
                </div>

                <div class="user-management-drawer__actions">
                  <button class="secondary-btn" type="button" @click="resetRoleForm">重置</button>
                  <button class="primary-btn" type="button" :disabled="isSavingRole" @click="saveRole">
                    {{ isSavingRole ? '保存中...' : '保存角色修改' }}
                  </button>
                </div>
              </div>

              <div v-else class="user-management-drawer__empty user-management-drawer__empty--detail">
                请选择一个角色查看详情。
              </div>
            </section>
          </div>
        </section>
      </aside>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import { userAdminApi } from '@/api/userAdminApi'
import type { UserAdminRole, UserAdminUser } from '@/api/types'
import { useAuthStore } from '@/auth/authStore'

const props = defineProps<{
  open: boolean
}>()

defineEmits<{
  (e: 'close'): void
}>()

const authStore = useAuthStore()
const activeTab = ref<'users' | 'roles'>('users')
const searchKeyword = ref('')
const statusFilter = ref<'' | 'active' | 'disabled'>('')
const roleFilter = ref('')
const users = ref<UserAdminUser[]>([])
const totalUsers = ref(0)
const selectedUserId = ref<number | null>(null)
const selectedUser = ref<UserAdminUser | null>(null)
const roles = ref<UserAdminRole[]>([])
const selectedRoleId = ref<number | null>(null)
const error = ref<string | null>(null)
const isUsersLoading = ref(false)
const isRolesLoading = ref(false)
const isSavingUserProfile = ref(false)
const isSavingUserStatus = ref(false)
const isSavingUserRoles = ref(false)
const isSavingRole = ref(false)
const isEditingUser = ref(false)
const selectedRoleIds = ref<number[]>([])

const userForm = reactive({
  displayName: '',
  email: '',
  phone: '',
  avatarUrl: ''
})

const roleForm = reactive({
  roleNameCn: '',
  roleNameEn: '',
  roleDesc: '',
  isActive: true
})

const isSuperAdmin = computed(() => {
  return (authStore.currentUser?.user.roles || []).some(role => role.roleKey === 'super_admin')
})

const activeRoles = computed(() => roles.value.filter(role => role.isActive))
const assignableRoles = computed(() => roles.value.filter(role => role.isActive || selectedRoleIds.value.includes(role.roleId)))
const selectedRole = computed(() => roles.value.find(role => role.roleId === selectedRoleId.value) || null)

watch(() => props.open, opened => {
  if (!opened) {
    error.value = null
    return
  }
  void initialize()
}, { immediate: true })

watch(selectedRole, role => {
  if (!role) return
  roleForm.roleNameCn = role.roleNameCn
  roleForm.roleNameEn = role.roleNameEn
  roleForm.roleDesc = role.roleDesc
  roleForm.isActive = role.isActive
}, { immediate: true })

async function initialize(): Promise<void> {
  error.value = null
  await Promise.all([loadRoles(), loadUsers()])
}

async function loadUsers(): Promise<void> {
  isUsersLoading.value = true
  error.value = null
  try {
    const payload = await userAdminApi.listUsers({
      keyword: searchKeyword.value,
      status: statusFilter.value,
      roleKey: roleFilter.value
    })
    users.value = payload.items
    totalUsers.value = payload.total
    const nextUserId = payload.items.find(user => user.userId === selectedUserId.value)?.userId ?? payload.items[0]?.userId ?? null
    selectedUserId.value = nextUserId
    if (nextUserId != null) {
      await selectUser(nextUserId)
    } else {
      selectedUser.value = null
      selectedRoleIds.value = []
    }
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    isUsersLoading.value = false
  }
}

async function selectUser(userId: number): Promise<void> {
  selectedUserId.value = userId
  error.value = null
  try {
    const user = await userAdminApi.getUser(userId)
    selectedUser.value = user
    resetUserForm()
    resetUserRoles()
  } catch (err) {
    error.value = (err as Error).message
  }
}

async function loadRoles(): Promise<void> {
  isRolesLoading.value = true
  error.value = null
  try {
    roles.value = await userAdminApi.listRoles(true)
    if (selectedRoleId.value == null && roles.value.length) {
      selectedRoleId.value = roles.value[0].roleId
    }
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    isRolesLoading.value = false
  }
}

function selectRole(roleId: number): void {
  selectedRoleId.value = roleId
}

function resetUserForm(): void {
  userForm.displayName = selectedUser.value?.displayName || ''
  userForm.email = selectedUser.value?.email || ''
  userForm.phone = selectedUser.value?.phone || ''
  userForm.avatarUrl = selectedUser.value?.avatarUrl || ''
  isEditingUser.value = false
}

function resetUserRoles(): void {
  selectedRoleIds.value = selectedUser.value?.roles.map(role => role.roleId) || []
}

function toggleUserEdit(): void {
  if (isEditingUser.value) {
    resetUserForm()
    return
  }
  isEditingUser.value = true
}

async function saveUserProfile(): Promise<void> {
  if (!selectedUser.value) return
  isSavingUserProfile.value = true
  error.value = null
  try {
    const updated = await userAdminApi.updateUser(selectedUser.value.userId, {
      displayName: userForm.displayName.trim(),
      email: userForm.email.trim() || null,
      phone: userForm.phone.trim() || null,
      avatarUrl: userForm.avatarUrl.trim() || null
    })
    selectedUser.value = updated
    syncUserList(updated)
    resetUserForm()
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    isSavingUserProfile.value = false
  }
}

async function toggleUserStatus(): Promise<void> {
  if (!selectedUser.value) return
  isSavingUserStatus.value = true
  error.value = null
  try {
    const nextStatus = selectedUser.value.status === 'active' ? 'disabled' : 'active'
    const updated = await userAdminApi.updateUserStatus(selectedUser.value.userId, nextStatus)
    selectedUser.value = updated
    syncUserList(updated)
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    isSavingUserStatus.value = false
  }
}

function toggleRole(roleId: number, checked: boolean): void {
  const next = new Set(selectedRoleIds.value)
  if (checked) {
    next.add(roleId)
  } else {
    next.delete(roleId)
  }
  selectedRoleIds.value = Array.from(next)
}

function isRoleDisabled(role: UserAdminRole): boolean {
  if (role.roleKey !== 'super_admin') return false
  return !isSuperAdmin.value
}

async function saveUserRoles(): Promise<void> {
  if (!selectedUser.value) return
  isSavingUserRoles.value = true
  error.value = null
  try {
    const updated = await userAdminApi.replaceUserRoles(selectedUser.value.userId, selectedRoleIds.value)
    selectedUser.value = updated
    syncUserList(updated)
    resetUserRoles()
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    isSavingUserRoles.value = false
  }
}

function resetRoleForm(): void {
  if (!selectedRole.value) return
  roleForm.roleNameCn = selectedRole.value.roleNameCn
  roleForm.roleNameEn = selectedRole.value.roleNameEn
  roleForm.roleDesc = selectedRole.value.roleDesc
  roleForm.isActive = selectedRole.value.isActive
}

async function saveRole(): Promise<void> {
  if (!selectedRole.value) return
  isSavingRole.value = true
  error.value = null
  try {
    const updated = await userAdminApi.updateRole(selectedRole.value.roleId, {
      roleNameCn: roleForm.roleNameCn.trim(),
      roleNameEn: roleForm.roleNameEn.trim(),
      roleDesc: roleForm.roleDesc.trim(),
      isActive: roleForm.isActive
    })
    const index = roles.value.findIndex(role => role.roleId === updated.roleId)
    if (index >= 0) {
      roles.value.splice(index, 1, updated)
    }
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    isSavingRole.value = false
  }
}

function syncUserList(updated: UserAdminUser): void {
  const index = users.value.findIndex(user => user.userId === updated.userId)
  if (index >= 0) {
    users.value.splice(index, 1, updated)
  }
}

function formatRoleNames(roleItems: Array<{ roleNameCn: string; roleKey: string }>): string {
  if (!roleItems.length) return '未分配角色'
  return roleItems.map(role => role.roleNameCn || role.roleKey).join(' / ')
}

function formatDateTime(value: string | null): string {
  if (!value) return '未登录'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

function identitySourceLabel(user: UserAdminUser): string {
  if (!user.identities.length) return 'Local'
  const providers = Array.from(new Set(user.identities.map(identity => identity.providerCode)))
  return `OAuth / ${providers.join(', ')}`
}
</script>

<style scoped>
.user-management-drawer {
  position: fixed;
  inset: 0;
  z-index: 40;
}

.user-management-drawer__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(15, 23, 42, 0.22);
}

.user-management-drawer__panel {
  position: absolute;
  top: 0;
  right: 0;
  block-size: 100%;
  width: min(1040px, 100vw);
  display: flex;
  flex-direction: column;
  gap: var(--section-gap);
  padding: var(--card-pad);
  background: var(--bg-canvas);
  border-left: 1px solid var(--line-subtle);
  box-shadow: -24px 0 48px rgba(15, 23, 42, 0.14);
}

.user-management-drawer__header,
.user-management-drawer__detail-head,
.user-management-drawer__item-head,
.user-management-drawer__card-head,
.user-management-drawer__list-head,
.user-management-drawer__actions,
.user-management-drawer__detail-actions {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--section-gap);
}

.user-management-drawer__header h2,
.user-management-drawer__list-head h3,
.user-management-drawer__detail-head h3,
.user-management-drawer__card-head h4 {
  margin: 0;
  font-size: var(--font-title);
  line-height: var(--line-title);
}

.user-management-drawer__header p,
.user-management-drawer__list-head p,
.user-management-drawer__detail-head p {
  margin: 0;
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.user-management-drawer__tabs {
  display: inline-flex;
  gap: calc(var(--section-gap) * 0.45);
  align-items: center;
  padding: calc(var(--pane-block) * 0.35);
  width: fit-content;
  border-radius: 999px;
  border: 1px solid var(--line-subtle);
  background: var(--surface-subtle);
}

.user-management-drawer__tab {
  min-inline-size: calc(4.8rem + 0.6vi);
  padding-block: calc(var(--pane-block) * 0.65);
  padding-inline: calc(var(--pane-inline) * 0.75);
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-dense);
  font-weight: 600;
  line-height: var(--line-dense);
}

.user-management-drawer__tab--active {
  background: #fff;
  color: var(--accent);
  box-shadow: var(--shadow-sm);
}

.user-management-drawer__error {
  margin: 0;
  padding: var(--card-pad-tight);
  border-radius: 14px;
  border: 1px solid rgba(220, 38, 38, 0.18);
  background: rgba(220, 38, 38, 0.08);
  color: var(--danger);
}

.user-management-drawer__section,
.user-management-drawer__content,
.user-management-drawer__detail,
.user-management-drawer__list,
.user-management-drawer__detail-body {
  min-height: 0;
}

.user-management-drawer__section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--section-gap);
}

.user-management-drawer__toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) repeat(2, minmax(8.5rem, 0.7fr)) auto;
  gap: var(--section-gap);
  padding: var(--card-pad);
}

.user-management-drawer__content {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(18rem, 0.8fr) minmax(0, 1.4fr);
  gap: var(--section-gap);
}

.user-management-drawer__list,
.user-management-drawer__detail {
  display: flex;
  flex-direction: column;
  gap: calc(var(--section-gap) * 0.8);
  padding: var(--card-pad);
  overflow: hidden;
}

.user-management-drawer__items,
.user-management-drawer__detail-body {
  display: grid;
  gap: calc(var(--section-gap) * 0.7);
  overflow: auto;
}

.user-management-drawer__item {
  display: grid;
  gap: calc(var(--section-gap) * 0.3);
  padding: var(--card-pad-tight);
  text-align: left;
  border-radius: 14px;
  border: 1px solid var(--line-subtle);
  background: var(--surface-subtle);
  color: inherit;
}

.user-management-drawer__item--active {
  background: var(--accent-lighter);
  border-color: var(--accent-light);
}

.user-management-drawer__item p,
.user-management-drawer__item small {
  margin: 0;
  color: var(--text-secondary);
  line-height: var(--line-meta);
}

.user-management-drawer__item p {
  font-size: var(--font-dense);
  line-height: var(--line-dense);
}

.user-management-drawer__item small,
.user-management-drawer__role-option small {
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.user-management-drawer__profile-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: calc(var(--section-gap) * 0.8);
}

.user-management-drawer__field,
.user-management-drawer__search {
  display: grid;
  gap: calc(var(--section-gap) * 0.45);
  color: var(--text-secondary);
  font-size: var(--font-dense);
  line-height: var(--line-dense);
}

.user-management-drawer__field input,
.user-management-drawer__field select,
.user-management-drawer__search input,
.user-management-drawer__field textarea {
  width: 100%;
  min-block-size: var(--control-block);
  border: 1px solid var(--line-subtle);
  border-radius: 12px;
  padding-block: calc(var(--pane-block) * 0.75);
  padding-inline: calc(var(--pane-inline) * 0.75);
  background: var(--surface-panel);
  color: var(--text-primary);
  font-size: var(--font-dense);
  line-height: var(--line-dense);
}

.user-management-drawer__field textarea {
  resize: vertical;
  min-block-size: calc(3lh + 1dvh);
  max-block-size: min(20dvh, 12rem);
}

.user-management-drawer__field--full {
  grid-column: 1 / -1;
}

.user-management-drawer__meta,
.user-management-drawer__card {
  display: grid;
  gap: calc(var(--section-gap) * 0.45);
}

.user-management-drawer__meta {
  padding: var(--card-pad-tight);
  border-radius: 14px;
  background: var(--surface-subtle);
  border: 1px solid var(--line-subtle);
}

.user-management-drawer__meta span {
  color: var(--text-muted);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.user-management-drawer__card {
  padding: var(--card-pad);
  border-radius: 16px;
  border: 1px solid var(--line-subtle);
  background: var(--surface-subtle);
}

.user-management-drawer__role-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: calc(var(--section-gap) * 0.7);
}

.user-management-drawer__role-option {
  display: flex;
  align-items: flex-start;
  gap: calc(var(--section-gap) * 0.7);
  padding: var(--card-pad-tight);
  border-radius: 14px;
  border: 1px solid var(--line-subtle);
  background: var(--surface-panel);
}

.user-management-drawer__role-option small {
  display: block;
  margin-top: calc(var(--section-gap) * 0.25);
  color: var(--text-muted);
}

.user-management-drawer__role-option--disabled {
  opacity: 0.72;
}

.user-management-drawer__hint {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.user-management-drawer__toggle {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--section-gap) * 0.55);
  min-block-size: calc(1.8rem + 0.6dvh);
  color: var(--text-primary);
  font-size: var(--font-dense);
  line-height: var(--line-dense);
}

.user-management-drawer__empty {
  display: grid;
  place-items: center;
  min-block-size: clamp(8rem, 22dvh, 12rem);
  border: 1px dashed var(--line-subtle);
  border-radius: 16px;
  color: var(--text-secondary);
  background: var(--surface-subtle);
}

.user-management-drawer__empty--detail {
  min-block-size: clamp(12rem, 34dvh, 20rem);
}

.user-management-drawer__danger-btn {
  color: var(--danger);
}

@media (max-width: 980px) {
  .user-management-drawer__panel {
    width: 100vw;
    padding: var(--pane-block) var(--pane-inline);
  }

  .user-management-drawer__toolbar,
  .user-management-drawer__content,
  .user-management-drawer__profile-grid,
  .user-management-drawer__role-grid {
    grid-template-columns: 1fr;
  }
}
</style>
