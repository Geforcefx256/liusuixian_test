import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtimeHarness = vi.hoisted(() => {
  const fakeMonaco = {
    editor: {},
    languages: {},
    __runtimeEntry: 'edcore.main'
  }

  return {
    fakeMonaco,
    ensureMmlLanguage: vi.fn()
  }
})

vi.mock('monaco-editor/esm/vs/editor/editor.worker?worker', () => ({
  default: class MockEditorWorker {}
}))

vi.mock('monaco-editor/esm/vs/editor/edcore.main', () => ({
  __esModule: true,
  ...runtimeHarness.fakeMonaco
}))

vi.mock('./mmlLanguage', () => ({
  ensureMmlLanguage: runtimeHarness.ensureMmlLanguage
}))

import { loadMonaco } from './monacoRuntime'

describe('monacoRuntime', () => {
  beforeEach(() => {
    runtimeHarness.ensureMmlLanguage.mockClear()
  })

  it('loads the Monaco runtime from the official edcore entrypoint', async () => {
    const monaco = await loadMonaco()

    expect((monaco as unknown as { __runtimeEntry: string }).__runtimeEntry).toBe('edcore.main')
    expect(runtimeHarness.ensureMmlLanguage).toHaveBeenCalledWith(monaco)
  })
})
