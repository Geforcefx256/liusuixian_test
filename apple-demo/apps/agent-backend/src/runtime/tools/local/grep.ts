import type { GatewayTraceContext } from '../../../gateway/tools/types.js'
import type { CommandRunner, CommandRunnerResult } from './shared/commandRunner.js'
import { buildSearchPayload, buildSnippets, normalizeContext, normalizeLimit, type RgMatch } from './grepPayload.js'
import { logGrepCompletion, logGrepFailure, logRipgrepSelection } from './grepLogging.js'
import { resolveWorkspacePath } from './shared/pathUtils.js'
import {
  assertRipgrepBinaryAccessible,
  detectRipgrepRuntimeInfo,
  resolveRipgrepSelection,
  type RipgrepRuntimeInfo,
  type RipgrepSelection
} from './shared/ripgrep.js'

const DEFAULT_FILE_GLOB = '**/*'
const RIPGREP_VERSION_TIMEOUT_MS = 5_000
const RIPGREP_SEARCH_TIMEOUT_MS = 30_000

const ripgrepVersionCache = new Map<string, string>()

/** @internal Exposed for testing only. */
export function clearRipgrepVersionCache(): void {
  ripgrepVersionCache.clear()
}

export interface LocalGrepArgs {
  pattern: string
  basePath?: string
  glob?: string
  ignoreCase?: boolean
  literal?: boolean
  context?: number
  limit?: number
}

export interface LocalGrepOptions {
  ripgrepRoot: string
  commandRunner: CommandRunner
  trace?: GatewayTraceContext
  runtime?: RipgrepRuntimeInfo
}

interface NormalizedGrepRequest {
  pattern: string
  basePath: {
    absolutePath: string
    relativePath: string
  }
  fileGlob: string
  ignoreCase: boolean
  literal: boolean
  context: number
  limit: number
}

interface RgExecution {
  matches: RgMatch[]
  truncated: boolean
  result: CommandRunnerResult
}

export async function grepWorkspaceFiles(
  workspaceDir: string,
  args: LocalGrepArgs,
  options: LocalGrepOptions
): Promise<string> {
  const request = normalizeGrepRequest(workspaceDir, args)
  const runtime = options.runtime ?? detectRipgrepRuntimeInfo()
  let selection: RipgrepSelection | null = null
  let version = ''

  try {
    selection = resolveRipgrepSelection(options.ripgrepRoot, runtime)
    await assertRipgrepBinaryAccessible(selection)
    const versionCached = ripgrepVersionCache.has(selection.binaryPath)
    version = await readRipgrepVersion(workspaceDir, selection, options.commandRunner)
    logRipgrepSelection(options.trace, selection, version, versionCached)
    const execution = await executeRipgrep(request, selection, options.commandRunner)
    const matches = await buildSnippets(request.basePath.absolutePath, execution.matches, request.context)
    logGrepCompletion(options.trace, toLogRequest(request), selection, version, execution.result, matches.length)
    return buildSearchPayload(request.pattern, request.basePath.relativePath, request.fileGlob, matches, execution.truncated)
  } catch (error) {
    logGrepFailure(options.trace, toLogRequest(request), runtime, selection, version, error)
    throw error
  }
}

function normalizeGrepRequest(workspaceDir: string, args: LocalGrepArgs): NormalizedGrepRequest {
  const pattern = args.pattern?.trim()
  if (!pattern) {
    throw new Error('pattern is required')
  }

  return {
    pattern,
    basePath: resolveWorkspacePath(workspaceDir, args.basePath || '.'),
    fileGlob: args.glob || DEFAULT_FILE_GLOB,
    ignoreCase: args.ignoreCase === true,
    literal: args.literal === true,
    context: normalizeContext(args.context),
    limit: normalizeLimit(args.limit)
  }
}

async function readRipgrepVersion(
  workspaceDir: string,
  selection: RipgrepSelection,
  commandRunner: CommandRunner
): Promise<string> {
  const cached = ripgrepVersionCache.get(selection.binaryPath)
  if (cached !== undefined) {
    return cached
  }
  const result = await commandRunner.run(
    selection.binaryPath,
    ['--version'],
    workspaceDir,
    { timeoutMs: RIPGREP_VERSION_TIMEOUT_MS }
  )
  ensureSuccessfulCommand(result, selection, 'version check')
  const firstLine = result.stdout.split('\n').map(line => line.trim()).find(Boolean)
  if (!firstLine) {
    throw new Error(`Vendored ripgrep did not return version output: ${selection.binaryPath}`)
  }
  ripgrepVersionCache.set(selection.binaryPath, firstLine)
  return firstLine
}

async function executeRipgrep(
  request: NormalizedGrepRequest,
  selection: RipgrepSelection,
  commandRunner: CommandRunner
): Promise<RgExecution> {
  const result = await commandRunner.run(
    selection.binaryPath,
    buildRipgrepArgs(request),
    request.basePath.absolutePath,
    { timeoutMs: RIPGREP_SEARCH_TIMEOUT_MS }
  )
  if (result.exitCode !== 0 && result.exitCode !== 1) {
    ensureSuccessfulCommand(result, selection, 'search')
  }
  const matches = parseRgMatches(result.stdout)
  return {
    matches: matches.slice(0, request.limit),
    truncated: matches.length > request.limit,
    result
  }
}

function buildRipgrepArgs(request: NormalizedGrepRequest): string[] {
  const args = ['--json', '--line-number', '--color=never', '--hidden']
  if (request.ignoreCase) {
    args.push('--ignore-case')
  }
  if (request.literal) {
    args.push('--fixed-strings')
  }
  if (request.fileGlob) {
    args.push('--glob', request.fileGlob)
  }
  args.push('--regexp', request.pattern)
  return args
}

function ensureSuccessfulCommand(
  result: CommandRunnerResult,
  selection: RipgrepSelection,
  phase: 'version check' | 'search'
): void {
  if (!result.timedOut && result.exitCode === 0 && result.signal === null) {
    return
  }
  if (result.timedOut) {
    throw new Error(`Vendored ripgrep ${phase} timed out for target ${selection.target}: ${selection.binaryPath}`)
  }
  const diagnostics = [
    `target=${selection.target}`,
    `rgPath=${selection.binaryPath}`,
    `exitCode=${result.exitCode === null ? 'null' : String(result.exitCode)}`,
    `signal=${result.signal ?? 'none'}`
  ]
  const stderr = result.stderr.trim()
  if (stderr) {
    diagnostics.push(`stderr=${stderr}`)
  }
  throw new Error(`Vendored ripgrep ${phase} failed (${diagnostics.join(', ')})`)
}

function parseRgMatches(stdout: string): RgMatch[] {
  return stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .flatMap(line => {
      const parsed = JSON.parse(line) as {
        type?: string
        data?: {
          path?: { text?: string }
          line_number?: number
          submatches?: Array<{ start?: number }>
        }
      }
      if (parsed.type !== 'match' || !parsed.data?.path?.text || !parsed.data.line_number) {
        return []
      }
      return [{
        path: parsed.data.path.text,
        line: parsed.data.line_number,
        column: (parsed.data.submatches?.[0]?.start ?? 0) + 1
      }]
    })
}

function toLogRequest(request: NormalizedGrepRequest): {
  pattern: string
  basePath: string
  glob: string
} {
  return {
    pattern: request.pattern,
    basePath: request.basePath.relativePath,
    glob: request.fileGlob
  }
}
