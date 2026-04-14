<template>
  <aside class="workspace-context">
    <section class="workspace-context__section card-shell">
      <div class="workspace-context__section-head">
        <div class="workspace-context__agent-head">
          <span class="agent-identity__badge agent-identity__badge--context" aria-hidden="true">
            <span class="agent-glyph"></span>
          </span>
          <div>
            <p class="workspace-context__eyebrow panel-eyebrow">当前智能体</p>
            <h3>{{ agentTitle }}</h3>
          </div>
        </div>
        <button class="workspace-upload-btn" type="button" @click="$emit('upload-files')">
          {{ isUploading ? '上传中...' : '上传文件' }}
        </button>
      </div>
      <p class="workspace-context__copy">
        {{ agent?.presentation?.summary || agent?.description || '等待后端返回 agent 元数据。' }}
      </p>
      <div class="workspace-context__stats">
        <div>
          <span>模型</span>
          <strong>{{ agent?.runtime?.provider || 'unknown' }}/{{ agent?.runtime?.modelName || 'unknown' }}</strong>
        </div>
        <div>
          <span>工具数</span>
          <strong>{{ bootstrap?.gateway.tools.length || 0 }}</strong>
        </div>
      </div>
    </section>

    <section class="workspace-context__section card-shell">
      <p class="workspace-context__eyebrow panel-eyebrow">任务状态</p>
      <div class="workspace-context__status-list">
        <div>
          <span>会话</span>
          <strong>{{ activeSession?.title || '尚未创建' }}</strong>
        </div>
        <div>
          <span>状态</span>
          <strong>{{ conversationStatus }}</strong>
        </div>
        <div v-if="conversationPlanSummary">
          <span>计划摘要</span>
          <strong>{{ conversationPlanSummary }}</strong>
        </div>
      </div>
      <div v-if="latestAssistantMessage" class="workspace-context__summary">
        <p class="workspace-context__eyebrow panel-eyebrow">最近输出摘要</p>
        <p>{{ latestAssistantMessage.text }}</p>
      </div>
    </section>

    <section class="workspace-context__section card-shell">
      <div class="workspace-context__section-head">
        <div>
          <p class="workspace-context__eyebrow panel-eyebrow">工作区文件</p>
          <h3>{{ uploads.length }} 个文件</h3>
        </div>
      </div>
      <div v-if="uploads.length === 0" class="workspace-context__empty">
        上传后的文件会出现在这里，并作为当前任务上下文提供给智能体。
      </div>
      <ul v-else class="workspace-context__files">
        <li v-for="item in uploads" :key="item.fileKey">
          <strong>{{ item.fileName }}</strong>
          <span>{{ item.fileKey }}</span>
        </li>
      </ul>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AgentCatalogDetail, AgentSessionListItem, RuntimeBootstrapPayload, WorkspaceSidebarFileItem } from '@/api/types'
import type { UiMessage } from '@/stores/workbenchStore'

const props = defineProps<{
  agent: AgentCatalogDetail | null
  bootstrap: RuntimeBootstrapPayload | null
  activeSession: AgentSessionListItem | null
  conversationStatus: string
  conversationPlanSummary: string
  workspaceStatus?: string
  latestAssistantMessage: UiMessage | null
  uploads: WorkspaceSidebarFileItem[]
  isUploading: boolean
}>()

defineEmits<{
  (event: 'upload-files'): void
}>()

const agentTitle = computed(() => {
  return props.agent?.presentation?.title || props.agent?.name || '未加载'
})
</script>

<style scoped>
.workspace-context {
  width: 324px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border-left: 1px solid var(--line-subtle);
  background: var(--surface-panel);
}

.workspace-context__section {
  padding: 14px 16px;
}

.workspace-context__section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.workspace-context__agent-head {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.workspace-context__eyebrow {
  margin-bottom: 4px;
}

.workspace-context__section-head h3 {
  margin: 0;
  font-size: var(--font-title);
  line-height: var(--line-title);
}

.workspace-context__copy {
  margin: 12px 0 0;
  color: var(--text-tertiary);
  font-size: var(--font-body);
  line-height: var(--line-body);
}

.workspace-context__stats,
.workspace-context__status-list {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.workspace-context__stats div,
.workspace-context__status-list div {
  display: grid;
  gap: 4px;
}

.workspace-context__stats span,
.workspace-context__status-list span,
.workspace-context__files span {
  color: var(--text-muted);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.workspace-context__summary {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--line-subtle);
}

.workspace-context__summary p:last-child {
  margin: 0;
  font-size: var(--font-dense);
  line-height: var(--line-body);
  color: var(--text-secondary);
  white-space: pre-wrap;
}

.workspace-context__empty {
  margin-top: 14px;
  padding: 14px;
  border-radius: 14px;
  border: 1px dashed var(--line-subtle);
  color: var(--text-secondary);
  background: var(--surface-subtle);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.workspace-context__files {
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.workspace-context__files li {
  padding: 10px 12px;
  border-radius: 10px;
  background: linear-gradient(180deg, #fbfdff 0%, #f5f8fc 100%);
  border: 1px solid var(--line-subtle);
  display: grid;
  gap: 3px;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}

.workspace-context__files li:hover {
  background: var(--surface-accent);
  border-color: var(--accent-light);
  box-shadow: var(--shadow-sm);
}

.workspace-context__files strong {
  font-size: var(--font-dense);
  line-height: var(--line-dense);
}

@media (max-width: 1180px) {
  .workspace-context {
    width: 280px;
  }
}
</style>
