import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { MmlSchemaResponse } from '@/api/types'
import { buildMmlGridSheet, buildMmlWorkbook } from './mmlWorkbook'
import MmlWorkbookGrid from './MmlWorkbookGrid.vue'
import mmlWorkbookGridSource from './MmlWorkbookGrid.vue?raw'

const { mockedJspreadsheet, gridState } = vi.hoisted(() => ({
  gridState: {
    latestOptions: null as Record<string, any> | null,
    latestInstance: null as {
      destroy: ReturnType<typeof vi.fn>
      options: { data: string[][] }
      records: Array<Array<HTMLTableCellElement | undefined> | undefined>
      getCellFromCoords: (x: number, y: number) => HTMLTableCellElement
      getValueFromCoords: (x: number, y: number) => string
      setValueFromCoords: ReturnType<typeof vi.fn>
      resetSelection: ReturnType<typeof vi.fn>
      updateSelectionFromCoords: ReturnType<typeof vi.fn>
    } | null
  },
  mockedJspreadsheet: vi.fn((_: HTMLDivElement, options: Record<string, any>) => {
    gridState.latestOptions = options
    const data = (options.data || []) as string[][]
    const renderedRowCount = Math.min(data.length, 2)
    const records = Array.from({ length: data.length }, (_row, rowIndex) => {
      if (rowIndex >= renderedRowCount) return undefined
      return data[rowIndex].map(cellValue => {
        const cell = document.createElement('td')
        cell.textContent = cellValue
        return cell
      })
    })

    function getRenderedCell(x: number, y: number): HTMLTableCellElement {
      const row = records[y]
      const cell = row?.[x]
      if (!cell) {
        throw new Error(`Cell ${x},${y} is not rendered`)
      }
      return cell
    }

    gridState.latestInstance = {
      destroy: vi.fn(),
      options: { data },
      records,
      getCellFromCoords: (x: number, y: number) => getRenderedCell(x, y),
      getValueFromCoords: (x: number, y: number) => getRenderedCell(x, y).innerHTML,
      setValueFromCoords: vi.fn((x: number, y: number, value: string) => {
        const cell = getRenderedCell(x, y)
        if (data[y]) data[y][x] = value
        cell.textContent = value
      }),
      resetSelection: vi.fn(),
      updateSelectionFromCoords: vi.fn()
    }
    return gridState.latestInstance
  })
}))

vi.mock('jspreadsheet-ce', () => ({
  default: mockedJspreadsheet
}))

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
          editable: true
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
          compositeFlagSetOptions: ['TLS1', 'TLS2'],
          defaultValue: null,
          editable: true
        }
      ]
    }
  ]
}

describe('MmlWorkbookGrid', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      return window.setTimeout(() => callback(performance.now()), 0)
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn((handle: number) => {
      window.clearTimeout(handle)
    }))
    gridState.latestOptions = null
    gridState.latestInstance = null
    mockedJspreadsheet.mockClear()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('maps schema-driven sheet columns into a jspreadsheet grid and bridges selection/edit events', async () => {
    const workbook = buildMmlWorkbook('ADD TEST:NAME="Alpha", MODE=A, COUNT=1;', schema, 'ready')
    const sheet = buildMmlGridSheet(workbook.sheets[0], { spareRowCount: 2 })
    const firstRow = sheet.rows[0]
    if (firstRow.kind !== 'persisted') {
      throw new Error('expected first row to be persisted')
    }
    const wrapper = mount(MmlWorkbookGrid, {
      props: {
        sheet,
        selectedRange: { x1: 0, y1: 0, x2: 0, y2: 0 }
      }
    })

    await wrapper.vm.$nextTick()

    expect(mockedJspreadsheet).toHaveBeenCalledTimes(1)
    expect(gridState.latestOptions?.data).toHaveLength(3)
    expect(gridState.latestOptions?.columns[1]).toMatchObject({
      type: 'dropdown',
      title: 'MODE',
      source: ['A', 'B']
    })
    expect(gridState.latestInstance?.updateSelectionFromCoords).toHaveBeenCalledWith(0, 0, 0, 0, 'external-sync')

    gridState.latestOptions?.onselection?.(document.createElement('div'), 0, 0, 0, 0, 'user')
    expect(wrapper.emitted('selection-change')).toBeUndefined()
    await vi.runAllTimersAsync()
    expect(wrapper.emitted('selection-change')).toEqual([[{ x1: 0, y1: 0, x2: 0, y2: 0 }]])

    gridState.latestOptions?.onchange?.(document.createElement('div'), document.createElement('td'), 1, 0, 'B', 'A')
    expect(wrapper.emitted('cell-change')).toBeUndefined()
    await vi.runAllTimersAsync()
    expect(wrapper.emitted('cell-change')).toEqual([[firstRow.persistedRowId, 'MODE', 'B']])

    const pasteResult = gridState.latestOptions?.onbeforepaste?.(document.createElement('div'), 'B\t10', 1, 0)
    expect(pasteResult).toBe(false)
    expect(wrapper.emitted('range-paste')).toBeUndefined()
    await vi.runAllTimersAsync()
    expect(wrapper.emitted('range-paste')).toEqual([[
      {
        startColumnIndex: 1,
        startRowIndex: 0,
        targetRange: { x1: 0, y1: 0, x2: 0, y2: 0 },
        values: [['B', '10']]
      }
    ]])
  })

  it('opens template editing for composite columns instead of allowing free-text edits', async () => {
    const workbook = buildMmlWorkbook('ADD TEST:NAME="Alpha", FLAGS=TLS1-1;', schema, 'ready')
    const sheet = buildMmlGridSheet(workbook.sheets[0], { spareRowCount: 1 })
    const firstRow = sheet.rows[0]
    if (firstRow.kind !== 'persisted') {
      throw new Error('expected first row to be persisted')
    }
    const wrapper = mount(MmlWorkbookGrid, {
      props: {
        sheet,
        selectedRange: null
      }
    })

    await wrapper.vm.$nextTick()

    const blockedValue = gridState.latestOptions?.onbeforechange?.(
      document.createElement('div'),
      document.createElement('td'),
      3,
      0,
      'TLS2-1'
    )

    expect(blockedValue).toBe('TLS1-1')
    expect(wrapper.emitted('composite-edit-request')).toBeUndefined()
    await vi.runAllTimersAsync()
    expect(wrapper.emitted('composite-edit-request')).toEqual([[{ rowId: firstRow.persistedRowId, columnKey: 'FLAGS' }]])
  })

  it('blocks edits against read-only rows and reports the reason', async () => {
    const workbook = buildMmlWorkbook([
      'ADD TEST:NAME="Alpha", MODE=A;',
      'ADD TEST:NAME="Beta", EXTRA=1;'
    ].join('\n'), schema, 'ready')
    const sheet = buildMmlGridSheet(workbook.sheets[0], { spareRowCount: 1 })
    const wrapper = mount(MmlWorkbookGrid, {
      props: {
        sheet,
        selectedRange: null
      }
    })

    await wrapper.vm.$nextTick()

    const blockedValue = gridState.latestOptions?.onbeforechange?.(
      document.createElement('div'),
      document.createElement('td'),
      0,
      1,
      'Gamma'
    )

    expect(blockedValue).toBe('Beta')
    expect(wrapper.emitted('blocked-edit')).toBeUndefined()
    await vi.runAllTimersAsync()
    expect((wrapper.emitted('blocked-edit')?.[0] || [])[0]).toContain('未识别参数: EXTRA')
  })

  it('allows paste and direct typing to target spare rows through the same authoring surface', async () => {
    const workbook = buildMmlWorkbook('ADD TEST:NAME="Alpha", MODE=A;', schema, 'ready')
    const sheet = buildMmlGridSheet(workbook.sheets[0], { spareRowCount: 2 })
    const wrapper = mount(MmlWorkbookGrid, {
      props: {
        sheet,
        selectedRange: null
      }
    })

    await wrapper.vm.$nextTick()

    const sparePaste = gridState.latestOptions?.onbeforepaste?.(document.createElement('div'), 'Beta', 0, 1)
    expect(sparePaste).toBe(false)
    expect(wrapper.emitted('range-paste')).toBeUndefined()
    await vi.runAllTimersAsync()
    expect(wrapper.emitted('range-paste')).toEqual([[
      {
        startColumnIndex: 0,
        startRowIndex: 1,
        targetRange: null,
        values: [['Beta']]
      }
    ]])

    const nextValue = gridState.latestOptions?.onbeforechange?.(
      document.createElement('div'),
      document.createElement('td'),
      0,
      1,
      'Beta'
    )
    expect(nextValue).toBe('Beta')
    gridState.latestOptions?.onchange?.(document.createElement('div'), document.createElement('td'), 0, 1, 'Beta', '')
    expect(wrapper.emitted('spare-cell-change')).toBeUndefined()
    await vi.runAllTimersAsync()
    expect(wrapper.emitted('spare-cell-change')).toEqual([[
      {
        rowNumber: 2,
        columnKey: 'NAME',
        nextValue: 'Beta'
      }
    ]])
  })

  it('marks missing required cells on spare rows with the invalid cell styling hook', async () => {
    const workbook = buildMmlWorkbook('ADD TEST:NAME="Alpha", MODE=A;', schema, 'ready')
    const sheet = buildMmlGridSheet(workbook.sheets[0], { spareRowCount: 1 })
    const wrapper = mount(MmlWorkbookGrid, {
      props: {
        sheet,
        selectedRange: null,
        incompleteRows: {
          2: {
            rowNumber: 2,
            values: {
              MODE: 'B'
            },
            invalidCells: {},
            missingRequired: ['NAME'],
            missingConditionalRequired: []
          }
        }
      }
    })

    await wrapper.vm.$nextTick()

    const cell = gridState.latestInstance?.getCellFromCoords(0, 1)
    expect(cell?.classList.contains('mml-workbook-grid__cell--invalid')).toBe(true)
    expect(cell?.title).toContain('缺少必选参数')
  })

  it('updates incomplete spare-row cells without rebuilding the spreadsheet instance', async () => {
    const workbook = buildMmlWorkbook('ADD TEST:NAME="Alpha", MODE=A;', schema, 'ready')
    const sheet = buildMmlGridSheet(workbook.sheets[0], { spareRowCount: 1 })
    const wrapper = mount(MmlWorkbookGrid, {
      props: {
        sheet,
        selectedRange: null,
        incompleteRows: {}
      }
    })

    await wrapper.vm.$nextTick()

    expect(mockedJspreadsheet).toHaveBeenCalledTimes(1)

    await wrapper.setProps({
      incompleteRows: {
        2: {
          rowNumber: 2,
          values: {
            NAME: 'Beta'
          },
          invalidCells: {},
          missingRequired: [],
          missingConditionalRequired: []
        }
      }
    })
    await wrapper.vm.$nextTick()

    expect(mockedJspreadsheet).toHaveBeenCalledTimes(1)
    expect(gridState.latestInstance?.setValueFromCoords).not.toHaveBeenCalled()
    expect(gridState.latestInstance?.options.data[1]?.[0]).toBe('Beta')
    expect(gridState.latestInstance?.getCellFromCoords(0, 1).textContent).toBe('Beta')
    expect(gridState.latestInstance?.destroy).not.toHaveBeenCalled()
  })

  it('syncs incomplete state for unrendered spare rows through grid data only', async () => {
    const workbook = buildMmlWorkbook('ADD TEST:NAME="Alpha", MODE=A;', schema, 'ready')
    const sheet = buildMmlGridSheet(workbook.sheets[0], { spareRowCount: 4 })
    const wrapper = mount(MmlWorkbookGrid, {
      props: {
        sheet,
        selectedRange: null,
        incompleteRows: {}
      }
    })

    await wrapper.vm.$nextTick()

    await wrapper.setProps({
      incompleteRows: {
        4: {
          rowNumber: 4,
          values: {
            NAME: 'Delta'
          },
          invalidCells: {},
          missingRequired: [],
          missingConditionalRequired: []
        }
      }
    })
    await wrapper.vm.$nextTick()

    expect(mockedJspreadsheet).toHaveBeenCalledTimes(1)
    expect(gridState.latestInstance?.setValueFromCoords).not.toHaveBeenCalled()
    expect(gridState.latestInstance?.options.data[3]?.[0]).toBe('Delta')

    await wrapper.setProps({
      incompleteRows: {}
    })
    await wrapper.vm.$nextTick()

    expect(gridState.latestInstance?.options.data[3]?.[0]).toBe('')
  })

  it('drops deferred events after unmount', async () => {
    const workbook = buildMmlWorkbook('ADD TEST:NAME="Alpha", MODE=A;', schema, 'ready')
    const sheet = buildMmlGridSheet(workbook.sheets[0], { spareRowCount: 1 })
    const firstRow = sheet.rows[0]
    if (firstRow.kind !== 'persisted') {
      throw new Error('expected first row to be persisted')
    }
    const wrapper = mount(MmlWorkbookGrid, {
      props: {
        sheet,
        selectedRange: null
      }
    })

    await wrapper.vm.$nextTick()

    gridState.latestOptions?.onchange?.(document.createElement('div'), document.createElement('td'), 1, 0, 'B', 'A')
    wrapper.unmount()
    await vi.runAllTimersAsync()

    expect(gridState.latestInstance?.destroy).toHaveBeenCalled()
    expect(wrapper.emitted('cell-change')).toBeUndefined()
  })

  it('locks vendor table cells and editors to the governed table typography', () => {
    expect(mmlWorkbookGridSource).toContain('font-family: var(--font-family-ui);')
    expect(mmlWorkbookGridSource).toContain('font-size: var(--font-table);')
    expect(mmlWorkbookGridSource).toContain('font-size: var(--font-table-meta);')
    expect(mmlWorkbookGridSource).toContain('border-color: var(--line-subtle);')
    expect(mmlWorkbookGridSource).toContain('background: transparent;')
    expect(mmlWorkbookGridSource).toContain('background: var(--surface-panel);')
    expect(mmlWorkbookGridSource).toContain('.mml-workbook-grid__host :deep(input)')
  })
})
