<template>
  <div class="assistant-text-message">
    <div class="assistant-text-message__meta">
      <small>{{ timestamp }}</small>
      <button
        v-if="showToggle"
        class="assistant-text-message__toggle"
        type="button"
        @click="$emit('toggle-view')"
      >
        {{ toggleLabel }}
      </button>
    </div>
    <div
      v-if="showReadingMode"
      class="assistant-text-message__reading"
      v-html="html"
    />
    <p v-else class="assistant-text-message__raw">{{ bodyText }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { UiTextMessage } from '@/stores/workbenchStore'
import { renderMarkdownToHtml } from './markdownPreview'

const props = defineProps<{
  message: UiTextMessage
  timestamp: string
}>()

defineEmits<{
  (event: 'toggle-view'): void
}>()

const bodyText = computed(() => {
  return props.message.text || (props.message.status === 'streaming' ? '正在生成内容...' : '')
})

const showReadingMode = computed(() => {
  return props.message.readingModeEligible
    && props.message.displayMode === 'reading'
    && props.message.status === 'done'
})

const showToggle = computed(() => {
  return props.message.readingModeEligible && props.message.status === 'done'
})

const toggleLabel = computed(() => {
  return props.message.displayMode === 'reading' ? '原文' : '阅读'
})

const html = computed(() => renderMarkdownToHtml(bodyText.value))
</script>

<style scoped>
.assistant-text-message {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.assistant-text-message__raw {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: inherit;
}

.assistant-text-message__reading {
  min-width: 0;
  max-width: 100%;
  color: var(--text-primary);
  font-size: var(--font-body);
  line-height: 1.55;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.assistant-text-message__reading :deep(h1),
.assistant-text-message__reading :deep(h2),
.assistant-text-message__reading :deep(h3),
.assistant-text-message__reading :deep(h4),
.assistant-text-message__reading :deep(h5),
.assistant-text-message__reading :deep(h6) {
  margin: 0 0 6px;
  color: var(--text-primary);
  line-height: 1.35;
}

.assistant-text-message__reading :deep(h1) {
  font-size: calc(var(--font-title) + 0.12rem);
}

.assistant-text-message__reading :deep(h2) {
  font-size: var(--font-title);
  margin-top: 10px;
}

.assistant-text-message__reading :deep(h3) {
  font-size: var(--font-dense);
  margin-top: 8px;
}

.assistant-text-message__reading :deep(p),
.assistant-text-message__reading :deep(li),
.assistant-text-message__reading :deep(ul),
.assistant-text-message__reading :deep(ol),
.assistant-text-message__reading :deep(blockquote),
.assistant-text-message__reading :deep(pre) {
  margin: 0 0 8px;
  max-width: 100%;
  white-space: normal;
}

.assistant-text-message__reading :deep(ul),
.assistant-text-message__reading :deep(ol) {
  padding-left: 22px;
}

.assistant-text-message__reading :deep(li + li) {
  margin-top: 4px;
}

.assistant-text-message__reading :deep(blockquote) {
  padding: 10px 14px;
  border-left: 3px solid var(--accent-light);
  border-radius: 0 12px 12px 0;
  background: rgba(241, 245, 249, 0.92);
  color: var(--text-secondary);
}

.assistant-text-message__reading :deep(a) {
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.assistant-text-message__reading :deep(code) {
  padding: 2px 5px;
  border-radius: 6px;
  max-width: 100%;
  font-family: var(--font-family-mono);
  overflow-wrap: anywhere;
  word-break: break-word;
  background: rgba(226, 232, 240, 0.82);
  font-size: var(--font-code-inline);
  line-height: var(--line-code-inline);
}

.assistant-text-message__reading :deep(pre) {
  overflow-wrap: normal;
  word-break: normal;
  overflow: auto;
  padding: 14px 16px;
  border-radius: 12px;
  background: #0f172a;
  color: #e2e8f0;
  font-family: var(--font-family-mono);
  font-size: var(--font-editor);
  line-height: var(--line-editor);
}

.assistant-text-message__reading :deep(pre code) {
  padding: 0;
  background: transparent;
  color: inherit;
}

.assistant-text-message__reading :deep(a) {
  color: var(--accent);
  text-decoration: underline;
}

.assistant-text-message__reading :deep(hr) {
  border: 0;
  border-top: 1px solid var(--line-subtle);
  margin: 10px 0;
}

.assistant-text-message__reading :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0 0 8px;
  font-size: var(--font-body);
}

.assistant-text-message__reading :deep(th),
.assistant-text-message__reading :deep(td) {
  border: 1px solid var(--line-subtle);
  padding: 6px 10px;
  text-align: left;
}

.assistant-text-message__reading :deep(th) {
  background: rgba(241, 245, 249, 0.92);
  font-weight: 600;
}

.assistant-text-message__reading :deep(tr:nth-child(even) td) {
  background: rgba(248, 250, 252, 0.7);
}

.assistant-text-message__reading :deep(.markdown-table-scroll) {
  overflow-x: auto;
  max-width: 100%;
  margin: 0 0 8px;
}

.assistant-text-message__reading :deep(del) {
  text-decoration: line-through;
  color: var(--text-secondary);
}

.assistant-text-message__meta {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 10px;
  color: var(--text-secondary);
}

.assistant-text-message__toggle {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: var(--font-meta);
  line-height: var(--line-meta);
  cursor: pointer;
  opacity: 0.82;
}

.assistant-text-message__toggle:hover {
  color: var(--text-primary);
  opacity: 1;
}

.assistant-text-message__meta small {
  margin: 0;
}
</style>
