import { existsSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SHARED_SKILL_LIBRARY_DIR } from '../skills/constants.js'

const PUBLISHED_ASSET_DIR = 'assets'
const SOURCE_AGENT_ASSET_DIR = 'assets'
const BACKEND_CONFIG_NAME = 'config.json'
const VENDORED_RIPGREP_PATH = ['vendor', 'ripgrep']

function buildUpSegments(levelsUp: number): string[] {
  return Array.from({ length: levelsUp }, () => '..')
}

export function resolveBackendRoot(moduleUrl: string, levelsUp: number): string {
  let currentDir = dirname(fileURLToPath(moduleUrl))
  for (let step = 0; step <= levelsUp + 2; step += 1) {
    if (existsSync(resolve(currentDir, BACKEND_CONFIG_NAME))) {
      return currentDir
    }
    currentDir = resolve(currentDir, '..')
  }
  const moduleDir = dirname(fileURLToPath(moduleUrl))
  const publishedRoot = resolvePublishedBackendRoot(moduleDir)
  if (publishedRoot) {
    return publishedRoot
  }
  return resolve(moduleDir, ...buildUpSegments(levelsUp))
}

export function resolveAgentAssetsRoot(moduleUrl: string, levelsUp: number): string {
  const backendRoot = resolveBackendRoot(moduleUrl, levelsUp)
  const publishedAssetsRoot = resolve(backendRoot, PUBLISHED_ASSET_DIR)
  if (existsSync(publishedAssetsRoot)) {
    return publishedAssetsRoot
  }
  return resolve(backendRoot, SOURCE_AGENT_ASSET_DIR)
}

export function resolveSkillAssetsRoot(moduleUrl: string, levelsUp: number): string {
  return resolve(resolveAgentAssetsRoot(moduleUrl, levelsUp), SHARED_SKILL_LIBRARY_DIR)
}

export function resolveVendoredRipgrepRoot(moduleUrl: string, levelsUp: number): string {
  return resolve(resolveAgentAssetsRoot(moduleUrl, levelsUp), ...VENDORED_RIPGREP_PATH)
}

function resolvePublishedBackendRoot(moduleDir: string): string | null {
  const normalized = `${moduleDir}${sep}`
  const markers = [
    `${sep}dist${sep}agent-backend${sep}`,
    `${sep}dist${sep}agent${sep}`
  ]

  for (const marker of markers) {
    const index = normalized.lastIndexOf(marker)
    if (index === -1) {
      continue
    }
    return normalized.slice(0, index + marker.length - 1)
  }

  return null
}
