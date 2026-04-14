import { describe, expect, it } from 'vitest'

import { parseWorkbookFileName } from './fileName.js'

describe('parseWorkbookFileName', () => {
  it('parses network type and version from a compliant workbook name', () => {
    expect(parseWorkbookFileName('CHECK_RULE_AMF_20.9.2.xlsx')).toEqual({
      networkType: 'AMF',
      networkVersion: '20.9.2'
    })
  })

  it('rejects non-compliant workbook names', () => {
    expect(parseWorkbookFileName('CHECK_RULE_AMF_20.9.2_MARCO_RULE.xlsx')).toBeNull()
    expect(parseWorkbookFileName('rules.xlsx')).toBeNull()
  })
})
