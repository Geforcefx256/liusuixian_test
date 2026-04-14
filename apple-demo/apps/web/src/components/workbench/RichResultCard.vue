<template>
  <div class="rich-result-card">
    <template v-if="message.result.kind === 'notice'">
      <p class="rich-result-card__notice">{{ message.result.data.message }}</p>
    </template>

    <template v-else-if="isTabularResult">
      <div class="rich-result-card__head">
        <div>
          <p class="rich-result-card__eyebrow">结构化结果</p>
          <strong>{{ resultTitle }}</strong>
        </div>
        <span class="rich-result-card__count">{{ rows.length }} 行</span>
      </div>
      <div class="rich-result-card__table-wrap">
        <table class="rich-result-card__table">
          <thead>
            <tr>
              <th v-for="column in columns" :key="column">{{ column }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in previewRows" :key="index">
              <td v-for="column in columns" :key="column">{{ stringifyCell(row[column]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="rows.length > previewRows.length" class="rich-result-card__meta">
        仅展示前 {{ previewRows.length }} 行。
      </p>
    </template>

    <template v-else-if="message.result.kind === 'artifact_ref'">
      <div class="rich-result-card__head">
        <div>
          <p class="rich-result-card__eyebrow">产物引用</p>
          <strong>{{ artifactTitle }}</strong>
        </div>
        <button
          v-if="artifactOpenFileId"
          class="rich-result-card__action"
          type="button"
          @click="$emit('open-file', artifactOpenFileId)"
        >
          打开文件
        </button>
      </div>
      <dl class="rich-result-card__kv">
        <div v-for="entry in artifactEntries" :key="entry.key" class="rich-result-card__kv-row">
          <dt>{{ entry.key }}</dt>
          <dd>{{ entry.value }}</dd>
        </div>
      </dl>
    </template>

    <template v-else>
      <p class="rich-result-card__meta">暂未支持该结果类型，已保留原始输出。</p>
      <pre class="rich-result-card__raw">{{ formattedRaw }}</pre>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { UiResultMessage } from '@/stores/workbenchStore'

const props = defineProps<{
  message: UiResultMessage
}>()

defineEmits<{
  (event: 'open-file', fileId: string): void
}>()

const tabularResult = computed(() => {
  if (props.message.result.kind === 'rows_result' || props.message.result.kind === 'sheet_snapshot') {
    return props.message.result
  }
  return null
})

const isTabularResult = computed(() => tabularResult.value !== null)

const columns = computed(() => tabularResult.value?.data.columns || [])

const rows = computed(() => tabularResult.value?.data.rows || [])

const previewRows = computed(() => rows.value.slice(0, 5))

const resultTitle = computed(() => {
  if (props.message.result.kind === 'sheet_snapshot') {
    return props.message.result.data.sheetName
  }
  return '表格预览'
})

const artifactEntries = computed(() => {
  if (props.message.result.kind !== 'artifact_ref') return []
  return Object.entries(props.message.result.data).map(([key, value]) => ({
    key,
    value: stringifyCell(value)
  }))
})

const artifactTitle = computed(() => {
  if (props.message.result.kind !== 'artifact_ref') return '产物'
  const fileName = props.message.result.data.fileName
  if (typeof fileName === 'string' && fileName.trim()) return fileName
  const path = props.message.result.data.path
  if (typeof path === 'string' && path.trim()) return path
  const fileId = props.message.result.data.fileId
  return typeof fileId === 'string' && fileId.trim() ? fileId : '运行产物'
})

const artifactOpenFileId = computed(() => {
  if (props.message.result.kind !== 'artifact_ref') return ''
  const fileKey = props.message.result.data.fileKey
  if (typeof fileKey === 'string' && fileKey.trim()) return fileKey
  const fileId = props.message.result.data.fileId
  return typeof fileId === 'string' ? fileId : ''
})

const formattedRaw = computed(() => JSON.stringify(props.message.result, null, 2))

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
</script>

<style scoped>
.rich-result-card {
  display: grid;
  gap: 12px;
}

.rich-result-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.rich-result-card__eyebrow,
.rich-result-card__meta {
  margin: 0;
  color: var(--text-secondary);
}

.rich-result-card__eyebrow {
  font-size: var(--font-overline);
  font-weight: 700;
  line-height: var(--line-overline);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.rich-result-card__count {
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--surface-subtle);
  color: var(--text-secondary);
  font-size: var(--font-table-meta);
  line-height: var(--line-meta);
}

.rich-result-card__table-wrap {
  overflow: auto;
  border: 1px solid var(--line-subtle);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.82);
}

.rich-result-card__action {
  border: 1px solid var(--accent-light);
  border-radius: 999px;
  background: var(--accent-lighter);
  color: var(--accent);
  padding: 6px 12px;
  font-size: var(--font-meta);
  font-weight: 600;
  line-height: var(--line-meta);
}

.rich-result-card__table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-family-ui);
  font-size: var(--font-table);
  line-height: var(--line-table);
}

.rich-result-card__table th,
.rich-result-card__table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--line-subtle);
  text-align: left;
  vertical-align: top;
}

.rich-result-card__table th {
  font-weight: 700;
  background: rgba(246, 248, 251, 0.96);
  font-size: var(--font-table-meta);
  line-height: var(--line-meta);
}

.rich-result-card__kv {
  margin: 0;
  display: grid;
  gap: 8px;
}

.rich-result-card__kv-row {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid var(--line-subtle);
}

.rich-result-card__kv-row dt {
  color: var(--text-muted);
  font-size: var(--font-table-meta);
  line-height: var(--line-meta);
}

.rich-result-card__kv-row dd,
.rich-result-card__notice {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.rich-result-card__raw {
  margin: 0;
  padding: 12px;
  border-radius: 12px;
  background: var(--surface-subtle);
  color: var(--text-secondary);
  overflow: auto;
  font-family: var(--font-family-mono);
  font-size: var(--font-code-inline);
  line-height: var(--line-code-inline);
}
</style>
