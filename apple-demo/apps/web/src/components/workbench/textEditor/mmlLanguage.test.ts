import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api'
import { describe, expect, it, vi } from 'vitest'

import {
  MML_LANGUAGE_ID,
  mmlLanguageConfiguration,
  mmlMonarchLanguage,
  WORKSPACE_EDITOR_THEME,
  ensureMmlLanguage
} from './mmlLanguage'

function createMonacoMock(): typeof Monaco {
  return {
    languages: {
      register: vi.fn(),
      setLanguageConfiguration: vi.fn(),
      setMonarchTokensProvider: vi.fn()
    },
    editor: {
      defineTheme: vi.fn()
    }
  } as unknown as typeof Monaco
}

function matchesWord(value: string): boolean {
  const pattern = mmlLanguageConfiguration.wordPattern
  if (!pattern) return false
  pattern.lastIndex = 0
  return pattern.test(value)
}

describe('mmlLanguage', () => {
  it('registers the dedicated MML language, tokenizer, and theme', () => {
    const monaco = createMonacoMock()

    ensureMmlLanguage(monaco)

    expect(monaco.languages.register).toHaveBeenCalledWith({ id: MML_LANGUAGE_ID })
    expect(monaco.languages.setLanguageConfiguration).toHaveBeenCalledWith(MML_LANGUAGE_ID, mmlLanguageConfiguration)
    expect(monaco.languages.setMonarchTokensProvider).toHaveBeenCalledWith(MML_LANGUAGE_ID, mmlMonarchLanguage)
    expect(monaco.editor.defineTheme).toHaveBeenCalledWith(
      WORKSPACE_EDITOR_THEME,
      expect.objectContaining({ base: 'vs', inherit: true })
    )
  })

  it('defines editor behavior and tokenizer boundaries for MML comments and commands', () => {
    expect(mmlLanguageConfiguration.comments).toEqual({
      lineComment: '//',
      blockComment: ['/*', '*/']
    })
    expect(matchesWord('RULEBANE')).toBe(true)
    expect(matchesWord('GMT+0800')).toBe(true)
    expect(matchesWord("K'135")).toBe(true)
    expect(mmlMonarchLanguage.ignoreCase).toBe(true)
    expect(mmlMonarchLanguage.tokenizer.root).toEqual(
      expect.arrayContaining([
        [/^\s*#.*/, 'comment.line.hash'],
        [/\/\/.*$/, 'comment.line.slash'],
        [/[;]/, 'delimiter.terminator']
      ])
    )
  })

  it('uses Huawei-style statement position to classify unified command names and parameters', () => {
    expect(mmlMonarchLanguage.tokenizer.root).toEqual(
      expect.arrayContaining([
        [new RegExp('\\b(?:ADD|MOD|RMV|LST|SET|ACT|DEA|STR|DEL|DSP|CFG|SHOW)\\b(?:\\s+[A-Za-z_][\\w.]*)*'), { token: 'command.name', next: '@afterCommandHead' }]
      ])
    )
    expect(mmlMonarchLanguage.tokenizer.afterCommandHead).toEqual(
      expect.arrayContaining([
        [/:/, { token: 'delimiter.separator', next: '@afterColon' }]
      ])
    )
    expect(mmlMonarchLanguage.tokenizer.afterColon).toEqual(
      expect.arrayContaining([
        [/[A-Za-z_][\w]*/, { token: 'key.parameter', next: '@afterParameter' }]
      ])
    )
    expect(mmlMonarchLanguage.tokenizer.afterParameter).toEqual(
      expect.arrayContaining([
        [/=/, { token: 'operator.assignment', next: '@afterValue' }]
      ])
    )
  })

  it('supports Huawei-style command-name highlighting, value forms, empty command bodies, and multiple statements per line', () => {
    expect(mmlMonarchLanguage.tokenizer.afterValue).toEqual(
      expect.arrayContaining([
        [/"/, 'value.string', '@doubleQuotedValue'],
        [/[A-Za-z_][\w-]*'[^,\s;]+/, { token: 'value.prefixed', next: '@afterValueTerminator' }],
        [/[A-Za-z_][\w]*(?:[+/-][A-Za-z0-9_./-]+)+/, { token: 'value.symbolic', next: '@afterValueTerminator' }],
        [/\d+(?:\.\d+)?/, { token: 'value.number', next: '@afterValueTerminator' }],
        [/[A-Za-z_][\w.]*/, { token: 'value.enum', next: '@afterValueTerminator' }]
      ])
    )
    expect(mmlMonarchLanguage.tokenizer.afterColon).toEqual(
      expect.arrayContaining([
        [/[;]/, 'delimiter.terminator', '@popall']
      ])
    )
    expect(mmlMonarchLanguage.tokenizer.root).toEqual(
      expect.arrayContaining([
        [new RegExp('\\b(?:ADD|MOD|RMV|LST|SET|ACT|DEA|STR|DEL|DSP|CFG|SHOW)\\b(?:\\s+[A-Za-z_][\\w.]*)*'), { token: 'command.name', next: '@afterCommandHead' }]
      ])
    )
    expect(mmlMonarchLanguage.tokenizer.afterValueTerminator).toEqual(
      expect.arrayContaining([
        [/,/, { token: 'delimiter.separator', next: '@afterColon' }],
        [/[;]/, 'delimiter.terminator', '@popall']
      ])
    )
  })
})
