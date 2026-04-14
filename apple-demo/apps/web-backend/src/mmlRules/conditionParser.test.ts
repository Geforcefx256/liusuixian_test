import { describe, expect, it } from 'vitest'

import { parseConditionRules } from './conditionParser.js'

describe('parseConditionRules', () => {
  it('parses multiple conditional required rules from excel json-like text', () => {
    expect(parseConditionRules('{"1=A":"必选","1=NAPTR":"必选"}')).toEqual([
      {
        expression: '1=A',
        sourceParamId: 1,
        operator: '=',
        expectedValue: 'A',
        requiredMode: 'required'
      },
      {
        expression: '1=NAPTR',
        sourceParamId: 1,
        operator: '=',
        expectedValue: 'NAPTR',
        requiredMode: 'required'
      }
    ])
  })

  it('tolerates full-width punctuation from workbook cells', () => {
    expect(parseConditionRules('{"1=A"："可选"，"2=B"："必选"}')).toEqual([
      {
        expression: '1=A',
        sourceParamId: 1,
        operator: '=',
        expectedValue: 'A',
        requiredMode: 'optional'
      },
      {
        expression: '2=B',
        sourceParamId: 2,
        operator: '=',
        expectedValue: 'B',
        requiredMode: 'required'
      }
    ])
  })
})
