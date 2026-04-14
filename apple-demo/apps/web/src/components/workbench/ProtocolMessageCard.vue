<template>
  <div class="protocol-card">
    <div
      v-for="component in supportedComponents"
      :key="String(component.id || component.type)"
      class="protocol-card__component"
    >
      <div
        v-if="isTextComponent(component)"
        class="protocol-card__text"
        :class="textStyleClass(component.style)"
      >
        {{ component.content }}
      </div>

      <section v-else-if="isListComponent(component)" class="protocol-card__list">
        <p v-if="component.label" class="protocol-card__label">{{ component.label }}</p>
        <ul class="protocol-card__items">
          <li
            v-for="item in component.items"
            :key="item.id || item.title"
            class="protocol-card__item"
            :class="{
              'protocol-card__item--selectable': isSelectableList(component),
              'protocol-card__item--selected': isListItemSelected(component.id, item.id)
            }"
          >
            <button
              v-if="isSelectableList(component)"
              class="protocol-card__item-btn"
              type="button"
              :disabled="disabled || actionBusy || !item.id"
              @click="toggleListItem(component, item.id)"
            >
              <strong>{{ item.title }}</strong>
              <small v-if="item.description">{{ item.description }}</small>
            </button>
            <template v-else>
              <strong>{{ item.title }}</strong>
              <small v-if="item.description">{{ item.description }}</small>
            </template>
          </li>
        </ul>
      </section>

      <section v-else-if="isFormComponent(component)" class="protocol-card__form">
        <p v-if="component.label" class="protocol-card__label">{{ component.label }}</p>
        <label
          v-for="field in component.fields"
          :key="field.id"
          class="protocol-card__field"
        >
          <span class="protocol-card__field-label">
            {{ field.label }}
            <em v-if="isFieldRequired(field)" class="protocol-card__field-required">必填</em>
          </span>

          <input
            v-if="field.type === 'text'"
            class="protocol-card__input"
            type="text"
            :value="fieldValue(component.id, field.id)"
            :placeholder="field.placeholder || ''"
            :disabled="isFieldDisabled(component, field)"
            @input="handleTextInput(component.id, field.id, $event)"
          >

          <select
            v-else
            class="protocol-card__input"
            :disabled="isFieldDisabled(component, field)"
            :value="selectedOptionIndex(field, formValue(component.id, field.id))"
            @change="handleSelectInput(component.id, field, $event)"
          >
            <option
              v-if="selectedOptionIndex(field, formValue(component.id, field.id)) === ''"
              value=""
              disabled
              hidden
            >
              {{ selectPlaceholder(field) }}
            </option>
            <option
              v-for="(option, optionIndex) in field.options"
              :key="`${field.id}-${optionIndex}`"
              :value="String(optionIndex)"
            >
              {{ option.label }}
            </option>
          </select>

          <small
            v-if="fieldError(component.id, field.id)"
            class="protocol-card__field-error"
          >
            {{ fieldError(component.id, field.id) }}
          </small>
        </label>
      </section>

      <section v-else-if="isTableComponent(component)" class="protocol-card__table-block">
        <div class="protocol-card__table-head">
          <p v-if="component.label" class="protocol-card__label">{{ component.label }}</p>
          <span class="protocol-card__table-mode">
            {{ component.editable && component.readonly !== true ? '可编辑' : '只读' }}
          </span>
        </div>

        <div class="protocol-card__table-wrap">
          <table class="protocol-card__table">
            <thead>
              <tr>
                <th v-for="column in tableColumns(component)" :key="column.id">{{ column.label }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) in tableRows(component.id)" :key="`${component.id}-${rowIndex}`">
                <td v-for="column in tableColumns(component)" :key="column.id">
                  <input
                    v-if="column.editable && !disabled && !actionBusy"
                    class="protocol-card__table-input"
                    type="text"
                    :value="stringifyValue(row[column.id])"
                    @input="handleTableInput(component.id, rowIndex, column.id, $event)"
                  >
                  <span v-else>{{ stringifyValue(row[column.id]) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-else-if="isButtonGroupComponent(component)" class="protocol-card__button-group">
        <p v-if="component.label" class="protocol-card__label">{{ component.label }}</p>
        <div class="protocol-card__button-row">
          <button
            v-for="button in normalizeButtonGroupButtons(component)"
            :key="button.id"
            class="protocol-card__button"
            :class="buttonStyleClass(button.style)"
            type="button"
            :disabled="disabled || actionBusy || button.disabled || !resolveButtonAction(button)"
            @click="triggerButtonAction(button)"
          >
            {{ button.label }}
          </button>
        </div>
      </section>
    </div>

    <div v-if="unsupportedTypes.length > 0" class="protocol-card__fallback">
      暂未完整支持的协议组件：{{ unsupportedTypes.join('、') }}
    </div>

    <p v-for="notice in renderState.notices" :key="notice" class="protocol-card__note">{{ notice }}</p>
    <p v-if="stateNote" class="protocol-card__note">{{ stateNote }}</p>

    <div v-if="standaloneActions.length" class="protocol-card__actions">
      <button
        v-for="action in standaloneActions"
        :key="action.id"
        class="protocol-card__action-btn"
        type="button"
        :disabled="action.disabled || disabled || actionBusy"
        @click="$emit('action', action)"
      >
        {{ action.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { ProtocolAction } from '@/api/types'
import type { UiProtocolMessage } from '@/stores/workbenchStore'
import {
  buildFieldErrorKey,
  buildProtocolRenderState,
  getRenderedProtocolPayload,
  isButtonGroupComponent,
  isFormComponent,
  isListComponent,
  isSelectableList,
  isTableComponent,
  isTextComponent,
  normalizeButtonGroupButtons,
  normalizeTableColumns,
  resolveQuestionFieldRequired,
  updateProtocolFormValue,
  updateProtocolListSelection,
  updateProtocolTableCell,
  type ProtocolButtonGroupButton,
  type ProtocolFormField,
  type ProtocolFormComponent,
  type ProtocolListComponent,
  type ProtocolMessageState
} from './protocolRuntime'

const props = defineProps<{
  message: UiProtocolMessage
  disabled?: boolean
}>()

const emit = defineEmits<{
  (event: 'action', action: ProtocolAction): void
  (event: 'state-change', state: ProtocolMessageState): void
}>()

const renderedProtocol = computed(() => {
  return getRenderedProtocolPayload(props.message.protocol, props.message.protocolState)
})

const renderState = computed(() => {
  return buildProtocolRenderState(renderedProtocol.value, props.message.protocolState)
})

const supportedComponents = computed(() => {
  return renderedProtocol.value.components.filter(component => {
    return isTextComponent(component)
      || isListComponent(component)
      || isFormComponent(component)
      || isTableComponent(component)
      || isButtonGroupComponent(component)
  })
})

const unsupportedTypes = computed(() => {
  return renderedProtocol.value.components
    .filter(component => {
      return !isTextComponent(component)
        && !isListComponent(component)
        && !isFormComponent(component)
        && !isTableComponent(component)
        && !isButtonGroupComponent(component)
    })
    .map(component => String(component.type || 'unknown'))
})

const groupedActionIds = computed(() => {
  return new Set(
    supportedComponents.value
      .flatMap(component => isButtonGroupComponent(component) ? normalizeButtonGroupButtons(component) : [])
      .map(button => button.actionId)
      .filter((actionId): actionId is string => typeof actionId === 'string' && actionId.trim().length > 0)
  )
})

const standaloneActions = computed(() => {
  return (renderedProtocol.value.actions || []).filter(action => !groupedActionIds.value.has(action.id))
})

const stateNote = computed(() => renderState.value.note)
const actionBusy = computed(() => props.message.protocolState?.actionStatus === 'submitting')

function formValue(formId: string, fieldId: string): unknown {
  return renderState.value.form[formId]?.[fieldId]
}

function fieldValue(formId: string, fieldId: string): string {
  const value = formValue(formId, fieldId)
  return value === null || value === undefined ? '' : String(value)
}

function fieldError(formId: string, fieldId: string): string {
  return renderState.value.validationErrors[buildFieldErrorKey(formId, fieldId)] || ''
}

function isFieldRequired(field: ProtocolFormField): boolean {
  return resolveQuestionFieldRequired(field.required, questionRequiredDefault())
}

function isFieldDisabled(component: ProtocolFormComponent, field: ProtocolFormField): boolean {
  return props.disabled === true
    || actionBusy.value
    || component.readonly === true
    || field.disabled === true
    || field.readonly === true
}

function handleTextInput(formId: string, fieldId: string, event: Event): void {
  emit('state-change', updateProtocolFormValue(
    props.message.protocolState,
    renderedProtocol.value,
    formId,
    fieldId,
    (event.target as HTMLInputElement).value
  ))
}

function handleSelectInput(formId: string, field: Extract<ProtocolFormField, { type: 'select' }>, event: Event): void {
  const rawValue = (event.target as HTMLSelectElement).value
  const optionIndex = Number(rawValue)
  const value = rawValue === ''
    ? ''
    : (Number.isInteger(optionIndex) ? field.options[optionIndex]?.value : undefined)
  emit('state-change', updateProtocolFormValue(
    props.message.protocolState,
    renderedProtocol.value,
    formId,
    field.id,
    value
  ))
}

function selectedOptionIndex(field: Extract<ProtocolFormField, { type: 'select' }>, value: unknown): string {
  const index = field.options.findIndex(option => protocolValuesEqual(option.value, value))
  return index >= 0 ? String(index) : ''
}

function selectPlaceholder(field: Extract<ProtocolFormField, { type: 'select' }>): string {
  return typeof field.placeholder === 'string' && field.placeholder.trim()
    ? field.placeholder
    : '请选择'
}

function questionRequiredDefault(): boolean {
  const data = renderedProtocol.value.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false
  }
  const content = (data as Record<string, unknown>).content
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    return false
  }
  return (content as Record<string, unknown>).required === true
}

function isListItemSelected(componentId: string | undefined, itemId: string | undefined): boolean {
  if (!componentId || !itemId) return false
  return (renderState.value.listSelection[componentId] || []).includes(itemId)
}

function toggleListItem(component: ProtocolListComponent, itemId: string | undefined): void {
  if (!component.id || !itemId) return
  const current = renderState.value.listSelection[component.id] || []
  const nextSelection = component.selectionMode === 'multiple'
    ? current.includes(itemId)
      ? current.filter(id => id !== itemId)
      : [...current, itemId]
    : current.includes(itemId)
      ? []
      : [itemId]

  emit('state-change', updateProtocolListSelection(
    props.message.protocolState,
    component.id,
    nextSelection
  ))
}

function tableColumns(component: Extract<(typeof supportedComponents.value)[number], { type: 'table' }>) {
  const tableState = renderState.value.table[component.id]
  return tableState?.columns || normalizeTableColumns(component)
}

function tableRows(tableId: string): Array<Record<string, unknown>> {
  return renderState.value.table[tableId]?.rows || []
}

function handleTableInput(tableId: string, rowIndex: number, columnId: string, event: Event): void {
  emit('state-change', updateProtocolTableCell(
    props.message.protocolState,
    renderedProtocol.value,
    tableId,
    rowIndex,
    columnId,
    (event.target as HTMLInputElement).value
  ))
}

function resolveButtonAction(button: ProtocolButtonGroupButton): ProtocolAction | null {
  if (button.action) return button.action
  if (!button.actionId) return null
  return renderedProtocol.value.actions?.find(action => action.id === button.actionId) || null
}

function triggerButtonAction(button: ProtocolButtonGroupButton): void {
  const action = resolveButtonAction(button)
  if (!action) return
  emit('action', action)
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function protocolValuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (typeof left === 'object' || typeof right === 'object') {
    return JSON.stringify(left) === JSON.stringify(right)
  }
  return String(left) === String(right)
}

function textStyleClass(style: string | undefined): string {
  switch (style) {
    case 'heading':
      return 'protocol-card__text--heading'
    case 'subheading':
      return 'protocol-card__text--subheading'
    case 'label':
      return 'protocol-card__text--label'
    case 'muted':
      return 'protocol-card__text--muted'
    case 'success':
      return 'protocol-card__text--success'
    case 'warning':
      return 'protocol-card__text--warning'
    case 'code':
      return 'protocol-card__text--code'
    default:
      return ''
  }
}

function buttonStyleClass(style: string | undefined): string {
  switch (style) {
    case 'secondary':
      return 'protocol-card__button--secondary'
    case 'danger':
      return 'protocol-card__button--danger'
    default:
      return 'protocol-card__button--primary'
  }
}
</script>

<style scoped>
.protocol-card {
  display: grid;
  gap: 12px;
}

.protocol-card__component {
  display: grid;
  gap: 8px;
}

.protocol-card__text {
  color: var(--text-primary);
  line-height: 1.6;
  white-space: pre-wrap;
}

.protocol-card__text--heading {
  font-size: var(--font-title);
  font-weight: 700;
  line-height: var(--line-title);
}

.protocol-card__text--subheading {
  font-size: var(--font-dense);
  font-weight: 700;
  line-height: var(--line-dense);
}

.protocol-card__text--label {
  color: var(--text-small);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: var(--font-overline);
  font-weight: 700;
  line-height: var(--line-overline);
}

.protocol-card__text--muted {
  color: var(--text-secondary);
}

.protocol-card__text--success {
  color: #1f7a45;
  font-weight: 600;
}

.protocol-card__text--warning {
  color: #9a5d0d;
  font-weight: 600;
}

.protocol-card__text--code {
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(246, 248, 251, 0.96);
  font-family: var(--font-family-mono);
  font-size: var(--font-code-inline);
  line-height: var(--line-code-inline);
}

.protocol-card__label {
  margin: 0;
  font-size: var(--font-overline);
  font-weight: 700;
  line-height: var(--line-overline);
  color: var(--text-small);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.protocol-card__items,
.protocol-card__form {
  display: grid;
  gap: 8px;
}

.protocol-card__items {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 18rem;
  overflow-y: auto;
}

.protocol-card__form {
  max-height: 18rem;
  overflow-y: auto;
}

.protocol-card__item,
.protocol-card__field,
.protocol-card__note {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--line-subtle);
  background: rgba(255, 255, 255, 0.78);
}

.protocol-card__item--selectable {
  padding: 0;
}

.protocol-card__item--selected {
  border-color: var(--accent-light);
  background: var(--accent-lighter);
}

.protocol-card__item-btn {
  width: 100%;
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  text-align: left;
  color: inherit;
}

.protocol-card__field-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.protocol-card__field-required {
  color: #b94a48;
  font-style: normal;
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.protocol-card__input,
.protocol-card__table-input {
  min-height: 38px;
  border-radius: 10px;
  border: 1px solid var(--line-subtle);
  background: rgba(255, 255, 255, 0.94);
  padding: 0 12px;
  color: var(--text-primary);
  font-family: var(--font-family-ui);
  font-size: var(--font-table);
  line-height: var(--line-table);
}

.protocol-card__field-error {
  color: #b94a48;
}

.protocol-card__table-block {
  display: grid;
  gap: 8px;
}

.protocol-card__table-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.protocol-card__table-mode {
  color: var(--text-secondary);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.protocol-card__table-wrap {
  overflow: auto;
  max-height: 18rem;
  border-radius: 12px;
  border: 1px solid var(--line-subtle);
  background: rgba(255, 255, 255, 0.82);
}

.protocol-card__table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-family-ui);
  font-size: var(--font-table);
  line-height: var(--line-table);
}

.protocol-card__table th,
.protocol-card__table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--line-subtle);
  text-align: left;
  vertical-align: top;
}

.protocol-card__table th {
  font-weight: 700;
  background: rgba(246, 248, 251, 0.96);
  font-size: var(--font-table-meta);
  line-height: var(--line-meta);
}

.protocol-card__button-group,
.protocol-card__button-row,
.protocol-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.protocol-card__button,
.protocol-card__action-btn {
  min-height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--accent-light);
  background: var(--accent-lighter);
  color: var(--accent);
  font-weight: 600;
}

.protocol-card__button--secondary {
  background: var(--surface-subtle);
  color: var(--text-secondary);
  border-color: var(--line-subtle);
}

.protocol-card__button--danger {
  border-color: rgba(185, 74, 72, 0.32);
  background: rgba(185, 74, 72, 0.08);
  color: #b94a48;
}

.protocol-card__item small,
.protocol-card__fallback,
.protocol-card__note {
  color: var(--text-secondary);
  font-size: var(--font-meta);
  line-height: var(--line-meta);
}

.protocol-card__fallback {
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--surface-subtle);
}

.protocol-card__button:disabled,
.protocol-card__action-btn:disabled,
.protocol-card__item-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
