<template>
  <section class="pending-question-card">
    <header class="pending-question-card__header">
      <p class="pending-question-card__eyebrow">待处理问题</p>
      <h3>{{ interaction.payload.title || '需要补充信息后才能继续' }}</h3>
      <p class="pending-question-card__prompt">{{ interaction.payload.prompt }}</p>
      <div v-if="degradedDetails" class="pending-question-card__degraded">
        <p class="pending-question-card__degraded-reason">{{ degradedDetails.reason }}</p>
        <div
          v-if="degradedDetails.referenceOptions.length > 0"
          class="pending-question-card__reference"
        >
          <p class="pending-question-card__reference-title">参考选项</p>
          <ul class="pending-question-card__reference-list">
            <li
              v-for="(option, index) in degradedDetails.referenceOptions"
              :key="`${interaction.interactionId}-reference-${index}`"
            >
              {{ option }}
            </li>
          </ul>
        </div>
      </div>
    </header>

    <label
      v-for="field in interaction.payload.fields"
      :key="field.id"
      class="pending-question-card__field"
    >
      <span class="pending-question-card__label">
        {{ field.label }}
        <em v-if="isFieldRequired(field)" class="pending-question-card__required">必填</em>
      </span>

      <input
        v-if="field.type === 'text'"
        v-model="textValues[field.id]"
        class="pending-question-card__input"
        type="text"
        :disabled="disabled"
        :placeholder="field.placeholder || ''"
      >

      <select
        v-else
        v-model="selectValues[field.id]"
        :class="[
          'pending-question-card__input',
          { 'pending-question-card__input--placeholder': !selectValues[field.id] }
        ]"
        :disabled="disabled"
      >
        <option
          value=""
          disabled
          class="pending-question-card__placeholder-option"
        >
          {{ field.placeholder || (isFieldRequired(field) ? '请选择' : '（可跳过）') }}
        </option>
        <option
          v-for="option in field.options"
          :key="`${field.id}-${String(option.value)}`"
          :value="serializeOptionValue(option.value)"
        >
          {{ option.label }}
        </option>
      </select>

      <small v-if="errors[field.id]" class="pending-question-card__error">{{ errors[field.id] }}</small>
    </label>

    <p v-if="submitError" class="pending-question-card__submit-error">{{ submitError }}</p>

    <div class="pending-question-card__actions">
      <button class="secondary-btn" type="button" :disabled="disabled" @click="$emit('reject')">
        跳过
      </button>
      <button class="primary-btn" type="button" :disabled="disabled" @click="submit">
        {{ PRIMARY_ACTION_LABEL }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { AgentSessionInteraction, QuestionInteractionField } from '@/api/types'

const props = defineProps<{
  interaction: AgentSessionInteraction
  disabled?: boolean
}>()

const emit = defineEmits<{
  (event: 'reply', answer: Record<string, unknown>): void
  (event: 'reject'): void
}>()

const PRIMARY_ACTION_LABEL = '确认'
const textValues = ref<Record<string, string>>({})
const selectValues = ref<Record<string, string>>({})
const errors = ref<Record<string, string>>({})
const submitError = ref('')

watch(
  () => props.interaction.interactionId,
  () => {
    textValues.value = {}
    selectValues.value = {}
    errors.value = {}
    submitError.value = ''
  },
  { immediate: true }
)

const optionValueByKey = computed(() => {
  const entries = props.interaction.payload.fields.flatMap(field => {
    if (field.type !== 'select') {
      return []
    }
    return field.options.map(option => [serializeOptionValue(option.value), option.value] as const)
  })
  return new Map(entries)
})
const degradedDetails = computed(() => props.interaction.payload.degraded ?? null)

function submit(): void {
  const nextErrors: Record<string, string> = {}
  const answer: Record<string, unknown> = {}
  props.interaction.payload.fields.forEach(field => {
    const value = resolveFieldValue(field)
    if (value !== undefined) {
      answer[field.id] = value
    }
    if (isFieldRequired(field) && !isValuePresent(value)) {
      nextErrors[field.id] = `请填写${field.label}`
    }
  })
  errors.value = nextErrors
  submitError.value = Object.keys(nextErrors).length > 0 ? '请先补全必填项。' : ''
  if (Object.keys(nextErrors).length > 0) {
    return
  }
  emit('reply', answer)
}

function resolveFieldValue(field: QuestionInteractionField): unknown {
  if (field.type === 'text') {
    const value = textValues.value[field.id]?.trim() || ''
    return value ? value : undefined
  }
  const selected = selectValues.value[field.id] || ''
  if (!selected) {
    return undefined
  }
  return optionValueByKey.value.get(selected)
}

function isFieldRequired(field: QuestionInteractionField): boolean {
  return field.required ?? props.interaction.payload.required
}

function isValuePresent(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0
  }
  return value !== null && value !== undefined
}

function serializeOptionValue(value: unknown): string {
  return JSON.stringify(value)
}
</script>

<style scoped>
.pending-question-card {
  border: 1px solid rgba(42, 88, 128, 0.18);
  border-left: 3px solid rgba(42, 88, 128, 0.5);
  background: linear-gradient(180deg, rgba(248, 252, 255, 0.98), rgba(241, 247, 255, 0.98));
  border-radius: 18px;
  padding: 18px;
  display: grid;
  gap: 14px;
}

.pending-question-card__header h3 {
  margin: 6px 0 8px;
  font-size: 1rem;
}

.pending-question-card__eyebrow {
  margin: 0;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #5b6c7d;
}

.pending-question-card__prompt {
  margin: 0;
  color: #30465d;
  line-height: 1.5;
  white-space: pre-wrap;
}

.pending-question-card__degraded {
  margin-top: 10px;
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 244, 228, 0.75);
  border: 1px solid rgba(199, 140, 71, 0.22);
  display: grid;
  gap: 10px;
}

.pending-question-card__degraded-reason,
.pending-question-card__reference-title,
.pending-question-card__reference-list {
  margin: 0;
}

.pending-question-card__degraded-reason {
  color: #7a4f1d;
  line-height: 1.5;
}

.pending-question-card__reference {
  display: grid;
  gap: 6px;
}

.pending-question-card__reference-title {
  font-size: 0.84rem;
  color: #8a5b23;
  font-weight: 600;
}

.pending-question-card__reference-list {
  padding-left: 18px;
  color: #5c4633;
  display: grid;
  gap: 4px;
}

.pending-question-card__field {
  display: grid;
  gap: 6px;
}

.pending-question-card__label {
  font-size: 0.92rem;
  color: #22364a;
  display: flex;
  gap: 6px;
  align-items: center;
}

.pending-question-card__required {
  font-style: normal;
  font-size: 0.75rem;
  color: #a54848;
}

.pending-question-card__input {
  width: 100%;
  min-height: 44px;
  border-radius: 12px;
  border: 1px solid rgba(63, 93, 122, 0.2);
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.96);
}

.pending-question-card__input--placeholder,
.pending-question-card__placeholder-option {
  color: #9ca3af;
}

.pending-question-card__error,
.pending-question-card__submit-error {
  color: #b24a3a;
  font-size: 0.82rem;
}

.pending-question-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
