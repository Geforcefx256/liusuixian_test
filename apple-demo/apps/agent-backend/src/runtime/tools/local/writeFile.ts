import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileStore, type ProjectRegistrationResult, type WorkspaceScope } from '../../../files/fileStore.js'
import type { ReadFileStateEntry } from './readFileState.js'

export const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[a-zA-Z]:[\\/]/

export interface LocalWriteFileArgs {
  path: string
  content: string
  workspaceScope?: WorkspaceScope
}

export type LocalWriteLogMeta = Record<string, unknown> & {
  relativePath: string
  contentChars: number
  contentBytes: number
}

export async function writeWorkspaceProjectFile(args: LocalWriteFileArgs): Promise<{
  summary: string
  logMeta: LocalWriteLogMeta
  fileMeta: ReadFileStateEntry
}> {
  await fileStore.initialize()
  const relativePath = normalizeProjectRelativePath(args.path)
  const registration = await fileStore.registerProjectPath(relativePath, args.workspaceScope)
  const absolutePath = fileStore.getProjectEntryPath(registration.entry)

  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, args.content, 'utf8')
  const fileStats = await stat(absolutePath)

  return {
    summary: JSON.stringify(buildArtifactRef(registration), null, 2),
    logMeta: {
      relativePath,
      contentChars: args.content.length,
      contentBytes: Buffer.byteLength(args.content, 'utf8')
    },
    fileMeta: {
      absolutePath,
      relativePath,
      mtimeMs: fileStats.mtimeMs
    }
  }
}

export function normalizeProjectRelativePath(inputPath: string): string {
  const trimmed = inputPath.trim()
  if (!trimmed) {
    throw new Error('Project path must be a non-empty relative path')
  }

  const portablePath = trimmed.replace(/\\/g, '/')
  if (portablePath.endsWith('/')) {
    throw new Error('Project path must target a file, not a directory')
  }
  if (portablePath.startsWith('/') || WINDOWS_ABSOLUTE_PATH_PATTERN.test(trimmed)) {
    throw new Error('Project path must be relative to the scoped project directory')
  }

  const normalizedPath = path.posix.normalize(portablePath).replace(/^\.\//, '')
  if (!normalizedPath || normalizedPath === '.' || normalizedPath === '..' || normalizedPath.startsWith('../')) {
    throw new Error('Project path escapes the scoped project directory')
  }
  return normalizedPath
}

function buildArtifactRef(registration: ProjectRegistrationResult): Record<string, unknown> {
  return {
    kind: 'artifact_ref',
    data: {
      fileId: registration.entry.fileId,
      fileKey: registration.entry.fileKey,
      fileName: registration.entry.originalName,
      path: fileStore.getWorkspaceRelativePath(registration.entry),
      created: registration.created
    }
  }
}
