<template>
  <div class="workspace-text-search-bar">
    <div class="workspace-text-search-bar__row">
      <input
        class="workspace-text-search-bar__input"
        :value="modelValue"
        type="text"
        placeholder="在当前文件中搜索"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      >
      <button class="workspace-text-search-bar__button" type="button" :disabled="!modelValue" @click="emit('previous')">
        上一个
      </button>
      <button class="workspace-text-search-bar__button" type="button" :disabled="!modelValue" @click="emit('next')">
        下一个
      </button>
      <button class="workspace-text-search-bar__button" type="button" :disabled="!canReplace" @click="emit('toggle-replace')">
        {{ replaceExpanded ? '收起替换' : '替换' }}
      </button>
      <button class="workspace-text-search-bar__button" type="button" @click="emit('close')">
        关闭
      </button>
    </div>

    <div v-if="replaceExpanded" class="workspace-text-search-bar__row workspace-text-search-bar__row--replace">
      <input
        class="workspace-text-search-bar__input"
        :value="replaceValue"
        type="text"
        placeholder="替换为"
        :disabled="!canReplace"
        @input="emit('update:replaceValue', ($event.target as HTMLInputElement).value)"
      >
      <button class="workspace-text-search-bar__button" type="button" :disabled="!canReplace" @click="emit('replace-current')">
        替换当前
      </button>
      <button class="workspace-text-search-bar__button" type="button" :disabled="!canReplace" @click="emit('replace-all')">
        全部替换
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string
  replaceValue: string
  replaceExpanded: boolean
  canReplace: boolean
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
  (event: 'update:replaceValue', value: string): void
  (event: 'toggle-replace'): void
  (event: 'previous'): void
  (event: 'next'): void
  (event: 'close'): void
  (event: 'replace-current'): void
  (event: 'replace-all'): void
}>()
</script>

<style scoped>
.workspace-text-search-bar {
  display: grid;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line-subtle);
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.98), rgba(255, 255, 255, 0.98));
}

.workspace-text-search-bar__row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.workspace-text-search-bar__row--replace {
  padding-top: 2px;
}

.workspace-text-search-bar__input {
  min-width: 0;
  flex: 1 1 240px;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--line-subtle);
  border-radius: 8px;
  background: #fff;
  color: var(--text-primary);
  font-size: var(--font-dense);
  line-height: var(--line-dense);
}

.workspace-text-search-bar__button {
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line-subtle);
  background: var(--surface-subtle);
  color: var(--text-secondary);
}

@media (max-width: 880px) {
  .workspace-text-search-bar__row {
    align-items: stretch;
  }

  .workspace-text-search-bar__button {
    flex: 1 1 120px;
  }
}
</style>
