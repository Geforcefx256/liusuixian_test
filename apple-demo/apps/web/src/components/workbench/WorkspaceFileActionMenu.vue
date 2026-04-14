<template>
  <div ref="root" class="workspace-file-action-menu">
    <button
      class="workspace-file-action-menu__trigger"
      type="button"
      :aria-label="`更多操作：${fileName}`"
      :aria-expanded="isOpen"
      aria-haspopup="menu"
      @click.stop.prevent="toggleMenu"
      @dblclick.stop.prevent
    >
      <svg viewBox="0 0 24 24" class="icon-svg" aria-hidden="true">
        <circle cx="12" cy="5" r="1.75" />
        <circle cx="12" cy="12" r="1.75" />
        <circle cx="12" cy="19" r="1.75" />
      </svg>
    </button>

    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="dropdown"
        class="workspace-file-action-menu__dropdown"
        :style="dropdownStyle"
        role="menu"
      >
        <button
          v-if="copyVisible"
          class="workspace-file-action-menu__item"
          type="button"
          role="menuitem"
          @click.stop.prevent="handleCopyFileName"
          @dblclick.stop.prevent
        >
          复制文件名
        </button>
        <button
          v-if="renameVisible !== false"
          class="workspace-file-action-menu__item"
          type="button"
          role="menuitem"
          :disabled="renameDisabled"
          :title="renameDisabled ? renameDisabledReason : undefined"
          @click.stop.prevent="handleRename"
          @dblclick.stop.prevent
        >
          {{ renameLabel || '重命名' }}
        </button>
        <button
          v-if="downloadVisible !== false"
          class="workspace-file-action-menu__item"
          type="button"
          role="menuitem"
          @click.stop.prevent="handleDownload"
          @dblclick.stop.prevent
        >
          下载
        </button>
        <button
          v-if="deleteVisible !== false"
          class="workspace-file-action-menu__item workspace-file-action-menu__item--danger"
          type="button"
          role="menuitem"
          :disabled="deleteDisabled"
          :title="deleteDisabled ? deleteDisabledReason : undefined"
          @click.stop.prevent="handleDelete"
          @dblclick.stop.prevent
        >
          删除
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  fileName: string
  copyVisible?: boolean
  renameLabel?: string
  renameVisible?: boolean
  downloadVisible?: boolean
  deleteVisible?: boolean
  renameDisabled?: boolean
  renameDisabledReason?: string
  deleteDisabled?: boolean
  deleteDisabledReason?: string
}>()

const emit = defineEmits<{
  (event: 'copy-file-name'): void
  (event: 'rename'): void
  (event: 'download'): void
  (event: 'delete'): void
}>()

const isOpen = ref(false)
const root = ref<HTMLElement | null>(null)
const dropdown = ref<HTMLElement | null>(null)
const dropdownTop = ref(0)
const dropdownLeft = ref(0)

const DROPDOWN_GAP_PX = 8
const DROPDOWN_MIN_WIDTH_PX = 132
const VIEWPORT_EDGE_PADDING_PX = 12
const DROPDOWN_ITEM_HEIGHT_PX = 42
const DROPDOWN_ITEM_GAP_PX = 4
const DROPDOWN_VERTICAL_PADDING_PX = 12

const visibleItemCount = computed(() => {
  let count = 0
  if (props.copyVisible) count += 1
  if (props.renameVisible !== false) count += 1
  if (props.downloadVisible !== false) count += 1
  if (props.deleteVisible !== false) count += 1
  return count
})

const dropdownApproxHeightPx = computed(() => {
  if (visibleItemCount.value === 0) return DROPDOWN_VERTICAL_PADDING_PX
  return DROPDOWN_VERTICAL_PADDING_PX
    + (visibleItemCount.value * DROPDOWN_ITEM_HEIGHT_PX)
    + ((visibleItemCount.value - 1) * DROPDOWN_ITEM_GAP_PX)
})

const dropdownStyle = computed(() => ({
  top: `${dropdownTop.value}px`,
  left: `${dropdownLeft.value}px`
}))

function toggleMenu(): void {
  isOpen.value = !isOpen.value
}

function closeMenu(): void {
  isOpen.value = false
}

function handleCopyFileName(): void {
  emit('copy-file-name')
  closeMenu()
}

function handleRename(): void {
  emit('rename')
  closeMenu()
}

function handleDownload(): void {
  emit('download')
  closeMenu()
}

function handleDelete(): void {
  emit('delete')
  closeMenu()
}

function updateDropdownPosition(): void {
  if (!isOpen.value || !root.value) return
  const rect = root.value.getBoundingClientRect()
  const maxLeft = Math.max(
    VIEWPORT_EDGE_PADDING_PX,
    window.innerWidth - DROPDOWN_MIN_WIDTH_PX - VIEWPORT_EDGE_PADDING_PX
  )
  const nextLeft = Math.min(Math.max(rect.right - DROPDOWN_MIN_WIDTH_PX, VIEWPORT_EDGE_PADDING_PX), maxLeft)
  const preferTop = rect.bottom + DROPDOWN_GAP_PX
  const canOpenDownward =
    preferTop + dropdownApproxHeightPx.value <= window.innerHeight - VIEWPORT_EDGE_PADDING_PX
  const nextTop = canOpenDownward
    ? preferTop
    : Math.max(VIEWPORT_EDGE_PADDING_PX, rect.top - dropdownApproxHeightPx.value - DROPDOWN_GAP_PX)
  dropdownLeft.value = nextLeft
  dropdownTop.value = nextTop
}

function handleDocumentPointerDown(event: PointerEvent): void {
  if (!isOpen.value || !root.value) return
  const target = event.target
  if (!(target instanceof Node)) return
  if (root.value.contains(target) || dropdown.value?.contains(target)) return
  closeMenu()
}

function handleViewportChange(): void {
  updateDropdownPosition()
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  window.addEventListener('resize', handleViewportChange)
  window.addEventListener('scroll', handleViewportChange, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  window.removeEventListener('resize', handleViewportChange)
  window.removeEventListener('scroll', handleViewportChange, true)
})

watch(isOpen, async (open) => {
  if (!open) return
  await nextTick()
  updateDropdownPosition()
})
</script>

<style scoped>
.workspace-file-action-menu {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
}

.workspace-file-action-menu__trigger {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-tertiary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.workspace-file-action-menu__trigger:hover,
.workspace-file-action-menu__trigger:focus-visible {
  border-color: var(--line-subtle);
  background: var(--surface-subtle);
  color: var(--text-primary);
}

.workspace-file-action-menu__dropdown {
  position: fixed;
  min-width: 132px;
  padding: 6px;
  border: 1px solid var(--line-subtle);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(12px);
  display: grid;
  gap: 4px;
  z-index: 40;
}

.workspace-file-action-menu__item {
  width: 100%;
  padding: 9px 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  font-size: var(--font-dense);
  line-height: var(--line-dense);
}

.workspace-file-action-menu__item:hover,
.workspace-file-action-menu__item:focus-visible {
  background: var(--accent-lighter);
  border-color: var(--accent-light);
  color: var(--accent);
}

.workspace-file-action-menu__item:disabled {
  cursor: not-allowed;
  opacity: 0.48;
  background: transparent;
  border-color: transparent;
  color: var(--text-tertiary);
}

.workspace-file-action-menu__item--danger {
  color: var(--danger, #d14343);
}

.workspace-file-action-menu__item--danger:hover,
.workspace-file-action-menu__item--danger:focus-visible {
  border-color: color-mix(in srgb, var(--danger, #d14343) 28%, transparent);
  background: color-mix(in srgb, var(--danger, #d14343) 12%, transparent);
  color: var(--danger, #d14343);
}
</style>
