import fs from 'node:fs/promises'
import path from 'node:path'

export interface ResolvedWorkspacePath {
  absolutePath: string
  relativePath: string
}

export interface DirectoryEntry {
  name: string
  type: 'file' | 'directory' | 'other'
}

export function resolveWorkspacePath(workspaceDir: string, inputPath: string): ResolvedWorkspacePath {
  const trimmedPath = inputPath.trim()
  if (!trimmedPath) {
    throw new Error('path is required')
  }

  const absolutePath = path.resolve(workspaceDir, trimmedPath)
  const relativePath = path.relative(workspaceDir, absolutePath)
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Path is outside workspace boundary (outside workspace).')
  }

  return {
    absolutePath,
    relativePath: relativePath || trimmedPath
  }
}

export async function readDirectoryEntries(absolutePath: string): Promise<DirectoryEntry[]> {
  const entries = await fs.readdir(absolutePath, { withFileTypes: true })
  return entries
    .map(entry => ({
      name: entry.name,
      type: toDirectoryEntryType(entry)
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

function toDirectoryEntryType(entry: { isDirectory(): boolean; isFile(): boolean }): DirectoryEntry['type'] {
  if (entry.isDirectory()) {
    return 'directory'
  }
  if (entry.isFile()) {
    return 'file'
  }
  return 'other'
}
