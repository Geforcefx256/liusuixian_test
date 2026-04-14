<template>
  <div class="app-root">
    <div v-if="authStore.isBootstrapping" class="boot-screen">
      <div class="boot-screen__card">
        <p class="boot-screen__eyebrow">AI MML</p>
        <h1>正在准备工作台</h1>
        <p>正在检查登录态并初始化智能体前端。</p>
      </div>
    </div>
    <LoginView v-else-if="!authStore.isAuthenticated" />
    <WorkbenchShell v-else />
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'

import LoginView from '@/auth/LoginView.vue'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import { useAuthStore } from '@/auth/authStore'
import { useWorkbenchStore } from '@/stores/workbenchStore'

const authStore = useAuthStore()
const workbenchStore = useWorkbenchStore()

onMounted(() => {
  void authStore.initialize()
})

watch(
  () => authStore.isAuthenticated,
  isAuthenticated => {
    if (isAuthenticated) {
      void workbenchStore.initialize()
      return
    }
    workbenchStore.reset()
  },
  { immediate: true }
)
</script>
