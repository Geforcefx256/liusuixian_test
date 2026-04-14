import type { QuestionContractWarning } from './questionInputNormalization.js'

const OPTIONAL_FIELD_WARNING_MESSAGE = 'Inferred field.required=false from optional wording in the field label or placeholder.'
const OPTIONAL_LABEL_PATTERN = /(?:（|\()?(\s)*(?:可选|选填)(\s)*(?:）|\))?\s*$/
const OPTIONAL_PLACEHOLDER_PATTERN = /^(?:可选|选填)(?:[，、,:：\s]|$)/

export function inferOptionalFieldRequired(params: {
  fieldLabel: string
  fieldPlaceholder?: string
  fieldRequired?: boolean
  questionRequired: boolean
  fieldPath: string
}): { required: boolean | undefined; warnings: QuestionContractWarning[] } {
  if (!params.questionRequired || typeof params.fieldRequired === 'boolean') {
    return {
      required: params.fieldRequired,
      warnings: []
    }
  }
  if (!hasOptionalMarker(params.fieldLabel, params.fieldPlaceholder)) {
    return {
      required: undefined,
      warnings: []
    }
  }
  return {
    required: false,
    warnings: [{
      code: 'field_required_inferred_from_optional_text',
      field: `${params.fieldPath}.required`,
      message: OPTIONAL_FIELD_WARNING_MESSAGE
    }]
  }
}

function hasOptionalMarker(label: string, placeholder?: string): boolean {
  return OPTIONAL_LABEL_PATTERN.test(label) || OPTIONAL_PLACEHOLDER_PATTERN.test(placeholder || '')
}
