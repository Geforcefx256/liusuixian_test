export type MmlSchemaValueType = 'string' | 'number' | 'enum' | 'token'
export type MmlSchemaControlType = 'text' | 'select' | 'composite'
export type MmlSchemaRequiredMode = 'required' | 'optional' | 'conditional_required' | 'conditional_optional'
export type MmlSchemaValueFormat =
  | 'string'
  | 'integer'
  | 'ipv4'
  | 'ipv6'
  | 'enum'
  | 'password'
  | 'composite_flag_set'
  | 'token'

export interface MmlSchemaConditionRule {
  expression: string
  sourceParamId: number | null
  operator: '='
  expectedValue: string
  requiredMode: 'required' | 'optional'
}

export interface MmlSchemaNumberConstraints {
  minValue: number | null
  maxValue: number | null
  interval: string | null
}

export interface MmlSchemaLengthConstraints {
  minLength: number | null
  maxLength: number | null
  exactLength: number | null
}

export interface MmlSchemaParameter {
  paramName: string
  label: string
  valueType: MmlSchemaValueType
  controlType: MmlSchemaControlType
  required: boolean
  requiredMode: MmlSchemaRequiredMode
  orderParamId: number
  enumValues: string[]
  defaultValue: string | null
  editable: boolean
  valueFormat?: MmlSchemaValueFormat
  conditions?: MmlSchemaConditionRule[]
  compositeFlagSetOptions?: string[]
  numberConstraints?: MmlSchemaNumberConstraints | null
  lengthConstraints?: MmlSchemaLengthConstraints | null
  caseSensitive?: boolean
  source?: Record<string, unknown>
}

export interface MmlSchemaCommand {
  commandName: string
  params: MmlSchemaParameter[]
}

export interface MmlSchemaResponse {
  networkType: string
  networkVersion: string
  commands: MmlSchemaCommand[]
}

export interface MmlTypeVersionOptions {
  networkTypes: string[]
  networkVersionsByType: Record<string, string[]>
}

export interface MmlValidationError {
  param?: string
  message: string
}

export interface MmlValidationResult {
  valid: boolean
  command: string
  errors: MmlValidationError[]
}

export interface WorkspaceMmlMetadata {
  networkType: string
  networkVersion: string
}

export interface MmlFileQueryCondition {
  paramName: string
  expectedValue: string
}

export interface MmlFileQueryRow {
  i: number
  text: string
  v?: string | null
}

export interface MmlFileQueryResult {
  file: string
  cmd: string
  sel?: string
  n: number
  rows?: MmlFileQueryRow[]
  texts?: string[]
}
