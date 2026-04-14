import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runtimeLogDispatcher } from '../../../logging/runtime.js'
import type { RuntimeLogEntry, RuntimeLogSink } from '../../../logging/types.js'
import { clearRipgrepVersionCache, grepWorkspaceFiles } from './grep.js'
import type { CommandRunner } from './shared/commandRunner.js'

function createSink(entries: RuntimeLogEntry[]): RuntimeLogSink {
  return {
    append(entry) {
      entries.push(entry)
    }
  }
}

function createRunner(searchResult: Awaited<ReturnType<CommandRunner['run']>>): CommandRunner {
  return {
    async run(command, args) {
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
        ...searchResult,
        stdout: searchResult.stdout.replaceAll('__COMMAND__', command)
      }
    }
  }
}

function createCapturingRunner(
  capturedArgs: string[],
  searchResult: Awaited<ReturnType<CommandRunner['run']>>
): CommandRunner {
  return {
    async run(_command, args) {
      if (args[0] === '--version') {
        return {
          stdout: 'ripgrep 15.1.0\n',
          stderr: '',
          exitCode: 0,
          signal: null,
          timedOut: false
        }
      }
      capturedArgs.push(...args)
      return searchResult
    }
  }
}

function createCountingRunner(
  searchResult: Awaited<ReturnType<CommandRunner['run']>>
): { runner: CommandRunner; versionCallCount: () => number } {
  let versionCalls = 0
  return {
    runner: {
      async run(command, args) {
        if (args[0] === '--version') {
          versionCalls += 1
          return {
            stdout: 'ripgrep 15.1.0\n',
            stderr: '',
            exitCode: 0,
            signal: null,
            timedOut: false
          }
        }
        return {
          ...searchResult,
          stdout: searchResult.stdout.replaceAll('__COMMAND__', command)
        }
      }
    },
    versionCallCount: () => versionCalls
  }
}

async function createVendoredBinary(root: string, target: string, binaryName: string): Promise<void> {
  const targetDir = join(root, target)
  await mkdir(targetDir, { recursive: true })
  const binaryPath = join(targetDir, binaryName)
  await writeFile(binaryPath, '#!/bin/sh\nexit 0\n', 'utf8')
  await chmod(binaryPath, 0o755)
}

describe('grepWorkspaceFiles', () => {
  let workspaceDir = ''
  let ripgrepRoot = ''
  let entries: RuntimeLogEntry[] = []
  let detachSink = () => {}

  beforeEach(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'local-grep-workspace-'))
    ripgrepRoot = await mkdtemp(join(tmpdir(), 'local-grep-rg-'))
    entries = []
    runtimeLogDispatcher.resetForTests()
    detachSink = runtimeLogDispatcher.attachSink(createSink(entries))
    await writeFile(join(workspaceDir, 'alpha.ts'), 'first line\nTarget value\nthird line\n', 'utf8')
  })

  afterEach(async () => {
    detachSink()
    runtimeLogDispatcher.resetForTests()
    clearRipgrepVersionCache()
    await rm(workspaceDir, { recursive: true, force: true })
    await rm(ripgrepRoot, { recursive: true, force: true })
  })

  it('searches with vendored ripgrep and logs a successful no-match result', async () => {
    await createVendoredBinary(ripgrepRoot, 'x86_64-unknown-linux-gnu', 'rg')
    const runner = createRunner({
      stdout: '',
      stderr: '',
      exitCode: 1,
      signal: null,
      timedOut: false
    })

    const summary = await grepWorkspaceFiles(workspaceDir, {
      pattern: 'missing',
      literal: true
    }, {
      ripgrepRoot,
      commandRunner: runner,
      runtime: {
        platform: 'linux',
        arch: 'x64',
        libc: 'glibc'
      },
      trace: {
        runId: 'run-1',
        turnId: 'turn-1'
      }
    })

    const payload = JSON.parse(summary) as {
      engine: string
      matches: unknown[]
    }
    expect(payload.engine).toBe('vendored-rg')
    expect(payload.matches).toEqual([])
    expect(entries.filter(entry => entry.component === 'local_grep').map(entry => entry.message)).toEqual([
      'vendored ripgrep selected',
      'local grep completed'
    ])
    expect(entries.find(entry => entry.message === 'local grep completed')?.data).toMatchObject({
      outcome: 'no_match',
      target: 'x86_64-unknown-linux-gnu',
      matchCount: 0
    })
  })

  it('logs explicit diagnostics when vendored ripgrep execution fails', async () => {
    await createVendoredBinary(ripgrepRoot, 'x86_64-unknown-linux-musl', 'rg')
    const runner = createRunner({
      stdout: '',
      stderr: 'regex parse error',
      exitCode: 2,
      signal: null,
      timedOut: false
    })

    await expect(grepWorkspaceFiles(workspaceDir, {
      pattern: '['
    }, {
      ripgrepRoot,
      commandRunner: runner,
      runtime: {
        platform: 'linux',
        arch: 'x64',
        libc: 'musl'
      }
    })).rejects.toThrow(/regex parse error/)

    expect(entries.find(entry => entry.message === 'local grep failed')?.data).toMatchObject({
      target: 'x86_64-unknown-linux-musl',
      rgPath: expect.stringMatching(/[\\/]x86_64-unknown-linux-musl[\\/]rg$/),
      error: {
        message: expect.stringContaining('regex parse error')
      }
    })
  })

  it('uses vendored ripgrep on macOS arm64', async () => {
    await createVendoredBinary(ripgrepRoot, 'aarch64-apple-darwin', 'rg')

    const summary = await grepWorkspaceFiles(workspaceDir, {
      pattern: 'Target',
      literal: true
    }, {
      ripgrepRoot,
      commandRunner: createRunner({
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
      }),
      runtime: {
        platform: 'darwin',
        arch: 'arm64',
        libc: null
      }
    })

    const payload = JSON.parse(summary) as {
      engine: string
      matches: Array<{ path: string; line: number }>
    }
    expect(payload.engine).toBe('vendored-rg')
    expect(payload.matches[0]).toMatchObject({
      path: 'alpha.ts',
      line: 2
    })
    expect(entries.find(entry => entry.message === 'vendored ripgrep selected')?.data).toMatchObject({
      target: 'aarch64-apple-darwin'
    })
  })

  it('passes leading-dash patterns with --regexp so rg does not parse them as flags', async () => {
    await createVendoredBinary(ripgrepRoot, 'aarch64-apple-darwin', 'rg')
    const capturedArgs: string[] = []

    await grepWorkspaceFiles(workspaceDir, {
      pattern: '--foo',
      literal: true
    }, {
      ripgrepRoot,
      commandRunner: createCapturingRunner(capturedArgs, {
        stdout: '',
        stderr: '',
        exitCode: 1,
        signal: null,
        timedOut: false
      }),
      runtime: {
        platform: 'darwin',
        arch: 'arm64',
        libc: null
      }
    })

    expect(capturedArgs).toEqual(expect.arrayContaining(['--regexp', '--foo']))
  })

  it('caches ripgrep version check across multiple calls', async () => {
    await createVendoredBinary(ripgrepRoot, 'aarch64-apple-darwin', 'rg')
    const noMatchResult = {
      stdout: '',
      stderr: '',
      exitCode: 1,
      signal: null,
      timedOut: false
    } as const
    const { runner, versionCallCount } = createCountingRunner(noMatchResult)
    const options = {
      ripgrepRoot,
      commandRunner: runner,
      runtime: {
        platform: 'darwin' as const,
        arch: 'arm64' as const,
        libc: null
      },
      trace: { runId: 'run-cache', turnId: 'turn-cache' }
    }

    await grepWorkspaceFiles(workspaceDir, { pattern: 'first' }, options)
    await grepWorkspaceFiles(workspaceDir, { pattern: 'second' }, options)

    expect(versionCallCount()).toBe(1)

    const selectionLogs = entries.filter(e => e.message === 'vendored ripgrep selected')
    expect(selectionLogs).toHaveLength(2)
    expect(selectionLogs[0]?.data).toMatchObject({ versionCached: false })
    expect(selectionLogs[1]?.data).toMatchObject({ versionCached: true })
  })

  it('produces correct snippets for multiple matches in the same file', async () => {
    await createVendoredBinary(ripgrepRoot, 'aarch64-apple-darwin', 'rg')
    await writeFile(
      join(workspaceDir, 'multi.ts'),
      'line1\nline2\nline3\nline4\nline5\n',
      'utf8'
    )

    const twoMatchesInSameFile = [
      JSON.stringify({
        type: 'match',
        data: { path: { text: 'multi.ts' }, line_number: 2, submatches: [{ start: 0 }] }
      }),
      JSON.stringify({
        type: 'match',
        data: { path: { text: 'multi.ts' }, line_number: 4, submatches: [{ start: 0 }] }
      })
    ].join('\n') + '\n'

    const summary = await grepWorkspaceFiles(workspaceDir, {
      pattern: 'line',
      literal: true,
      context: 1
    }, {
      ripgrepRoot,
      commandRunner: createRunner({
        stdout: twoMatchesInSameFile,
        stderr: '',
        exitCode: 0,
        signal: null,
        timedOut: false
      }),
      runtime: { platform: 'darwin', arch: 'arm64', libc: null }
    })

    const payload = JSON.parse(summary) as {
      matches: Array<{ path: string; line: number; snippet: string }>
    }
    expect(payload.matches).toHaveLength(2)
    expect(payload.matches[0]).toMatchObject({ path: 'multi.ts', line: 2 })
    expect(payload.matches[1]).toMatchObject({ path: 'multi.ts', line: 4 })
    expect(payload.matches[0]?.snippet).toContain('line1')
    expect(payload.matches[0]?.snippet).toContain('line2')
    expect(payload.matches[0]?.snippet).toContain('line3')
    expect(payload.matches[1]?.snippet).toContain('line3')
    expect(payload.matches[1]?.snippet).toContain('line4')
    expect(payload.matches[1]?.snippet).toContain('line5')
  })
})
