import fs from 'node:fs/promises'
import { readDirectoryEntries, resolveWorkspacePath } from './shared/pathUtils.js'

export interface LocalListDirectoryArgs {
  path: string
}

export async function listWorkspaceDirectory(
  workspaceDir: string,
  args: LocalListDirectoryArgs
): Promise<string> {
  const safePath = resolveWorkspacePath(workspaceDir, args.path)
  const stats = await statWorkspacePath(safePath.absolutePath, safePath.relativePath)
  if (!stats.isDirectory()) {
    throw new Error('Path is not a directory. Use read_file instead.')
  }

  const entries = await readDirectoryEntries(safePath.absolutePath)
  return JSON.stringify({
    success: true,
    type: 'directory',
    path: safePath.relativePath,
    entries
  }, null, 2)
}

async function statWorkspacePath(absolutePath: string, displayPath: string) {
  try {
    return await fs.stat(absolutePath)
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new Error(`Path not found: ${displayPath}. Use find_files if you only know the filename.`)
    }
    throw error
  }
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
