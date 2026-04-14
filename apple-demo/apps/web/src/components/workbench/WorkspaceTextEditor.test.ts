import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MML_LANGUAGE_ID } from './textEditor/mmlLanguage'

const monacoTestHarness = vi.hoisted(() => {
  let currentValue = ''
  let currentLanguage = 'plaintext'
  let currentSelection = {
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: 1,
    endColumn: 1
  }
  const listeners: Array<() => void> = []
  const markers: unknown[] = []
  let hoverProvider: { provideHover: (model: unknown, position: { lineNumber: number; column: number }) => unknown } | null = null
  let contentHoverContribution: object | null = {}

  function getOffsetAt(position: { lineNumber: number; column: number }) {
    const lines = currentValue.split('\n')
    let offset = 0
    for (let index = 0; index < position.lineNumber - 1; index += 1) {
      offset += (lines[index] || '').length + 1
    }
    return offset + position.column - 1
  }

  function getPositionAt(offset: number) {
    const prefix = currentValue.slice(0, offset)
    const lines = prefix.split('\n')
    return {
      lineNumber: lines.length,
      column: (lines[lines.length - 1] || '').length + 1
    }
  }

  function findMatches(searchString: string, limitResultCount?: number) {
    if (!searchString) return []
    const matches: Array<{ range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number } }> = []
    const haystack = currentValue.toLowerCase()
    const needle = searchString.toLowerCase()
    let cursor = 0

    while (cursor <= haystack.length) {
      const index = haystack.indexOf(needle, cursor)
      if (index === -1) break
      const start = getPositionAt(index)
      const end = getPositionAt(index + searchString.length)
      matches.push({
        range: {
          startLineNumber: start.lineNumber,
          startColumn: start.column,
          endLineNumber: end.lineNumber,
          endColumn: end.column
        }
      })
      cursor = index + Math.max(searchString.length, 1)
      if (limitResultCount && matches.length >= limitResultCount) break
    }

    return matches
  }

  function applyEditOperations(operations: Array<{ range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }; text: string }>) {
    const nextOperations = operations
      .map(operation => ({
        start: getOffsetAt({
          lineNumber: operation.range.startLineNumber,
          column: operation.range.startColumn
        }),
        end: getOffsetAt({
          lineNumber: operation.range.endLineNumber,
          column: operation.range.endColumn
        }),
        text: operation.text
      }))
      .sort((left, right) => right.start - left.start)

    currentValue = nextOperations.reduce(
      (value, operation) => value.slice(0, operation.start) + operation.text + value.slice(operation.end),
      currentValue
    )
  }

  const model = {
    getValue: vi.fn(() => currentValue),
    setValue: vi.fn((nextValue: string) => {
      currentValue = nextValue
      listeners.forEach(listener => listener())
    }),
    onDidChangeContent: vi.fn((listener: () => void) => {
      listeners.push(listener)
      return { dispose: vi.fn() }
    }),
    findMatches: vi.fn((searchString: string, ...args: unknown[]) => {
      const limitResultCount = typeof args[5] === 'number' ? args[5] : typeof args[6] === 'number' ? args[6] : undefined
      return findMatches(searchString, limitResultCount)
    }),
    getOffsetAt: vi.fn((position: { lineNumber: number; column: number }) => getOffsetAt(position)),
    getPositionAt: vi.fn((offset: number) => getPositionAt(offset)),
    getWordUntilPosition: vi.fn(() => ({
      startColumn: 1,
      endColumn: 1
    })),
    pushEditOperations: vi.fn((_selections: unknown, operations: Array<{ range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }; text: string }>) => {
      applyEditOperations(operations)
      listeners.forEach(listener => listener())
      return null
    }),
    getLanguageId: vi.fn(() => currentLanguage),
    dispose: vi.fn()
  }

  const editor = {
    getPosition: vi.fn(() => ({ lineNumber: 1, column: 1 })),
    getSelection: vi.fn(() => currentSelection),
    getContribution: vi.fn((id: string) => (id === 'editor.contrib.contentHover' ? contentHoverContribution : null)),
    addAction: vi.fn(() => ({ dispose: vi.fn() })),
    onDidBlurEditorText: vi.fn(() => ({ dispose: vi.fn() })),
    setSelection: vi.fn((range: typeof currentSelection) => {
      currentSelection = range
    }),
    revealRangeInCenter: vi.fn(),
    focus: vi.fn(),
    trigger: vi.fn(),
    dispose: vi.fn()
  }

  const monaco = {
    Range: class {
      constructor(
        public startLineNumber: number,
        public startColumn: number,
        public endLineNumber: number,
        public endColumn: number
      ) {}
    },
    MarkerSeverity: {
      Error: 8,
      Warning: 4
    },
    languages: {
      CompletionItemKind: {
        Keyword: 17,
        Field: 5,
        Function: 1,
        Value: 12
      },
      registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })),
      registerHoverProvider: vi.fn((_language: string, provider: typeof hoverProvider) => {
        hoverProvider = provider
        return { dispose: vi.fn() }
      })
    },
    editor: {
      createModel: vi.fn((value: string, language: string) => {
        currentValue = value
        currentLanguage = language
        return model
      }),
      create: vi.fn(() => editor),
      setModelMarkers: vi.fn((_model: unknown, _owner: string, nextMarkers: unknown[]) => {
        markers.length = 0
        markers.push(...nextMarkers)
      }),
      setModelLanguage: vi.fn((_model: unknown, language: string) => {
        currentLanguage = language
      })
    }
  }

  return {
    monaco,
    model,
    editor,
    getHoverProvider() {
      return hoverProvider
    },
    setContentHoverContribution(nextValue: object | null) {
      contentHoverContribution = nextValue
    },
    listeners,
    markers,
    resetSelection() {
      currentSelection = {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1
      }
    },
    setCurrentValue(nextValue: string) {
      currentValue = nextValue
    }
  }
})

vi.mock('./textEditor/monacoRuntime', () => ({
  loadMonaco: vi.fn(async () => monacoTestHarness.monaco)
}))

import WorkspaceTextEditor from './WorkspaceTextEditor.vue'

describe('WorkspaceTextEditor', () => {
  beforeEach(() => {
    monacoTestHarness.setContentHoverContribution({})
    monacoTestHarness.listeners.length = 0
    monacoTestHarness.setCurrentValue('')
    monacoTestHarness.resetSelection()
    monacoTestHarness.model.getValue.mockClear()
    monacoTestHarness.model.findMatches.mockClear()
    monacoTestHarness.model.setValue.mockClear()
    monacoTestHarness.model.onDidChangeContent.mockClear()
    monacoTestHarness.model.pushEditOperations.mockClear()
    monacoTestHarness.model.dispose.mockClear()
    monacoTestHarness.editor.dispose.mockClear()
    monacoTestHarness.editor.addAction.mockClear()
    monacoTestHarness.editor.trigger.mockClear()
    monacoTestHarness.editor.onDidBlurEditorText.mockClear()
    monacoTestHarness.editor.getContribution.mockClear()
    monacoTestHarness.editor.getSelection.mockClear()
    monacoTestHarness.editor.setSelection.mockClear()
    monacoTestHarness.editor.revealRangeInCenter.mockClear()
    monacoTestHarness.editor.focus.mockClear()
    monacoTestHarness.monaco.editor.createModel.mockClear()
    monacoTestHarness.monaco.editor.create.mockClear()
    monacoTestHarness.monaco.editor.setModelMarkers.mockClear()
    monacoTestHarness.monaco.editor.setModelLanguage.mockClear()
    monacoTestHarness.monaco.languages.registerCompletionItemProvider.mockClear()
    monacoTestHarness.monaco.languages.registerHoverProvider.mockClear()
  })

  it('creates a Monaco-backed editor and emits content changes', async () => {
    const wrapper = mount(WorkspaceTextEditor, {
      props: {
        modelValue: 'alpha',
        fileMode: 'text'
      }
    })

    await flushPromises()

    expect(monacoTestHarness.monaco.editor.createModel).toHaveBeenCalledWith('alpha', 'plaintext')
    expect(monacoTestHarness.monaco.editor.create).toHaveBeenCalledTimes(1)

    monacoTestHarness.setCurrentValue('beta')
    monacoTestHarness.listeners.forEach(listener => listener())

    expect(wrapper.emitted('update:modelValue')).toEqual([['beta']])
  })

  it('syncs external store updates into the Monaco model without echoing them back', async () => {
    const wrapper = mount(WorkspaceTextEditor, {
      props: {
        modelValue: 'alpha',
        fileMode: 'mml'
      }
    })

    await flushPromises()

    expect(monacoTestHarness.monaco.editor.createModel).toHaveBeenCalledWith('alpha', MML_LANGUAGE_ID)
    await wrapper.setProps({ modelValue: 'gamma' })

    expect(monacoTestHarness.model.setValue).toHaveBeenCalledWith('gamma')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('switches the Monaco model language when file mode changes', async () => {
    const wrapper = mount(WorkspaceTextEditor, {
      props: {
        modelValue: 'alpha',
        fileMode: 'text'
      }
    })

    await flushPromises()
    await wrapper.setProps({ fileMode: 'mml' })

    expect(monacoTestHarness.monaco.editor.setModelLanguage).toHaveBeenCalledWith(monacoTestHarness.model, MML_LANGUAGE_ID)
  })

  it('uses Monaco markdown language mode for markdown workspace files', async () => {
    const wrapper = mount(WorkspaceTextEditor, {
      props: {
        modelValue: '# title',
        fileMode: 'markdown'
      }
    })

    await flushPromises()

    expect(monacoTestHarness.monaco.editor.createModel).toHaveBeenCalledWith('# title', 'markdown')

    await wrapper.setProps({ fileMode: 'text' })

    expect(monacoTestHarness.monaco.editor.setModelLanguage).toHaveBeenCalledWith(monacoTestHarness.model, 'plaintext')
  })

  it('exposes current-file search navigation for the active Monaco editor', async () => {
    const wrapper = mount(WorkspaceTextEditor, {
      props: {
        modelValue: 'alpha beta alpha',
        fileMode: 'text'
      }
    })

    await flushPromises()

    const editorVm = wrapper.vm as unknown as {
      findNextMatch: () => boolean
      findPreviousMatch: () => boolean
      setSearchQuery: (searchQuery: string) => boolean
    }

    expect(editorVm.setSearchQuery('alpha')).toBe(true)
    expect(monacoTestHarness.editor.setSelection).toHaveBeenLastCalledWith(expect.objectContaining({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 6
    }))
    expect(monacoTestHarness.editor.focus).not.toHaveBeenCalled()

    expect(editorVm.findNextMatch()).toBe(true)
    expect(monacoTestHarness.editor.setSelection).toHaveBeenLastCalledWith(expect.objectContaining({
      startLineNumber: 1,
      startColumn: 12,
      endLineNumber: 1,
      endColumn: 17
    }))
    expect(monacoTestHarness.editor.focus).toHaveBeenCalledTimes(1)

    expect(editorVm.findPreviousMatch()).toBe(true)
    expect(monacoTestHarness.editor.setSelection).toHaveBeenLastCalledWith(expect.objectContaining({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 6
    }))
    expect(monacoTestHarness.editor.focus).toHaveBeenCalledTimes(2)
  })

  it('dispatches replace-current, replace-all, and undo through the active Monaco editor instance', async () => {
    const wrapper = mount(WorkspaceTextEditor, {
      props: {
        modelValue: 'alpha beta alpha',
        fileMode: 'text'
      }
    })

    await flushPromises()

    const editorVm = wrapper.vm as unknown as {
      replaceAllMatches: (replaceQuery: string) => boolean
      replaceCurrentMatch: (replaceQuery: string) => boolean
      setSearchQuery: (searchQuery: string) => boolean
      undo: () => void
    }

    editorVm.setSearchQuery('alpha')
    expect(editorVm.replaceCurrentMatch('omega')).toBe(true)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['omega beta alpha'])

    editorVm.setSearchQuery('alpha')
    expect(editorVm.replaceAllMatches('omega')).toBe(true)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['omega beta omega'])

    editorVm.undo()
    expect(monacoTestHarness.editor.trigger).toHaveBeenCalledWith('workspace-text-editor', 'undo', null)
  })

  it('registers MML assistance when schema metadata is available', async () => {
    mount(WorkspaceTextEditor, {
      props: {
        modelValue: 'ADD TEST:MODE=A;',
        fileMode: 'mml',
        mmlSchema: {
          networkType: 'AMF',
          networkVersion: '20.9.2',
          commands: [
            {
              commandName: 'ADD TEST',
              params: [
                {
                  paramName: 'MODE',
                  label: 'MODE',
                  valueType: 'enum',
                  valueFormat: 'enum',
                  controlType: 'select',
                  required: false,
                  requiredMode: 'optional',
                  orderParamId: 10,
                  enumValues: ['A', 'B'],
                  defaultValue: null,
                  editable: true
                }
              ]
            }
          ]
        }
      }
    })

    await flushPromises()

    expect(monacoTestHarness.monaco.languages.registerCompletionItemProvider).toHaveBeenCalled()
    expect(monacoTestHarness.monaco.languages.registerHoverProvider).toHaveBeenCalled()
    expect(monacoTestHarness.monaco.editor.setModelMarkers).toHaveBeenCalled()
    expect(monacoTestHarness.editor.getContribution).toHaveBeenCalledWith('editor.contrib.contentHover')
  })

  it('emits normalized diagnostics for active MML markers', async () => {
    const wrapper = mount(WorkspaceTextEditor, {
      props: {
        modelValue: 'ADD TEST:;',
        fileMode: 'mml',
        mmlSchema: {
          networkType: 'AMF',
          networkVersion: '20.9.2',
          commands: [
            {
              commandName: 'ADD TEST',
              params: [
                {
                  paramName: 'MODE',
                  label: 'MODE',
                  valueType: 'enum',
                  valueFormat: 'enum',
                  controlType: 'select',
                  required: true,
                  requiredMode: 'required',
                  orderParamId: 10,
                  enumValues: ['A', 'B'],
                  defaultValue: null,
                  editable: true
                }
              ]
            }
          ]
        }
      }
    })

    await flushPromises()

    expect(wrapper.emitted('diagnostics-change')?.at(-1)?.[0]).toEqual([
      expect.objectContaining({
        commandHead: 'ADD TEST',
        message: '缺少必选参数: MODE',
        severity: 'error',
        startLineNumber: 1
      })
    ])
  })

  it('reveals the selected diagnostic when activeDiagnosticId changes', async () => {
    const wrapper = mount(WorkspaceTextEditor, {
      props: {
        modelValue: 'ADD TEST:;',
        fileMode: 'mml',
        mmlSchema: {
          networkType: 'AMF',
          networkVersion: '20.9.2',
          commands: [
            {
              commandName: 'ADD TEST',
              params: [
                {
                  paramName: 'MODE',
                  label: 'MODE',
                  valueType: 'enum',
                  valueFormat: 'enum',
                  controlType: 'select',
                  required: true,
                  requiredMode: 'required',
                  orderParamId: 10,
                  enumValues: ['A', 'B'],
                  defaultValue: null,
                  editable: true
                }
              ]
            }
          ]
        }
      }
    })

    await flushPromises()
    const diagnostics = wrapper.emitted('diagnostics-change')?.at(-1)?.[0] as Array<{ id: string }>
    await wrapper.setProps({ activeDiagnosticId: diagnostics[0].id })

    expect(monacoTestHarness.editor.setSelection).toHaveBeenCalledTimes(1)
    expect(monacoTestHarness.editor.revealRangeInCenter).toHaveBeenCalledTimes(1)
    expect(monacoTestHarness.editor.focus).toHaveBeenCalledTimes(1)
  })

  it('returns schema guidance in hover for hovered parameters', async () => {
    mount(WorkspaceTextEditor, {
      props: {
        modelValue: 'ADD TEST:MODE=C;',
        fileMode: 'mml',
        mmlSchema: {
          networkType: 'AMF',
          networkVersion: '20.9.2',
          commands: [
            {
              commandName: 'ADD TEST',
              params: [
                {
                  paramName: 'MODE',
                  label: 'MODE',
                  valueType: 'enum',
                  valueFormat: 'enum',
                  controlType: 'select',
                  required: false,
                  requiredMode: 'optional',
                  orderParamId: 10,
                  enumValues: ['A', 'B'],
                  defaultValue: null,
                  editable: true
                }
              ]
            }
          ]
        }
      }
    })

    await flushPromises()
    const provider = monacoTestHarness.getHoverProvider()
    const hover = provider?.provideHover(monacoTestHarness.model as never, { lineNumber: 1, column: 11 }) as {
      contents: Array<{ value: string }>
    }

    expect(hover.contents.map(item => item.value)).toEqual([
      '**MODE**',
      '类型: enum',
      '枚举: A, B'
    ])
  })

  it('warns when the Monaco hover contribution is unavailable in the runtime', async () => {
    monacoTestHarness.setContentHoverContribution(null)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    mount(WorkspaceTextEditor, {
      props: {
        modelValue: 'ADD TEST:MODE=A;',
        fileMode: 'mml',
        mmlSchema: {
          networkType: 'AMF',
          networkVersion: '20.9.2',
          commands: [
            {
              commandName: 'ADD TEST',
              params: [
                {
                  paramName: 'MODE',
                  label: 'MODE',
                  valueType: 'enum',
                  valueFormat: 'enum',
                  controlType: 'select',
                  required: false,
                  requiredMode: 'optional',
                  orderParamId: 10,
                  enumValues: ['A', 'B'],
                  defaultValue: null,
                  editable: true
                }
              ]
            }
          ]
        }
      }
    })

    await flushPromises()

    expect(warnSpy).toHaveBeenCalledWith(
      'WorkspaceTextEditor: Monaco hover contribution is unavailable. Check the runtime entrypoint; hover support is not loaded.'
    )

    warnSpy.mockRestore()
  })
})
