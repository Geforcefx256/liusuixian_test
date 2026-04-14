import { describe, expect, it } from 'vitest'

import type { MmlSchemaResponse } from '@/api/types'
import {
  appendMmlStatementsToSheet,
  applyMmlCellEdit,
  applyMmlRangePaste,
  buildMmlGridSheet,
  buildMmlWorkbook,
  materializeMmlDraftRow,
  normalizeMmlWorkbookCellValue,
  normalizePasteMatrix,
  parseMmlDocument,
  validateMmlWorkbookCell
} from './mmlWorkbook'

const schema: MmlSchemaResponse = {
  networkType: 'AMF',
  networkVersion: '20.9.2',
  commands: [
    {
      commandName: 'ADD TEST',
      params: [
        {
          paramName: 'NAME',
          label: 'NAME',
          valueType: 'string',
          valueFormat: 'string',
          controlType: 'text',
          required: true,
          requiredMode: 'required',
          orderParamId: 10,
          enumValues: [],
          defaultValue: null,
          editable: true
        },
        {
          paramName: 'MODE',
          label: 'MODE',
          valueType: 'enum',
          valueFormat: 'enum',
          controlType: 'select',
          required: false,
          requiredMode: 'optional',
          orderParamId: 20,
          enumValues: ['A', 'B'],
          defaultValue: 'A',
          editable: true
        },
        {
          paramName: 'COUNT',
          label: 'COUNT',
          valueType: 'number',
          valueFormat: 'integer',
          controlType: 'text',
          required: false,
          requiredMode: 'optional',
          orderParamId: 30,
          enumValues: [],
          defaultValue: null,
          editable: true,
          numberConstraints: {
            minValue: 0,
            maxValue: 99,
            interval: null
          }
        },
        {
          paramName: 'FLAGS',
          label: 'FLAGS',
          valueType: 'token',
          valueFormat: 'composite_flag_set',
          controlType: 'composite',
          required: false,
          requiredMode: 'optional',
          orderParamId: 40,
          enumValues: [],
          compositeFlagSetOptions: ['TLS1', 'TLS2', 'TLS3'],
          defaultValue: null,
          editable: true
        }
      ]
    }
  ]
}

describe('mmlWorkbook', () => {
  it('splits documents into raw and statement segments and marks ambiguous comment binding conservatively', () => {
    const parsed = parseMmlDocument([
      '/* header */',
      'ADD TEST:NAME="A";',
      '// review before next line',
      'ADD TEST:NAME="B";'
    ].join('\n'))

    expect(parsed.segments.map(segment => segment.kind)).toEqual(['raw', 'statement', 'raw', 'statement'])
    expect(parsed.statements[0].ambiguousCommentBinding).toBe(true)
    expect(parsed.statements[1].ambiguousCommentBinding).toBe(true)
  })

  it('tracks leading comments, trailing comments, and detached comment blocks explicitly', () => {
    const parsed = parseMmlDocument([
      '// lead comment',
      'ADD TEST:NAME="A"; // tail',
      '',
      '/* detached */',
      '',
      'ADD TEST:NAME="B";'
    ].join('\n'))

    expect(parsed.statements[0].leadingCommentText).toContain('// lead comment')
    expect(parsed.statements[0].trailingCommentText).toContain('// tail')
    expect(parsed.statements[0].ambiguousCommentBinding).toBe(false)
    expect(parsed.statements[1].leadingCommentText).toContain('/* detached */')
    expect(parsed.statements[1].ambiguousCommentBinding).toBe(false)
  })

  it('projects schema-driven sheets and keeps unknown or duplicate rows read-only', () => {
    const workbook = buildMmlWorkbook([
      'ADD TEST:NAME="A", MODE=A;',
      'ADD TEST:NAME="B", EXTRA=1;',
      'ADD TEST:NAME="C", MODE=A, MODE=B;'
    ].join('\n'), schema, 'ready')

    expect(workbook.sheets).toHaveLength(1)
    expect(workbook.sheets[0].columns.map(column => column.key)).toEqual(['NAME', 'MODE', 'COUNT', 'FLAGS', '__unknown__'])
    expect(workbook.sheets[0].rows[0].readOnly).toBe(false)
    expect(workbook.sheets[0].rows[1].values.__unknown__).toContain('EXTRA=1')
    expect(workbook.sheets[0].rows[1].readOnlyReasons).toContain('未识别参数: EXTRA')
    expect(workbook.sheets[0].rows[2].readOnlyReasons.join(' | ')).toContain('重复参数: MODE')
  })

  it('rewrites only the targeted statement while preserving comments, blank lines, insertion order, deletion, and token style', () => {
    const content = [
      '/* top */',
      'ADD TEST:NAME="Alpha", COUNT=1;',
      '',
      '// keep me',
      'ADD TEST:NAME="Beta";',
      ''
    ].join('\n')

    const workbook = buildMmlWorkbook(content, schema, 'ready')
    const firstRow = workbook.sheets[0].rows[0]
    const secondRow = workbook.sheets[0].rows[1]

    const inserted = applyMmlCellEdit({
      content,
      workbook,
      sheetKey: 'ADD TEST',
      rowId: secondRow.id,
      columnKey: 'MODE',
      nextValue: 'B',
      schema
    })
    expect(inserted).toContain('ADD TEST:NAME="Beta", MODE=B;')
    expect(inserted).toContain('// keep me')

    const insertedWorkbook = buildMmlWorkbook(inserted, schema, 'ready')
    const deleted = applyMmlCellEdit({
      content: inserted,
      workbook: insertedWorkbook,
      sheetKey: 'ADD TEST',
      rowId: firstRow.id,
      columnKey: 'COUNT',
      nextValue: '',
      schema
    })

    expect(deleted).toContain('ADD TEST:NAME="Alpha";')
    expect(deleted).not.toContain('COUNT=1')
    expect(deleted).toContain('ADD TEST:NAME="Beta", MODE=B;')
    expect(deleted).toContain('/* top */')
    expect(deleted).toContain('\n\n// keep me\n')
  })

  it('applies rectangular paste conservatively through the text-first rewrite path', () => {
    const content = [
      'ADD TEST:NAME="Alpha", MODE=A, COUNT=1;',
      'ADD TEST:NAME="Beta", MODE=B, COUNT=2;'
    ].join('\n')
    const workbook = buildMmlWorkbook(content, schema, 'ready')
    const gridSheet = buildMmlGridSheet(workbook.sheets[0], { spareRowCount: 2 })

    const result = applyMmlRangePaste({
      content,
      workbook,
      gridSheet,
      sheetKey: 'ADD TEST',
      startColumnIndex: 1,
      startRowIndex: 0,
      values: [['B', '10'], ['A', '20']],
      schema
    })

    expect(result.blockedReason).toBeNull()
    expect(result.updatedRowCount).toBe(2)
    expect(result.insertedRowCount).toBe(0)
    expect(result.content).toContain('ADD TEST:NAME="Alpha", MODE=B, COUNT=10;')
    expect(result.content).toContain('ADD TEST:NAME="Beta", MODE=A, COUNT=20;')
  })

  it('rejects rectangular paste when any targeted row is read-only', () => {
    const content = [
      'ADD TEST:NAME="Alpha", MODE=A;',
      'ADD TEST:NAME="Beta", EXTRA=1;'
    ].join('\n')
    const workbook = buildMmlWorkbook(content, schema, 'ready')
    const gridSheet = buildMmlGridSheet(workbook.sheets[0], { spareRowCount: 2 })

    const result = applyMmlRangePaste({
      content,
      workbook,
      gridSheet,
      sheetKey: 'ADD TEST',
      startColumnIndex: 0,
      startRowIndex: 1,
      values: [['Gamma']],
      schema
    })

    expect(result.blockedReason).toContain('未识别参数: EXTRA')
    expect(result.updatedRowCount).toBe(0)
    expect(result.insertedRowCount).toBe(0)
    expect(result.content).toBe(content)
  })

  it('serializes composite flag-set edits in schema order with enabled items only', () => {
    const content = 'ADD TEST:NAME="Alpha", FLAGS=TLS3-1&TLS1-1;'
    const workbook = buildMmlWorkbook(content, schema, 'ready')

    const nextContent = applyMmlCellEdit({
      content,
      workbook,
      sheetKey: 'ADD TEST',
      rowId: workbook.sheets[0].rows[0].id,
      columnKey: 'FLAGS',
      nextValue: 'TLS2-1&TLS1-1',
      schema
    })

    expect(nextContent).toContain('FLAGS=TLS1-1&TLS2-1')
  })

  it('validates enum and integer workbook cells against schema bounds', () => {
    const workbook = buildMmlWorkbook('ADD TEST:NAME="Alpha", MODE=A, COUNT=1;', schema, 'ready')
    const modeColumn = workbook.sheets[0].columns.find(column => column.key === 'MODE')!
    const countColumn = workbook.sheets[0].columns.find(column => column.key === 'COUNT')!

    expect(validateMmlWorkbookCell(modeColumn, 'C')).toContain('枚举范围')
    expect(validateMmlWorkbookCell(countColumn, '200')).toContain('不能大于 99')
    expect(validateMmlWorkbookCell(countColumn, '10')).toBeNull()
  })

  it('ignores legacy exactLength for workbook string validation while keeping min and max bounds', () => {
    const legacyStringSchema: MmlSchemaResponse = {
      networkType: 'AMF',
      networkVersion: '20.9.2',
      commands: [
        {
          commandName: 'ADD TEST',
          params: [
            {
              paramName: 'NAME',
              label: 'NAME',
              valueType: 'string',
              valueFormat: 'string',
              controlType: 'text',
              required: true,
              requiredMode: 'required',
              orderParamId: 10,
              enumValues: [],
              defaultValue: null,
              editable: true,
              lengthConstraints: {
                minLength: 2,
                maxLength: 5,
                exactLength: 4
              }
            }
          ]
        }
      ]
    }

    const workbook = buildMmlWorkbook('ADD TEST:NAME="ABCD";', legacyStringSchema, 'ready')
    const nameColumn = workbook.sheets[0].columns.find(column => column.key === 'NAME')!

    expect(validateMmlWorkbookCell(nameColumn, 'ABC')).toBeNull()
    expect(validateMmlWorkbookCell(nameColumn, 'A')).toContain('长度不能小于 2')
    expect(validateMmlWorkbookCell(nameColumn, 'ABCDEF')).toContain('长度不能大于 5')
  })

  it('builds a grid sheet with persisted rows followed by spare rows', () => {
    const workbook = buildMmlWorkbook('ADD TEST:NAME="Alpha";', schema, 'ready')
    const gridSheet = buildMmlGridSheet(workbook.sheets[0], { spareRowCount: 2 })

    expect(gridSheet.persistedRowCount).toBe(1)
    expect(gridSheet.spareRowCount).toBe(2)
    expect(gridSheet.rows.map(row => row.kind)).toEqual(['persisted', 'spare', 'spare'])
    expect(gridSheet.rows[1].rowNumber).toBe(2)
  })

  it('normalizes composite workbook values into canonical schema order', () => {
    const workbook = buildMmlWorkbook('ADD TEST:NAME="Alpha", FLAGS=TLS1-1;', schema, 'ready')
    const flagsColumn = workbook.sheets[0].columns.find(column => column.key === 'FLAGS')!

    const normalized = normalizeMmlWorkbookCellValue(flagsColumn, 'TLS3-1&TLS1-1')

    expect(normalized.validationMessage).toBeNull()
    expect(normalized.value).toBe('TLS1-1&TLS3-1')
  })

  it('materializes draft rows from explicit values only', () => {
    const result = materializeMmlDraftRow({
      sheetKey: 'ADD TEST',
      rowNumber: 3,
      values: {
        NAME: 'Gamma'
      },
      schema
    })

    expect(result.blockedReason).toBeNull()
    expect(result.statementText).toBe('ADD TEST:NAME="Gamma";')
    expect(result.missingRequired).toEqual([])
  })

  it('keeps draft rows incomplete when required values are still missing', () => {
    const result = materializeMmlDraftRow({
      sheetKey: 'ADD TEST',
      rowNumber: 3,
      values: {
        MODE: 'B'
      },
      schema
    })

    expect(result.statementText).toBeNull()
    expect(result.blockedReason).toBeNull()
    expect(result.missingRequired).toEqual(['NAME'])
  })

  it('appends new statements before the trailing raw segment after the last matching statement', () => {
    const content = [
      'ADD TEST:NAME="Alpha";',
      '// trailing note',
      'ADD OTHER:NAME="Z";'
    ].join('\n')
    const workbook = buildMmlWorkbook(content, {
      ...schema,
      commands: [
        ...schema.commands,
        {
          commandName: 'ADD OTHER',
          params: [
            {
              paramName: 'NAME',
              label: 'NAME',
              valueType: 'string',
              valueFormat: 'string',
              controlType: 'text',
              required: true,
              requiredMode: 'required',
              orderParamId: 10,
              enumValues: [],
              defaultValue: null,
              editable: true
            }
          ]
        }
      ]
    }, 'ready')

    const result = appendMmlStatementsToSheet({
      content,
      workbook,
      sheetKey: 'ADD TEST',
      statements: ['ADD TEST:NAME="Beta";']
    })

    expect(result.blockedReason).toBeNull()
    expect(result.content).toBe([
      'ADD TEST:NAME="Alpha";',
      'ADD TEST:NAME="Beta";',
      '// trailing note',
      'ADD OTHER:NAME="Z";'
    ].join('\n'))
  })

  it('creates new statements when paste extends into spare rows', () => {
    const content = 'ADD TEST:NAME="Alpha";'
    const workbook = buildMmlWorkbook(content, schema, 'ready')
    const gridSheet = buildMmlGridSheet(workbook.sheets[0], { spareRowCount: 3 })

    const result = applyMmlRangePaste({
      content,
      workbook,
      gridSheet,
      sheetKey: 'ADD TEST',
      startColumnIndex: 0,
      startRowIndex: 1,
      values: [['Beta'], ['Gamma']],
      schema
    })

    expect(result.blockedReason).toBeNull()
    expect(result.updatedRowCount).toBe(0)
    expect(result.insertedRowCount).toBe(2)
    expect(result.incompleteRows).toEqual([])
    expect(result.content).toContain('ADD TEST:NAME="Alpha";\nADD TEST:NAME="Beta";\nADD TEST:NAME="Gamma";')
  })

  it('handles mixed update and append paste in one transaction', () => {
    const content = [
      'ADD TEST:NAME="Alpha", MODE=A;',
      'ADD TEST:NAME="Beta", MODE=B;'
    ].join('\n')
    const workbook = buildMmlWorkbook(content, schema, 'ready')
    const gridSheet = buildMmlGridSheet(workbook.sheets[0], { spareRowCount: 2 })

    const result = applyMmlRangePaste({
      content,
      workbook,
      gridSheet,
      sheetKey: 'ADD TEST',
      startColumnIndex: 0,
      startRowIndex: 1,
      values: [['Gamma'], ['Delta']],
      schema
    })

    expect(result.blockedReason).toBeNull()
    expect(result.updatedRowCount).toBe(1)
    expect(result.insertedRowCount).toBe(1)
    expect(result.content).toContain('ADD TEST:NAME="Gamma", MODE=B;')
    expect(result.content).toContain('ADD TEST:NAME="Delta";')
  })

  it('keeps spare-row paste as incomplete local state when required values are still missing', () => {
    const content = 'ADD TEST:NAME="Alpha";'
    const workbook = buildMmlWorkbook(content, schema, 'ready')
    const gridSheet = buildMmlGridSheet(workbook.sheets[0], { spareRowCount: 2 })

    const result = applyMmlRangePaste({
      content,
      workbook,
      gridSheet,
      sheetKey: 'ADD TEST',
      startColumnIndex: 1,
      startRowIndex: 1,
      values: [['B']],
      schema
    })

    expect(result.blockedReason).toBeNull()
    expect(result.updatedRowCount).toBe(0)
    expect(result.insertedRowCount).toBe(0)
    expect(result.content).toBe(content)
    expect(result.incompleteRows).toEqual([
      {
        rowNumber: 2,
        values: {
          MODE: 'B'
        },
        invalidCells: {},
        missingRequired: ['NAME'],
        missingConditionalRequired: []
      }
    ])
  })

  describe('normalizePasteMatrix', () => {
    it('passes through original values when targetRange is null', () => {
      const values = [['Alpha']]
      const result = normalizePasteMatrix(values, null)
      expect(result.values).toEqual([['Alpha']])
      expect(result.blockedReason).toBeNull()
    })

    it('passes through when dimensions match exactly', () => {
      const values = [['A', 'B'], ['C', 'D']]
      const targetRange = { x1: 0, y1: 0, x2: 1, y2: 1 }
      const result = normalizePasteMatrix(values, targetRange)
      expect(result.values).toEqual([['A', 'B'], ['C', 'D']])
      expect(result.blockedReason).toBeNull()
    })

    it('expands single value to fill target range', () => {
      const values = [['Alpha']]
      const targetRange = { x1: 0, y1: 0, x2: 2, y2: 1 }
      const result = normalizePasteMatrix(values, targetRange)
      expect(result.values).toEqual([
        ['Alpha', 'Alpha', 'Alpha'],
        ['Alpha', 'Alpha', 'Alpha']
      ])
      expect(result.blockedReason).toBeNull()
    })

    it('tiles pattern when target is integer multiple of source', () => {
      const values = [['A', 'B']]
      const targetRange = { x1: 0, y1: 0, x2: 3, y2: 1 }
      const result = normalizePasteMatrix(values, targetRange)
      expect(result.values).toEqual([
        ['A', 'B', 'A', 'B'],
        ['A', 'B', 'A', 'B']
      ])
      expect(result.blockedReason).toBeNull()
    })

    it('rejects incompatible dimensions', () => {
      const values = [['A', 'B', 'C']]
      const targetRange = { x1: 0, y1: 0, x2: 1, y2: 1 }
      const result = normalizePasteMatrix(values, targetRange)
      expect(result.blockedReason).toBeTruthy()
      expect(result.blockedReason).toContain('尺寸不兼容')
    })
  })
})
