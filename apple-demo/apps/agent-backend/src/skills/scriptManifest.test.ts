import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseScriptManifest } from './scriptManifest.js'

describe('parseScriptManifest', () => {
  let skillDir = ''

  beforeEach(async () => {
    skillDir = await mkdtemp(join(tmpdir(), 'script-manifest-'))
  })

  afterEach(async () => {
    await rm(skillDir, { recursive: true, force: true })
  })

  it('parses valid governed templates from SCRIPTS.yaml', async () => {
    await writeFile(join(skillDir, 'run.js'), 'process.stdout.write("ok")', 'utf8')
    await writeFile(join(skillDir, 'SCRIPTS.yaml'), [
      'templates:',
      '  - id: convert',
      '    description: Convert rows',
      '    entry: run.js',
      '    timeoutSeconds: 12',
      '    inputSchema:',
      '      type: object',
      '      additionalProperties: false',
      '      properties:',
      '        inputPath:',
      '          type: string',
      '          pathBase: uploadDir',
      '        verbose:',
      '          type: boolean',
      '      required: [inputPath]',
      '    argv:',
      '      - kind: option',
      '        name: inputPath',
      '        flag: --input',
      '      - kind: flag',
      '        name: verbose',
      '        flag: --verbose',
      '      - kind: payload',
      '        encoding: json'
    ].join('\n'), 'utf8')

    const result = parseScriptManifest(join(skillDir, 'SCRIPTS.yaml'), skillDir)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.manifest.templates).toHaveLength(1)
    expect(result.manifest.templates[0]).toMatchObject({
      id: 'convert',
      description: 'Convert rows',
      entry: 'run.js',
      timeoutSeconds: 12,
      argv: [
        { kind: 'option', name: 'inputPath', flag: '--input' },
        { kind: 'flag', name: 'verbose', flag: '--verbose' },
        { kind: 'payload', encoding: 'json' }
      ]
    })
  })

  it('rejects template entries that escape or cannot resolve their script entry', async () => {
    await writeFile(join(skillDir, 'SCRIPTS.yaml'), [
      'templates:',
      '  - id: escape',
      '    description: bad path',
      '    entry: ../outside.js',
      '    inputSchema:',
      '      type: object',
      '      additionalProperties: false',
      '      properties: {}',
      '    argv:',
      '      - kind: payload',
      '        encoding: json',
      '  - id: missing',
      '    description: missing file',
      '    entry: missing.js',
      '    inputSchema:',
      '      type: object',
      '      additionalProperties: false',
      '      properties: {}',
      '    argv:',
      '      - kind: payload',
      '        encoding: json'
    ].join('\n'), 'utf8')

    const result = parseScriptManifest(join(skillDir, 'SCRIPTS.yaml'), skillDir)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'templates[0].entry' }),
      expect.objectContaining({
        field: 'templates[1].entry',
        message: 'Script entry does not exist: missing.js'
      })
    ]))
  })

  it('rejects absolute paths and caller-controlled env declarations', async () => {
    await writeFile(join(skillDir, 'SCRIPTS.yaml'), [
      'templates:',
      '  - id: invalid',
      '    description: invalid env',
      '    entry: /tmp/run.js',
      '    env:',
      '      TOKEN: forbidden',
      '    inputSchema:',
      '      type: object',
      '      additionalProperties: false',
      '      properties: {}',
      '    argv:',
      '      - kind: payload',
      '        encoding: json'
    ].join('\n'), 'utf8')

    const result = parseScriptManifest(join(skillDir, 'SCRIPTS.yaml'), skillDir)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        field: 'templates[0].entry',
        message: 'templates[0].entry must be a relative path.'
      }),
      expect.objectContaining({
        field: 'templates[0].env',
        message: 'templates[0].env is not supported. Runtime-owned environment only.'
      })
    ]))
  })
})
