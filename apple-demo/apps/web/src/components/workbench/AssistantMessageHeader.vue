<template>
  <div
    class="assistant-message-header"
    :class="`assistant-message-header--${header.tone}`"
    v-bind="announcementAttributes"
  >
    <span class="assistant-message-header__dot" aria-hidden="true"></span>
    <span class="assistant-message-header__label">{{ header.label }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { UiAssistantHeader } from '@/stores/workbenchStore'

const props = defineProps<{
  header: UiAssistantHeader
}>()

const announcementAttributes = computed(() => {
  if (props.header.liveMode === 'assertive') {
    return {
      role: 'alert',
      'aria-live': 'assertive',
      'aria-atomic': 'true'
    } as const
  }
  if (props.header.liveMode === 'polite') {
    return {
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': 'true'
    } as const
  }
  return {}
})
</script>

<style scoped>
.assistant-message-header {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  inline-size: fit-content;
  max-inline-size: 100%;
  gap: 0.45rem;
  margin-bottom: 0.55rem;
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(241, 245, 249, 0.92);
  color: rgba(15, 23, 42, 0.72);
  font-size: 0.76rem;
  font-weight: 600;
  line-height: 1;
}

.assistant-message-header__label {
  white-space: nowrap;
}

.assistant-message-header__dot {
  inline-size: 0.42rem;
  block-size: 0.42rem;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.7;
}

.assistant-message-header--progress {
  color: rgba(30, 64, 175, 0.8);
  background: rgba(239, 246, 255, 0.96);
  border-color: rgba(96, 165, 250, 0.28);
}

.assistant-message-header--progress .assistant-message-header__dot {
  animation: assistant-message-header-progress-pulse 1.4s ease-in-out infinite;
}

.assistant-message-header--progress .assistant-message-header__label {
  animation: assistant-message-header-progress-breathe 1.8s ease-in-out infinite;
}

.assistant-message-header--summary {
  color: rgba(15, 23, 42, 0.7);
}

.assistant-message-header--error {
  color: rgba(185, 28, 28, 0.82);
  background: rgba(254, 242, 242, 0.96);
  border-color: rgba(248, 113, 113, 0.26);
}

@keyframes assistant-message-header-progress-pulse {
  0%,
  100% {
    opacity: 0.45;
    transform: scale(0.88);
  }

  50% {
    opacity: 1;
    transform: scale(1.12);
  }
}

@keyframes assistant-message-header-progress-breathe {
  0%,
  100% {
    opacity: 0.72;
  }

  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .assistant-message-header--progress .assistant-message-header__dot,
  .assistant-message-header--progress .assistant-message-header__label {
    animation: none;
  }
}
</style>
