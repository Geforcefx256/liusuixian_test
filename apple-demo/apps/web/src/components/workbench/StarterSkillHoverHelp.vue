<template>
  <div
    class="starter-skill-hover-help"
    @mouseenter="openHelp"
    @mouseleave="closeHelp"
    @focusin="openHelp"
    @focusout="handleFocusOut"
  >
    <button
      :aria-describedby="isOpen ? helpId : undefined"
      :aria-label="`查看${skill.governedTitleText}快速开始摘要`"
      class="starter-skill-hover-help__trigger"
      type="button"
    >
      i
    </button>
    <section
      v-if="isOpen"
      :id="helpId"
      :class="`starter-skill-hover-help__card--${placement}`"
      class="starter-skill-hover-help__card"
      role="tooltip"
    >
      <p class="starter-skill-hover-help__title">{{ skill.governedTitleText }}</p>
      <p class="starter-skill-hover-help__description">{{ skill.starterSummaryText }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { StarterSkillView } from '@/stores/workbenchStore'

type StarterHelpPlacement = 'right' | 'bottom' | 'left'

const props = defineProps<{
  skill: StarterSkillView
  placement: StarterHelpPlacement
}>()

const isOpen = ref(false)
const helpId = computed(() => `starter-skill-help-${props.skill.id}`)

function openHelp(): void {
  isOpen.value = true
}

function closeHelp(): void {
  isOpen.value = false
}

function handleFocusOut(event: FocusEvent): void {
  const nextTarget = event.relatedTarget
  if (nextTarget instanceof Node && event.currentTarget instanceof HTMLElement) {
    if (event.currentTarget.contains(nextTarget)) {
      return
    }
  }
  closeHelp()
}
</script>

<style scoped>
.starter-skill-hover-help {
  position: relative;
  display: none;
  align-items: center;
}

.starter-skill-hover-help__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: 22px;
  block-size: 22px;
  padding: 0;
  border: 1px solid rgba(37, 99, 235, 0.24);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  cursor: help;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease;
}

.starter-skill-hover-help__trigger:hover,
.starter-skill-hover-help__trigger:focus-visible {
  border-color: rgba(37, 99, 235, 0.42);
  background: rgba(239, 246, 255, 0.96);
  outline: none;
}

.starter-skill-hover-help__card {
  position: absolute;
  z-index: 12;
  inline-size: min(32ch, calc(100vw - 72px));
  padding: 12px 14px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.16);
}

.starter-skill-hover-help__card--right {
  top: 50%;
  left: calc(100% + 12px);
  transform: translateY(-50%);
}

.starter-skill-hover-help__card--bottom {
  top: calc(100% + 12px);
  left: 0;
}

.starter-skill-hover-help__card--left {
  top: 50%;
  right: calc(100% + 12px);
  transform: translateY(-50%);
}

.starter-skill-hover-help__title {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-dense);
  font-weight: 700;
  line-height: var(--line-dense);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.starter-skill-hover-help__description {
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
  display: -webkit-box;
  line-clamp: 6;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}

@media (min-width: 981px) {
  .starter-skill-hover-help {
    display: inline-flex;
  }
}
</style>
