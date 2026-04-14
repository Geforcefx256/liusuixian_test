<template>
  <section
    :class="['session-rail-confirm', `session-rail-confirm--${props.variant}`]"
    :role="props.variant === 'dialog' ? 'dialog' : 'group'"
    :aria-modal="props.variant === 'dialog' ? 'true' : undefined"
    :aria-label="props.title"
  >
    <h3 class="session-rail-confirm__title">{{ props.title }}</h3>
    <p v-if="props.context" class="session-rail-confirm__context">会话：{{ props.context }}</p>
    <p
      v-for="line in props.detailLines"
      :key="line"
      class="session-rail-confirm__detail"
    >
      {{ line }}
    </p>
    <div class="session-rail-confirm__actions">
      <button ref="cancelButton" class="ghost-btn session-rail-confirm__cancel" type="button" @click="$emit('cancel')">
        取消
      </button>
      <button
        class="secondary-btn secondary-btn--danger session-rail-confirm__confirm"
        type="button"
        @click="$emit('confirm')"
      >
        {{ props.confirmLabel }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

const props = defineProps<{
  variant: 'inline' | 'dialog'
  title: string
  context?: string
  detailLines: readonly string[]
  confirmLabel: string
}>()

defineEmits<{
  (event: 'cancel'): void
  (event: 'confirm'): void
}>()

const cancelButton = ref<HTMLButtonElement | null>(null)

onMounted(() => {
  cancelButton.value?.focus()
})
</script>

<style scoped>
.session-rail-confirm {
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--line-subtle);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(12px);
}

.session-rail-confirm--dialog {
  padding: 18px;
  gap: 10px;
}

.session-rail-confirm__title {
  margin: 0;
  font-size: var(--font-dense);
  line-height: var(--line-dense);
}

.session-rail-confirm__context {
  margin: 0;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--surface-subtle);
  color: var(--text-primary);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.session-rail-confirm__detail {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.session-rail-confirm__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.session-rail-confirm__cancel,
.session-rail-confirm__confirm {
  padding-inline: 14px;
}
</style>
