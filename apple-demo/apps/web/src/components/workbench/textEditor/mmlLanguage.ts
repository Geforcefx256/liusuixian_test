import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api'

export const MML_LANGUAGE_ID = 'mml'
export const WORKSPACE_EDITOR_THEME = 'workspace-editor-light'

const MML_COMMAND_VERBS = [
  'ADD',
  'MOD',
  'RMV',
  'LST',
  'SET',
  'ACT',
  'DEA',
  'STR',
  'DEL',
  'DSP',
  'CFG',
  'SHOW'
]

const MML_CONTROL_KEYWORDS = [
  'BEGIN',
  'END',
  'COMMIT',
  'ROLLBACK',
  'RETURN',
  'EXIT'
]

const verbPattern = `\\b(?:${MML_COMMAND_VERBS.join('|')})\\b`
const controlPattern = `\\b(?:${MML_CONTROL_KEYWORDS.join('|')})\\b`
const symbolicValuePattern = /[A-Za-z_][\w]*(?:[+/-][A-Za-z0-9_./-]+)+/
const prefixedValuePattern = /[A-Za-z_][\w-]*'[^,\s;]+/
const barewordValuePattern = /[A-Za-z_][\w.]*/
const numberValuePattern = /\d+(?:\.\d+)?/
const parameterPattern = /[A-Za-z_][\w]*/
const commandHeadPattern = /[A-Za-z_][\w.]*(?:\s+[A-Za-z_][\w.]*)*/

export const mmlLanguageConfiguration: Monaco.languages.LanguageConfiguration = {
  comments: {
    lineComment: '//',
    blockComment: ['/*', '*/']
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')']
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: '\'', close: '\'' }
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: '\'', close: '\'' }
  ],
  wordPattern: /(-?\d*\.\d\w*)|([A-Za-z_][\w.+/'-]*)/g
}

export const mmlMonarchLanguage: Monaco.languages.IMonarchLanguage = {
  defaultToken: '',
  tokenPostfix: '.mml',
  ignoreCase: true,
  tokenizer: {
    root: [
      [/\/\*/, 'comment.block', '@comment'],
      [/^\s*#.*/, 'comment.line.hash'],
      [/\/\/.*$/, 'comment.line.slash'],
      [new RegExp(`${verbPattern}(?:\\s+[A-Za-z_][\\w.]*)*`), { token: 'command.name', next: '@afterCommandHead' }],
      [new RegExp(controlPattern), 'keyword.control'],
      [/[;]/, 'delimiter.terminator'],
      [/[()[\]{}]/, 'delimiter.separator'],
      [/[A-Za-z_][\w.+/'-]*/, 'identifier.unknown'],
      [/\s+/, '']
    ],
    afterCommandHead: [
      [/\s+/, ''],
      [/:/, { token: 'delimiter.separator', next: '@afterColon' }],
      [/[;]/, 'delimiter.terminator', '@popall'],
      [/[A-Za-z_][\w.+/'-]*/, 'identifier.unknown', '@popall']
    ],
    afterColon: [
      [/\/\*/, 'comment.block', '@comment'],
      [/^\s*#.*/, 'comment.line.hash'],
      [/\/\/.*$/, 'comment.line.slash'],
      [/\s+/, ''],
      [/[;]/, 'delimiter.terminator', '@popall'],
      [parameterPattern, { token: 'key.parameter', next: '@afterParameter' }],
      [/[A-Za-z_][\w.+/'-]*/, 'identifier.unknown']
    ],
    afterParameter: [
      [/\s+/, ''],
      [/=/, { token: 'operator.assignment', next: '@afterValue' }],
      [/[;,]/, 'delimiter.separator', '@popall'],
      [/[A-Za-z_][\w.+/'-]*/, 'identifier.unknown', '@popall']
    ],
    afterValue: [
      [/\s+/, ''],
      [/"/, 'value.string', '@doubleQuotedValue'],
      [prefixedValuePattern, { token: 'value.prefixed', next: '@afterValueTerminator' }],
      [symbolicValuePattern, { token: 'value.symbolic', next: '@afterValueTerminator' }],
      [numberValuePattern, { token: 'value.number', next: '@afterValueTerminator' }],
      [barewordValuePattern, { token: 'value.enum', next: '@afterValueTerminator' }],
      [/[A-Za-z_][\w.+/'-]*/, { token: 'identifier.unknown', next: '@afterValueTerminator' }]
    ],
    afterValueTerminator: [
      [/\s+/, ''],
      [/,/, { token: 'delimiter.separator', next: '@afterColon' }],
      [/[;]/, 'delimiter.terminator', '@popall'],
      [/\/\*/, 'comment.block', '@comment'],
      [/^\s*#.*/, 'comment.line.hash'],
      [/\/\/.*$/, 'comment.line.slash'],
      [/[A-Za-z_][\w.+/'-]*/, 'identifier.unknown', '@popall']
    ],
    comment: [
      [/[^/*]+/, 'comment.block'],
      [/\*\//, 'comment.block', '@pop'],
      [/[/\*]/, 'comment.block']
    ],
    doubleQuotedValue: [
      [/[^\\"]+/, 'value.string'],
      [/\\./, 'string.escape'],
      [/"/, { token: 'value.string', next: '@afterValueTerminator' }]
    ]
  }
}

let registered = false

export function ensureMmlLanguage(monaco: typeof Monaco): void {
  if (registered) return

  monaco.languages.register({ id: MML_LANGUAGE_ID })
  monaco.languages.setLanguageConfiguration(MML_LANGUAGE_ID, mmlLanguageConfiguration)
  monaco.languages.setMonarchTokensProvider(MML_LANGUAGE_ID, mmlMonarchLanguage)
  monaco.editor.defineTheme(WORKSPACE_EDITOR_THEME, {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment.block', foreground: '6A737D', fontStyle: 'italic' },
      { token: 'comment.line.slash', foreground: '6A737D', fontStyle: 'italic' },
      { token: 'comment.line.hash', foreground: '6A737D', fontStyle: 'italic' },
      { token: 'command.name', foreground: '005CC5', fontStyle: 'bold' },
      { token: 'keyword.control', foreground: '7C3AED', fontStyle: 'bold' },
      { token: 'key.parameter', foreground: 'B54708' },
      { token: 'operator.assignment', foreground: '8A6A2F' },
      { token: 'value.string', foreground: '0A7B83' },
      { token: 'value.number', foreground: '0550AE' },
      { token: 'value.enum', foreground: '8B5CF6' },
      { token: 'value.symbolic', foreground: '7C3AED' },
      { token: 'value.prefixed', foreground: '9A3412' },
      { token: 'delimiter.separator', foreground: '57606A' },
      { token: 'delimiter.terminator', foreground: '9A3412', fontStyle: 'bold' },
      { token: 'identifier.unknown', foreground: '7C2D12' }
    ],
    colors: {}
  })

  registered = true
}
