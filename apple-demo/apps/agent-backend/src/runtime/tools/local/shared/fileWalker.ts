import fs from 'node:fs/promises'
import path from 'node:path'

export async function collectFiles(basePath: string, relativePath = ''): Promise<string[]> {
  const absolutePath = relativePath ? path.join(basePath, relativePath) : basePath
  const entries = await fs.readdir(absolutePath, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const nextRelativePath = relativePath ? path.posix.join(relativePath, entry.name) : entry.name
    if (entry.isDirectory()) {
      files.push(...await collectFiles(basePath, nextRelativePath))
      continue
    }
    if (entry.isFile()) {
      files.push(nextRelativePath)
    }
  }

  return files
}
