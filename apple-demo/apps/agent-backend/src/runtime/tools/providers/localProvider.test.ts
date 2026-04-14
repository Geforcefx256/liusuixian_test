import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { fileStore, type WorkspaceScope } from '../../../files/fileStore.js'
import { LocalToolProvider } from './localProvider.js'

function createScope(): WorkspaceScope {
  return {
    userId: 42,
    agentId: `local-tool-${randomUUID()}`
  }
}

function createProvider(runtimeRoot: string, overrides: ConstructorParameters<typeof LocalToolProvider>[0] = {}) {
  return new LocalToolProvider({
    runtimeRoot,
    ...overrides
  })
}

const LINUX_X64_GLIBC = Object.freeze({
  platform: 'linux',
  arch: 'x64',
  libc: 'glibc'
}) as const

describe('LocalToolProvider', () => {
  let runtimeRoot = ''
  let ripgrepRoot = ''

  beforeEach(async () => {
    runtimeRoot = await mkdtemp(join(tmpdir(), 'local-tool-provider-'))
    ripgrepRoot = await mkdtemp(join(tmpdir(), 'local-tool-provider-rg-'))
  })

  afterEach(async () => {
    await rm(runtimeRoot, { recursive: true, force: true })
    await rm(ripgrepRoot, { recursive: true, force: true })
  })

  it('catalogs path-scoped filesystem tools without bash', () => {
    const provider = createProvider(runtimeRoot, { ripgrepRoot })
    const tools = provider.catalog()

    expect(tools.map(tool => tool.id)).toEqual([
      'read_file',
      'list_directory',
      'find_files',
      'grep',
      'write',
      'edit',
      'question'
    ])
    expect(tools.find(tool => tool.id === 'write')?.runtimePolicy).toEqual({
      idempotent: false,
      supportsRuntimeRetry: false,
      supportsModelRecovery: true
    })
    expect(tools.find(tool => tool.id === 'edit')?.runtimePolicy).toEqual({
      idempotent: false,
      supportsRuntimeRetry: false,
      supportsModelRecovery: true
    })
    expect(tools.find(tool => tool.id === 'write')?.description).toContain('Prefer edit for partial changes')
    expect(tools.find(tool => tool.id === 'edit')?.description).toContain('use read_file first')
    expect((tools.find(tool => tool.id === 'write')?.inputSchema as { properties?: { path?: { description?: string } } })
      .properties?.path?.description).toContain('without the leading project/ prefix')
    expect((tools.find(tool => tool.id === 'edit')?.inputSchema as { properties?: { file_path?: { description?: string } } })
      .properties?.file_path?.description).toContain('project/... path returned by read_file')
  })

  it('accepts question payloads with more than four select options', async () => {
    const provider = createProvider(runtimeRoot, {
      ripgrepRoot,
      sessionStore: {
        createInteraction: vi.fn().mockResolvedValue({
          interactionId: 'interaction-1',
          runId: 'run-1',
          kind: 'question',
          status: 'pending',
          payload: {
            questionId: 'question-1',
            title: '',
            prompt: 'Pick one',
            required: true,
            fields: []
          },
          createdAt: Date.now(),
          resolvedAt: null
        })
      } as any
    })

    const response = await provider.invoke({
      tool: 'question',
      args: {
        prompt: 'Pick one',
        options: Array.from({ length: 5 }, (_, index) => ({
          label: `Opt ${index + 1}`,
          value: index + 1
        }))
      },
      workspaceScope: createScope(),
      sessionKey: 'session-1',
      trace: {
        runId: 'run-1',
        turnId: 'turn-1'
      }
    })

    expect(response.ok).toBe(true)
    if (!response.ok) {
      throw new Error('expected question invocation to succeed')
    }
    expect(response.result.tool).toBe('question')
  })

  it('re-roots read_file and list_directory to runtimeRoot when no workspace scope is provided', async () => {
    await writeFile(join(runtimeRoot, 'notes.txt'), 'alpha\nbeta\n', 'utf8')
    const provider = createProvider(runtimeRoot, { ripgrepRoot })

    const readResponse = await provider.invoke({
      tool: 'read_file',
      args: { path: 'notes.txt' }
    })
    const listResponse = await provider.invoke({
      tool: 'list_directory',
      args: { path: '.' }
    })

    expect(readResponse.ok).toBe(true)
    expect(listResponse.ok).toBe(true)
    if (!readResponse.ok || !listResponse.ok) {
      throw new Error('expected filesystem tools to succeed')
    }

    const readPayload = JSON.parse(readResponse.result.summary) as {
      type: string
      content: string
    }
    const listPayload = JSON.parse(listResponse.result.summary) as {
      type: string
      entries: Array<{ name: string; type: string }>
    }
    expect(readPayload.type).toBe('file')
    expect(readPayload.content).toContain('1 | alpha')
    expect(listPayload.type).toBe('directory')
    expect(listPayload.entries).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'notes.txt', type: 'file' })])
    )
  })

  it('re-roots find_files and grep to runtimeRoot when no workspace scope is provided', async () => {
    await writeFile(join(runtimeRoot, 'alpha.ts'), 'first line\nTarget value\nthird line\n', 'utf8')
    const targetDir = join(ripgrepRoot, 'x86_64-unknown-linux-gnu')
    await mkdir(targetDir, { recursive: true })
    await writeFile(join(targetDir, 'rg'), '#!/bin/sh\nexit 0\n', 'utf8')
    await chmod(join(targetDir, 'rg'), 0o755)
    const provider = createProvider(runtimeRoot, {
      ripgrepRoot,
      commandRunner: {
        run: async (_command, args) => {
          if (args[0] === '--version') {
            return {
              stdout: 'ripgrep 15.1.0\n',
              stderr: '',
              exitCode: 0,
              signal: null,
              timedOut: false
            }
          }
          return {
            stdout: JSON.stringify({
              type: 'match',
              data: {
                path: { text: 'alpha.ts' },
                line_number: 2,
                submatches: [{ start: 0 }]
              }
            }) + '\n',
            stderr: '',
            exitCode: 0,
            signal: null,
            timedOut: false
          }
        }
      },
      ripgrepRuntime: LINUX_X64_GLIBC
    })

    const findResponse = await provider.invoke({
      tool: 'find_files',
      args: { pattern: '**/*.ts' }
    })
    const grepResponse = await provider.invoke({
      tool: 'grep',
      args: { pattern: 'Target', literal: true, context: 1 }
    })

    expect(findResponse.ok).toBe(true)
    expect(grepResponse.ok).toBe(true)
    if (!findResponse.ok || !grepResponse.ok) {
      throw new Error('expected scoped search tools to succeed')
    }

    const findPayload = JSON.parse(findResponse.result.summary) as {
      engine: string
      matches: string[]
    }
    const grepPayload = JSON.parse(grepResponse.result.summary) as {
      engine: string
      matches: Array<{ path: string; line: number }>
    }
    expect(['fd', 'node-glob']).toContain(findPayload.engine)
    expect(findPayload.matches.length).toBeGreaterThan(0)
    expect(grepPayload.engine).toBe('vendored-rg')
    expect(grepPayload.matches[0]).toMatchObject({
      path: 'alpha.ts',
      line: 2
    })
  })

  it('rejects grep paths that escape the current workspace', async () => {
    const targetDir = join(ripgrepRoot, 'x86_64-unknown-linux-gnu')
    await mkdir(targetDir, { recursive: true })
    await writeFile(join(targetDir, 'rg'), '#!/bin/sh\nexit 0\n', 'utf8')
    await chmod(join(targetDir, 'rg'), 0o755)
    const provider = createProvider(runtimeRoot, {
      ripgrepRoot,
      ripgrepRuntime: LINUX_X64_GLIBC,
      commandRunner: {
        run: async () => ({
          stdout: '',
          stderr: '',
          exitCode: 1,
          signal: null,
          timedOut: false
        })
      }
    })

    const response = await provider.invoke({
      tool: 'grep',
      args: {
        pattern: 'Target',
        basePath: '../outside'
      }
    })

    expect(response.ok).toBe(false)
    if (response.ok) {
      throw new Error('expected escaped workspace path to fail')
    }
    expect(response.error.message).toContain('outside workspace')
  })

  it('returns tool not found for unknown local tools', async () => {
    const provider = createProvider(runtimeRoot, { ripgrepRoot })

    const response = await provider.invoke({
      tool: 'missing_tool',
      args: {}
    })

    expect(response.ok).toBe(false)
    if (response.ok) {
      throw new Error('expected missing tool failure')
    }
    expect(response.error.type).toBe('TOOL_NOT_FOUND')
    expect(response.error.message).toContain('missing_tool')
  })

  it('edits project files after read_file and returns replacement metadata', async () => {
    const provider = createProvider(runtimeRoot, { ripgrepRoot })
    const scope = createScope()

    await provider.invoke({
      tool: 'write',
      args: {
        path: 'notes.txt',
        content: 'hello world\n'
      },
      workspaceScope: scope
    })

    const readResponse = await provider.invoke({
      tool: 'read_file',
      args: {
        path: 'project/notes.txt'
      },
      workspaceScope: scope,
      sessionKey: 'session-1'
    })

    expect(readResponse.ok).toBe(true)
    if (!readResponse.ok) {
      throw new Error('expected read_file invocation to succeed')
    }

    const readPayload = JSON.parse(readResponse.result.summary) as {
      path: string
    }

    const editResponse = await provider.invoke({
      tool: 'edit',
      args: {
        file_path: readPayload.path,
        old_string: 'world',
        new_string: 'team'
      },
      workspaceScope: scope,
      sessionKey: 'session-1'
    })

    expect(editResponse.ok).toBe(true)
    if (!editResponse.ok) {
      throw new Error('expected edit invocation to succeed')
    }

    const editPayload = JSON.parse(editResponse.result.summary) as {
      success: boolean
      type: string
      path: string
      replacements: number
    }
    expect(editPayload).toEqual({
      success: true,
      type: 'file_edit',
      path: 'project/notes.txt',
      replacements: 1
    })

    const readBackResponse = await provider.invoke({
      tool: 'read_file',
      args: {
        path: 'project/notes.txt'
      },
      workspaceScope: scope,
      sessionKey: 'session-1'
    })

    expect(readBackResponse.ok).toBe(true)
    if (!readBackResponse.ok) {
      throw new Error('expected read back invocation to succeed')
    }

    const readBackPayload = JSON.parse(readBackResponse.result.summary) as {
      content: string
    }
    expect(readBackPayload.content).toContain('1 | hello team')
  })

  it('edits CRLF project files from normalized read_file content and preserves CRLF on disk', async () => {
    const provider = createProvider(runtimeRoot, { ripgrepRoot })
    const scope = createScope()
    const projectDir = fileStore.getProjectDir(scope)
    const absolutePath = join(projectDir, 'notes.txt')

    await mkdir(projectDir, { recursive: true })
    await writeFile(absolutePath, 'alpha\r\nbeta\r\ngamma\r\n', 'utf8')

    const readResponse = await provider.invoke({
      tool: 'read_file',
      args: {
        path: 'project/notes.txt'
      },
      workspaceScope: scope,
      sessionKey: 'session-crlf'
    })

    expect(readResponse.ok).toBe(true)
    if (!readResponse.ok) {
      throw new Error('expected CRLF read_file invocation to succeed')
    }

    const editResponse = await provider.invoke({
      tool: 'edit',
      args: {
        file_path: 'project/notes.txt',
        old_string: 'alpha\nbeta',
        new_string: 'one\ntwo'
      },
      workspaceScope: scope,
      sessionKey: 'session-crlf'
    })

    expect(editResponse.ok).toBe(true)
    if (!editResponse.ok) {
      throw new Error('expected CRLF edit invocation to succeed')
    }

    const rawContent = await readFile(absolutePath, 'utf8')
    expect(rawContent).toBe('one\r\ntwo\r\ngamma\r\n')

    const readBackResponse = await provider.invoke({
      tool: 'read_file',
      args: {
        path: 'project/notes.txt'
      },
      workspaceScope: scope,
      sessionKey: 'session-crlf'
    })

    expect(readBackResponse.ok).toBe(true)
    if (!readBackResponse.ok) {
      throw new Error('expected CRLF read back invocation to succeed')
    }

    const readBackPayload = JSON.parse(readBackResponse.result.summary) as {
      content: string
    }
    expect(readBackPayload.content).toContain('1 | one')
    expect(readBackPayload.content).toContain('2 | two')
  })

  it('keeps LF files on disk while supporting normalized deletion with replace_all', async () => {
    const provider = createProvider(runtimeRoot, { ripgrepRoot })
    const scope = createScope()
    const projectDir = fileStore.getProjectDir(scope)
    const absolutePath = join(projectDir, 'notes.txt')

    await mkdir(projectDir, { recursive: true })
    await writeFile(absolutePath, 'keep\nremove me\nremove me\nend\n', 'utf8')

    await provider.invoke({
      tool: 'read_file',
      args: {
        path: 'project/notes.txt'
      },
      workspaceScope: scope,
      sessionKey: 'session-lf-delete'
    })

    const editResponse = await provider.invoke({
      tool: 'edit',
      args: {
        file_path: 'project/notes.txt',
        old_string: 'remove me\n',
        new_string: '',
        replace_all: true
      },
      workspaceScope: scope,
      sessionKey: 'session-lf-delete'
    })

    expect(editResponse.ok).toBe(true)
    if (!editResponse.ok) {
      throw new Error('expected LF delete invocation to succeed')
    }

    const editPayload = JSON.parse(editResponse.result.summary) as {
      replacements: number
    }
    expect(editPayload.replacements).toBe(2)

    const rawContent = await readFile(absolutePath, 'utf8')
    expect(rawContent).toBe('keep\nend\n')
  })

  it('rejects binary project files before editing', async () => {
    const provider = createProvider(runtimeRoot, { ripgrepRoot })
    const scope = createScope()
    const absolutePath = join(fileStore.getProjectDir(scope), 'archive.bin')

    await mkdir(fileStore.getProjectDir(scope), { recursive: true })
    await writeFile(absolutePath, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x41]))

    const editResponse = await provider.invoke({
      tool: 'edit',
      args: {
        file_path: 'project/archive.bin',
        old_string: 'A',
        new_string: 'B'
      },
      workspaceScope: scope,
      sessionKey: 'session-binary'
    })

    expect(editResponse.ok).toBe(false)
    if (editResponse.ok) {
      throw new Error('expected binary edit invocation to fail')
    }
    expect(editResponse.error.message).toContain('Only text files are supported')
  })

  it('rejects stale edits when the file changes after read_file', async () => {
    const provider = createProvider(runtimeRoot, { ripgrepRoot })
    const scope = createScope()

    await provider.invoke({
      tool: 'write',
      args: {
        path: 'notes.txt',
        content: 'hello world\n'
      },
      workspaceScope: scope
    })

    await provider.invoke({
      tool: 'read_file',
      args: {
        path: 'project/notes.txt'
      },
      workspaceScope: scope,
      sessionKey: 'session-stale'
    })

    const absolutePath = join(fileStore.getProjectDir(scope), 'notes.txt')
    await new Promise(resolve => setTimeout(resolve, 5))
    await writeFile(absolutePath, 'hello changed\n', 'utf8')

    const editResponse = await provider.invoke({
      tool: 'edit',
      args: {
        file_path: 'project/notes.txt',
        old_string: 'changed',
        new_string: 'team'
      },
      workspaceScope: scope,
      sessionKey: 'session-stale'
    })

    expect(editResponse.ok).toBe(false)
    if (editResponse.ok) {
      throw new Error('expected stale edit invocation to fail')
    }
    expect(editResponse.error.message).toContain('Call read_file again before editing')
  })

  it('allows edit after write in the same session without re-reading', async () => {
    const provider = createProvider(runtimeRoot, { ripgrepRoot })
    const scope = createScope()

    await provider.invoke({
      tool: 'write',
      args: {
        path: 'notes.txt',
        content: 'draft\n'
      },
      workspaceScope: scope,
      sessionKey: 'session-write-edit'
    })

    const readResponse = await provider.invoke({
      tool: 'read_file',
      args: {
        path: 'project/notes.txt'
      },
      workspaceScope: scope,
      sessionKey: 'session-write-edit'
    })

    expect(readResponse.ok).toBe(true)
    if (!readResponse.ok) {
      throw new Error('expected read_file invocation to succeed')
    }

    await new Promise(resolve => setTimeout(resolve, 5))
    const writeResponse = await provider.invoke({
      tool: 'write',
      args: {
        path: 'notes.txt',
        content: 'hello world\n'
      },
      workspaceScope: scope,
      sessionKey: 'session-write-edit'
    })

    expect(writeResponse.ok).toBe(true)
    if (!writeResponse.ok) {
      throw new Error('expected write invocation to succeed')
    }

    const editResponse = await provider.invoke({
      tool: 'edit',
      args: {
        file_path: 'project/notes.txt',
        old_string: 'world',
        new_string: 'team'
      },
      workspaceScope: scope,
      sessionKey: 'session-write-edit'
    })

    expect(editResponse.ok).toBe(true)
    if (!editResponse.ok) {
      throw new Error('expected edit invocation to succeed')
    }

    const rawContent = await readFile(join(fileStore.getProjectDir(scope), 'notes.txt'), 'utf8')
    expect(rawContent).toBe('hello team\n')
  })
})
