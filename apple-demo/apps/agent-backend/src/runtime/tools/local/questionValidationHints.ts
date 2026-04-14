export interface QuestionValidationHint {
  readonly field?: string
  readonly expected?: string
  readonly actual?: string
  readonly fix?: string
}

export function buildQuestionValidationHint(params: {
  code:
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
  field?: string
}): QuestionValidationHint {
  const field = params.field
  switch (params.code) {
    case 'prompt_required':
      return createHint(field ?? 'prompt', 'non-empty string', 'missing or empty value', 'Provide a prompt string.')
    case 'fields_or_options_required':
      return createHint(
        field ?? 'fields|options',
        'exactly one of fields or options',
        'neither fields nor options provided',
        'Provide fields for structured input or options for a single select question.'
      )
    case 'fields_and_options_conflict':
      return createHint(
        field ?? 'fields|options',
        'exactly one of fields or options',
        'both fields and options provided',
        'Keep only one of fields or options.'
      )
    case 'field_label_required':
      return createHint(field ?? 'fields[].label', 'non-empty string', 'missing or empty label', 'Add a label for every field.')
    case 'field_type_invalid':
      return createHint(field ?? 'fields[].type', '"select" or "text"', 'unsupported field type', 'Use "select" or "text" only.')
    case 'text_field_options_forbidden':
      return createHint(
        field ?? 'fields[].options',
        'omit options when field type is "text"',
        'options provided for a text field',
        'Remove options or change the field type to "select".'
      )
    case 'select_field_options_required':
    case 'options_required':
      return createHint(
        field ?? 'options',
        'array with at least 2 options',
        'missing or empty options array',
        'Provide at least 2 options.'
      )
    case 'options_count_invalid':
      return createHint(field ?? 'options', 'at least 2 options', 'fewer than 2 options', 'Add more options.')
    case 'option_label_required':
      return createHint(field ?? 'options[].label', 'non-empty string', 'missing or empty label', 'Provide a label for each option.')
    case 'option_value_required':
      return createHint(field ?? 'options[].value', 'value for each option', 'missing option value', 'Provide a value for each option.')
    case 'option_value_empty':
      return createHint(
        field ?? 'options[].value',
        'non-empty string when the value is a string',
        'empty string value',
        'Use a non-empty string value or a structured value.'
      )
    case 'option_values_duplicate':
      return createHint(field ?? 'options[].value', 'unique values', 'duplicate values', 'Make option values unique.')
    case 'field_ids_duplicate':
      return createHint(field ?? 'fields[].id', 'unique field ids', 'duplicate field ids', 'Make every field id unique.')
    case 'recommended_option_order':
      return createHint(
        field ?? 'options[0]',
        'recommended option at index 0',
        'recommended option appears later',
        'Move the recommended option to the first position.'
      )
  }
}

function createHint(
  field: string,
  expected: string,
  actual: string,
  fix: string
): QuestionValidationHint {
  return { field, expected, actual, fix }
}
