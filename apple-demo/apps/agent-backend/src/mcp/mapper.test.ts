import { describe, expect, it } from 'vitest'
import { attachRuntimeLogSink, resetRuntimeLoggingForTests } from '../logging/index.js'
import type { RuntimeLogEntry } from '../logging/types.js'
import { mapToOperations } from './mapper.js'

describe('mapToOperations', () => {
  it('maps a single operation object', () => {
    const result = mapToOperations({
      type: 'insert',
      sheetName: 'VLR',
      rows: [{ VN: '1' }]
    })

    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('insert')
  })

  it('filters invalid operations in operations array', () => {
    const entries: RuntimeLogEntry[] = []
    const detach = attachRuntimeLogSink({
      append(entry) {
        entries.push(entry)
      }
    })

    const result = mapToOperations({
      operations: [
        { type: 'insert', sheetName: 'VLR', rows: [] },
        { type: 'unsupported', sheetName: 'VLR' },
        { type: 'delete' }
      ]
    })
    detach()
    resetRuntimeLoggingForTests()

    expect(result).toHaveLength(1)
    expect(entries.filter(entry => entry.level === 'warn' && entry.component === 'mcp_mapper')).toHaveLength(1)
  })
})
