import { DefaultCommandRunner, type CommandRunner } from './shared/commandRunner.js'
import { collectFiles } from './shared/fileWalker.js'
import { matchesGlobPattern } from './shared/globUtils.js'
import { resolveWorkspacePath } from './shared/pathUtils.js'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

export interface LocalFindFilesArgs {
  pattern: string
  basePath?: string
  limit?: number
}

export interface FindFilesOptions {
  compatibilityMode: boolean
  commandRunner?: CommandRunner
}

export async function findWorkspaceFiles(
  workspaceDir: string,
  args: LocalFindFilesArgs,
  options: FindFilesOptions
): Promise<string> {
  const pattern = args.pattern?.trim()
  if (!pattern) {
    throw new Error('pattern is required')
  }

  const basePath = resolveWorkspacePath(workspaceDir, args.basePath || '.')
  const limit = normalizeLimit(args.limit)

  try {
    const result = await runFdSearch(pattern, basePath.absolutePath, limit, options.commandRunner)
    return buildFindFilesPayload('fd', pattern, basePath.relativePath, result.matches, result.truncated)
  } catch (error) {
    if (!options.compatibilityMode) {
      throw new Error('fd is required for find_files')
    }
  }

  const result = await findWithNode(basePath.absolutePath, pattern, limit)
  return buildFindFilesPayload('node-glob', pattern, basePath.relativePath, result.matches, result.truncated)
}

async function runFdSearch(
  pattern: string,
  cwd: string,
  limit: number,
  commandRunner: CommandRunner | undefined
): Promise<{ matches: string[]; truncated: boolean }> {
  const runner = commandRunner || new DefaultCommandRunner()
  const result = await runner.run('fd', ['--glob', '--type', 'f', pattern], cwd)
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || 'fd failed')
  }

  const matches = result.stdout.split('\n').map(line => line.trim()).filter(Boolean)
  return {
    matches: matches.slice(0, limit),
    truncated: matches.length > limit
  }
}

async function findWithNode(
  basePath: string,
  pattern: string,
  limit: number
): Promise<{ matches: string[]; truncated: boolean }> {
  const matches: string[] = []
  const files = await collectFiles(basePath)
  for (const file of files) {
    if (!matchesGlobPattern(file, pattern)) {
      continue
    }
    if (matches.length >= limit) {
      return { matches, truncated: true }
    }
    matches.push(file)
  }
  return { matches, truncated: false }
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_LIMIT
  }
  return Math.min(Math.floor(limit), MAX_LIMIT)
}

function buildFindFilesPayload(
  engine: 'fd' | 'node-glob',
  pattern: string,
  basePath: string,
  matches: string[],
  truncated: boolean
): string {
  return JSON.stringify({
    success: true,
    type: 'search_results',
    engine,
    pattern,
    basePath,
    matches,
    totalReturned: matches.length,
    truncated
  }, null, 2)
}
