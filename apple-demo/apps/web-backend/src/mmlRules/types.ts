import type {
  MmlSchemaConditionRule,
  MmlSchemaControlType,
  MmlSchemaLengthConstraints,
  MmlSchemaNumberConstraints,
  MmlSchemaRequiredMode,
  MmlSchemaValueFormat,
  MmlSchemaValueType
} from './schema.js'

export interface WorkbookIdentity {
  networkType: string
  networkVersion: string
  fileName: string
  filePath: string
  checksum: string
}

export interface ImportedMmlRuleset extends WorkbookIdentity {
  commands: ImportedMmlCommand[]
}

export interface ImportedMmlCommand {
  commandName: string
  params: ImportedMmlParameter[]
}

export interface ImportedMmlParameter {
  paramName: string
  label: string
  orderParamId: number
  valueType: MmlSchemaValueType
  valueFormat: MmlSchemaValueFormat
  controlType: MmlSchemaControlType
  required: boolean
  requiredMode: MmlSchemaRequiredMode
  enumValues: string[]
  compositeFlagSetOptions: string[]
  defaultValue: string | null
  editable: boolean
  conditions: MmlSchemaConditionRule[]
  numberConstraints: MmlSchemaNumberConstraints | null
  lengthConstraints: MmlSchemaLengthConstraints | null
  caseSensitive: boolean
  source: Record<string, unknown>
}

export interface WorkbookImportOutcome {
  status: 'imported' | 'skipped'
  identity: WorkbookIdentity
  commandCount: number
  parameterCount: number
}
