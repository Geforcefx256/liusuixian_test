<template>
  <main class="login-page">
    <section class="login-card card-shell">
      <div class="login-card__brand">
        <p class="login-card__eyebrow">AI MML</p>
        <h1>登录后继续使用智能体工作台</h1>
        <p>
          先完成认证，再进入会话、文件上下文和流式对话工作区。
        </p>
      </div>

      <p v-if="authStore.error" class="login-card__error">{{ authStore.error }}</p>

      <form
        v-if="authStore.loginFormVisible"
        class="login-card__form"
        @submit.prevent="submit"
      >
        <label class="login-card__field">
          <span>账号</span>
          <input v-model="account" autocomplete="username" type="text" />
        </label>
        <label class="login-card__field">
          <span>密码</span>
          <input v-model="password" autocomplete="current-password" type="password" />
        </label>
        <button class="primary-btn login-card__submit" type="submit" :disabled="authStore.isLoading">
          本地登录
        </button>
      </form>

      <div v-else class="login-card__oauth">
        <p v-if="authStore.error">
          企业登录未完成，请重新发起后端托管的统一认证流程。
        </p>
        <p v-else>
          当前环境使用后端托管的企业登录入口。继续后将跳转到统一认证，再返回工作台。
        </p>
        <button
          class="primary-btn"
          type="button"
          :disabled="!authStore.oauthLoginEnabled || authStore.isLoading"
          @click="authStore.startOAuthLogin()"
        >
          {{ authStore.error ? '重试企业登录' : '继续企业登录' }}
        </button>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import { useAuthStore } from '@/auth/authStore'

const authStore = useAuthStore()
const account = ref('admin')
const password = ref('')

async function submit(): Promise<void> {
  await authStore.loginWithLocalAccount(account.value, password.value)
  if (authStore.isAuthenticated) {
    password.value = ''
  }
}
</script>

<style scoped>
.login-page {
  background:
    radial-gradient(circle at top left, rgba(37, 99, 235, 0.16), transparent 35%),
    radial-gradient(circle at bottom right, rgba(22, 163, 74, 0.12), transparent 30%),
    linear-gradient(180deg, #f5f8ff 0%, #edf2fb 100%);
}

.login-card {
  width: min(480px, 100%);
  padding: 32px;
}

.login-card__eyebrow {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
}

.login-card__brand h1 {
  margin: 0 0 12px;
  font-size: 32px;
  line-height: 1.1;
}

.login-card__brand p,
.login-card__oauth p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.login-card__error {
  margin: 20px 0 0;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(220, 38, 38, 0.08);
  color: #b91c1c;
}

.login-card__form,
.login-card__oauth {
  display: grid;
  gap: 14px;
  margin-top: 24px;
}

.login-card__field {
  display: grid;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 13px;
}

.login-card__field input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--line-subtle);
  border-radius: 14px;
  background: #fff;
}

.login-card__submit {
  justify-content: center;
}
</style>
