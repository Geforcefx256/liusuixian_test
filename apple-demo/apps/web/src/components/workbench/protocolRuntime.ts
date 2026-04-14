import type { ProtocolAction, ProtocolPayload } from '@/api/types'

export type ProtocolActionStatus = 'idle' | 'submitting' | 'done' | 'error' | 'blocked'

export interface ProtocolTextComponent {
  type: 'text'
  id?: string
  content: string
  style?: string
}

export interface ProtocolListItem {
  id?: string
  title: string
  description?: string
  selected?: boolean
}

export interface ProtocolListComponent {
  type: 'list'
  id?: string
  label?: string
  items: ProtocolListItem[]
  selectable?: boolean
  selectionMode?: 'single' | 'multiple'
}

export interface ProtocolFormOption {
  label: string
  value: unknown
}

interface ProtocolFormFieldBase {
  id: string
  label: string
  required?: boolean
  disabled?: boolean
  readonly?: boolean
}

export interface ProtocolTextField extends ProtocolFormFieldBase {
  type: 'text'
  value?: string
  placeholder?: string
}

export interface ProtocolSelectField extends ProtocolFormFieldBase {
  type: 'select'
  value?: unknown
  placeholder?: string
  options: ProtocolFormOption[]
}

export type ProtocolFormField = ProtocolTextField | ProtocolSelectField

export interface ProtocolFormComponent {
  type: 'form'
  id: string
  label?: string
  fields: ProtocolFormField[]
  readonly?: boolean
}

export interface ProtocolTableColumn {
  id: string
  label: string
  editable?: boolean
}

export interface ProtocolTableComponent {
  type: 'table'
  id: string
  label?: string
  columns: Array<string | ProtocolTableColumn>
  rows: Array<Record<string, unknown>>
  editable?: boolean
  readonly?: boolean
}

export interface ProtocolButtonGroupButton {
  id: string
  label: string
  actionId?: string
  action?: ProtocolAction
  style?: string
  disabled?: boolean
}

export interface ProtocolButtonGroupComponent {
  type: 'button-group'
  id?: string
  label?: string
  buttons: ProtocolButtonGroupButton[]
}

export interface ProtocolTableState {
  columns: ProtocolTableColumn[]
  rows: Array<Record<string, unknown>>
}

export interface ProtocolMessageState {
  form?: Record<string, Record<string, unknown>>
  listSelection?: Record<string, string[]>
  table?: Record<string, ProtocolTableState>
  message?: ProtocolPayload | null
  note?: string
  notices?: string[]
  validationErrors?: Record<string, string>
  actionStatus?: ProtocolActionStatus
  lastActionId?: string
  compatibility?: {
    tool?: string
    status?: 'missing_context' | 'unsupported'
    message: string
  }
  updatedAt?: number
  [key: string]: unknown
}

export interface ProtocolRenderState {
  form: Record<string, Record<string, unknown>>
  listSelection: Record<string, string[]>
  table: Record<string, ProtocolTableState>
  validationErrors: Record<string, string>
  note: string
  notices: string[]
}

export interface ProtocolActionContext {
  form: Record<string, Record<string, unknown>>
  listSelection: Record<string, string[]>
  table: Record<string, ProtocolTableState>
  data: Record<string, unknown>
  meta: Record<string, unknown>
}

const WORKBOOK_TOOL_MESSAGES: Record<string, string> = {
  gateway_tools_invoke: '当前工作台未接入网关工具执行上下文，暂时只能展示该协议动作，无法直接执行。',
  modify_mml_rows: '当前工作台未接入表格行修改执行上下文，暂时无法在会话壳层内直接应用该操作。'
}

export function normalizeProtocolState(raw: Record<string, unknown> | null | undefined): ProtocolMessageState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }
  return raw as ProtocolMessageState
}

export function getRenderedProtocolPayload(
  protocol: ProtocolPayload,
  rawState: Record<string, unknown> | null | undefined
): ProtocolPayload {
  const state = normalizeProtocolState(rawState)
  return asProtocolPayload(state.message) || protocol
}

export function buildProtocolRenderState(
  protocol: ProtocolPayload,
  rawState: Record<string, unknown> | null | undefined
): ProtocolRenderState {
  const state = normalizeProtocolState(rawState)
  const form: Record<string, Record<string, unknown>> = {}
  const listSelection: Record<string, string[]> = {}
  const table: Record<string, ProtocolTableState> = {}

  for (const component of protocol.components) {
    if (isFormComponent(component)) {
      form[component.id] = {
        ...buildDefaultFormValues(component),
        ...(state.form?.[component.id] || {})
      }
      continue
    }

    if (isListComponent(component) && component.id) {
      listSelection[component.id] = state.listSelection?.[component.id]
        || component.items
          .filter(item => item.selected && item.id)
          .map(item => item.id as string)
      continue
    }

    if (isTableComponent(component)) {
      table[component.id] = state.table?.[component.id] || {
        columns: normalizeTableColumns(component),
        rows: component.rows.map(row => ({ ...row }))
      }
    }
  }

  return {
    form,
    listSelection,
    table,
    validationErrors: state.validationErrors || {},
    note: typeof state.note === 'string' ? state.note : '',
    notices: Array.isArray(state.notices)
      ? state.notices.filter((notice): notice is string => typeof notice === 'string' && notice.trim().length > 0)
      : []
  }
}

export function isTextComponent(component: unknown): component is ProtocolTextComponent {
  return Boolean(component)
    && typeof component === 'object'
    && (component as { type?: unknown }).type === 'text'
    && typeof (component as { content?: unknown }).content === 'string'
}

export function isListComponent(component: unknown): component is ProtocolListComponent {
  return Boolean(component)
    && typeof component === 'object'
    && (component as { type?: unknown }).type === 'list'
    && Array.isArray((component as { items?: unknown[] }).items)
    && ((component as { items: unknown[] }).items).every(item => {
      return item
        && typeof item === 'object'
        && typeof (item as ProtocolListItem).title === 'string'
    })
}

export function isFormComponent(component: unknown): component is ProtocolFormComponent {
  return Boolean(component)
    && typeof component === 'object'
    && (component as { type?: unknown }).type === 'form'
    && typeof (component as { id?: unknown }).id === 'string'
    && Array.isArray((component as { fields?: unknown[] }).fields)
}

export function isTableComponent(component: unknown): component is ProtocolTableComponent {
  return Boolean(component)
    && typeof component === 'object'
    && (component as { type?: unknown }).type === 'table'
    && typeof (component as { id?: unknown }).id === 'string'
    && Array.isArray((component as { rows?: unknown[] }).rows)
    && Array.isArray((component as { columns?: unknown[] }).columns)
}

export function isButtonGroupComponent(component: unknown): component is ProtocolButtonGroupComponent {
  const buttons = (component as { buttons?: unknown[]; items?: unknown[] } | null)?.buttons
    || (component as { buttons?: unknown[]; items?: unknown[] } | null)?.items
  return Boolean(component)
    && typeof component === 'object'
    && (component as { type?: unknown }).type === 'button-group'
    && Array.isArray(buttons)
}

export function isSelectableList(component: ProtocolListComponent): boolean {
  return component.selectable === true
    || component.selectionMode === 'single'
    || component.selectionMode === 'multiple'
}

export function normalizeButtonGroupButtons(component: ProtocolButtonGroupComponent): ProtocolButtonGroupButton[] {
  const rawButtons = component.buttons || []
  return rawButtons.filter(isButtonGroupButton)
}

export function normalizeTableColumns(component: ProtocolTableComponent): ProtocolTableColumn[] {
  return component.columns.map((column, index) => {
    if (typeof column === 'string') {
      return {
        id: column,
        label: column,
        editable: component.editable === true && component.readonly !== true
      }
    }

    const id = typeof column.id === 'string' && column.id.trim()
      ? column.id
      : `column-${index + 1}`
    return {
      id,
      label: typeof column.label === 'string' && column.label.trim() ? column.label : id,
      editable: component.editable === true
        && component.readonly !== true
        && column.editable !== false
    }
  })
}

export function buildProtocolActionContext(
  protocol: ProtocolPayload,
  rawState: Record<string, unknown> | null | undefined
): ProtocolActionContext {
  const renderState = buildProtocolRenderState(protocol, rawState)
  return {
    form: renderState.form,
    listSelection: renderState.listSelection,
    table: renderState.table,
    data: isRecord(protocol.data) ? protocol.data : {},
    meta: isRecord(protocol.meta) ? protocol.meta : {}
  }
}

export function resolveProtocolPlaceholders(value: unknown, context: ProtocolActionContext): unknown {
  if (typeof value === 'string') {
    return resolveProtocolPlaceholderString(value, context)
  }
  if (Array.isArray(value)) {
    return value.map(item => resolveProtocolPlaceholders(item, context))
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, resolveProtocolPlaceholders(nested, context)])
    )
  }
  return value
}

export function updateProtocolFormValue(
  rawState: Record<string, unknown> | null | undefined,
  protocol: ProtocolPayload,
  formId: string,
  fieldId: string,
  value: unknown
): ProtocolMessageState {
  const nextState = normalizeProtocolState(rawState)
  const renderState = buildProtocolRenderState(protocol, rawState)
  const formState = {
    ...renderState.form[formId],
    [fieldId]: value
  }
  const validationErrors = {
    ...(nextState.validationErrors || {})
  }
  delete validationErrors[buildFieldErrorKey(formId, fieldId)]
  return {
    ...nextState,
    form: {
      ...(nextState.form || {}),
      [formId]: formState
    },
    validationErrors,
    note: nextState.note,
    updatedAt: Date.now()
  }
}

export function updateProtocolListSelection(
  rawState: Record<string, unknown> | null | undefined,
  componentId: string,
  selectedIds: string[]
): ProtocolMessageState {
  const nextState = normalizeProtocolState(rawState)
  return {
    ...nextState,
    listSelection: {
      ...(nextState.listSelection || {}),
      [componentId]: selectedIds
    },
    updatedAt: Date.now()
  }
}

export function updateProtocolTableCell(
  rawState: Record<string, unknown> | null | undefined,
  protocol: ProtocolPayload,
  tableId: string,
  rowIndex: number,
  columnId: string,
  value: unknown
): ProtocolMessageState {
  const nextState = normalizeProtocolState(rawState)
  const renderState = buildProtocolRenderState(protocol, rawState)
  const currentTable = renderState.table[tableId]
  if (!currentTable) {
    return {
      ...nextState,
      updatedAt: Date.now()
    }
  }

  const rows = currentTable.rows.map((row, index) => {
    if (index !== rowIndex) return { ...row }
    return {
      ...row,
      [columnId]: value
    }
  })

  return {
    ...nextState,
    table: {
      ...(nextState.table || {}),
      [tableId]: {
        columns: currentTable.columns,
        rows
      }
    },
    updatedAt: Date.now()
  }
}

export function validateQuestionResponse(
  protocol: ProtocolPayload,
  rawState: Record<string, unknown> | null | undefined
): Record<string, string> {
  const renderState = buildProtocolRenderState(protocol, rawState)
  const protocolData = isRecord(protocol.data) ? protocol.data : {}
  const dataContent = isRecord(protocolData.content) ? protocolData.content : {}
  const questionRequired = dataContent.required === true
  const errors: Record<string, string> = {}

  for (const component of protocol.components) {
    if (!isFormComponent(component)) continue
    const values = renderState.form[component.id] || {}
    for (const field of component.fields) {
      const required = resolveQuestionFieldRequired(field.required, questionRequired)
      if (!required) continue
      if (!isProtocolValuePresent(values[field.id])) {
        errors[buildFieldErrorKey(component.id, field.id)] = `${field.label}为必填项`
      }
    }
  }

  return errors
}

export function withProtocolValidationErrors(
  rawState: Record<string, unknown> | null | undefined,
  validationErrors: Record<string, string>,
  note: string
): ProtocolMessageState {
  const nextState = normalizeProtocolState(rawState)
  return {
    ...nextState,
    actionStatus: 'error',
    validationErrors,
    note,
    updatedAt: Date.now()
  }
}

export function buildConvergedProtocolMessage(
  protocol: ProtocolPayload,
  options: {
    removeActionIds?: string[]
    disableActionIds?: string[]
    readonlyForms?: boolean
    readonlyTables?: boolean
  } = {}
): ProtocolPayload {
  const removeActionIds = new Set(options.removeActionIds || [])
  const disableActionIds = new Set(options.disableActionIds || [])
  const components = protocol.components.map(component => {
    if (options.readonlyForms && isFormComponent(component)) {
      return {
        ...component,
        readonly: true,
        fields: component.fields.map(field => ({
          ...field,
          disabled: true,
          readonly: true
        }))
      }
    }

    if (options.readonlyTables && isTableComponent(component)) {
      return {
        ...component,
        editable: false,
        readonly: true
      }
    }

    return component
  })

  const actions = (protocol.actions || [])
    .filter(action => !removeActionIds.has(action.id))
    .map(action => {
      if (!disableActionIds.has(action.id)) return action
      return {
        ...action,
        disabled: true
      }
    })

  return {
    ...protocol,
    components,
    actions
  }
}

export function buildRedirectedProtocolMessage(
  protocol: ProtocolPayload,
  action: ProtocolAction
): ProtocolPayload | null {
  const toolInput = isRecord(action.toolInput) ? action.toolInput : {}
  const directMessage = asProtocolPayload(toolInput.message) || asProtocolPayload(toolInput.protocol)
  if (directMessage) {
    return directMessage
  }

  if (Array.isArray(toolInput.components)) {
    return {
      ...protocol,
      components: toolInput.components.filter(component => isRecord(component)) as Array<Record<string, unknown>>,
      actions: Array.isArray(toolInput.actions)
        ? toolInput.actions.filter(isProtocolActionLike) as ProtocolAction[]
        : protocol.actions
    }
  }

  return null
}

export function summarizeQuestionResponseAnswer(
  protocol: ProtocolPayload,
  answer: unknown
): string {
  if (typeof answer === 'string' && answer.trim()) {
    return `已提交回答：${answer.trim()}`
  }
  if (!isRecord(answer)) {
    return '已提交回答'
  }

  const labels = buildFieldLabelMap(protocol)
  const parts = Object.entries(answer)
    .filter(([, value]) => isProtocolValuePresent(value))
    .map(([key, value]) => `${labels[key] || key}：${formatProtocolValue(value)}`)

  if (!parts.length) return '已提交回答'
  return `已提交回答：${parts.join('，')}`
}

export function rewriteQuestionResponseText(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{')) return null

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>
    if (!isRecord(parsed) || typeof parsed.questionId !== 'string' || !('answer' in parsed)) {
      return null
    }
    return summarizeQuestionResponseAnswer({ version: '1.0', components: [] }, parsed.answer)
  } catch {
    return null
  }
}

export function isEditablePersistedUserText(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) {
    return false
  }
  if (trimmed.startsWith('[INTERACTION CONTEXT]')) {
    return false
  }
  return rewriteQuestionResponseText(text) === null
}

export function getWorkbookCompatibilityMessage(tool: string | undefined): string | null {
  if (!tool) return null
  if (WORKBOOK_TOOL_MESSAGES[tool]) {
    return WORKBOOK_TOOL_MESSAGES[tool]
  }
  if (tool.includes('rows') || tool.includes('sheet') || tool.includes('gateway')) {
    return `当前工作台缺少执行 ${tool} 所需的 workbook 上下文，暂时只能展示兼容性提示。`
  }
  return null
}

export function buildFieldErrorKey(formId: string, fieldId: string): string {
  return `${formId}.${fieldId}`
}

export function resolveQuestionFieldRequired(
  fieldRequired: boolean | undefined,
  questionRequired: boolean
): boolean {
  return fieldRequired ?? questionRequired
}

function resolveProtocolPlaceholderString(value: string, context: ProtocolActionContext): unknown {
  const exactMatch = value.match(/^\$\{([^}]+)\}$/)
  if (exactMatch) {
    return lookupProtocolContextValue(exactMatch[1] || '', context)
  }

  return value.replace(/\$\{([^}]+)\}/g, (_, expression: string) => {
    return formatProtocolValue(lookupProtocolContextValue(expression, context))
  })
}

function lookupProtocolContextValue(expression: string, context: ProtocolActionContext): unknown {
  const [root, ...segments] = expression.trim().split('.').filter(Boolean)
  if (!root) return expression

  const source = root === 'form'
    ? context.form
    : root === 'listSelection'
      ? context.listSelection
      : root === 'table'
        ? context.table
        : root === 'data'
          ? context.data
          : root === 'meta'
            ? context.meta
            : null

  return resolveNestedProtocolValue(source, segments)
}

function resolveNestedProtocolValue(source: unknown, segments: string[]): unknown {
  let current = source
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const numericIndex = Number(segment)
      if (!Number.isInteger(numericIndex)) return undefined
      current = current[numericIndex]
      continue
    }

    if (!isRecord(current)) {
      return undefined
    }
    current = current[segment]
  }
  return current
}

function buildDefaultFormValues(component: ProtocolFormComponent): Record<string, unknown> {
  return Object.fromEntries(component.fields.map(field => [field.id, field.value ?? '']))
}

function buildFieldLabelMap(protocol: ProtocolPayload): Record<string, string> {
  const entries: Array<[string, string]> = []
  for (const component of protocol.components) {
    if (!isFormComponent(component)) continue
    for (const field of component.fields) {
      entries.push([field.id, field.label])
    }
  }
  return Object.fromEntries(entries)
}

function isButtonGroupButton(button: unknown): button is ProtocolButtonGroupButton {
  return Boolean(button)
    && typeof button === 'object'
    && typeof (button as { id?: unknown }).id === 'string'
    && typeof (button as { label?: unknown }).label === 'string'
}

function asProtocolPayload(value: unknown): ProtocolPayload | null {
  if (!isRecord(value)) return null
  if (typeof value.version !== 'string' || !Array.isArray(value.components)) {
    return null
  }
  return value as ProtocolPayload
}

function isProtocolActionLike(value: unknown): value is ProtocolAction {
  return Boolean(value)
    && typeof value === 'object'
    && typeof (value as { id?: unknown }).id === 'string'
    && typeof (value as { label?: unknown }).label === 'string'
    && typeof (value as { type?: unknown }).type === 'string'
}

function isProtocolValuePresent(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return value !== null && value !== undefined
}

function formatProtocolValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(item => formatProtocolValue(item)).join('、')
  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, nested]) => `${key}: ${formatProtocolValue(nested)}`)
      .join(', ')
  }
  return String(value)
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
