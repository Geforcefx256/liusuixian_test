import fs from 'node:fs/promises'
import path from 'node:path'
import { fileStore, type WorkspaceScope } from '../../../files/fileStore.js'
import {
  detectBinary,
  detectDominantLineEnding,
  normalizeLineEndings,
  restoreLineEndings,
  type DominantLineEnding
} from './shared/textUtils.js'
import { ReadFileStateMap, type ReadFileStateEntry } from './readFileState.js'
import { normalizeProjectRelativePath } from './writeFile.js'

const STALENESS_TOLERANCE_MS = 1
const PROJECT_PATH_PREFIX = 'project/'

export interface LocalEditFileArgs {
  file_path: string
  old_string: string
  new_string: string
  replace_all?: boolean
  sessionKey?: string
  workspaceScope?: WorkspaceScope
  readFileState: ReadFileStateMap
}

export type LocalEditLogMeta = Record<string, unknown> & {
  relativePath: string
  replacements: number
  oldStringChars: number
  newStringChars: number
}

export async function editWorkspaceProjectFile(args: LocalEditFileArgs): Promise<{
  summary: string
  logMeta: LocalEditLogMeta
}> {
  const relativePath = normalizeEditableProjectPath(args.file_path)
  assertOldString(args.old_string)
  await fileStore.initialize()

  const absolutePath = resolveProjectPath(relativePath, args.workspaceScope)
  const currentFile = await loadEditableFile(absolutePath, relativePath)
  assertFreshFile(args.readFileState, args.sessionKey, currentFile.fileMeta)
  const oldString = normalizeLineEndings(args.old_string)
  const newString = normalizeLineEndings(args.new_string)

  const replacements = countOccurrences(currentFile.normalizedContent, oldString)
  assertReplacementCount(replacements, Boolean(args.replace_all), relativePath)

  const nextContent = applyReplacement(currentFile.normalizedContent, oldString, newString, Boolean(args.replace_all))
  await fileStore.registerProjectPath(relativePath, args.workspaceScope)
  await fs.writeFile(absolutePath, restoreLineEndings(nextContent, currentFile.lineEnding), 'utf8')

  const nextFileMeta = await readFileMeta(absolutePath, relativePath)
  args.readFileState.record(args.sessionKey ?? '', nextFileMeta)
  return {
    summary: JSON.stringify({
      success: true,
      type: 'file_edit',
      path: `${PROJECT_PATH_PREFIX}${relativePath}`,
      replacements
    }, null, 2),
    logMeta: {
      relativePath,
      replacements,
      oldStringChars: args.old_string.length,
      newStringChars: args.new_string.length
    }
  }
}

async function loadEditableFile(absolutePath: string, relativePath: string): Promise<{
  normalizedContent: string
  lineEnding: DominantLineEnding
  fileMeta: ReadFileStateEntry
}> {
  const fileMeta = await readFileMeta(absolutePath, relativePath)
  const content = await readEditableContent(absolutePath, relativePath)
  return {
    normalizedContent: normalizeLineEndings(content),
    lineEnding: detectDominantLineEnding(content),
    fileMeta
  }
}

async function readFileMeta(absolutePath: string, relativePath: string): Promise<ReadFileStateEntry> {
  try {
    const stats = await fs.stat(absolutePath)
    if (stats.isDirectory()) {
      throw new Error(`Edit path must target a file, not a directory: ${relativePath}`)
    }
    return {
      absolutePath,
      relativePath,
      mtimeMs: stats.mtimeMs
    }
  } catch (error) {
    throw mapEditFileError(error, relativePath)
  }
}

async function readEditableContent(absolutePath: string, relativePath: string): Promise<string> {
  try {
    const content = await fs.readFile(absolutePath, 'utf8')
    if (detectBinary(content)) {
      throw new Error(`Cannot edit binary file content: ${relativePath}. Only text files are supported.`)
    }
    return content
  } catch (error) {
    throw mapEditFileError(error, relativePath)
  }
}

function normalizeEditableProjectPath(inputPath: string): string {
  const normalizedPath = normalizeProjectRelativePath(inputPath)
  if (normalizedPath.startsWith(PROJECT_PATH_PREFIX)) {
    return normalizedPath.slice(PROJECT_PATH_PREFIX.length)
  }
  return normalizedPath
}

function assertFreshFile(
  readFileState: ReadFileStateMap,
  sessionKey: string | undefined,
  fileMeta: ReadFileStateEntry
): void {
  if (!sessionKey?.trim()) {
    return
  }

  const previous = readFileState.get(sessionKey, fileMeta.absolutePath)
  if (!previous) {
    return
  }
  if (Math.abs(previous.mtimeMs - fileMeta.mtimeMs) <= STALENESS_TOLERANCE_MS) {
    return
  }

  throw new Error(`File has changed since the last read_file call: ${fileMeta.relativePath}. Call read_file again before editing.`)
}

function assertOldString(oldString: string): void {
  if (!oldString) {
    throw new Error('edit requires old_string to be non-empty')
  }
}

function assertReplacementCount(replacements: number, replaceAll: boolean, relativePath: string): void {
  if (replacements === 0) {
    throw new Error(`old_string not found in ${relativePath}. Use read_file to verify the current file content.`)
  }
  if (!replaceAll && replacements > 1) {
    throw new Error(
      `old_string matched ${replacements} times in ${relativePath}. Use replace_all: true or provide a more specific old_string.`
    )
  }
}

function applyReplacement(content: string, oldString: string, newString: string, replaceAll: boolean): string {
  if (replaceAll) {
    return content.split(oldString).join(newString)
  }
  return content.replace(oldString, newString)
}

function countOccurrences(content: string, target: string): number {
  return content.split(target).length - 1
}

function resolveProjectPath(relativePath: string, workspaceScope?: WorkspaceScope): string {
  return path.join(fileStore.getProjectDir(workspaceScope), ...relativePath.split('/'))
}

function mapEditFileError(error: unknown, relativePath: string): Error {
  if (isMissingPathError(error)) {
    return new Error(`File not found: ${relativePath}. Use write to create it first.`)
  }
  return error instanceof Error ? error : new Error(String(error))
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
