import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function resolveServiceRoot(): string {
  let currentDir = path.dirname(fileURLToPath(import.meta.url))
  for (let step = 0; step < 4; step += 1) {
    if (existsSync(path.join(currentDir, 'package.json'))) {
      return currentDir
    }
    currentDir = path.resolve(currentDir, '..')
  }
  return process.cwd()
}

const SERVICE_ROOT = resolveServiceRoot()

export function getServiceRoot(): string {
  return SERVICE_ROOT
}

export function resolveServicePath(...segments: string[]): string {
  return path.join(SERVICE_ROOT, ...segments)
}
