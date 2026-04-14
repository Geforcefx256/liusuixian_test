import type { GatewayTraceContext } from '../../../gateway/tools/types.js'
import { createLogger } from '../../../logging/index.js'
import type { CommandRunnerResult } from './shared/commandRunner.js'
import type { RipgrepRuntimeInfo, RipgrepSelection } from './shared/ripgrep.js'

const grepLogger = createLogger({
  category: 'tool',
  component: 'local_grep'
})

export function logRipgrepSelection(
  trace: GatewayTraceContext | undefined,
  selection: RipgrepSelection,
  version: string,
  versionCached: boolean
): void {
  grepLogger.info({
    message: 'vendored ripgrep selected',
    context: toTraceLogContext(trace),
    data: {
      platform: selection.platform,
      arch: selection.arch,
      libc: selection.libc,
      target: selection.target,
      rgPath: selection.binaryPath,
      version,
      versionCached
    }
  })
}

export function logGrepCompletion(
  trace: GatewayTraceContext | undefined,
  request: {
    pattern: string
    basePath: string
    glob: string
  },
  selection: RipgrepSelection,
  version: string,
  result: CommandRunnerResult,
  matchCount: number
): void {
  grepLogger.info({
    message: 'local grep completed',
    context: toTraceLogContext(trace),
    data: {
      outcome: matchCount > 0 ? 'match' : 'no_match',
      pattern: request.pattern,
      basePath: request.basePath,
      glob: request.glob,
      target: selection.target,
      rgPath: selection.binaryPath,
      version,
      exitCode: result.exitCode,
      signal: result.signal,
      stderr: result.stderr.trim() || null,
      matchCount
    }
  })
}

export function logGrepFailure(
  trace: GatewayTraceContext | undefined,
  request: {
    pattern: string
    basePath: string
    glob: string
  },
  runtime: RipgrepRuntimeInfo,
  selection: RipgrepSelection | null,
  version: string,
  error: unknown
): void {
  grepLogger.error({
    message: 'local grep failed',
    context: toTraceLogContext(trace),
    data: {
      pattern: request.pattern,
      basePath: request.basePath,
      glob: request.glob,
      platform: runtime.platform,
      arch: runtime.arch,
      libc: runtime.libc,
      target: selection?.target ?? null,
      rgPath: selection?.binaryPath ?? null,
      version: version || null,
      error: serializeError(error)
    }
  })
}

function toTraceLogContext(
  trace: GatewayTraceContext | undefined
): { runId: string; turnId?: string } | undefined {
  if (!trace?.runId) {
    return undefined
  }
  return {
    runId: trace.runId,
    ...(trace.turnId ? { turnId: trace.turnId } : {})
  }
}

function serializeError(error: unknown): { message: string; name?: string } {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name
    }
  }
  return {
    message: String(error)
  }
}
