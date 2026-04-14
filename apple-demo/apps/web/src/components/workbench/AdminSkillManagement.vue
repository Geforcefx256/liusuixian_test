<template>
  <section class="admin-skills">
    <header class="admin-skills__hero card-shell">
      <div>
        <p class="panel-eyebrow">技能治理</p>
        <h1>管理标准 Skill 的展示与绑定策略</h1>
        <p>
          这里负责上传标准 skill ZIP、治理统一的用户可见名称与描述、管理草稿 / 已发布生命周期，以及控制 agent 的可加载范围。
          终端用户只消费治理后的名称与描述，不会看到原始 `SKILL.md` 内容。
        </p>
      </div>
      <div class="admin-skills__hero-actions">
        <button class="secondary-btn" type="button" :disabled="isLoading" @click="load">
          刷新列表
        </button>
        <input
          ref="uploadInput"
          class="admin-skills__upload-input"
          type="file"
          accept=".zip,application/zip"
          @change="handleUploadSelection"
        >
        <button class="primary-btn" type="button" :disabled="isUploading" @click="triggerUpload">
          {{ isUploading ? '上传中...' : '上传 Skill ZIP' }}
        </button>
      </div>
    </header>

    <p v-if="error" class="admin-skills__error">{{ error }}</p>
    <section v-if="uploadConflict" class="admin-skills__notice admin-skills__notice--warning">
      <div>
        <strong>发现 canonical skill 冲突：{{ uploadConflict.skillId }}</strong>
        <p>
          本次上传与现有 {{ uploadConflictFieldLabel }} 冲突。当前标准名称为 {{ uploadConflict.canonicalName }}，
          生命周期为 {{ formatLifecycleLabel(uploadConflict.lifecycle) }}，已绑定 {{ uploadConflict.boundAgents.length }} 个 Agent。
        </p>
        <p>{{ uploadConflictActionMessage }}</p>
      </div>
      <div class="admin-skills__notice-actions">
        <button class="secondary-btn" type="button" :disabled="!pendingUploadFile || isUploading" @click="cancelOverwrite">
          取消
        </button>
        <button
          v-if="isOverwriteUploadConflict"
          class="primary-btn"
          type="button"
          :disabled="!pendingUploadFile || isUploading"
          @click="confirmOverwrite"
        >
          {{ isUploading ? '覆盖中...' : '确认覆盖' }}
        </button>
      </div>
    </section>
    <section v-if="uploadIssues.length" class="admin-skills__notice">
      <div>
        <strong>上传校验失败</strong>
        <ul class="admin-skills__issue-list">
          <li v-for="issue in uploadIssues" :key="`${issue.code}-${issue.path || ''}-${issue.field || ''}-${issue.message}`">
            <span>{{ issue.message }}</span>
            <small v-if="issue.path || issue.field">
              {{ issue.path || 'SKILL.md' }}{{ issue.field ? ` · ${issue.field}` : '' }}
            </small>
          </li>
        </ul>
      </div>
    </section>

    <div class="admin-skills__layout">
      <aside class="admin-skills__list card-shell">
        <div class="admin-skills__summary-rail">
          <div class="admin-skills__summary-head">
            <p class="panel-eyebrow">治理概览</p>
            <h2>{{ summaryRailTitle }}</h2>
            <p class="admin-skills__summary-note">{{ summaryRailDescription }}</p>
          </div>

          <div v-if="skills.length" class="admin-skills__items admin-skills__items--summary">
            <button
              v-for="skill in skills"
              :key="skill.skillId"
              class="admin-skills__item admin-skills__item--summary"
              :class="{ 'admin-skills__item--active': skill.skillId === selectedSkillId }"
              :aria-pressed="skill.skillId === selectedSkillId"
              type="button"
              @click="selectedSkillId = skill.skillId"
            >
              <div class="admin-skills__item-head">
                <strong>{{ resolveSummaryCardTitle(skill) }}</strong>
                <span :class="['status-pill', skill.lifecycle === 'published' ? 'status-pill--success' : 'status-pill--warning']">
                  {{ formatLifecycleLabel(skill.lifecycle) }}
                </span>
              </div>
              <div class="admin-skills__item-meta">
                <small>Starter · {{ formatStarterEnabledLabel(skill.starterEnabled) }}</small>
                <small v-if="skill.starterEnabled">意图分组 · {{ formatIntentGroup(skill.intentGroup) }}</small>
              </div>
            </button>
          </div>
          <div v-else class="admin-skills__empty">
            当前还没有已纳管的 skill。
          </div>
        </div>
      </aside>

      <section class="admin-skills__detail card-shell">
        <div v-if="selectedSkill && form" class="admin-skills__detail-body">
          <section v-if="overwriteResetMessage" class="admin-skills__notice admin-skills__notice--warning">
            <div>
              <strong>覆盖已重置治理状态</strong>
              <p>{{ overwriteResetMessage }}</p>
            </div>
          </section>
            <div class="admin-skills__detail-head">
              <div>
                <p class="panel-eyebrow">治理详情</p>
                <h2>{{ detailDisplayName }}</h2>
              </div>
              <span class="status-pill">{{ selectedSkill.skillId }}</span>
            </div>

          <div class="admin-skills__canonical">
            <div>
              <span>标准 Skill</span>
              <strong>{{ selectedSkill.canonicalName }}</strong>
            </div>
            <div>
              <span>技能来源</span>
              <strong>{{ selectedSkill.sourceAgentId }}</strong>
            </div>
            <div>
              <span>导入时间</span>
              <strong>{{ formatTime(selectedSkill.importedAt) }}</strong>
            </div>
            <div>
              <span>最近更新</span>
              <strong>{{ formatTime(selectedSkill.updatedAt) }}</strong>
            </div>
          </div>

          <section class="admin-skills__section">
            <div class="admin-skills__section-head">
              <div>
                <p class="panel-eyebrow">基础信息</p>
                <h3>统一治理名称、说明与生命周期</h3>
              </div>
            </div>

            <div class="admin-skills__row">
              <label class="admin-skills__field">
                <span>用户可见名称</span>
                <input v-model="form.displayName" type="text" placeholder="例如：DPI 规划入口">
              </label>

              <label class="admin-skills__field">
                <span>生命周期</span>
                <select v-model="form.lifecycle">
                  <option value="draft">草稿</option>
                  <option value="published">已发布</option>
                </select>
              </label>
            </div>

            <ul v-if="displayNameIssues.length" class="admin-skills__field-issues">
              <li v-for="issue in displayNameIssues" :key="issue">{{ issue }}</li>
            </ul>

            <label class="admin-skills__field">
              <span>用户可见描述</span>
              <textarea v-model="form.displayDescription" rows="4"></textarea>
            </label>

            <div v-if="publishBlockers.length" class="admin-skills__notice admin-skills__notice--warning">
              <div>
                <strong>发布前还需要完成以下治理项</strong>
                <ul class="admin-skills__issue-list">
                  <li v-for="blocker in publishBlockers" :key="blocker">{{ blocker }}</li>
                </ul>
              </div>
            </div>
          </section>

          <section class="admin-skills__section admin-skills__section--starter">
            <div class="admin-skills__section-head">
              <div>
                <p class="panel-eyebrow">首页卡片治理</p>
                <h3>Starter 摘要与预览</h3>
              </div>
            </div>

            <div class="admin-skills__starter-controls">
              <label class="admin-skills__toggle">
                <input v-model="form.starterEnabled" type="checkbox">
                <span>作为首页代表 starter</span>
              </label>
              <label class="admin-skills__field admin-skills__field--intent">
                <span>意图分组</span>
                <select v-model="intentGroupValue">
                  <option value="">未分组</option>
                  <option value="planning">方案制作</option>
                  <option value="configuration-authoring">配置生成</option>
                  <option value="verification">配置核查</option>
                </select>
              </label>
              <label class="admin-skills__field admin-skills__field--compact">
                <span>Starter 优先级</span>
                <input v-model.number="form.starterPriority" type="number" min="0" step="10">
              </label>
            </div>

            <label class="admin-skills__field">
              <span>快速开始摘要</span>
              <textarea
                v-model="form.starterSummary"
                rows="3"
                placeholder="例如：根据业务场景描述，生成 SMF / UPF DPI 配置草案"
              ></textarea>
            </label>
            <p
              class="admin-skills__field-hint"
              :class="{ 'admin-skills__field-hint--warning': starterSummaryHintTone === 'warning' }"
            >
              {{ starterSummaryHint }}
            </p>
            <p v-if="form.invalidIntentGroup" class="admin-skills__field-hint admin-skills__field-hint--warning">
              历史意图分组“{{ form.invalidIntentGroup }}”已失效，当前按“未分组”处理；如需继续作为首页 starter，请重新选择有效分组后保存。
            </p>

            <div class="admin-skills__starter-preview">
              <div class="admin-skills__starter-preview-head">
                <span>卡片预览</span>
                <small>{{ form.starterEnabled ? '启用后将按此方式展示在首页快速开始中' : '当前未启用 starter，预览仅用于治理参考' }}</small>
              </div>
              <div
                class="admin-skills__starter-preview-card"
                :class="{ 'admin-skills__starter-preview-card--muted': !form.starterEnabled }"
              >
                <div class="admin-skills__starter-preview-card-head">
                  <strong>{{ starterPreviewDisplayName }}</strong>
                  <span
                    v-if="form.starterEnabled"
                    class="status-pill status-pill--success"
                  >
                    {{ formatIntentGroup(form.intentGroup || undefined) }}
                  </span>
                </div>
                <p class="admin-skills__starter-preview-card-summary">{{ starterPreviewSummary }}</p>
                <div class="admin-skills__starter-preview-card-actions">
                  <button class="primary-btn" type="button" disabled>开始生成</button>
                  <button class="admin-skills__preview-link" type="button" disabled>查看说明</button>
                </div>
              </div>
            </div>
          </section>

          <div class="admin-skills__bindings">
            <div class="admin-skills__bindings-head">
              <span>Agent 绑定范围</span>
              <small>决定哪些 agent 能在运行时看到并加载此 skill。所有已绑定 agent 将共享同一治理名称与描述。</small>
            </div>
            <p v-if="governanceSummary" class="admin-skills__governance-summary">{{ governanceSummary }}</p>
            <div v-if="agents.length" class="admin-skills__binding-list">
              <label
                v-for="agent in agents"
                :key="agent.id"
                class="admin-skills__binding-item"
              >
                <div class="admin-skills__binding-toggle">
                  <input
                    :checked="hasBinding(agent.id)"
                    type="checkbox"
                    @change="toggleBinding(agent.id, ($event.target as HTMLInputElement).checked)"
                  >
                </div>
                <div>
                  <strong>{{ agent.name }}</strong>
                  <small>{{ agent.id }}</small>
                </div>
              </label>
            </div>
            <div v-else class="admin-skills__empty">
              当前没有可绑定的 agent。
            </div>
          </div>

          <div class="admin-skills__actions">
            <button
              class="danger-btn"
              type="button"
              :disabled="isDeleting"
              @click="toggleDeleteConfirmation"
            >
              {{ deleteConfirmSkillId === selectedSkill.skillId ? (isDeleting ? '删除中...' : '确认删除 Skill') : '删除 Skill' }}
            </button>
            <button
              v-if="deleteConfirmSkillId === selectedSkill.skillId"
              class="secondary-btn"
              type="button"
              :disabled="isDeleting"
              @click="cancelDelete"
            >
              取消删除
            </button>
            <button class="secondary-btn" type="button" @click="resetForm">重置</button>
            <button class="primary-btn" type="button" :disabled="isSaving || hasBlockingValidation" @click="save">
              {{ isSaving ? '保存中...' : '保存治理策略' }}
            </button>
          </div>
        </div>

        <div v-else class="admin-skills__empty admin-skills__empty--detail">
          还没有可管理的 skill。先执行一次导入同步。
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { agentApi } from '@/api/agentApi'
import type {
  AgentCatalogSummary,
  ManagedSkillAgentBinding,
  ManagedSkillIntentGroup,
  ManagedSkillLifecycle,
  ManagedSkillRecord,
  ManagedSkillUpdateRequest,
  SkillUploadConflict,
  SkillUploadValidationIssue
} from '@/api/types'
import { useWorkbenchStore } from '@/stores/workbenchStore'
import { resolveManagedSkillIntentGroupState } from './adminSkillIntentGroup'

interface ManagedSkillForm {
  displayName: string
  displayDescription: string
  starterSummary: string
  lifecycle: ManagedSkillLifecycle
  intentGroup: ManagedSkillIntentGroup | null
  invalidIntentGroup: string | null
  starterEnabled: boolean
  starterPriority: number
  agentBindings: ManagedSkillAgentBinding[]
}

const EMPTY_SUMMARY_CARD_TITLE = '待填写用户可见名称'

const skills = ref<ManagedSkillRecord[]>([])
const agents = ref<AgentCatalogSummary[]>([])
const selectedSkillId = ref('')
const error = ref<string | null>(null)
const isLoading = ref(false)
const isUploading = ref(false)
const isDeleting = ref(false)
const isSaving = ref(false)
const form = ref<ManagedSkillForm | null>(null)
const uploadInput = ref<HTMLInputElement | null>(null)
const pendingUploadFile = ref<File | null>(null)
const uploadConflict = ref<SkillUploadConflict | null>(null)
const uploadIssues = ref<SkillUploadValidationIssue[]>([])
const deleteConfirmSkillId = ref<string | null>(null)
const overwriteResetMessage = ref<string | null>(null)
const workbenchStore = useWorkbenchStore()
const isOverwriteUploadConflict = computed(() => uploadConflict.value?.reason === 'id')
const uploadConflictFieldLabel = computed(() => {
  return uploadConflict.value?.reason === 'name' ? 'canonical name' : 'canonical id'
})
const uploadConflictActionMessage = computed(() => {
  if (!uploadConflict.value) return ''
  if (uploadConflict.value.reason === 'id') {
    return '这是同一 canonical id 的覆盖冲突，确认后会替换当前纳管包并重置治理状态。'
  }
  return 'canonical name 冲突不支持覆盖，请调整上传包中的 canonical id 或 canonical name 后重试。'
})

const selectedSkill = computed(() => {
  if (!skills.value.length) return null
  return skills.value.find(skill => skill.skillId === selectedSkillId.value) || skills.value[0]
})

const summaryRailTitle = computed(() => {
  return skills.value.length > 1 ? '选择要治理的 Skill' : '当前治理状态'
})
const summaryRailDescription = computed(() => {
  if (skills.value.length > 1) {
    return '通过左侧摘要卡切换当前治理对象。'
  }
  return '左侧仅展示当前 Skill 的核心治理状态。'
})
const detailDisplayName = computed(() => {
  if (!selectedSkill.value || !form.value) return ''
  const displayName = form.value.displayName.trim()
  if (displayName) return displayName
  return selectedSkill.value.displayName || selectedSkill.value.canonicalName || selectedSkill.value.skillId
})
const displayNameIssues = computed(() => {
  const skill = selectedSkill.value
  if (!skill || !form.value) return []
  return buildDisplayNameIssues(skill, form.value.displayName, form.value.agentBindings, skills.value)
})
const publishBlockers = computed(() => {
  const skill = selectedSkill.value
  if (!skill || !form.value) return []
  return buildPublishBlockers(skill, form.value, skills.value)
})
const hasBlockingValidation = computed(() => {
  if (!selectedSkill.value || !form.value) return false
  if (displayNameIssues.value.includes('与其他 Skill 在同一 Agent 下重名')) {
    return true
  }
  return form.value.lifecycle === 'published' && publishBlockers.value.length > 0
})
const governanceSummary = computed(() => {
  if (!selectedSkill.value || !form.value) return ''
  const bindingCount = form.value.agentBindings.length
  if (displayNameIssues.value.includes('与其他 Skill 在同一 Agent 下重名')) {
    return '当前存在同一 Agent 下的重名冲突，保存前必须先解决。'
  }
  if (form.value.lifecycle === 'published' && publishBlockers.value.length > 0) {
    return '当前未满足发布条件，Skill 必须保持草稿。'
  }
  if (publishBlockers.value.length > 0) {
    return `发布前还缺少 ${publishBlockers.value.length} 项治理条件。`
  }
  if (bindingCount === 0) {
    return '当前未绑定任何 Agent，该 Skill 不会进入任何治理运行面。'
  }
  if (form.value.lifecycle === 'draft') {
    return `已绑定 ${bindingCount} 个 Agent，完成治理后可发布。`
  }
  return `已发布到 ${bindingCount} 个 Agent，将共享同一治理名称与描述。`
})
const starterSummaryHint = computed(() => {
  if (!form.value || !selectedSkill.value) return ''
  const summary = form.value.starterSummary.trim()
  if (summary.length > 60) {
    return '快速开始摘要建议控制在 60 个字以内，卡片展示会限制为 2 行。'
  }
  if (form.value.starterEnabled && !summary) {
    return '未填写快速开始摘要时，首页卡片将回退到用户可见描述。'
  }
  return '建议 20-40 个字，只描述“输入什么，产出什么”。'
})
const starterSummaryHintTone = computed<'info' | 'warning'>(() => {
  if (!form.value) return 'info'
  if (form.value.starterSummary.trim().length > 60) return 'warning'
  if (form.value.starterEnabled && !form.value.starterSummary.trim()) return 'warning'
  return 'info'
})
const starterPreviewDisplayName = computed(() => {
  return detailDisplayName.value
})
const starterPreviewSummary = computed(() => {
  if (!selectedSkill.value || !form.value) return ''
  return resolveStarterSummary({
    starterSummary: form.value.starterSummary,
    displayDescription: form.value.displayDescription,
    canonicalDescription: selectedSkill.value.canonicalDescription,
    inputExample: selectedSkill.value.inputExample
  })
})
const intentGroupValue = computed({
  get: () => form.value?.intentGroup || '',
  set: (value: string) => {
    if (!form.value) return
    form.value.intentGroup = value
      ? (value as ManagedSkillIntentGroup)
      : null
  }
})

watch(selectedSkill, skill => {
  if (!skill) {
    form.value = null
    return
  }
  if (selectedSkillId.value !== skill.skillId) {
    selectedSkillId.value = skill.skillId
  }
  form.value = createManagedSkillForm(skill)
}, { immediate: true })

onMounted(() => {
  void load()
})

async function load(): Promise<void> {
  isLoading.value = true
  error.value = null
  pendingUploadFile.value = null
  uploadConflict.value = null
  uploadIssues.value = []
  overwriteResetMessage.value = null
  try {
    const payload = await agentApi.listManagedSkills()
    skills.value = payload.skills
    agents.value = payload.agents
    if (!selectedSkillId.value && payload.skills.length) {
      selectedSkillId.value = payload.skills[0].skillId
    }
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    isLoading.value = false
  }
}

function triggerUpload(): void {
  uploadInput.value?.click()
}

async function handleUploadSelection(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0]
  if (!file) {
    return
  }
  await uploadSkill(file, false)
  if (target) {
    target.value = ''
  }
}

async function uploadSkill(file: File, overwrite: boolean): Promise<void> {
  isUploading.value = true
  error.value = null
  uploadIssues.value = []
  try {
    const result = await agentApi.uploadManagedSkill(file, overwrite)
    pendingUploadFile.value = null
    uploadConflict.value = null
    deleteConfirmSkillId.value = null
    await load()
    selectedSkillId.value = result.skill.skillId
    overwriteResetMessage.value = result.replaced
      ? `该 Skill 已被新包覆盖，生命周期已重置为草稿，用户可见名称、用户可见描述、Starter 元数据和 Agent 绑定均已清空，需要重新治理后才能发布。`
      : null
    await workbenchStore.refreshActiveAgentGovernance()
  } catch (err) {
    const uploadError = err as Error & {
      code?: string
      conflict?: SkillUploadConflict
      issues?: SkillUploadValidationIssue[]
    }
    if (uploadError.code === 'SKILL_UPLOAD_CONFLICT' && uploadError.conflict) {
      pendingUploadFile.value = file
      uploadConflict.value = uploadError.conflict
      error.value = null
      return
    }
    if (uploadError.code === 'SKILL_UPLOAD_INVALID' && Array.isArray(uploadError.issues)) {
      pendingUploadFile.value = null
      uploadConflict.value = null
      uploadIssues.value = uploadError.issues
      error.value = null
      return
    }
    error.value = uploadError.message
  } finally {
    isUploading.value = false
  }
}

async function confirmOverwrite(): Promise<void> {
  if (!pendingUploadFile.value) return
  await uploadSkill(pendingUploadFile.value, true)
}

function cancelOverwrite(): void {
  pendingUploadFile.value = null
  uploadConflict.value = null
  uploadIssues.value = []
}

function resetForm(): void {
  const skill = selectedSkill.value
  if (!skill) return
  form.value = createManagedSkillForm(skill)
  deleteConfirmSkillId.value = null
}

function toggleBinding(agentId: string, checked: boolean): void {
  if (!form.value) return
  if (checked) {
    if (hasBinding(agentId)) return
    form.value.agentBindings = [
      ...form.value.agentBindings,
      { agentId }
    ]
    return
  }
  form.value.agentBindings = form.value.agentBindings.filter(binding => binding.agentId !== agentId)
}

function hasBinding(agentId: string): boolean {
  return Boolean(form.value?.agentBindings.some(binding => binding.agentId === agentId))
}

async function save(): Promise<void> {
  if (!selectedSkill.value || !form.value) return
  if (hasBlockingValidation.value) {
    error.value = governanceSummary.value
    return
  }

  isSaving.value = true
  error.value = null
  try {
    const payload: ManagedSkillUpdateRequest = {
      displayName: form.value.displayName,
      displayDescription: form.value.displayDescription,
      starterSummary: form.value.starterSummary,
      lifecycle: form.value.lifecycle,
      intentGroup: form.value.intentGroup,
      starterEnabled: form.value.starterEnabled,
      starterPriority: Number.isFinite(form.value.starterPriority) ? form.value.starterPriority : 0,
      agentBindings: form.value.agentBindings.map(binding => ({ agentId: binding.agentId }))
    }
    const updated = await agentApi.updateManagedSkill(selectedSkill.value.skillId, payload)
    skills.value = skills.value.map(skill => skill.skillId === updated.skillId ? updated : skill)
    selectedSkillId.value = updated.skillId
    await workbenchStore.refreshActiveAgentGovernance()
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    isSaving.value = false
  }
}

async function toggleDeleteConfirmation(): Promise<void> {
  const skill = selectedSkill.value
  if (!skill) return
  if (deleteConfirmSkillId.value !== skill.skillId) {
    deleteConfirmSkillId.value = skill.skillId
    return
  }
  isDeleting.value = true
  error.value = null
  try {
    await agentApi.deleteManagedSkill(skill.skillId)
    deleteConfirmSkillId.value = null
    selectedSkillId.value = ''
    await load()
    await workbenchStore.refreshActiveAgentGovernance()
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    isDeleting.value = false
  }
}

function cancelDelete(): void {
  deleteConfirmSkillId.value = null
}

function formatIntentGroup(value?: ManagedSkillIntentGroup | string | null): string {
  switch (resolveManagedSkillIntentGroupState(value || null).intentGroup) {
    case 'planning':
      return '方案制作'
    case 'configuration-authoring':
      return '配置生成'
    case 'verification':
      return '配置核查'
    default:
      return '未分组'
  }
}

function createManagedSkillForm(skill: ManagedSkillRecord): ManagedSkillForm {
  const intentGroupState = resolveManagedSkillIntentGroupState(skill.intentGroup || null)
  return {
    displayName: skill.displayName,
    displayDescription: skill.displayDescription,
    starterSummary: skill.starterSummary || '',
    lifecycle: skill.lifecycle,
    intentGroup: intentGroupState.intentGroup,
    invalidIntentGroup: intentGroupState.invalidIntentGroup,
    starterEnabled: skill.starterEnabled,
    starterPriority: skill.starterPriority,
    agentBindings: skill.agentBindings.map(binding => ({ ...binding }))
  }
}

function formatLifecycleLabel(value: ManagedSkillLifecycle): string {
  return value === 'published' ? '已发布' : '草稿'
}

function formatStarterEnabledLabel(value: boolean): string {
  return value ? '已启用' : '未启用'
}

function resolveSummaryCardTitle(skill: ManagedSkillRecord): string {
  const displayName = skill.displayName.trim()
  return displayName || EMPTY_SUMMARY_CARD_TITLE
}

function resolveStarterSummary(params: {
  starterSummary?: string
  displayDescription?: string
  canonicalDescription?: string
  inputExample?: string
}): string {
  const candidates = [
    params.starterSummary,
    params.displayDescription,
    params.canonicalDescription,
    params.inputExample
  ]
  for (const candidate of candidates) {
    const text = typeof candidate === 'string' ? candidate.trim() : ''
    if (text) return text
  }
  return '使用该技能开始处理任务。'
}

function formatTime(value: number): string {
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false
  })
}

function buildDisplayNameIssues(
  skill: ManagedSkillRecord,
  displayName: string,
  bindings: ManagedSkillAgentBinding[],
  allSkills: ManagedSkillRecord[]
): string[] {
  const issues: string[] = []
  const normalizedName = displayName.trim()
  if (!normalizedName) {
    issues.push('未填写用户可见名称')
  }
  if (normalizedName === skill.skillId || normalizedName === skill.canonicalName) {
    issues.push('仍为默认导入名称，不能直接发布')
  }
  if (hasDuplicateDisplayName(skill, normalizedName, bindings, allSkills)) {
    issues.push('与其他 Skill 在同一 Agent 下重名')
  }
  return issues
}

function buildPublishBlockers(
  skill: ManagedSkillRecord,
  nextForm: ManagedSkillForm,
  allSkills: ManagedSkillRecord[]
): string[] {
  const blockers: string[] = []
  const displayNameIssues = buildDisplayNameIssues(skill, nextForm.displayName, nextForm.agentBindings, allSkills)
  if (displayNameIssues.includes('未填写用户可见名称') || displayNameIssues.includes('仍为默认导入名称，不能直接发布')) {
    blockers.push('请先完成用户可见名称治理。')
  }
  if (!nextForm.displayDescription.trim()) {
    blockers.push('请先填写用户可见描述。')
  }
  if (nextForm.agentBindings.length === 0) {
    blockers.push('请至少绑定一个 Agent。')
  }
  if (displayNameIssues.includes('与其他 Skill 在同一 Agent 下重名')) {
    blockers.push('请先解决同一 Agent 下的重名冲突。')
  }
  return blockers
}

function hasDuplicateDisplayName(
  skill: ManagedSkillRecord,
  displayName: string,
  bindings: ManagedSkillAgentBinding[],
  allSkills: ManagedSkillRecord[]
): boolean {
  const normalized = displayName.trim().toLocaleLowerCase()
  if (!normalized) return false
  return allSkills.some(candidate => {
    if (candidate.skillId === skill.skillId) return false
    if (candidate.displayName.trim().toLocaleLowerCase() !== normalized) return false
    return candidate.agentBindings.some(candidateBinding => {
      return bindings.some(binding => binding.agentId === candidateBinding.agentId)
    })
  })
}
</script>

<style scoped>
.admin-skills {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--section-gap);
  padding-block: var(--pane-block);
  padding-inline: var(--pane-inline);
  overflow: hidden;
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.09), transparent 32%),
    linear-gradient(180deg, #f4f7fb 0%, #eef3f9 100%);
}

.admin-skills__hero,
.admin-skills__list,
.admin-skills__detail {
  border-radius: 12px;
}

.admin-skills__hero {
  padding: calc(var(--card-pad) * 0.8) var(--card-pad);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: calc(var(--section-gap) * 1.15);
}

.admin-skills__hero h1 {
  margin: 0;
  font-size: var(--font-page-title);
  line-height: var(--line-page-title);
}

.admin-skills__hero p:last-child {
  margin: calc(var(--section-gap) * 0.6) 0 0;
  max-width: 820px;
  color: var(--text-secondary);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.admin-skills__hero-actions {
  display: flex;
  gap: calc(var(--section-gap) * 0.7);
}

.admin-skills__upload-input {
  display: none;
}

.admin-skills__error {
  margin: 0;
  color: var(--danger);
}

.admin-skills__notice {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--section-gap);
  padding: calc(var(--card-pad-tight) * 0.9) var(--card-pad);
  border: 1px solid rgba(14, 116, 144, 0.16);
  border-radius: 12px;
  background: rgba(240, 249, 255, 0.88);
}

.admin-skills__notice--warning {
  border-color: rgba(202, 138, 4, 0.22);
  background: rgba(254, 249, 195, 0.88);
}

.admin-skills__notice strong {
  display: block;
  font-size: var(--font-dense);
  line-height: var(--line-dense);
}

.admin-skills__notice p {
  margin: calc(var(--section-gap) * 0.4) 0 0;
  color: var(--text-secondary);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.admin-skills__notice-actions {
  display: flex;
  gap: calc(var(--section-gap) * 0.55);
  flex-wrap: wrap;
}

.admin-skills__issue-list {
  margin: calc(var(--section-gap) * 0.55) 0 0;
  padding-left: 1.1rem;
  color: var(--text-primary);
}

.admin-skills__issue-list li + li {
  margin-top: calc(var(--section-gap) * 0.35);
}

.admin-skills__issue-list small {
  display: block;
  margin-top: calc(var(--section-gap) * 0.2);
  color: var(--text-secondary);
}

.admin-skills__layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(18rem, 29vi) minmax(0, 1fr);
  gap: var(--section-gap);
  overflow: hidden;
}

.admin-skills__list,
.admin-skills__detail {
  padding: var(--card-pad);
  min-height: 0;
  min-width: 0;
}

.admin-skills__list {
  display: flex;
  flex-direction: column;
  gap: calc(var(--section-gap) * 0.8);
  overflow: hidden;
}

.admin-skills__list--summary {
  justify-content: flex-start;
}

.admin-skills__detail {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.danger-btn {
  min-block-size: var(--control-block);
  border: 1px solid rgba(185, 28, 28, 0.22);
  border-radius: 8px;
  background: rgba(254, 242, 242, 0.9);
  color: #b91c1c;
  padding-inline: calc(var(--pane-inline) * 0.75);
  font-size: var(--font-dense);
}

.admin-skills__detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--section-gap);
}

.admin-skills__detail-head h2 {
  margin: 0;
  font-size: var(--font-title);
  line-height: var(--line-title);
}

.admin-skills__summary-rail {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: calc(var(--section-gap) * 0.75);
  padding: calc(var(--card-pad-tight) * 0.85);
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: linear-gradient(180deg, #fcfdff 0%, #f3f7fb 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.84);
}

.admin-skills__summary-head {
  display: grid;
  gap: calc(var(--section-gap) * 0.42);
  padding: calc(var(--card-pad-tight) * 0.78) calc(var(--card-pad-tight) * 0.82);
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(248, 250, 252, 0.92) 100%);
}

.admin-skills__summary-head h2 {
  margin: 0;
  font-size: var(--font-title);
  line-height: var(--line-title);
}

.admin-skills__summary-note {
  margin: 0;
  max-width: 30ch;
  color: var(--text-secondary);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.admin-skills__field input,
.admin-skills__field select,
.admin-skills__field textarea {
  width: 100%;
  min-block-size: var(--control-block);
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: #fff;
  padding-block: calc(var(--pane-block) * 0.6);
  padding-inline: calc(var(--pane-inline) * 0.65);
  color: var(--text-primary);
  font-size: var(--font-dense);
  line-height: var(--line-dense);
}

.admin-skills__items {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: grid;
  gap: calc(var(--section-gap) * 0.3);
}

.admin-skills__items--summary {
  gap: calc(var(--section-gap) * 0.55);
  align-content: start;
  grid-auto-rows: max-content;
  padding-right: 2px;
}

.admin-skills__item {
  padding: calc(var(--card-pad-tight) * 0.65) calc(var(--card-pad-tight) * 0.85);
  border: 1px solid var(--line-subtle);
  border-left: 3px solid transparent;
  border-radius: 8px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  display: grid;
  gap: calc(var(--section-gap) * 0.3);
  transition: border-color 0.18s, background-color 0.18s, border-left-color 0.18s, box-shadow 0.18s;
}

.admin-skills__item--summary {
  gap: calc(var(--section-gap) * 0.45);
  min-block-size: 6.25rem;
  align-content: start;
}

.admin-skills__item--active {
  border-color: rgba(96, 165, 250, 0.42);
  border-left-color: var(--accent);
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.9) 0%, rgba(248, 250, 252, 0.98) 100%);
  box-shadow: 0 8px 18px rgba(59, 130, 246, 0.08);
}

.admin-skills__item:focus-visible {
  outline: none;
  border-color: rgba(96, 165, 250, 0.48);
  border-left-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.14);
}

@media (hover: hover) {
  .admin-skills__item:hover {
    border-color: rgba(148, 163, 184, 0.4);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.98) 100%);
    box-shadow: 0 6px 14px rgba(15, 23, 42, 0.06);
  }
}

.admin-skills__item-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--section-gap);
}

.admin-skills__item-head strong {
  font-size: var(--font-dense);
  line-height: var(--line-dense);
}

.admin-skills__item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--section-gap) * 0.45);
}

.admin-skills__item small {
  display: inline-flex;
  align-items: center;
  min-block-size: 1.75rem;
  padding-inline: 0.65rem;
  border-radius: 999px;
  background: rgba(241, 245, 249, 0.92);
  border: 1px solid rgba(203, 213, 225, 0.78);
}

.admin-skills__item small,
.admin-skills__bindings-head small {
  color: var(--text-muted);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

@media (prefers-reduced-motion: reduce) {
  .admin-skills__item {
    transition: none;
  }
}

.admin-skills__detail-body {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: grid;
  gap: var(--section-gap);
  overflow: auto;
  padding-right: 4px;
}

.admin-skills__section {
  display: grid;
  gap: calc(var(--section-gap) * 0.6);
  padding: calc(var(--card-pad-tight) * 0.85);
  border-radius: 10px;
  border: 1px solid var(--line-subtle);
  background: #fbfdff;
}

.admin-skills__section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--section-gap);
}

.admin-skills__section-head h3 {
  margin: 0;
  font-size: var(--font-title);
  line-height: var(--line-title);
}

.admin-skills__canonical {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: calc(var(--section-gap) * 0.55);
  padding: calc(var(--card-pad-tight) * 0.85);
  border-radius: 10px;
  background: linear-gradient(180deg, #fbfdff 0%, #f5f8fc 100%);
  border: 1px solid var(--line-subtle);
}

.admin-skills__canonical div,
.admin-skills__field {
  display: grid;
  min-width: 0;
  gap: calc(var(--section-gap) * 0.45);
}

.admin-skills__canonical span,
.admin-skills__field span,
.admin-skills__bindings-head span {
  color: var(--text-muted);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.admin-skills__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: calc(var(--section-gap) * 0.7);
  align-items: end;
}

.admin-skills__starter-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-areas:
    'toggle toggle'
    'intent priority';
  gap: calc(var(--section-gap) * 0.7);
  align-items: end;
}

.admin-skills__field textarea {
  resize: vertical;
  min-block-size: calc(3.1lh + 1.1dvh);
  max-block-size: min(20dvh, 12rem);
}

.admin-skills__field-hint {
  margin: calc(var(--section-gap) * -0.2) 0 0;
  color: var(--text-secondary);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.admin-skills__field-hint--warning {
  color: #b45309;
}

.admin-skills__field-issues {
  margin: 0;
  padding-left: 1rem;
  color: var(--danger);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.admin-skills__field--compact {
  grid-area: priority;
  max-width: min(100%, 12rem);
}

.admin-skills__toggle {
  grid-area: toggle;
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: calc(var(--section-gap) * 0.7);
  min-block-size: calc(1.6rem + 0.6dvh);
  min-width: 0;
  color: var(--text-primary);
}

.admin-skills__field--intent {
  grid-area: intent;
}

.admin-skills__starter-preview {
  display: grid;
  gap: calc(var(--section-gap) * 0.6);
}

.admin-skills__starter-preview-head {
  display: grid;
  gap: calc(var(--section-gap) * 0.3);
}

.admin-skills__starter-preview-head span {
  color: var(--text-muted);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.admin-skills__starter-preview-head small {
  color: var(--text-muted);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.admin-skills__starter-preview-card {
  display: grid;
  gap: calc(var(--section-gap) * 0.5);
  padding: calc(var(--card-pad-tight) * 0.85);
  border-radius: 10px;
  border: 1px solid rgba(37, 99, 235, 0.16);
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.82) 0%, rgba(255, 255, 255, 0.96) 100%);
}

.admin-skills__starter-preview-card--muted {
  opacity: 0.72;
}

.admin-skills__starter-preview-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--section-gap);
}

.admin-skills__starter-preview-card-head strong {
  font-size: var(--font-dense);
  line-height: var(--line-dense);
}

.admin-skills__starter-preview-card-summary {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-dense);
  line-height: var(--line-dense);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.admin-skills__starter-preview-card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: calc(var(--section-gap) * 0.7);
}

.admin-skills__starter-preview-card-actions .primary-btn {
  min-block-size: 34px;
  padding-inline: 14px;
}

.admin-skills__preview-link {
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: var(--font-meta);
  font-weight: 600;
  white-space: normal;
  text-align: left;
}

.admin-skills__bindings {
  display: grid;
  gap: calc(var(--section-gap) * 0.6);
  padding: calc(var(--card-pad-tight) * 0.85);
  border-radius: 10px;
  border: 1px solid var(--line-subtle);
  background: #fbfdff;
}

.admin-skills__governance-summary {
  margin: 0;
  padding: calc(var(--section-gap) * 0.55) calc(var(--section-gap) * 0.7);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.04);
  color: var(--text-secondary);
  font-size: var(--font-dense);
  line-height: var(--line-dense);
}

.admin-skills__binding-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: calc(var(--section-gap) * 0.7);
}

.admin-skills__binding-item {
  display: flex;
  align-items: flex-start;
  gap: calc(var(--section-gap) * 0.6);
  padding: calc(var(--card-pad-tight) * 0.7);
  border-radius: 8px;
  border: 1px solid var(--line-subtle);
  background: #fff;
}

.admin-skills__binding-toggle {
  padding-top: 0.1rem;
}

.admin-skills__binding-item strong {
  display: block;
  font-size: var(--font-dense);
  line-height: var(--line-dense);
}

.admin-skills__binding-item small {
  color: var(--text-muted);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.admin-skills__actions {
  display: flex;
  justify-content: flex-end;
  gap: calc(var(--section-gap) * 0.7);
}

.admin-skills__empty {
  padding: var(--card-pad);
  border-radius: 10px;
  border: 1px dashed var(--line-subtle);
  color: var(--text-secondary);
  background: #f8fbff;
}

.admin-skills__empty--detail {
  min-block-size: clamp(12rem, 34dvh, 20rem);
  display: grid;
  place-items: center;
}

@media (max-width: 1180px) {
  .admin-skills {
    overflow-y: auto;
  }

  .admin-skills__layout {
    flex: none;
    min-height: auto;
    grid-template-columns: 1fr;
  }

  .admin-skills__list,
  .admin-skills__detail,
  .admin-skills__items {
    overflow: visible;
  }
}

@media (max-width: 980px) {
  .admin-skills__starter-controls {
    grid-template-columns: 1fr;
    grid-template-areas:
      'toggle'
      'intent'
      'priority';
  }

  .admin-skills__field--compact {
    max-width: none;
  }
}

@media (max-width: 760px) {
  .admin-skills {
    padding-block: var(--pane-block);
    padding-inline: var(--pane-inline);
  }

  .admin-skills__hero {
    flex-direction: column;
  }

  .admin-skills__hero-actions,
  .admin-skills__actions {
    width: 100%;
    justify-content: stretch;
  }

  .admin-skills__hero-actions button,
  .admin-skills__actions button {
    flex: 1;
  }

  .admin-skills__row,
  .admin-skills__starter-controls,
  .admin-skills__canonical,
  .admin-skills__binding-list {
    grid-template-columns: 1fr;
  }

  .admin-skills__starter-preview-card-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
