/**
 * Vector Extension Loader
 *
 * Loads sqlite-vec extension for vector similarity search.
 */

import path from 'path'
import fs from 'fs'
import type { DatabaseSync } from 'node:sqlite'
import { resolveBackendRoot } from '../support/runtimePaths.js'
import { createLogger } from '../logging/index.js'

const vectorExtensionLogger = createLogger({
  category: 'runtime',
  component: 'vector_extension'
})

/**
 * Find the sqlite-vec extension file for current platform
 */
function findVectorExtension(): string | null {
  const extensionsDir = path.join(resolveBackendRoot(import.meta.url, 2), 'extensions')

  const platform = process.platform
  const extMap: Record<string, string> = {
    win32: 'vec0.dll',
    darwin: 'vec0.dylib',
    linux: 'vec0.so'
  }

  const extName = extMap[platform]
  if (!extName) {
    vectorExtensionLogger.warn({
      message: 'unsupported sqlite-vec platform',
      data: { platform }
    })
    return null
  }

  return path.join(extensionsDir, extName)
}

/**
 * Load sqlite-vec extension into database
 *
 * @param db - DatabaseSync instance
 * @returns true if loaded successfully, false otherwise
 */
export function loadVectorExtension(db: DatabaseSync): boolean {
  const extPath = findVectorExtension()

  if (!extPath) {
    vectorExtensionLogger.warn({ message: 'could not resolve sqlite-vec extension path' })
    return false
  }

  if (!fs.existsSync(extPath)) {
    vectorExtensionLogger.warn({
      message: 'sqlite-vec extension not found',
      data: { path: extPath }
    })
    return false
  }

  try {
    db.loadExtension(extPath)
    vectorExtensionLogger.info({
      message: 'sqlite-vec extension loaded',
      data: { path: extPath }
    })
    return true
  } catch (error) {
    vectorExtensionLogger.warn({
      message: 'failed to load sqlite-vec extension',
      data: {
        path: extPath,
        error: error instanceof Error ? error.message : String(error)
      }
    })
    return false
  }
}

/**
 * Check if vector extension is available
 */
export function isVectorExtensionAvailable(): boolean {
  const extPath = findVectorExtension()
  if (!extPath) return false
  return fs.existsSync(extPath)
}
