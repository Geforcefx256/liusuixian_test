<template>
  <section class="home-stage">
    <header class="home-stage__header agent-bar-surface">
      <div class="home-stage__reading-measure">
        <div class="agent-identity agent-identity--hero home-stage__header-identity">
          <div class="agent-identity__main home-stage__header-main">
            <span class="agent-identity__badge agent-identity__badge--hero home-stage__header-badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" class="icon-svg">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </span>
            <div class="agent-identity__copy home-stage__header-copy">
              <h1 class="agent-identity__title home-stage__title">{{ title }}</h1>
              <p class="agent-identity__subtitle home-stage__subtitle">{{ subtitle }}</p>
            </div>
          </div>
        </div>
      </div>
    </header>

    <div class="home-stage__body">
      <div class="home-stage__surface-measure">
        <section class="home-stage__skills card-shell">
          <div class="home-stage__skills-head">
            <div class="home-stage__skills-head-main">
              <h2>您可以从下面几个场景开始</h2>
              <p class="home-stage__skills-summary">先从常见技能开始，需要更多时再展开搜索。</p>
            </div>
            <button
              class="home-stage__toggle-btn home-stage__toggle-btn--search"
              type="button"
              @click="handleDiscoveryAction"
            >
              {{ discoveryActionLabel }}
            </button>
          </div>
          <div v-if="discoveryPanelOpen" class="home-stage__skills-search-panel">
            <div class="home-stage__search-shell home-stage__search-shell--integrated">
              <input
                :value="searchQuery"
                type="search"
                placeholder="搜索方案制作、配置生成、配置核查相关技能"
                @input="handleSearchInput"
              >
            </div>
            <p v-if="!isSearchActive" class="home-stage__discovery-summary">
              可用技能共 {{ discoverySkills.length }} 项，可按方案制作、配置生成和配置核查快速检索。
            </p>
            <div v-else-if="discoverySkills.length === 0" class="home-stage__empty">
              没有找到匹配技能，试试更泛化的关键词。
            </div>
            <div v-else class="home-stage__discovery-grid">
              <button
                v-for="skill in visibleDiscoverySkills"
                :key="skill.id"
                class="home-stage__discovery-card"
                type="button"
                @click="$emit('send-prompt', skill.starterPrompt)"
              >
                <span>{{ formatIntentGroup(skill.intentGroup) }}</span>
                <strong>{{ skill.name }}</strong>
                <p>{{ skill.description }}</p>
              </button>
            </div>
          </div>

          <div class="home-stage__group-grid">
            <article
              v-for="group in starterGroups"
              :key="group.id"
              class="home-stage__group-card"
            >
              <div class="home-stage__group-head">
                <span class="home-stage__group-icon" aria-hidden="true">{{ group.icon }}</span>
                <div>
                  <p class="home-stage__group-title">{{ group.title }}</p>
                  <small>{{ group.subtitle }}</small>
                </div>
              </div>
              <ul v-if="group.previewSkills.length" class="home-stage__group-preview">
                <li
                  v-for="skill in group.previewSkills"
                  :key="`${group.id}-${skill.id}`"
                  class="home-stage__group-preview-item"
                >
                  {{ skill.name }}
                </li>
              </ul>

              <button
                v-if="group.skill"
                class="home-stage__skill"
                type="button"
                @click="$emit('send-prompt', group.skill.starterPrompt)"
              >
                <span>{{ group.skill.name }}</span>
                <strong>{{ group.skill.description }}</strong>
                <small v-if="group.skill.inputExample">{{ group.skill.inputExample }}</small>
              </button>

              <button
                v-else
                class="home-stage__fallback"
                type="button"
                @click="$emit('discover-group', group.discoveryQuery)"
              >
                <strong>{{ group.emptyTitle }}</strong>
                <small>{{ group.emptyDescription }}</small>
              </button>
            </article>
          </div>
        </section>

        <section class="home-stage__composer card-shell">
          <div class="home-stage__reading-measure">
            <div
              class="soft-input-shell home-stage__composer-shell"
              :class="{
                'home-stage__composer-shell--dragging': isDragActive,
                'home-stage__composer-shell--drag-reject': dragError !== null
              }"
              @dragenter="handleComposerDragEnter"
              @dragover="handleComposerDragOver"
              @dragleave="handleComposerDragLeave"
              @drop="handleComposerDrop"
            >
              <textarea
                v-model="draft"
                rows="2"
                :placeholder="COMPOSER_PLACEHOLDER"
              />
              <div class="home-stage__actions">
                <div class="home-stage__action-left">
                  <div class="home-stage__icon-entry">
                    <button class="home-stage__attach-btn" type="button" aria-label="添加附件" @click="$emit('upload-files')">
                      +
                    </button>
                    <span class="home-stage__icon-tooltip" aria-hidden="true">
                      {{ COMPOSER_UPLOAD_TIP }}
                    </span>
                  </div>
                </div>
                <div class="home-stage__icon-entry">
                  <button
                    class="primary-btn home-stage__composer-action"
                    type="button"
                    aria-label="发送消息"
                    :disabled="!draft.trim()"
                    @click="sendDraft"
                  >
                    <svg viewBox="0 0 24 24" class="home-stage__composer-action-icon" aria-hidden="true">
                      <path d="M5 12L18 12" />
                      <path d="M12 6L18 12L12 18" />
                    </svg>
                  </button>
                  <span class="home-stage__icon-tooltip" aria-hidden="true">{{ COMPOSER_SEND_LABEL }}</span>
                </div>
              </div>
            </div>
            <p v-if="dragError" class="home-stage__upload-error">{{ dragError }}</p>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  buildComposerUploadError,
  COMPOSER_PLACEHOLDER,
  COMPOSER_SEND_LABEL,
  COMPOSER_UPLOAD_TIP,
  splitComposerUploadFiles
} from './composerUpload'

const props = defineProps<{
  title: string
  subtitle: string
  starterGroups: Array<{
    id: string
    title: string
    subtitle: string
    icon: string
    discoveryQuery: string
    emptyTitle: string
    emptyDescription: string
    previewSkills: Array<{
      id: string
      name: string
    }>
    skill: {
      id: string
      name: string
      description: string
      inputExample?: string
      starterPrompt: string
    } | null
  }>
  discoverySkills: Array<{
    id: string
    name: string
    description: string
    intentGroup?: string
    starterPrompt: string
  }>
  searchQuery: string
}>()

const emit = defineEmits<{
  (event: 'send-prompt', prompt: string): void
  (event: 'upload-files', files?: File[]): void
  (event: 'update:search-query', value: string): void
  (event: 'discover-group', value: string): void
}>()

const draft = ref('')
const discoveryOpen = ref(false)
const discoveryShowAll = ref(false)
const dragDepth = ref(0)
const isDragActive = ref(false)
const dragError = ref<string | null>(null)

const isSearchActive = computed(() => props.searchQuery.trim().length > 0)

const discoveryPanelOpen = computed(() => discoveryOpen.value || isSearchActive.value)

const visibleDiscoverySkills = computed(() => {
  return discoveryShowAll.value ? props.discoverySkills : props.discoverySkills.slice(0, 4)
})

const canToggleDiscovery = computed(() => props.discoverySkills.length > 4)

const discoveryActionLabel = computed(() => {
  if (!discoveryPanelOpen.value) return '搜索更多技能'
  if (isSearchActive.value && canToggleDiscovery.value && !discoveryShowAll.value) {
    return `查看更多 ${props.discoverySkills.length - visibleDiscoverySkills.value.length} 项`
  }
  return '收起搜索'
})

function sendDraft(): void {
  const value = draft.value.trim()
  if (!value) return
  emit('send-prompt', value)
  draft.value = ''
}

function resetDragState(): void {
  dragDepth.value = 0
  isDragActive.value = false
}

function handleComposerDragEnter(event: DragEvent): void {
  if (!event.dataTransfer?.types.includes('Files')) return
  dragDepth.value += 1
  isDragActive.value = true
  dragError.value = null
}

function handleComposerDragOver(event: DragEvent): void {
  if (!event.dataTransfer?.types.includes('Files')) return
  event.preventDefault()
  event.dataTransfer.dropEffect = 'copy'
}

function handleComposerDragLeave(): void {
  if (dragDepth.value > 0) {
    dragDepth.value -= 1
  }
  if (dragDepth.value === 0) {
    isDragActive.value = false
  }
}

function handleComposerDrop(event: DragEvent): void {
  event.preventDefault()
  const files = Array.from(event.dataTransfer?.files || [])
  const { acceptedFiles, rejectedFiles } = splitComposerUploadFiles(files)
  resetDragState()
  if (rejectedFiles.length > 0) {
    dragError.value = buildComposerUploadError(rejectedFiles)
    return
  }
  dragError.value = null
  if (!acceptedFiles.length) return
  emit('upload-files', acceptedFiles)
}

function handleDiscoveryAction(): void {
  if (!discoveryPanelOpen.value) {
    discoveryOpen.value = true
    discoveryShowAll.value = false
    return
  }

  if (isSearchActive.value && canToggleDiscovery.value && !discoveryShowAll.value) {
    discoveryShowAll.value = true
    return
  }

  if (isSearchActive.value) {
    emit('update:search-query', '')
  }

  discoveryShowAll.value = false
  discoveryOpen.value = false
}

function handleSearchInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  if (!value.trim()) {
    discoveryOpen.value = false
    discoveryShowAll.value = false
  }
  emit('update:search-query', value)
}

function formatIntentGroup(value?: string): string {
  switch (value) {
    case 'planning':
      return '方案制作'
    case 'configuration-authoring':
      return '配置生成'
    case 'verification':
      return '配置核查'
    default:
      return '可用技能'
  }
}
</script>

<style scoped>
.home-stage {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-canvas);
  overflow: hidden;
}

.home-stage__header {
  display: flex;
  min-block-size: var(--chrome-secondary-b);
  align-items: center;
  justify-content: flex-start;
  flex-shrink: 0;
  padding-inline: var(--pane-inline);
}

.home-stage__reading-measure,
.home-stage__surface-measure {
  width: min(100%, clamp(var(--layout-reading-min), var(--layout-reading-fluid), var(--layout-reading-max)));
  margin-inline: auto;
}

.home-stage__surface-measure {
  width: min(100%, clamp(var(--layout-surface-min), var(--layout-surface-fluid), var(--layout-surface-max)));
  display: flex;
  flex-direction: column;
  gap: var(--section-gap);
}

.home-stage__header-identity {
  width: 100%;
  justify-content: center;
}

.home-stage__header-main {
  width: 100%;
  margin-inline: auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  column-gap: 12px;
}

.home-stage__header-badge {
  grid-column: 1;
  justify-self: end;
  inline-size: calc(var(--chrome-secondary-b) - 0.6rem);
  block-size: calc(var(--chrome-secondary-b) - 0.6rem);
}

.home-stage__header-badge .icon-svg {
  width: 60%;
  height: 60%;
}

.home-stage__header-copy {
  grid-column: 2;
  align-items: center;
  text-align: center;
}

.home-stage__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--section-gap);
  padding-block: var(--pane-block);
  padding-inline: var(--pane-inline);
  overflow-y: auto;
}

.home-stage__kicker {
  margin-bottom: 8px;
}

.home-stage__title {
  font-size: var(--font-page-title);
  letter-spacing: -0.03em;
  line-height: var(--line-page-title);
}

.home-stage__subtitle {
  max-inline-size: 68ch;
  font-size: var(--font-meta);
  line-height: var(--line-meta);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.home-stage__skills,
.home-stage__composer {
  padding: var(--card-pad);
}

.home-stage__skills {
  display: block;
}

.home-stage__skills-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--section-gap);
}

.home-stage__skills-head-main {
  min-width: 0;
}

.home-stage__skills-head h2 {
  margin: 0;
  font-size: var(--font-title);
  line-height: var(--line-title);
}

.home-stage__skills-summary {
  margin: calc(var(--section-gap) * 0.35) 0 0;
  color: var(--text-muted);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.home-stage__toggle-btn {
  border: 0;
  background: transparent;
  color: var(--accent);
  font-size: var(--font-dense);
  font-weight: 600;
  line-height: var(--line-dense);
  padding: 0;
  flex-shrink: 0;
}

.home-stage__toggle-btn--search {
  min-block-size: calc(1.7rem + 0.5dvh);
  padding-inline: calc(0.55rem + 0.22vi);
  border: 1px solid var(--line-subtle);
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-subtle);
}

.home-stage__toggle-btn--search:hover {
  background: var(--accent-lighter);
  border-color: var(--accent-light);
}

.home-stage__skills-search-panel {
  margin-top: var(--section-gap);
  padding-top: var(--section-gap);
  border-top: 1px solid rgba(217, 225, 234, 0.9);
}

.home-stage__group-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(32ch, 100%), 1fr));
  gap: var(--section-gap);
  align-items: start;
  margin-top: var(--section-gap);
}

.home-stage__group-card {
  padding: var(--card-pad-tight);
  border: 1px solid var(--line-subtle);
  border-radius: 14px;
  background: linear-gradient(180deg, #fff 0%, #f8fbff 100%);
  display: flex;
  flex-direction: column;
  gap: calc(var(--section-gap) * 0.65);
  align-self: start;
}

.home-stage__group-head {
  display: flex;
  align-items: center;
  gap: calc(var(--section-gap) * 0.7);
  min-width: 0;
}

.home-stage__group-icon {
  inline-size: calc(1.55rem + 0.85dvh);
  block-size: calc(1.55rem + 0.85dvh);
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #dfeaff, #eef4ff);
  color: var(--accent);
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
}

.home-stage__group-title {
  margin: 0 0 calc(var(--section-gap) * 0.25);
  font-size: var(--font-title);
  font-weight: 700;
  line-height: var(--line-title);
  color: var(--text-primary);
}

.home-stage__group-head small {
  display: -webkit-box;
  color: var(--text-muted);
  line-height: var(--line-meta);
  font-size: var(--font-meta);
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.home-stage__group-preview {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
}

.home-stage__group-preview-item {
  min-width: 0;
  padding: 8px 10px;
  border-radius: 999px;
  background: rgba(222, 232, 247, 0.72);
  color: var(--text-primary);
  font-size: var(--font-meta);
  font-weight: 600;
  line-height: var(--line-meta);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.home-stage__group-preview-item:nth-child(n + 3) {
  display: none;
}

.home-stage__skill,
.home-stage__fallback,
.home-stage__discovery-card {
  padding: var(--card-pad-tight);
  border: 1px solid var(--line-subtle);
  border-radius: 12px;
  background: linear-gradient(180deg, #fff 0%, #fbfdff 100%);
  text-align: left;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: calc(var(--section-gap) * 0.35);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;
}

.home-stage__skill:hover,
.home-stage__fallback:hover,
.home-stage__discovery-card:hover {
  border-color: var(--accent-light);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.home-stage__skill span {
  font-size: var(--font-overline);
  font-weight: 700;
  line-height: var(--line-overline);
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.home-stage__skill strong {
  font-size: var(--font-dense);
  line-height: var(--line-dense);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.home-stage__skill small {
  color: var(--text-muted);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.home-stage__fallback {
  background: linear-gradient(180deg, #fbfdff 0%, #f4f8fd 100%);
}

.home-stage__fallback strong {
  font-size: var(--font-dense);
  line-height: var(--line-dense);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.home-stage__fallback small {
  color: var(--text-muted);
  line-height: var(--line-meta);
  font-size: var(--font-meta);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.home-stage__search-shell,
.home-stage__discovery-grid,
.home-stage__empty {
  min-height: 0;
}

.home-stage__search-shell {
  margin-top: calc(var(--section-gap) * 0.7);
}

.home-stage__search-shell--integrated {
  margin-top: 0;
}

.home-stage__search-shell input {
  width: 100%;
  border: 1px solid var(--line-subtle);
  border-radius: 10px;
  background: #fff;
  padding-block: calc(var(--pane-block) * 0.7);
  padding-inline: calc(var(--pane-inline) * 0.75);
  color: var(--text-primary);
  font-size: var(--font-dense);
  line-height: var(--line-dense);
}

.home-stage__discovery-summary {
  margin: calc(var(--section-gap) * 0.7) 0 0;
  color: var(--text-muted);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.home-stage__discovery-grid {
  margin-top: calc(var(--section-gap) * 0.7);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(32ch, 100%), 1fr));
  gap: calc(var(--section-gap) * 0.7);
  align-items: start;
}

.home-stage__discovery-card {
  padding: var(--card-pad-tight);
  gap: calc(var(--section-gap) * 0.25);
}

.home-stage__discovery-card span {
  font-size: var(--font-overline);
  font-weight: 700;
  line-height: var(--line-overline);
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.home-stage__discovery-card strong {
  font-size: var(--font-dense);
  line-height: var(--line-dense);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.home-stage__discovery-card p {
  margin: 0;
  color: var(--text-secondary);
  line-height: var(--line-meta);
  font-size: var(--font-meta);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.home-stage__empty {
  margin-top: calc(var(--section-gap) * 0.7);
  padding: var(--card-pad-tight);
  border-radius: 12px;
  border: 1px dashed var(--line-subtle);
  color: var(--text-secondary);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.home-stage__composer-shell {
  padding: var(--card-pad-tight);
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    box-shadow 0.16s ease;
}

.home-stage__composer-shell--dragging {
  border-color: rgba(59, 130, 246, 0.45);
  background: rgba(239, 246, 255, 0.92);
  box-shadow: 0 0 0 2px rgba(191, 219, 254, 0.7);
}

.home-stage__composer-shell--drag-reject {
  border-color: rgba(220, 38, 38, 0.28);
}

.home-stage__composer textarea {
  min-block-size: var(--composer-min-block);
  max-block-size: min(16dvh, var(--composer-max-block));
  resize: none;
  display: block;
  font-size: var(--font-body);
  line-height: var(--line-body);
}

.home-stage__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--section-gap) * 0.7);
  margin-top: calc(var(--section-gap) * 0.7);
}

.home-stage__action-left {
  display: flex;
  align-items: center;
  min-width: 0;
}

.home-stage__icon-entry {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.home-stage__icon-entry:hover .home-stage__icon-tooltip,
.home-stage__icon-entry:focus-within .home-stage__icon-tooltip {
  opacity: 1;
  transform: translate(-50%, 0);
}

.home-stage__icon-tooltip {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 6px);
  transform: translate(-50%, 4px);
  padding: 4px 8px;
  border: 0;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.88);
  color: #fff;
  font-size: 11px;
  line-height: 1.3;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease, transform 0.12s ease;
  z-index: 2;
}

.home-stage__icon-tooltip--wide {
  max-inline-size: min(34ch, calc(100vw - 32px));
  white-space: normal;
  text-align: center;
}

.home-stage__attach-btn {
  inline-size: 36px;
  block-size: 36px;
  border: 1px solid var(--line-subtle);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 1.35rem;
  line-height: 1;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    color 0.16s ease;
}

.home-stage__attach-btn:hover,
.home-stage__attach-btn:focus-visible {
  border-color: rgba(59, 130, 246, 0.34);
  background: rgba(239, 246, 255, 0.96);
  color: rgba(29, 78, 216, 0.94);
}

.home-stage__composer-action {
  inline-size: 44px;
  block-size: 44px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.home-stage__composer-action-icon {
  inline-size: 20px;
  block-size: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.home-stage__upload-error {
  margin: 10px 0 0;
  color: #b91c1c;
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

@media (min-width: 720px) {
  .home-stage__group-preview-item:nth-child(3) {
    display: block;
  }
}

@media (max-width: 980px) {
  .home-stage {
    display: flex;
    overflow: visible;
  }

  .home-stage__header {
    padding-inline: var(--pane-inline);
  }

  .home-stage__body {
    padding-block: var(--pane-block);
    padding-inline: var(--pane-inline);
    gap: var(--section-gap);
  }

  .home-stage__reading-measure,
  .home-stage__surface-measure {
    width: 100%;
  }

  .home-stage__subtitle {
    -webkit-line-clamp: 2;
  }

  .home-stage__group-grid,
  .home-stage__discovery-grid {
    grid-template-columns: 1fr;
  }

  .home-stage__skills-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .home-stage__toggle-btn--search {
    width: 100%;
    justify-content: center;
  }

  .home-stage__composer textarea {
    min-block-size: calc(3lh + 1.25dvh);
    max-height: none;
    resize: vertical;
  }
}
</style>
