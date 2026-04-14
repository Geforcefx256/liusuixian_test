import { defineComponent, h, watch } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const textEditorStubBehavior = vi.hoisted(() => ({
  clearSearch: vi.fn(),
  emitDiagnosticsOnModelValueChange: false,
  findNextMatch: vi.fn(() => true),
  findPreviousMatch: vi.fn(() => true),
  replaceAllMatches: vi.fn((_replaceQuery: string) => true),
  replaceCurrentMatch: vi.fn((_replaceQuery: string) => true),
  setSearchQuery: vi.fn((_searchQuery: string) => true),
  undo: vi.fn()
}))

function buildTextEditorDiagnostics() {
  return [
    {
      id: 'diag-1',
      commandHead: 'ADD SGSLNK',
      message: '缺少条件必选参数: LOCALIPV6_1',
      severity: 'error' as const,
      start: 0,
      end: 10,
      startLineNumber: 5,
      startColumn: 1,
      endLineNumber: 5,
      endColumn: 10
    },
    {
      id: 'diag-2',
      commandHead: 'ADD SGSLNK',
      message: '未知参数: EXTRA',
      severity: 'error' as const,
      start: 11,
      end: 20,
      startLineNumber: 6,
      startColumn: 1,
      endLineNumber: 6,
      endColumn: 10
    }
  ]
}

vi.mock('./WorkspaceTextEditor.vue', () => ({
  default: defineComponent({
    name: 'WorkspaceTextEditor',
    props: {
      modelValue: {
        type: String,
        required: true
      },
      activeDiagnosticId: {
        type: String,
        default: null
      },
      fileMode: {
        type: String,
        required: true
      },
      mmlSchema: {
        type: Object,
        default: null
      }
    },
    emits: ['update:modelValue', 'diagnostics-change'],
    setup(props, { emit, expose }) {
      expose({
        clearSearch: () => textEditorStubBehavior.clearSearch(),
        findNextMatch: () => textEditorStubBehavior.findNextMatch(),
        findPreviousMatch: () => textEditorStubBehavior.findPreviousMatch(),
        replaceAllMatches: (replaceQuery: string) => textEditorStubBehavior.replaceAllMatches(replaceQuery),
        replaceCurrentMatch: (replaceQuery: string) => textEditorStubBehavior.replaceCurrentMatch(replaceQuery),
        setSearchQuery: (searchQuery: string) => textEditorStubBehavior.setSearchQuery(searchQuery),
        undo: () => textEditorStubBehavior.undo()
      })

      watch(
        () => props.modelValue,
        () => {
          if (!textEditorStubBehavior.emitDiagnosticsOnModelValueChange) return
          emit('diagnostics-change', buildTextEditorDiagnostics())
        }
      )

      return () => h('div', { class: 'workspace-text-editor-stub', 'data-active-diagnostic-id': props.activeDiagnosticId || '' }, [
        h('button', {
          class: 'workspace-text-editor-stub__update',
          type: 'button',
          'data-file-mode': props.fileMode,
          'data-has-mml-schema': props.mmlSchema ? 'yes' : 'no',
          onClick: () => emit('update:modelValue', `${props.modelValue}-updated`)
        }),
        h('button', {
          class: 'workspace-text-editor-stub__diagnostics',
          type: 'button',
          onClick: () => emit('diagnostics-change', buildTextEditorDiagnostics())
        })
      ])
    }
  })
}))

vi.mock('./MmlWorkbookGrid.vue', () => ({
  default: defineComponent({
    name: 'MmlWorkbookGrid',
    props: {
      sheet: {
        type: Object,
        required: true
      },
      selectedRange: {
        type: Object,
        default: null
      },
      incompleteRows: {
        type: Object,
        default: () => ({})
      }
    },
    emits: ['selection-change', 'cell-change', 'spare-cell-change', 'range-paste', 'blocked-edit', 'composite-edit-request'],
    setup(props, { emit }) {
      return () => h('div', {
        class: 'mml-workbook-grid-stub',
        'data-sheet-key': (props.sheet as { key: string }).key,
        'data-incomplete-count': String(Object.keys((props.incompleteRows as Record<string, unknown>) || {}).length)
      }, [
        h('button', {
          class: 'mml-workbook-grid-stub__select',
          type: 'button',
          onClick: () => emit('selection-change', { x1: 0, y1: 0, x2: 0, y2: 0 })
        }),
        h('button', {
          class: 'mml-workbook-grid-stub__select-spare',
          type: 'button',
          onClick: () => emit('selection-change', {
            x1: 0,
            y1: (props.sheet as { persistedRowCount: number }).persistedRowCount,
            x2: 0,
            y2: (props.sheet as { persistedRowCount: number }).persistedRowCount
          })
        }),
        h('button', {
          class: 'mml-workbook-grid-stub__edit',
          type: 'button',
          onClick: () => emit(
            'cell-change',
            (props.sheet as { rows: Array<{ id: string }> }).rows[0]?.id || '',
            'MODE',
            'B'
          )
        }),
        h('button', {
          class: 'mml-workbook-grid-stub__spare-edit',
          type: 'button',
          onClick: () => emit('spare-cell-change', {
            rowNumber: (props.sheet as { persistedRowCount: number }).persistedRowCount + 1,
            columnKey: 'NAME',
            nextValue: 'Beta'
          })
        }),
        h('button', {
          class: 'mml-workbook-grid-stub__spare-mode-only',
          type: 'button',
          onClick: () => emit('spare-cell-change', {
            rowNumber: (props.sheet as { persistedRowCount: number }).persistedRowCount + 1,
            columnKey: 'MODE',
            nextValue: 'B'
          })
        }),
        h('button', {
          class: 'mml-workbook-grid-stub__paste-update',
          type: 'button',
          onClick: () => emit('range-paste', {
            startColumnIndex: 1,
            startRowIndex: 0,
            values: [['B']]
          })
        }),
        h('button', {
          class: 'mml-workbook-grid-stub__paste-append',
          type: 'button',
          onClick: () => emit('range-paste', {
            startColumnIndex: 0,
            startRowIndex: (props.sheet as { persistedRowCount: number }).persistedRowCount,
            values: [['Beta']]
          })
        }),
        h('button', {
          class: 'mml-workbook-grid-stub__paste-mixed',
          type: 'button',
          onClick: () => emit('range-paste', {
            startColumnIndex: 0,
            startRowIndex: 0,
            values: [['Gamma'], ['Delta']]
          })
        }),
        h('button', {
          class: 'mml-workbook-grid-stub__blocked',
          type: 'button',
          onClick: () => emit('blocked-edit', 'R2 NAME · Unknown parameters: EXTRA')
        })
      ])
    }
  })
}))

vi.mock('@/api/mmlSchemaApi', () => ({
  mmlSchemaApi: {
    getSchema: vi.fn(),
    getOptions: vi.fn()
  }
}))

import WorkspaceEditorPane from './WorkspaceEditorPane.vue'
import WorkspaceEditorPaneSource from './WorkspaceEditorPane.vue?raw'
import WorkspaceMarkdownPreviewSource from './WorkspaceMarkdownPreview.vue?raw'
import { mmlSchemaApi } from '@/api/mmlSchemaApi'
import type { WorkspaceEditorFileState } from '@/stores/workbenchStore'

const mockedMmlSchemaApi = vi.mocked(mmlSchemaApi)
const normalizedWorkspaceEditorPaneSource = WorkspaceEditorPaneSource.replace(/\r\n/g, '\n')
const normalizedWorkspaceMarkdownPreviewSource = WorkspaceMarkdownPreviewSource.replace(/\r\n/g, '\n')

function buildFile(overrides: Partial<WorkspaceEditorFileState> = {}): WorkspaceEditorFileState {
  return {
    fileKey: 'file-1',
    fileId: 'file-1',
    fileName: 'current.txt',
    path: 'upload/current.txt',
    source: 'upload',
    writable: true,
    mode: 'text',
    content: 'alpha',
    mmlMetadata: null,
    isDirty: false,
    saveStatus: 'idle',
    saveError: null,
    ...overrides
  }
}

function getButtonByText(wrapper: ReturnType<typeof mount>, text: string) {
  const button = wrapper.findAll('button').find(item => item.text() === text)
  expect(button, `expected button "${text}"`).toBeDefined()
  return button!
}

function countOccurrences(text: string, target: string) {
  return text.split(target).length - 1
}

describe('WorkspaceEditorPane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    textEditorStubBehavior.emitDiagnosticsOnModelValueChange = false
    mockedMmlSchemaApi.getOptions.mockResolvedValue({
      networkTypes: [],
      networkVersionsByType: {}
    })
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('reuses the shared segmented control without extra state copy', async () => {
    const activeFile = buildFile({
      fileName: 'current.csv',
      mode: 'csv',
      content: 'name,value\nalpha,1\n'
    })
    const wrapper = mount(WorkspaceEditorPane, {
      props: {
        openFiles: [activeFile],
        activeFileId: activeFile.fileId,
        activeFile
      }
    })

    expect(wrapper.get('.workspace-editor__toolbar-switch').classes()).toContain('segmented-control')
    expect(wrapper.get('.workspace-editor__toolbar-switch').classes()).toContain('segmented-control--compact')
    expect(normalizedWorkspaceEditorPaneSource).toContain('segmented-control segmented-control--compact')
    expect(normalizedWorkspaceEditorPaneSource).not.toContain('.workspace-editor__tool-btn,\n.workspace-editor__action-btn {\n  border-radius')
    expect(wrapper.text()).not.toContain('当前视图：')
    expect(normalizedWorkspaceEditorPaneSource).not.toContain('当前视图：')

    await wrapper.get('.workspace-editor__tool-btn:last-child').trigger('click')

    expect(wrapper.get('.workspace-editor__tool-btn:last-child').classes()).toContain('segmented-control__item--active')
  })

  it('shows the active file name only in the tab row and keeps file actions accessible', async () => {
    const activeFile = buildFile({
      fileName: 'network-rollback-plan-for-region-a.super-long.txt',
      mode: 'text',
      content: 'alpha'
    })
    const wrapper = mount(WorkspaceEditorPane, {
      attachTo: document.body,
      props: {
        openFiles: [activeFile],
        activeFileId: activeFile.fileId,
        activeFile
      }
    })

    expect(wrapper.find('.workspace-editor__selected-file').exists()).toBe(false)
    expect(wrapper.get('.workspace-editor__tab-row').text()).toContain('network-rollback-plan-for-region-a.super-long.txt')
    expect(wrapper.find('.workspace-editor__toolbar-actions .workspace-file-action-menu').exists()).toBe(false)
    expect(countOccurrences(wrapper.text(), 'network-rollback-plan-for-region-a.super-long.txt')).toBe(1)

    await wrapper.get('.workspace-file-action-menu__trigger').trigger('click')

    const items = Array.from(document.body.querySelectorAll('.workspace-file-action-menu__item')).map(node => node.textContent?.trim())
    expect(items).toEqual(['复制文件名', '重命名', '下载', '删除'])
  })

  it('hides the duplicated bottom filename for plain text files', () => {
    const activeFile = buildFile({
      fileName: 'current.txt',
      mode: 'text',
      content: 'alpha'
    })
    const wrapper = mount(WorkspaceEditorPane, {
      props: {
        openFiles: [activeFile],
        activeFileId: activeFile.fileId,
        activeFile
      }
    })

    expect(wrapper.find('.workspace-editor__selected-file').exists()).toBe(false)
    expect(wrapper.get('.workspace-editor__tab-row').text()).toContain('current.txt')
    expect(wrapper.get('.workspace-editor__status-left').text()).not.toContain('current.txt')
    expect(countOccurrences(wrapper.text(), 'current.txt')).toBe(1)
  })

  it('keeps text editor actions compact by default and expands inline search controls on demand', async () => {
    const activeFile = buildFile({
      fileName: 'current.txt',
      mode: 'text',
      content: 'alpha beta alpha'
    })
    const wrapper = mount(WorkspaceEditorPane, {
      props: {
        openFiles: [activeFile],
        activeFileId: activeFile.fileId,
        activeFile
      }
    })

    expect(wrapper.find('.workspace-text-search-bar').exists()).toBe(false)
    expect(wrapper.find('.workspace-editor__toolbar-actions')?.text()).toContain('搜索')
    expect(wrapper.find('.workspace-editor__toolbar-actions')?.text()).toContain('保存')
    expect(wrapper.find('.workspace-editor__toolbar-actions')?.text()).toContain('更多')
    expect(wrapper.find('.workspace-editor__toolbar-actions')?.text()).not.toContain('替换当前')

    await getButtonByText(wrapper, '搜索').trigger('click')

    expect(wrapper.find('.workspace-text-search-bar').exists()).toBe(true)
    expect(wrapper.text()).toContain('上一个')
    expect(wrapper.text()).toContain('下一个')
    expect(wrapper.text()).toContain('关闭')
    expect(wrapper.text()).not.toContain('替换当前')

    const searchInput = wrapper.get('.workspace-text-search-bar__input')
    await searchInput.setValue('alpha')

    expect(textEditorStubBehavior.setSearchQuery).toHaveBeenLastCalledWith('alpha')

    await getButtonByText(wrapper, '替换').trigger('click')

    expect(wrapper.text()).toContain('替换当前')
    expect(wrapper.text()).toContain('全部替换')
  })

  it('exposes undo only from the more menu for supported text views', async () => {
    const activeFile = buildFile({
      fileName: 'current.txt',
      mode: 'text',
      content: 'alpha beta alpha'
    })
    const wrapper = mount(WorkspaceEditorPane, {
      props: {
        openFiles: [activeFile],
        activeFileId: activeFile.fileId,
        activeFile
      }
    })

    expect(wrapper.text()).not.toContain('撤销')

    await getButtonByText(wrapper, '更多').trigger('click')

    expect(wrapper.find('.workspace-editor__more-menu-panel').exists()).toBe(true)
    expect(wrapper.find('.workspace-editor__more-menu-panel')?.text()).toContain('撤销')

    await getButtonByText(wrapper, '撤销').trigger('click')

    expect(textEditorStubBehavior.undo).toHaveBeenCalledTimes(1)
  })

  it('only enables search actions in text view for Monaco-backed files', async () => {
    const activeFile = buildFile({
      fileName: 'notes.md',
      mode: 'markdown',
      content: '# title'
    })
    const wrapper = mount(WorkspaceEditorPane, {
      props: {
        openFiles: [activeFile],
        activeFileId: activeFile.fileId,
        activeFile
      }
    })

    expect(wrapper.find('.workspace-editor__toolbar-actions').text()).not.toContain('搜索')

    await wrapper.get('.workspace-editor__tool-btn:first-child').trigger('click')

    expect(wrapper.find('.workspace-editor__toolbar-actions').text()).toContain('搜索')

    await getButtonByText(wrapper, '搜索').trigger('click')
    expect(wrapper.find('.workspace-text-search-bar').exists()).toBe(true)

    await wrapper.get('.workspace-editor__tool-btn:last-child').trigger('click')

    expect(wrapper.find('.workspace-text-search-bar').exists()).toBe(false)
    expect(wrapper.find('.workspace-editor__toolbar-actions').text()).not.toContain('搜索')
  })

  it('emits file action events from the tab-row action menu', async () => {
    const activeFile = buildFile()
    const wrapper = mount(WorkspaceEditorPane, {
      attachTo: document.body,
      props: {
        openFiles: [activeFile],
        activeFileId: activeFile.fileId,
        activeFile
      }
    })

    await wrapper.get('.workspace-file-action-menu__trigger').trigger('click')
    ;(document.body.querySelectorAll('.workspace-file-action-menu__item')[0] as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('copy-file-name')).toEqual([['file-1']])

    await wrapper.get('.workspace-file-action-menu__trigger').trigger('click')
    ;(document.body.querySelectorAll('.workspace-file-action-menu__item')[1] as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('request-rename-file')).toEqual([['file-1']])
  })

  it('enables MML table view, loads schema-backed sheets, and emits text-first updates from editable cells', async () => {
    mockedMmlSchemaApi.getSchema.mockResolvedValueOnce({
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
              controlType: 'text',
              required: true,
              orderParamId: 10,
              enumValues: [],
              defaultValue: null,
              editable: true
            },
            {
              paramName: 'MODE',
              label: 'MODE',
              valueType: 'enum',
              controlType: 'select',
              required: false,
              orderParamId: 20,
              enumValues: ['A', 'B'],
              defaultValue: 'A',
              editable: true
            }
          ]
        }
      ]
    })

    const activeFile = buildFile({
      fileName: 'current.mml',
      mode: 'mml',
      content: '/* ME TYPE=AMF, Version=20.9.2 */\nADD TEST:NAME="Alpha";\n',
      mmlMetadata: {
        networkType: 'AMF',
        networkVersion: '20.9.2'
      }
    })
    const wrapper = mount(WorkspaceEditorPane, {
      props: {
        openFiles: [activeFile],
        activeFileId: activeFile.fileId,
        activeFile
      }
    })

    await flushPromises()
    await wrapper.get('.workspace-editor__tool-btn:last-child').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('当前配置可用于表格视图')
    expect(wrapper.get('.workspace-editor__table-view').classes()).toContain('workspace-editor__table-view--mml')
    expect(wrapper.findAll('.workspace-editor__mml-tab')[0].text()).toBe('汇总')
    expect(wrapper.text()).toContain('ADD TEST')
    expect(wrapper.find('.mml-workbook-grid-stub').exists()).toBe(false)
    expect(wrapper.find('.workspace-text-editor-stub').exists()).toBe(false)

    await wrapper.get('.workspace-editor__mml-tab:last-child').trigger('click')
    await wrapper.get('.mml-workbook-grid-stub__edit').trigger('click')

    expect(wrapper.emitted('update-content')).toEqual([
      ['file-1', '/* ME TYPE=AMF, Version=20.9.2 */\nADD TEST:NAME="Alpha", MODE=B;\n']
    ])
  })

  it('keeps table view active and avoids schema reload when grid edits update content', async () => {
    mockedMmlSchemaApi.getSchema.mockResolvedValueOnce({
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
              controlType: 'text',
              required: true,
              orderParamId: 10,
              enumValues: [],
              defaultValue: null,
              editable: true
            },
            {
              paramName: 'MODE',
              label: 'MODE',
              valueType: 'enum',
              controlType: 'select',
              required: false,
              orderParamId: 20,
              enumValues: ['A', 'B'],
              defaultValue: 'A',
              editable: true
            }
          ]
        }
      ]
    })

    const activeFile = buildFile({
      fileName: 'current.mml',
      mode: 'mml',
      content: '/* ME TYPE=AMF, Version=20.9.2 */\nADD TEST:NAME="Alpha";\n',
      mmlMetadata: {
        networkType: 'AMF',
        networkVersion: '20.9.2'
      }
    })
    const wrapper = mount(WorkspaceEditorPane, {
      props: {
        openFiles: [activeFile],
        activeFileId: activeFile.fileId,
        activeFile
      }
    })

    await flushPromises()
    expect(mockedMmlSchemaApi.getSchema).toHaveBeenCalledTimes(1)

    await wrapper.get('.workspace-editor__tool-btn:last-child').trigger('click')
    await flushPromises()
    await wrapper.get('.workspace-editor__mml-tab:last-child').trigger('click')
    await wrapper.get('.mml-workbook-grid-stub__edit').trigger('click')

    const emitted = wrapper.emitted('update-content') || []
    expect(emitted).toHaveLength(1)
    const nextContent = emitted[0][1] as string

    const nextActiveFile = {
      ...activeFile,
      content: nextContent,
      isDirty: true
    }
    await wrapper.setProps({
      openFiles: [nextActiveFile],
      activeFileId: nextActiveFile.fileId,
      activeFile: nextActiveFile
    })
    await flushPromises()

    expect(mockedMmlSchemaApi.getSchema).toHaveBeenCalledTimes(1)
    expect(wrapper.get('.workspace-editor__table-view').attributes('style') || '').not.toContain('display: none;')
    expect(wrapper.get('.workspace-editor__text-view').attributes('style') || '').toContain('display: none;')
    expect(wrapper.find('.mml-workbook-grid-stub').exists()).toBe(true)
  })

  it('keeps the MML text editor unmounted while table edits update content', async () => {
    textEditorStubBehavior.emitDiagnosticsOnModelValueChange = true
    mockedMmlSchemaApi.getSchema.mockResolvedValueOnce({
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
              controlType: 'text',
              required: true,
              orderParamId: 10,
              enumValues: [],
              defaultValue: null,
              editable: true
            },
            {
              paramName: 'MODE',
              label: 'MODE',
              valueType: 'enum',
              controlType: 'select',
              required: false,
              orderParamId: 20,
              enumValues: ['A', 'B'],
              defaultValue: 'A',
              editable: true
            }
          ]
        }
      ]
    })

    const activeFile = buildFile({
      fileName: 'current.mml',
      mode: 'mml',
      content: '/* ME TYPE=AMF, Version=20.9.2 */\nADD TEST:NAME="Alpha";\n',
      mmlMetadata: {
        networkType: 'AMF',
        networkVersion: '20.9.2'
      }
    })
    const wrapper = mount(WorkspaceEditorPane, {
      props: {
        openFiles: [activeFile],
        activeFileId: activeFile.fileId,
        activeFile
      }
    })

    await flushPromises()
    await wrapper.get('.workspace-editor__tool-btn:last-child').trigger('click')
    await flushPromises()
    await wrapper.get('.workspace-editor__mml-tab:last-child').trigger('click')

    expect(wrapper.find('.workspace-text-editor-stub').exists()).toBe(false)

    await wrapper.get('.mml-workbook-grid-stub__edit').trigger('click')

    expect(wrapper.emitted('update-content')).toEqual([
      ['file-1', '/* ME TYPE=AMF, Version=20.9.2 */\nADD TEST:NAME="Alpha", MODE=B;\n']
    ])

    await wrapper.get('.workspace-editor__tool-btn:first-child').trigger('click')

    expect(wrapper.find('.workspace-text-editor-stub').exists()).toBe(true)
  })

  it('keeps spare-row incomplete edits on the table path without remounting the text editor', async () => {
    textEditorStubBehavior.emitDiagnosticsOnModelValueChange = true
    mockedMmlSchemaApi.getSchema.mockResolvedValueOnce({
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
              controlType: 'text',
              required: true,
              orderParamId: 10,
              enumValues: [],
              defaultValue: null,
              editable: true
            },
            {
              paramName: 'MODE',
              label: 'MODE',
              valueType: 'enum',
              controlType: 'select',
              required: false,
              orderParamId: 20,
              enumValues: ['A', 'B'],
              defaultValue: 'A',
              editable: true
            }
          ]
        }
      ]
    })

    const activeFile = buildFile({
      fileName: 'current.mml',
      mode: 'mml',
      content: '/* ME TYPE=AMF, Version=20.9.2 */\nADD TEST:NAME="Alpha";\n',
      mmlMetadata: {
        networkType: 'AMF',
        networkVersion: '20.9.2'
      }
    })
    const wrapper = mount(WorkspaceEditorPane, {
      props: {
        openFiles: [activeFile],
        activeFileId: activeFile.fileId,
        activeFile
      }
    })

    await flushPromises()
    await wrapper.get('.workspace-editor__tool-btn:last-child').trigger('click')
    await flushPromises()
    await wrapper.get('.workspace-editor__mml-tab:last-child').trigger('click')

    expect(wrapper.find('.workspace-text-editor-stub').exists()).toBe(false)

    await wrapper.get('.mml-workbook-grid-stub__spare-mode-only').trigger('click')

    expect(wrapper.find('.mml-workbook-grid-stub').attributes('data-incomplete-count')).toBe('1')
    expect(wrapper.find('.workspace-editor__status-right').text()).toContain('缺少必选参数: NAME')
    expect(wrapper.emitted('update-content')).toBeUndefined()
  })

  it('shows a text-view diagnostic summary and lets the user select a diagnostic entry', async () => {
    mockedMmlSchemaApi.getSchema.mockResolvedValueOnce({
      networkType: 'UNC',
      networkVersion: '20.11.2',
      commands: []
    })

    const activeFile = buildFile({
      fileName: 'current.mml',
      mode: 'mml',
      content: 'ADD SGSLNK:IPTYPE=IPV4;',
      mmlMetadata: {
        networkType: 'UNC',
        networkVersion: '20.11.2'
      }
    })
    const wrapper = mount(WorkspaceEditorPane, {
      props: {
        openFiles: [activeFile],
        activeFileId: activeFile.fileId,
        activeFile
      }
    })

    await flushPromises()
    await wrapper.get('.workspace-text-editor-stub__diagnostics').trigger('click')

    expect(wrapper.text()).toContain('2 条诊断 · 2 error')

    await wrapper.get('.workspace-editor__status-action').trigger('click')

    expect(wrapper.text()).toContain('缺少条件必选参数: LOCALIPV6_1')
    expect(wrapper.findAll('.workspace-editor__diagnostic-item')).toHaveLength(2)

    await wrapper.findAll('.workspace-editor__diagnostic-item')[0].trigger('click')

    expect(wrapper.get('.workspace-text-editor-stub').attributes('data-active-diagnostic-id')).toBe('diag-1')
  })

  it('uses the same loaded schema for text assistance and workbook projection in one MML session', async () => {
    mockedMmlSchemaApi.getSchema.mockResolvedValueOnce({
      networkType: 'AMF',
      networkVersion: '20.9.2',
      commands: [
        {
          commandName: 'ADD SGSLNK',
          params: [
            {
              paramName: 'IPTYPE',
              label: 'IPTYPE',
              valueType: 'enum',
              valueFormat: 'enum',
              controlType: 'select',
              required: true,
              requiredMode: 'required',
              orderParamId: 10,
              enumValues: ['IPV4', 'IPV6'],
              defaultValue: 'IPV4',
              editable: true
            }
          ]
        }
      ]
    })

    const activeFile = buildFile({
      fileName: 'network.mml',
      mode: 'mml',
      content: '/* ME TYPE=AMF, Version=20.9.2 */\nADD SGSLNK:IPTYPE=IPV4;\n',
      mmlMetadata: {
        networkType: 'AMF',
        networkVersion: '20.9.2'
      }
    })
    const wrapper = mount(WorkspaceEditorPane, {
      props: {
        openFiles: [activeFile],
        activeFileId: activeFile.fileId,
        activeFile
      }
    })

    await flushPromises()

    expect(wrapper.get('.workspace-text-editor-stub__update').attributes('data-has-mml-schema')).toBe('yes')

    await wrapper.get('.workspace-editor__tool-btn:last-child').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('ADD SGSLNK')
    expect(wrapper.findAll('.workspace-editor__mml-tab').some(tab => tab.text() === 'ADD SGSLNK')).toBe(true)
  })

  it('opens the MML config panel with task-oriented copy when table view is unavailable', async () => {
    mockedMmlSchemaApi.getSchema.mockResolvedValueOnce(null)

    const activeFile = buildFile({
      fileName: 'current.mml',
      mode: 'mml',
      content: '/* ME TYPE=AMF, Version=20.9.2 */\nADD TEST:NAME="Alpha";\n',
      mmlMetadata: {
        networkType: 'AMF',
        networkVersion: '20.9.2'
      }
    })
    const wrapper = mount(WorkspaceEditorPane, {
      props: {
        openFiles: [activeFile],
        activeFileId: activeFile.fileId,
        activeFile
      }
    })

    await flushPromises()
    await wrapper.get('.workspace-editor__tool-btn:last-child').trigger('click')
    await flushPromises()

    expect(wrapper.find('.workspace-editor__mml-config').exists()).toBe(true)
    expect(wrapper.text()).toContain('当前版本暂不支持表格解析')
    expect(wrapper.find('.mml-workbook-grid-stub').exists()).toBe(false)
  })

  it('uses the same blocked-state copy when table-view preparation fails', async () => {
    mockedMmlSchemaApi.getSchema.mockRejectedValueOnce(new Error('network error'))

    const activeFile = buildFile({
      fileName: 'current.mml',
      mode: 'mml',
      content: '/* ME TYPE=AMF, Version=20.9.2 */\nADD TEST:NAME="Alpha";\n',
      mmlMetadata: {
        networkType: 'AMF',
        networkVersion: '20.9.2'
      }
    })
    const wrapper = mount(WorkspaceEditorPane, {
      props: {
        openFiles: [activeFile],
        activeFileId: activeFile.fileId,
        activeFile
      }
    })

    await flushPromises()
    await wrapper.get('.workspace-editor__tool-btn:last-child').trigger('click')
    await flushPromises()

    expect(wrapper.find('.workspace-editor__mml-config').exists()).toBe(true)
    expect(wrapper.text()).toContain('当前版本暂不支持表格解析')
    expect(wrapper.find('.mml-workbook-grid-stub').exists()).toBe(false)
  })

  it('keeps 汇总 fixed at the far left and switches between summary and command-sheet bodies', async () => {
    mockedMmlSchemaApi.getSchema.mockResolvedValueOnce({
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
              controlType: 'text',
              required: true,
              orderParamId: 10,
              enumValues: [],
              defaultValue: null,
              editable: true
            }
          ]
        }
      ]
    })

    const activeFile = buildFile({
      fileName: 'current.mml',
      mode: 'mml',
      content: '/* ME TYPE=AMF, Version=20.9.2 */\nADD TEST:NAME="Alpha";\n',
      mmlMetadata: {
        networkType: 'AMF',
        networkVersion: '20.9.2'
      }
    })
    const wrapper = mount(WorkspaceEditorPane, {
      props: {
        openFiles: [activeFile],
        activeFileId: activeFile.fileId,
        activeFile
      }
    })

    await flushPromises()
    await wrapper.get('.workspace-editor__tool-btn:last-child').trigger('click')
    await flushPromises()

    const tabs = wrapper.findAll('.workspace-editor__mml-tab')
    const shell = wrapper.get('.workspace-editor__mml-shell')
    expect(tabs[0].text()).toBe('汇总')
    expect(wrapper.find('.workspace-editor__mml-summary-page').exists()).toBe(true)
    expect(shell.find('.workspace-editor__mml-summary-page').classes()).toContain('workspace-editor__mml-sheet-surface')
    expect(shell.find('.workspace-editor__mml-summary-page').classes()).toContain('workspace-editor__mml-sheet-surface--summary')
    expect(wrapper.find('.mml-workbook-grid-stub').exists()).toBe(false)

    await tabs[1].trigger('click')

    expect(wrapper.find('.workspace-editor__mml-summary-page').exists()).toBe(false)
    expect(shell.find('.workspace-editor__mml-grid-panel').classes()).toContain('workspace-editor__mml-sheet-surface')
    expect(shell.find('.workspace-editor__mml-grid-panel').classes()).toContain('workspace-editor__mml-sheet-surface--grid')
    expect(wrapper.find('.mml-workbook-grid-stub').attributes('data-sheet-key')).toBe('ADD TEST')
  })

  it('surfaces spreadsheet selection and blocked-edit feedback in the status bar', async () => {
    mockedMmlSchemaApi.getSchema.mockResolvedValueOnce({
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
              controlType: 'text',
              required: true,
              orderParamId: 10,
              enumValues: [],
              defaultValue: null,
              editable: true
            },
            {
              paramName: 'MODE',
              label: 'MODE',
              valueType: 'enum',
              controlType: 'select',
              required: false,
              orderParamId: 20,
              enumValues: ['A', 'B'],
              defaultValue: 'A',
              editable: true
            }
          ]
        }
      ]
    })

    const activeFile = buildFile({
      fileName: 'current.mml',
      mode: 'mml',
      content: '/* ME TYPE=AMF, Version=20.9.2 */\nADD TEST:NAME="Alpha", MODE=A;\n',
      mmlMetadata: {
        networkType: 'AMF',
        networkVersion: '20.9.2'
      }
    })
    const wrapper = mount(WorkspaceEditorPane, {
      props: {
        openFiles: [activeFile],
        activeFileId: activeFile.fileId,
        activeFile
      }
    })

    await flushPromises()
    await wrapper.get('.workspace-editor__tool-btn:last-child').trigger('click')
    await flushPromises()
    await wrapper.get('.workspace-editor__mml-tab:last-child').trigger('click')

    await wrapper.get('.mml-workbook-grid-stub__select').trigger('click')
    expect(wrapper.find('.workspace-editor__status-right').text()).toContain('R1 NAME · 可编辑')

    await wrapper.get('.mml-workbook-grid-stub__select-spare').trigger('click')
    expect(wrapper.find('.workspace-editor__status-right').text()).toContain('空白行，可继续填写新语句')

    await wrapper.get('.mml-workbook-grid-stub__blocked').trigger('click')
    expect(wrapper.find('.workspace-editor__status-right').text()).toContain('R2 NAME · Unknown parameters: EXTRA')
    expect(wrapper.get('.workspace-editor__table-view').attributes('style') || '').not.toContain('display: none;')
  })

  it('handles update-only paste through the MML workbook flow', async () => {
    mockedMmlSchemaApi.getSchema.mockResolvedValueOnce({
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
              controlType: 'text',
              required: true,
              orderParamId: 10,
              enumValues: [],
              defaultValue: null,
              editable: true
            },
            {
              paramName: 'MODE',
              label: 'MODE',
              valueType: 'enum',
              controlType: 'select',
              required: false,
              orderParamId: 20,
              enumValues: ['A', 'B'],
              defaultValue: 'A',
              editable: true
            }
          ]
        }
      ]
    })

    const activeFile = buildFile({
      fileName: 'current.mml',
      mode: 'mml',
      content: '/* ME TYPE=AMF, Version=20.9.2 */\nADD TEST:NAME="Alpha";\n',
      mmlMetadata: {
        networkType: 'AMF',
        networkVersion: '20.9.2'
      }
    })
    const wrapper = mount(WorkspaceEditorPane, {
      props: {
        openFiles: [activeFile],
        activeFileId: activeFile.fileId,
        activeFile
      }
    })

    await flushPromises()
    await wrapper.get('.workspace-editor__tool-btn:last-child').trigger('click')
    await flushPromises()
    await wrapper.get('.workspace-editor__mml-tab:last-child').trigger('click')
    await wrapper.get('.mml-workbook-grid-stub__paste-update').trigger('click')

    expect(wrapper.emitted('update-content')).toEqual([
      ['file-1', '/* ME TYPE=AMF, Version=20.9.2 */\nADD TEST:NAME="Alpha", MODE=B;\n']
    ])
    expect(wrapper.find('.workspace-editor__status-right').text()).toContain('已更新 1 行')
  })

  it('handles append-only paste through the MML workbook flow', async () => {
    mockedMmlSchemaApi.getSchema.mockResolvedValueOnce({
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
              controlType: 'text',
              required: true,
              orderParamId: 10,
              enumValues: [],
              defaultValue: null,
              editable: true
            },
            {
              paramName: 'MODE',
              label: 'MODE',
              valueType: 'enum',
              controlType: 'select',
              required: false,
              orderParamId: 20,
              enumValues: ['A', 'B'],
              defaultValue: 'A',
              editable: true
            }
          ]
        }
      ]
    })

    const activeFile = buildFile({
      fileName: 'current.mml',
      mode: 'mml',
      content: '/* ME TYPE=AMF, Version=20.9.2 */\nADD TEST:NAME="Alpha";\n',
      mmlMetadata: {
        networkType: 'AMF',
        networkVersion: '20.9.2'
      }
    })
    const wrapper = mount(WorkspaceEditorPane, {
      props: {
        openFiles: [activeFile],
        activeFileId: activeFile.fileId,
        activeFile
      }
    })

    await flushPromises()
    await wrapper.get('.workspace-editor__tool-btn:last-child').trigger('click')
    await flushPromises()
    await wrapper.get('.workspace-editor__mml-tab:last-child').trigger('click')
    await wrapper.get('.mml-workbook-grid-stub__paste-append').trigger('click')

    expect(wrapper.emitted('update-content')).toEqual([
      ['file-1', '/* ME TYPE=AMF, Version=20.9.2 */\nADD TEST:NAME="Alpha";\nADD TEST:NAME="Beta";\n']
    ])
    expect(wrapper.find('.workspace-editor__status-right').text()).toContain('已新增 1 行')
  })

  it('handles mixed update-plus-append paste through the MML workbook flow', async () => {
    mockedMmlSchemaApi.getSchema.mockResolvedValueOnce({
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
              controlType: 'text',
              required: true,
              orderParamId: 10,
              enumValues: [],
              defaultValue: null,
              editable: true
            },
            {
              paramName: 'MODE',
              label: 'MODE',
              valueType: 'enum',
              controlType: 'select',
              required: false,
              orderParamId: 20,
              enumValues: ['A', 'B'],
              defaultValue: 'A',
              editable: true
            }
          ]
        }
      ]
    })

    const activeFile = buildFile({
      fileName: 'current.mml',
      mode: 'mml',
      content: '/* ME TYPE=AMF, Version=20.9.2 */\nADD TEST:NAME="Alpha";\n',
      mmlMetadata: {
        networkType: 'AMF',
        networkVersion: '20.9.2'
      }
    })
    const wrapper = mount(WorkspaceEditorPane, {
      props: {
        openFiles: [activeFile],
        activeFileId: activeFile.fileId,
        activeFile
      }
    })

    await flushPromises()
    await wrapper.get('.workspace-editor__tool-btn:last-child').trigger('click')
    await flushPromises()
    await wrapper.get('.workspace-editor__mml-tab:last-child').trigger('click')
    await wrapper.get('.mml-workbook-grid-stub__paste-mixed').trigger('click')

    expect(wrapper.emitted('update-content')).toEqual([
      ['file-1', '/* ME TYPE=AMF, Version=20.9.2 */\nADD TEST:NAME="Gamma";\nADD TEST:NAME="Delta";\n']
    ])
    expect(wrapper.find('.workspace-editor__status-right').text()).toContain('已更新 1 行，新增 1 行')
  })

  it('keeps spare-row partial input local, blocks save, and resumes after file-tab switching', async () => {
    mockedMmlSchemaApi.getSchema.mockResolvedValue({
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
              controlType: 'text',
              required: true,
              orderParamId: 10,
              enumValues: [],
              defaultValue: null,
              editable: true
            },
            {
              paramName: 'MODE',
              label: 'MODE',
              valueType: 'enum',
              controlType: 'select',
              required: false,
              orderParamId: 20,
              enumValues: ['A', 'B'],
              defaultValue: 'A',
              editable: true
            }
          ]
        }
      ]
    })

    const firstFile = buildFile({
      fileId: 'file-1',
      fileKey: 'file-1',
      fileName: 'first.mml',
      mode: 'mml',
      content: '/* ME TYPE=AMF, Version=20.9.2 */\nADD TEST:NAME="Alpha";\n',
      mmlMetadata: {
        networkType: 'AMF',
        networkVersion: '20.9.2'
      }
    })
    const secondFile = buildFile({
      fileId: 'file-2',
      fileKey: 'file-2',
      fileName: 'second.mml',
      mode: 'mml',
      content: '/* ME TYPE=AMF, Version=20.9.2 */\nADD TEST:NAME="Omega";\n',
      mmlMetadata: {
        networkType: 'AMF',
        networkVersion: '20.9.2'
      }
    })
    const wrapper = mount(WorkspaceEditorPane, {
      props: {
        openFiles: [firstFile, secondFile],
        activeFileId: firstFile.fileId,
        activeFile: firstFile
      }
    })

    await flushPromises()
    await wrapper.get('.workspace-editor__tool-btn:last-child').trigger('click')
    await flushPromises()
    await wrapper.get('.workspace-editor__mml-tab:last-child').trigger('click')
    await wrapper.get('.mml-workbook-grid-stub__spare-mode-only').trigger('click')

    expect(wrapper.find('.workspace-editor__status-right').text()).toContain('缺少必选参数: NAME')
    expect(wrapper.get('.workspace-editor__save-state').text()).toContain('存在未完成表格行')
    expect(wrapper.find('.mml-workbook-grid-stub').attributes('data-incomplete-count')).toBe('1')

    await wrapper.get('.workspace-editor__action-btn').trigger('click')

    expect(wrapper.emitted('save-file')).toBeUndefined()
    expect(wrapper.get('.workspace-editor__save-state').text()).toContain('补齐或清除后再保存')

    await wrapper.setProps({
      openFiles: [firstFile, secondFile],
      activeFileId: secondFile.fileId,
      activeFile: secondFile
    })
    await flushPromises()
    await wrapper.get('.workspace-editor__tool-btn:last-child').trigger('click')
    await flushPromises()
    await wrapper.get('.workspace-editor__mml-tab:last-child').trigger('click')

    expect(wrapper.find('.mml-workbook-grid-stub').attributes('data-incomplete-count')).toBe('0')

    await wrapper.setProps({
      openFiles: [firstFile, secondFile],
      activeFileId: firstFile.fileId,
      activeFile: firstFile
    })
    await flushPromises()
    await wrapper.get('.workspace-editor__tool-btn:last-child').trigger('click')
    await flushPromises()
    await wrapper.get('.workspace-editor__mml-tab:last-child').trigger('click')

    expect(wrapper.find('.mml-workbook-grid-stub').attributes('data-incomplete-count')).toBe('1')
    expect(wrapper.get('.workspace-editor__save-state').text()).toContain('存在未完成表格行')
  })

  it('materializes a spare row through direct typing without auto-filling untouched columns', async () => {
    mockedMmlSchemaApi.getSchema.mockResolvedValueOnce({
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
              controlType: 'text',
              required: true,
              orderParamId: 10,
              enumValues: [],
              defaultValue: null,
              editable: true
            },
            {
              paramName: 'MODE',
              label: 'MODE',
              valueType: 'enum',
              controlType: 'select',
              required: false,
              orderParamId: 20,
              enumValues: ['A', 'B'],
              defaultValue: 'A',
              editable: true
            }
          ]
        }
      ]
    })

    const activeFile = buildFile({
      fileName: 'current.mml',
      mode: 'mml',
      content: '/* ME TYPE=AMF, Version=20.9.2 */\nADD TEST:NAME="Alpha";\n',
      mmlMetadata: {
        networkType: 'AMF',
        networkVersion: '20.9.2'
      }
    })
    const wrapper = mount(WorkspaceEditorPane, {
      props: {
        openFiles: [activeFile],
        activeFileId: activeFile.fileId,
        activeFile
      }
    })

    await flushPromises()
    await wrapper.get('.workspace-editor__tool-btn:last-child').trigger('click')
    await flushPromises()
    await wrapper.get('.workspace-editor__mml-tab:last-child').trigger('click')
    await wrapper.get('.mml-workbook-grid-stub__spare-edit').trigger('click')

    expect(wrapper.emitted('update-content')).toEqual([
      ['file-1', '/* ME TYPE=AMF, Version=20.9.2 */\nADD TEST:NAME="Alpha";\nADD TEST:NAME="Beta";\n']
    ])
    expect(wrapper.find('.workspace-editor__status-right').text()).toContain('已新增 1 行')
  })

  it('routes text-class files through the Monaco-backed text editor adapter', async () => {
    const activeFile = buildFile()
    const wrapper = mount(WorkspaceEditorPane, {
      props: {
        openFiles: [activeFile],
        activeFileId: activeFile.fileId,
        activeFile
      }
    })

    expect(wrapper.find('.workspace-text-editor-stub').exists()).toBe(true)
    expect(wrapper.find('textarea').exists()).toBe(false)

    await wrapper.get('.workspace-text-editor-stub__update').trigger('click')

    expect(wrapper.emitted('update-content')).toEqual([[activeFile.fileId, 'alpha-updated']])
  })

  it('shows txt files an MML parsing entry and expands editable config on demand', async () => {
    mockedMmlSchemaApi.getOptions.mockResolvedValueOnce({
      networkTypes: ['UNC', 'AMF'],
      networkVersionsByType: {
        UNC: ['20.11.2', '20.9.2'],
        AMF: ['20.9.2']
      }
    })

    const activeFile = buildFile()
    const wrapper = mount(WorkspaceEditorPane, {
      props: {
        openFiles: [activeFile],
        activeFileId: activeFile.fileId,
        activeFile
      }
    })

    expect(wrapper.find('.workspace-text-editor-stub__update').attributes('data-file-mode')).toBe('text')
    expect(wrapper.find('.workspace-editor__mml-entry').text()).toContain('按 MML 解析：未启用')
    expect(wrapper.find('.workspace-editor__toolbar').text()).not.toContain('类型')
    expect(wrapper.find('.workspace-editor__toolbar').text()).not.toContain('继续处理')
    expect(wrapper.find('.workspace-editor__mml-config').exists()).toBe(false)

    await wrapper.get('.workspace-editor__mml-entry').trigger('click')
    await flushPromises()

    expect(wrapper.find('.workspace-editor__mml-config').exists()).toBe(true)
    expect(wrapper.text()).toContain('完成配置后可使用表格视图')
    expect(mockedMmlSchemaApi.getOptions).toHaveBeenCalledTimes(1)

    const selects = wrapper.findAll('.workspace-editor__mml-field-select')
    expect(selects).toHaveLength(2)
    expect(selects[0].findAll('option')[0].text()).toBe('请选择')
    expect(selects[1].findAll('option')[0].text()).toBe('请选择')

    await selects[0].setValue('UNC')

    expect(wrapper.emitted('update-mml-metadata')).toEqual([
      ['file-1', { networkType: 'UNC', networkVersion: '' }]
    ])

    await wrapper.setProps({
      activeFile: buildFile({
        fileId: 'file-1',
        fileName: 'current.txt',
        mode: 'mml',
        content: 'alpha',
        mmlMetadata: {
          networkType: 'UNC',
          networkVersion: ''
        }
      })
    })
    await flushPromises()

    const updatedSelects = wrapper.findAll('.workspace-editor__mml-field-select')
    expect(updatedSelects[1].findAll('option').map(option => option.text())).toEqual(['请选择', '20.11.2', '20.9.2'])

    await updatedSelects[1].setValue('20.11.2')

    expect(wrapper.emitted('update-mml-metadata')?.at(-1)).toEqual([
      'file-1',
      { networkType: 'UNC', networkVersion: '20.11.2' }
    ])
  })

  it('defaults markdown files to preview while preserving 编辑/预览 switching and no MML parsing entry', async () => {
    const activeFile = buildFile({
      fileName: 'notes.md',
      mode: 'markdown',
      content: '# 标题\n\n- 项目一\n'
    })
    const wrapper = mount(WorkspaceEditorPane, {
      props: {
        openFiles: [activeFile],
        activeFileId: activeFile.fileId,
        activeFile
      }
    })

    const buttons = wrapper.findAll('.workspace-editor__tool-btn')
    expect(buttons[0].text()).toBe('编辑')
    expect(buttons[1].text()).toBe('预览')
    expect(wrapper.find('.workspace-text-editor-stub__update').attributes('data-file-mode')).toBe('markdown')
    expect(wrapper.find('.workspace-editor__mml-entry').exists()).toBe(false)
    expect(wrapper.find('.workspace-editor__toolbar').text()).not.toContain('表格视图')
    expect(wrapper.get('.workspace-editor__text-view').attributes('style') || '').toContain('display: none;')
    expect(wrapper.get('.workspace-editor__preview-view').attributes('style') || '').not.toContain('display: none;')
    expect(wrapper.find('.workspace-editor__selected-file').exists()).toBe(false)
    expect(wrapper.get('.workspace-editor__tab-row').text()).toContain('notes.md')
    expect(wrapper.get('.workspace-editor__status-left').text()).not.toContain('notes.md')
    expect(countOccurrences(wrapper.text(), 'notes.md')).toBe(1)
    expect(wrapper.text()).toContain('标题')
    expect(wrapper.text()).toContain('项目一')

    await buttons[0].trigger('click')

    expect(buttons[0].classes()).toContain('segmented-control__item--active')
    expect(wrapper.get('.workspace-editor__text-view').attributes('style') || '').not.toContain('display: none;')
    expect(wrapper.get('.workspace-editor__preview-view').attributes('style') || '').toContain('display: none;')

    await buttons[1].trigger('click')

    expect(buttons[1].classes()).toContain('segmented-control__item--active')
    expect(wrapper.get('.workspace-editor__text-view').attributes('style') || '').toContain('display: none;')
    expect(wrapper.get('.workspace-editor__preview-view').attributes('style') || '').not.toContain('display: none;')
  })

  it('resets an already-open markdown file back to preview when re-activated', async () => {
    const markdownFile = buildFile({
      fileName: 'notes.md',
      mode: 'markdown',
      content: '# 标题\n\n- 项目一\n'
    })
    const textFile = buildFile({
      fileKey: 'file-2',
      fileId: 'file-2',
      fileName: 'notes.txt',
      mode: 'text',
      content: 'plain text'
    })
    const wrapper = mount(WorkspaceEditorPane, {
      props: {
        openFiles: [markdownFile, textFile],
        activeFileId: markdownFile.fileId,
        activeFile: markdownFile
      }
    })

    const markdownButtons = wrapper.findAll('.workspace-editor__tool-btn')
    await markdownButtons[0].trigger('click')

    expect(wrapper.get('.workspace-editor__text-view').attributes('style') || '').not.toContain('display: none;')
    expect(wrapper.get('.workspace-editor__preview-view').attributes('style')).toContain('display: none;')

    await wrapper.setProps({
      openFiles: [markdownFile, textFile],
      activeFileId: textFile.fileId,
      activeFile: textFile
    })
    await flushPromises()

    await wrapper.setProps({
      openFiles: [markdownFile, textFile],
      activeFileId: markdownFile.fileId,
      activeFile: markdownFile
    })
    await flushPromises()

    const reactivatedButtons = wrapper.findAll('.workspace-editor__tool-btn')
    expect(reactivatedButtons[1].text()).toBe('预览')
    expect(reactivatedButtons[1].attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('.workspace-editor__text-view').attributes('style') || '').toContain('display: none;')
    expect(wrapper.get('.workspace-editor__preview-view').attributes('style') || '').not.toContain('display: none;')
  })

  it('keeps markdown scrolling styles on the preview pane instead of the rendered content layer', () => {
    const markdownRootStyle = normalizedWorkspaceMarkdownPreviewSource.match(
      /\.workspace-markdown-preview\s*\{[\s\S]*?\}/
    )?.[0]

    expect(normalizedWorkspaceEditorPaneSource).toContain('.workspace-editor {\n  flex: 1;\n  min-height: 0;')
    expect(normalizedWorkspaceEditorPaneSource).toContain('.workspace-editor__preview-view {\n  display: flex;\n  flex-direction: column;\n  overflow: auto;')
    expect(markdownRootStyle).toBeDefined()
    expect(markdownRootStyle).not.toContain('height: 100%;')
    expect(markdownRootStyle).not.toContain('overflow: auto;')
  })

  it('defines a connected workbook shell for MML table mode', () => {
    expect(normalizedWorkspaceEditorPaneSource).toContain('class="workspace-editor__mml-shell"')
    expect(normalizedWorkspaceEditorPaneSource).toContain(":class=\"{ 'workspace-editor__table-view--mml': activeFile.mode === 'mml' }\"")
    expect(normalizedWorkspaceEditorPaneSource).toContain('workspace-editor__mml-summary-page workspace-editor__mml-sheet-surface workspace-editor__mml-sheet-surface--summary')
    expect(normalizedWorkspaceEditorPaneSource).toContain('workspace-editor__mml-grid-panel workspace-editor__mml-sheet-surface workspace-editor__mml-sheet-surface--grid')
    expect(normalizedWorkspaceEditorPaneSource).toContain('.workspace-editor__table-view--mml {\n  padding: 4px;')
    expect(normalizedWorkspaceEditorPaneSource).toContain('.workspace-editor__mml-shell {\n  min-height: 0;')
    expect(normalizedWorkspaceEditorPaneSource).toContain('padding: 2px 4px 0;')
    expect(normalizedWorkspaceEditorPaneSource).toContain('overflow-x: auto;')
    expect(normalizedWorkspaceEditorPaneSource).toContain('overflow-y: hidden;')
    expect(normalizedWorkspaceEditorPaneSource).toContain('.workspace-editor__mml-sheet-surface--grid {\n  padding: 0;')
  })

  it('opens MML configuration when a txt file requests table view before parsing is enabled', async () => {
    const activeFile = buildFile()
    const wrapper = mount(WorkspaceEditorPane, {
      props: {
        openFiles: [activeFile],
        activeFileId: activeFile.fileId,
        activeFile
      }
    })

    await wrapper.get('.workspace-editor__tool-btn:last-child').trigger('click')

    expect(wrapper.find('.workspace-editor__mml-config').exists()).toBe(true)
    expect(wrapper.text()).toContain('完成配置后可使用表格视图')
    expect(wrapper.text()).toContain('当前文件暂不可用表格视图')
    expect(wrapper.get('.workspace-editor__table-view').attributes('style') || '').not.toContain('display: none;')
    expect(wrapper.get('.workspace-editor__text-view').attributes('style') || '').toContain('display: none;')
    expect(wrapper.find('.workspace-editor__table').exists()).toBe(false)
  })

  it('preserves the existing CSV editing path outside the Monaco-backed adapter', async () => {
    mockedMmlSchemaApi.getSchema.mockResolvedValue(null)
    const activeFile = buildFile({
      fileName: 'current.csv',
      mode: 'csv',
      content: 'name,value\nalpha,1\nbeta,2\n',
      mmlMetadata: null
    })
    const wrapper = mount(WorkspaceEditorPane, {
      props: {
        openFiles: [activeFile],
        activeFileId: activeFile.fileId,
        activeFile
      }
    })

    expect(wrapper.find('.workspace-text-editor-stub').exists()).toBe(false)
    expect(wrapper.find('textarea').exists()).toBe(true)

    await wrapper.get('.workspace-editor__tool-btn:last-child').trigger('click')

    expect(wrapper.find('.workspace-editor__table').exists()).toBe(true)
    expect(wrapper.get('.workspace-editor__table-view').classes()).not.toContain('workspace-editor__table-view--mml')
    expect(wrapper.text()).toContain('2 行，2 列')
  })
})
