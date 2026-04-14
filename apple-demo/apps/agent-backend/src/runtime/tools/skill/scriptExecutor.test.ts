import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ScriptTemplate } from '../../../skills/scriptManifestTypes.js'
import { executeGovernedScript } from './scriptExecutor.js'
import { SkillScriptValidationError } from './execValidation.js'

describe('executeGovernedScript', () => {
  let tempDir = ''
  let runtimeRoot = ''

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'script-executor-'))
    runtimeRoot = join(tempDir, 'runtime-root')
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('builds argv from option, flag, and payload items', async () => {
    const entryPath = join(tempDir, 'echo-argv.js')
    await writeFile(entryPath, [
      'process.stdout.write(JSON.stringify({',
      '  kind: "notice",',
      '  data: { message: JSON.stringify(process.argv.slice(2)) }',
      '}))'
    ].join('\n'), 'utf8')

    const result = await executeGovernedScript({
      template: createTemplate(entryPath, {
        type: 'object',
        additionalProperties: false,
        properties: {
          fileName: { type: 'string' },
          verbose: { type: 'boolean' }
        },
        required: ['fileName']
      }, [
        { kind: 'option', name: 'fileName', flag: '--file' },
        { kind: 'flag', name: 'verbose', flag: '--verbose' },
        { kind: 'payload', encoding: 'json' }
      ]),
      args: {
        fileName: 'report.csv',
        verbose: true
      },
      workspaceScope: createScope('argv'),
      runtimeRoot
    })

    const payload = JSON.parse(result) as {
      kind: string
      data: { message: string }
    }
    expect(payload.kind).toBe('notice')
    expect(JSON.parse(payload.data.message)).toEqual([
      '--file',
      'report.csv',
      '--verbose',
      '{"fileName":"report.csv","verbose":true}'
    ])
  })

  it('fails early on invalid structured args and path boundary escapes', async () => {
    const entryPath = join(tempDir, 'noop.js')
    await writeFile(entryPath, 'process.stdout.write("ok")', 'utf8')
    const template = createTemplate(entryPath, {
      type: 'object',
      additionalProperties: false,
      properties: {
        outputPath: {
          type: 'string',
          pathBase: 'projectDir'
        }
      },
      required: ['outputPath']
    }, [
      { kind: 'option', name: 'outputPath', flag: '--output' }
    ])

    await expect(executeGovernedScript({
      template,
      args: {},
      workspaceScope: createScope('missing'),
      runtimeRoot
    })).rejects.toBeInstanceOf(SkillScriptValidationError)

    await expect(executeGovernedScript({
      template,
      args: {
        outputPath: '../escape.txt'
      },
      workspaceScope: createScope('escape'),
      runtimeRoot
    })).rejects.toMatchObject({
      name: 'SkillScriptValidationError',
      message: 'args.outputPath is outside allowed projectDir boundary'
    })
  })

  it('kills long-running scripts when timeout is exceeded', async () => {
    const entryPath = join(tempDir, 'timeout.js')
    await writeFile(entryPath, 'setTimeout(() => process.stdout.write("late"), 5000)', 'utf8')

    await expect(executeGovernedScript({
      template: createTemplate(entryPath, {
        type: 'object',
        additionalProperties: false,
        properties: {}
      }, [
        { kind: 'payload', encoding: 'json' }
      ], 1),
      args: {},
      workspaceScope: createScope('timeout'),
      runtimeRoot
    })).rejects.toThrow('skill script timed out after 1 seconds')
  }, 10000)

  it('truncates oversized stdout to the configured line cap', async () => {
    const entryPath = join(tempDir, 'large-output.js')
    await writeFile(entryPath, [
      'const lines = Array.from({ length: 2505 }, (_, index) => `line-${index + 1}`)',
      'process.stdout.write(lines.join("\\n"))'
    ].join('\n'), 'utf8')

    const result = await executeGovernedScript({
      template: createTemplate(entryPath, {
        type: 'object',
        additionalProperties: false,
        properties: {}
      }, [
        { kind: 'payload', encoding: 'json' }
      ]),
      args: {},
      workspaceScope: createScope('truncate'),
      runtimeRoot
    })

    const lines = result.split('\n')
    expect(lines).toHaveLength(2000)
    expect(lines[0]).toBe('line-1')
    expect(lines.at(-1)).toBe('line-2000')
  })

  it('registers artifact_ref outputs under the current workspace scope', async () => {
    const entryPath = join(tempDir, 'artifact.js')
    await writeFile(entryPath, [
      'const fs = require("node:fs")',
      'const path = require("node:path")',
      'const outputPath = path.join(process.env.WORKSPACE_PROJECT_DIR, "reports", "artifact.json")',
      'fs.mkdirSync(path.dirname(outputPath), { recursive: true })',
      'fs.writeFileSync(outputPath, "{\\"ok\\":true}", "utf8")',
      'process.stdout.write(JSON.stringify({',
      '  kind: "artifact_ref",',
      '  data: { path: outputPath }',
      '}))'
    ].join('\n'), 'utf8')

    const result = await executeGovernedScript({
      template: createTemplate(entryPath, {
        type: 'object',
        additionalProperties: false,
        properties: {}
      }, [
        { kind: 'payload', encoding: 'json' }
      ]),
      args: {},
      workspaceScope: createScope('artifact'),
      runtimeRoot
    })

    const payload = JSON.parse(result) as {
      kind: string
      data: Record<string, unknown>
    }
    expect(payload.kind).toBe('artifact_ref')
    expect(payload.data.fileId).toEqual(expect.any(String))
    expect(payload.data.path).toBe('project/reports/artifact.json')
  })
})

function createTemplate(
  entryPath: string,
  inputSchema: Record<string, unknown>,
  argv: ScriptTemplate['argv'],
  timeoutSeconds = 5
): ScriptTemplate {
  return {
    id: 'run',
    description: 'Run script',
    entry: entryPath,
    entryPath,
    inputSchema,
    argv,
    timeoutSeconds
  }
}

function createScope(suffix: string) {
  return {
    userId: 99,
    agentId: `script-exec-${suffix}-${randomUUID()}`
  }
}
