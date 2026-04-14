<template>
  <div class="workspace-markdown-preview" v-html="html" />
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { renderMarkdownToHtml } from './markdownPreview'

const props = defineProps<{
  source: string
}>()

const html = computed(() => renderMarkdownToHtml(props.source))
</script>

<style scoped>
.workspace-markdown-preview {
  padding: 24px 28px;
  background: #fff;
  color: var(--text-primary);
  font-family: var(--font-family-ui);
  font-size: var(--font-body);
  line-height: 1.7;
}

.workspace-markdown-preview :deep(h1),
.workspace-markdown-preview :deep(h2),
.workspace-markdown-preview :deep(h3),
.workspace-markdown-preview :deep(h4),
.workspace-markdown-preview :deep(h5),
.workspace-markdown-preview :deep(h6) {
  margin: 0 0 12px;
  line-height: 1.3;
}

.workspace-markdown-preview :deep(h1) {
  font-size: var(--font-doc-h1);
  line-height: var(--line-page-title);
}

.workspace-markdown-preview :deep(h2) {
  font-size: var(--font-doc-h2);
  line-height: var(--line-section);
  margin-top: 24px;
}

.workspace-markdown-preview :deep(h3) {
  font-size: var(--font-doc-h3);
  line-height: var(--line-section);
  margin-top: 20px;
}

.workspace-markdown-preview :deep(p),
.workspace-markdown-preview :deep(ul),
.workspace-markdown-preview :deep(ol),
.workspace-markdown-preview :deep(blockquote),
.workspace-markdown-preview :deep(pre) {
  margin: 0 0 16px;
}

.workspace-markdown-preview :deep(p),
.workspace-markdown-preview :deep(li),
.workspace-markdown-preview :deep(blockquote) {
  font-size: var(--font-body);
  line-height: 1.7;
}

.workspace-markdown-preview :deep(ul),
.workspace-markdown-preview :deep(ol) {
  padding-left: 24px;
}

.workspace-markdown-preview :deep(li + li) {
  margin-top: 6px;
}

.workspace-markdown-preview :deep(blockquote) {
  padding: 10px 14px;
  border-left: 3px solid var(--accent-light);
  background: var(--surface-subtle);
  color: var(--text-secondary);
}

.workspace-markdown-preview :deep(code) {
  padding: 2px 6px;
  border-radius: 6px;
  background: #f3f5f8;
  font-family: var(--font-family-mono);
  font-size: var(--font-code-inline);
  line-height: var(--line-code-inline);
}

.workspace-markdown-preview :deep(pre) {
  overflow: auto;
  padding: 14px 16px;
  border-radius: 12px;
  background: #0f172a;
  color: #e2e8f0;
  font-family: var(--font-family-mono);
  font-size: var(--font-editor);
  line-height: var(--line-editor);
}

.workspace-markdown-preview :deep(pre code) {
  padding: 0;
  background: transparent;
  color: inherit;
}

.workspace-markdown-preview :deep(a) {
  color: var(--accent);
  text-decoration: underline;
}

.workspace-markdown-preview :deep(hr) {
  border: 0;
  border-top: 1px solid var(--line-subtle);
  margin: 20px 0;
}

.workspace-markdown-preview :deep(.markdown-table-scroll) {
  overflow-x: auto;
  max-width: 100%;
  margin: 0 0 16px;
}

.workspace-markdown-preview :deep(table) {
  border-collapse: collapse;
  width: 100%;
  font-size: var(--font-body);
}

.workspace-markdown-preview :deep(th),
.workspace-markdown-preview :deep(td) {
  border: 1px solid var(--line-subtle);
  padding: 8px 12px;
  text-align: left;
}

.workspace-markdown-preview :deep(th) {
  background: rgba(241, 245, 249, 0.92);
  font-weight: 600;
}

.workspace-markdown-preview :deep(tr:nth-child(even) td) {
  background: rgba(248, 250, 252, 0.7);
}

.workspace-markdown-preview :deep(del) {
  text-decoration: line-through;
  color: var(--text-secondary);
}
</style>
