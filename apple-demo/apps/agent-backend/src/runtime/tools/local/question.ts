import {
  type LocalQuestionArgs,
  type QuestionFieldInput,
  isNonEmptyString,
  normalizeQuestionFields,
  prepareQuestionFields,
  resolveQuestionFieldRequired,
} from './questionContract.js'

const DEFAULT_OPTION_PLACEHOLDER = '（可跳过）'
const DEFAULT_REQUIRED_PLACEHOLDER = '请选择'
const QUESTION_ACTION_LABEL = '确认'

export type { LocalQuestionArgs } from './questionContract.js'

export function buildQuestionProtocol(args: LocalQuestionArgs): Record<string, unknown> {
  const questionRequired = args.required !== false
  const questionId = isNonEmptyString(args.id) ? args.id.trim() : crypto.randomUUID()
  const formId = `question-form-${questionId}`
  const preparedFields = prepareQuestionFields(args)
  const fields = buildFormFields({
    fields: normalizeQuestionFields(preparedFields.fields),
    questionRequired,
    optionalPlaceholder: resolveOptionalPlaceholder(args.placeholder)
  })

  return {
    version: '1.0',
    components: buildQuestionComponents({
      questionId,
      title: isNonEmptyString(args.title) ? args.title.trim() : '',
      prompt: args.prompt.trim(),
      formId,
      fields
    }),
    actions: buildQuestionActions({
      questionId,
      answerPlaceholder: `\${form.${formId}}`
    }),
    data: buildQuestionData(questionId, questionRequired)
  }
}

function buildFormFields(params: {
  fields: QuestionFieldInput[]
  questionRequired: boolean
  optionalPlaceholder: string
}): Array<Record<string, unknown>> {
  return params.fields.map(field => {
    const fieldRequired = resolveQuestionFieldRequired(field.required, params.questionRequired)
    if (field.type === 'text') {
      return buildTextFormField(field)
    }
    return buildSelectFormField(field, fieldRequired, params.optionalPlaceholder)
  })
}

function buildTextFormField(field: Extract<QuestionFieldInput, { type: 'text' }>): Record<string, unknown> {
  return {
    id: field.id,
    label: field.label,
    type: 'text',
    value: '',
    placeholder: field.placeholder || '',
    ...(typeof field.required === 'boolean' ? { required: field.required } : {})
  }
}

function buildSelectFormField(
  field: Extract<QuestionFieldInput, { type: 'select' }>,
  required: boolean,
  optionalPlaceholder: string
): Record<string, unknown> {
  return {
    id: field.id,
    label: field.label,
    type: 'select',
    value: '',
    placeholder: resolveSelectPlaceholder(field.placeholder, required, optionalPlaceholder),
    options: field.options,
    ...(typeof field.required === 'boolean' ? { required: field.required } : {})
  }
}

function buildQuestionComponents(params: {
  questionId: string
  title: string
  prompt: string
  formId: string
  fields: Array<Record<string, unknown>>
}): Array<Record<string, unknown>> {
  const components: Array<Record<string, unknown>> = []
  if (params.title) {
    components.push({
      type: 'text',
      id: `question-title-${params.questionId}`,
      content: params.title,
      style: 'heading'
    })
  }
  components.push({
    type: 'text',
    id: `question-prompt-${params.questionId}`,
    content: params.prompt
  })
  components.push({
    type: 'form',
    id: params.formId,
    fields: params.fields
  })
  return components
}

function buildQuestionActions(params: {
  questionId: string
  answerPlaceholder: string
}): Array<Record<string, unknown>> {
  return [{
    id: `submit-${params.questionId}`,
    label: QUESTION_ACTION_LABEL,
    type: 'submit',
    tool: 'question_response',
    toolInput: {
      questionId: params.questionId,
      answer: params.answerPlaceholder
    }
  }]
}

function buildQuestionData(questionId: string, required: boolean): Record<string, unknown> {
  return {
    type: 'json',
    content: {
      questionId,
      required
    }
  }
}

function resolveOptionalPlaceholder(placeholder: string | undefined): string {
  return isNonEmptyString(placeholder) ? placeholder.trim() : DEFAULT_OPTION_PLACEHOLDER
}

function resolveSelectPlaceholder(
  placeholder: string | undefined,
  required: boolean,
  optionalPlaceholder: string
): string {
  if (isNonEmptyString(placeholder)) {
    return placeholder.trim()
  }
  return required ? DEFAULT_REQUIRED_PLACEHOLDER : optionalPlaceholder
}
