<template>
  <div class="assistant-process-group">
    <AssistantTextMessage
      :message="mainMessage"
      :timestamp="formatTime(mainMessage.createdAt)"
      @toggle-view="$emit('toggle-view', mainMessage.id)"
    />

    <details class="assistant-process-group__details">
      <summary class="assistant-process-group__summary">
        查看过程（{{ collapsedSteps.length }}）
      </summary>
      <div class="assistant-process-group__steps">
        <div
          v-for="step in collapsedSteps"
          :key="step.id"
          class="assistant-process-group__step"
        >
          <template v-if="step.kind === 'tool-step'">
            <div
              v-for="(displayName, index) in step.toolDisplayNames"
              :key="`${step.id}-${index}`"
              class="assistant-process-group__tool-line"
            >
              ○ {{ displayName }}
            </div>
          </template>
          <AssistantTextMessage
            v-else
            :message="step"
            :timestamp="formatTime(step.createdAt)"
            @toggle-view="$emit('toggle-view', step.id)"
          />
        </div>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import AssistantTextMessage from './AssistantTextMessage.vue'
import type { AssistantProcessDisplayItem } from './conversationDisplay'

defineProps<{
  mainMessage: AssistantProcessDisplayItem['mainMessage']
  collapsedSteps: AssistantProcessDisplayItem['collapsedSteps']
  formatTime: (value: number) => string
}>()

defineEmits<{
  (event: 'toggle-view', messageId: string): void
}>()
</script>

<style scoped>
.assistant-process-group {
  display: grid;
  gap: 12px;
}

.assistant-process-group__details {
  display: grid;
  gap: 12px;
}

.assistant-process-group__summary {
  cursor: pointer;
  color: var(--text-secondary);
  font-size: var(--font-meta);
  list-style: none;
}

.assistant-process-group__summary::-webkit-details-marker {
  display: none;
}

.assistant-process-group__steps {
  display: grid;
  gap: 12px;
  padding-top: 4px;
}

.assistant-process-group__step {
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.04);
}

.assistant-process-group__tool-line {
  color: var(--text-secondary);
  font-size: var(--font-body);
  line-height: 1.6;
}
</style>
