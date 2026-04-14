import fs from 'node:fs/promises'
import { resolveWorkspacePath } from './shared/pathUtils.js'
import { buildFilePayload, detectBinary, normalizeLimit, normalizeOffset } from './shared/textUtils.js'
import type { ReadFileStateEntry } from './readFileState.js'

export interface LocalReadFileArgs {
  path: string
  offset?: number
  limit?: number
}

export interface ReadFileResult {
  summary: string
  fileMeta: ReadFileStateEntry
}

export async function readWorkspacePath(
  workspaceDir: string,
  args: LocalReadFileArgs
): Promise<ReadFileResult> {
  const safePath = resolveWorkspacePath(workspaceDir, args.path)
  const stats = await statWorkspacePath(safePath.absolutePath, safePath.relativePath)
  if (stats.isDirectory()) {
    throw new Error('Path is a directory. Use list_directory instead.')
  }

  const content = await readWorkspaceFile(safePath.absolutePath, safePath.relativePath)
  if (detectBinary(content)) {
    throw new Error('Cannot read binary file content. Only text files are supported.')
  }

  return {
    summary: buildFilePayload(
      safePath.relativePath,
      content,
      normalizeOffset(args.offset),
      normalizeLimit(args.limit)
    ),
    fileMeta: {
      absolutePath: safePath.absolutePath,
      relativePath: safePath.relativePath,
      mtimeMs: stats.mtimeMs
    }
  }
}

async function statWorkspacePath(absolutePath: string, displayPath: string) {
  try {
    return await fs.stat(absolutePath)
  } catch (error) {
    throw mapPathLookupError(error, displayPath)
  }
}

async function readWorkspaceFile(absolutePath: string, displayPath: string): Promise<string> {
  try {
    return await fs.readFile(absolutePath, 'utf-8')
  } catch (error) {
    throw mapPathLookupError(error, displayPath)
  }
}

function mapPathLookupError(error: unknown, displayPath: string): Error {
  if (isMissingPathError(error)) {
    return new Error(`File not found: ${displayPath}. Use find_files if you only know the filename.`)
  }
  return error instanceof Error ? error : new Error(String(error))
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
