import { buildQuestionValidationHint, type QuestionValidationHint } from './questionValidationHints.js'
import {
  type QuestionContractWarning,
  normalizeQuestionOptionsInput
} from './questionInputNormalization.js'
import { inferOptionalFieldRequired } from './questionFieldRequiredNormalization.js'
import { createQuestionValueKey } from './questionValue.js'

const QUESTION_MIN_OPTIONS = 2
const RECOMMENDED_TAG = '(Recommended)'
const DEFAULT_FIELD_ID = 'answer'
export const NOTES_FIELD_ID = 'notes'
export const NOTES_FIELD_LABEL = '补充说明'
export const NOTES_FIELD_PLACEHOLDER = '可选，补充特殊情况或备注'
const TEXT_FIELD_GUIDANCE = 'Use a text field instead of select when the value is open-ended, for example a column index, file name, path, or version.'

type QuestionValidationCode =
  | 'prompt_required'
  | 'fields_or_options_required'
  | 'fields_and_options_conflict'
  | 'field_label_required'
  | 'field_type_invalid'
  | 'text_field_options_forbidden'
  | 'select_field_options_required'
  | 'field_ids_duplicate'
  | 'options_required'
  | 'options_count_invalid'
  | 'option_label_required'
  | 'option_value_required'
  | 'option_value_empty'
  | 'option_values_duplicate'
  | 'recommended_option_order'

const MODEL_MESSAGES: Record<QuestionValidationCode, string> = {
  prompt_required: 'Question prompt is required.',
  fields_or_options_required: 'Question must provide exactly one of fields or options.',
  fields_and_options_conflict: 'Question must provide exactly one of fields or options.',
  field_label_required: 'Question fields must include non-empty labels.',
  field_type_invalid: 'Question fields must be select or text.',
  text_field_options_forbidden: 'Text fields cannot include options.',
  select_field_options_required: 'Select fields must include at least 2 options.',
  field_ids_duplicate: 'Question field ids must be unique.',
  options_required: 'Select fields must include at least 2 options.',
  options_count_invalid: 'Select options must contain at least 2 items.',
  option_label_required: 'Select options must include non-empty labels.',
  option_value_required: 'Select options must include values.',
  option_value_empty: 'Select option values cannot be empty.',
  option_values_duplicate: 'Select option values must be unique.',
  recommended_option_order: 'Recommended option must be the first item.'
}

export interface QuestionOptionInput {
  label: string
  value: unknown
}

type QuestionFieldType = 'select' | 'text'

interface QuestionFieldInputBase {
  id?: string
  label: string
  type: QuestionFieldType
  placeholder?: string
  required?: boolean
}

export interface QuestionSelectFieldInput extends QuestionFieldInputBase {
  type: 'select'
  options: QuestionOptionInput[] | string
}

export interface QuestionTextFieldInput extends QuestionFieldInputBase {
  type: 'text'
}

export type QuestionFieldInput = QuestionSelectFieldInput | QuestionTextFieldInput

export interface LocalQuestionArgs {
  id?: string
  title?: string
  prompt: string
  label?: string
  required?: boolean
  placeholder?: string
  options?: QuestionOptionInput[] | string
  fields?: QuestionFieldInput[]
}

export interface PreparedQuestionFields {
  fields: QuestionFieldInput[]
  warnings: QuestionContractWarning[]
}

export class QuestionToolValidationError extends Error {
  readonly code: QuestionValidationCode
  readonly modelMessage: string
  readonly field?: string
  readonly expected?: string
  readonly actual?: string
  readonly fix?: string

  constructor(code: QuestionValidationCode, detail: string, hint: QuestionValidationHint = {}) {
    super(detail)
    this.name = 'QuestionToolValidationError'
    this.code = code
    this.modelMessage = MODEL_MESSAGES[code]
    this.field = hint.field
    this.expected = hint.expected
    this.actual = hint.actual
    this.fix = hint.fix
  }
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function resolveQuestionFieldRequired(
  fieldRequired: boolean | undefined,
  questionRequired: boolean
): boolean {
  return fieldRequired ?? questionRequired
}

export function prepareQuestionFields(args: LocalQuestionArgs): PreparedQuestionFields {
  assertPrompt(args.prompt)
  assertFieldsOrOptions(args)
  const questionRequired = args.required !== false
  if (args.fields) {
    const normalized = normalizeQuestionFieldInputs(args.fields, questionRequired)
    assertFields(normalized.fields)
    return {
      fields: appendNotesField(normalized.fields),
      warnings: normalized.warnings
    }
  }
  const normalizedOptions = normalizeQuestionOptionsInput(args.options, 'options')
  assertSelectOptions(normalizedOptions.options || undefined)
  return {
    fields: appendNotesField([{
    id: DEFAULT_FIELD_ID,
    label: isNonEmptyString(args.label) ? args.label.trim() : '请选择',
    type: 'select',
    options: normalizedOptions.options || []
    }]),
    warnings: normalizedOptions.warnings
  }
}

export function normalizeQuestionFields(fields: QuestionFieldInput[]): QuestionFieldInput[] {
  return fields.map((field, index) => normalizeQuestionField(field, index))
}

export function formatQuestionToolValidationError(error: unknown): string {
  if (error instanceof QuestionToolValidationError) {
    return error.modelMessage
  }
  return 'Question validation failed.'
}

export {
  DEFAULT_FIELD_ID, QUESTION_MIN_OPTIONS, RECOMMENDED_TAG, TEXT_FIELD_GUIDANCE
}

function assertPrompt(prompt: string): void {
  if (!isNonEmptyString(prompt)) {
    throw createValidationError('prompt_required', 'Question tool requires a non-empty prompt.', 'prompt')
  }
}

function assertFieldsOrOptions(args: LocalQuestionArgs): void {
  if (args.fields && args.options) {
    throw createValidationError('fields_and_options_conflict', 'Question tool cannot accept both fields and options.')
  }
  if (!args.fields && !args.options) {
    throw createValidationError('fields_or_options_required', 'Question tool requires fields or options.')
  }
}

function assertFields(fields: QuestionFieldInput[]): void {
  if (!Array.isArray(fields) || fields.length === 0) {
    throw createValidationError('fields_or_options_required', 'Question tool requires a non-empty fields array.', 'fields')
  }
  const fieldIds = new Set<string>()
  fields.forEach((field, index) => {
    assertFieldLabel(field)
    const fieldId = resolveFieldId(field, index)
    if (fieldIds.has(fieldId)) {
      throw createValidationError('field_ids_duplicate', `Question tool field ids must be unique. Duplicate id: "${fieldId}".`, 'fields[].id')
    }
    fieldIds.add(fieldId)
    assertFieldShape(field)
  })
}

function assertFieldLabel(field: QuestionFieldInput): void {
  if (!isNonEmptyString(field.label)) {
    throw createValidationError('field_label_required', 'Question tool fields must include non-empty label values.', 'fields[].label')
  }
}

function assertFieldShape(field: QuestionFieldInput): void {
  if (field.type !== 'select' && field.type !== 'text') {
    throw createValidationError('field_type_invalid', 'Question tool fields must be select or text type.', 'fields[].type')
  }
  if (field.type === 'text') {
    if ('options' in field) {
      throw createValidationError('text_field_options_forbidden', 'Question tool text fields cannot include options.', 'fields[].options')
    }
    return
  }
  if (!Array.isArray(field.options)) {
    throw createValidationError('select_field_options_required', 'Question tool select fields must include options.', 'fields[].options')
  }
  assertSelectOptions(field.options, 'fields[].options')
}

function assertSelectOptions(options: QuestionOptionInput[] | undefined, field = 'options'): void {
  if (!Array.isArray(options) || options.length === 0) {
    throw createValidationError('options_required', 'Question tool requires a non-empty options array.', field)
  }
  if (options.length < QUESTION_MIN_OPTIONS) {
    throw createValidationError(
      'options_count_invalid',
      `Question tool options must include at least ${QUESTION_MIN_OPTIONS} items.`,
      field
    )
  }
  const optionValues = new Set<string>()
  options.forEach((option, index) => {
    assertOptionLabel(option, field)
    assertOptionValue(option, field)
    assertRecommendedOptionOrder(option, index, field)
    const valueKey = createQuestionValueKey(option.value)
    if (optionValues.has(valueKey)) {
      throw createValidationError('option_values_duplicate', 'Question tool select option values must be unique.', `${field}[].value`)
    }
    optionValues.add(valueKey)
  })
}

function assertOptionLabel(option: QuestionOptionInput, field: string): void {
  if (!isNonEmptyString(option?.label)) {
    throw createValidationError('option_label_required', 'Question tool options must include non-empty label values.', `${field}[].label`)
  }
}

function assertOptionValue(option: QuestionOptionInput, field: string): void {
  if (!('value' in option)) {
    throw createValidationError('option_value_required', 'Question tool options must include value for each option.', `${field}[].value`)
  }
  if (typeof option.value === 'string' && option.value.trim().length === 0) {
    throw createValidationError('option_value_empty', 'Question tool option values cannot be empty strings.', `${field}[].value`)
  }
}

function assertRecommendedOptionOrder(option: QuestionOptionInput, index: number, field: string): void {
  if (option.label.includes(RECOMMENDED_TAG) && index !== 0) {
    throw createValidationError(
      'recommended_option_order',
      `Question tool recommended option must be first when using ${RECOMMENDED_TAG}.`,
      `${field}[0]`
    )
  }
}

function normalizeQuestionField(field: QuestionFieldInput, index: number): QuestionFieldInput {
  const normalized = {
    ...field,
    id: resolveFieldId(field, index),
    label: field.label.trim(),
    ...(typeof field.placeholder === 'string' ? { placeholder: field.placeholder.trim() } : {}),
    ...(typeof field.required === 'boolean' ? { required: field.required } : {})
  }
  if (field.type === 'select') {
    if (!Array.isArray(field.options)) {
      throw new Error('Question select fields must be normalized before serialization.')
    }
    return {
      ...normalized,
      type: 'select',
      options: field.options.map(option => ({
        label: option.label.trim(),
        value: option.value
      }))
    }
  }
  return {
    ...normalized,
    type: 'text'
  }
}

function resolveFieldId(field: QuestionFieldInput, index: number): string {
  return isNonEmptyString(field.id) ? field.id.trim() : `${DEFAULT_FIELD_ID}-${index + 1}`
}

function createValidationError(
  code: QuestionValidationCode,
  detail: string,
  field?: string
): QuestionToolValidationError {
  return new QuestionToolValidationError(code, detail, buildQuestionValidationHint({ code, field }))
}

function normalizeQuestionFieldInputs(
  fields: QuestionFieldInput[],
  questionRequired: boolean
): PreparedQuestionFields {
  const warnings: QuestionContractWarning[] = []
  const normalizedFields = fields.map((field, index) => {
    const inferredRequired = inferOptionalFieldRequired({
      fieldLabel: field.label,
      fieldPlaceholder: field.placeholder,
      fieldRequired: field.required,
      questionRequired,
      fieldPath: `fields[${index}]`
    })
    warnings.push(...inferredRequired.warnings)
    if (field.type !== 'select') {
      return applyInferredFieldRequired(field, inferredRequired.required)
    }
    const normalizedOptions = normalizeQuestionOptionsInput(field.options, `fields[${index}].options`)
    warnings.push(...normalizedOptions.warnings)
    return {
      ...applyInferredFieldRequired(field, inferredRequired.required),
      options: normalizedOptions.options || field.options
    }
  })
  return { fields: normalizedFields, warnings }
}

function applyInferredFieldRequired<T extends QuestionFieldInput>(
  field: T,
  required: boolean | undefined
): T {
  if (typeof required !== 'boolean') {
    return field
  }
  return {
    ...field,
    required
  }
}

function appendNotesField(fields: QuestionFieldInput[]): QuestionFieldInput[] {
  if (!fields.some(isSelectField)) {
    return fields
  }
  const nextFields = fields.filter(field => field.id !== NOTES_FIELD_ID)
  nextFields.push(createNotesField())
  return nextFields
}

function createNotesField(): QuestionTextFieldInput {
  return {
    id: NOTES_FIELD_ID,
    label: NOTES_FIELD_LABEL,
    type: 'text',
    placeholder: NOTES_FIELD_PLACEHOLDER,
    required: false
  }
}

function isSelectField(field: QuestionFieldInput): field is QuestionSelectFieldInput {
  return field.type === 'select'
}
