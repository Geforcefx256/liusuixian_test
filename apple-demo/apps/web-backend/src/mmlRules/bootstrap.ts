import { existsSync } from 'node:fs'

import { MmlRuleImporter, type ImportDirectorySummary } from './importer.js'

export interface MmlRuleBootstrapConfig {
  sourceDir: string
  importOnStartup: boolean
  failOnStartupImportError: boolean
}

export function bootstrapMmlRules(
  config: MmlRuleBootstrapConfig,
  importer: MmlRuleImporter
): ImportDirectorySummary {
  if (!config.importOnStartup) {
    return {
      scannedFiles: 0,
      imported: [],
      skipped: []
    }
  }

  if (!existsSync(config.sourceDir)) {
    const error = new Error(`MML rule source directory does not exist: ${config.sourceDir}`)
    if (config.failOnStartupImportError) {
      throw error
    }
    console.warn([
      '[web-backend][WARN] MML rules source directory does not exist',
      `  path          : ${config.sourceDir}`,
      '  effect        : startup continues, MML rules import skipped'
    ].join('\n'))
    return {
      scannedFiles: 0,
      imported: [],
      skipped: []
    }
  }

  try {
    return importer.importDirectory(config.sourceDir)
  } catch (error) {
    if (config.failOnStartupImportError) {
      throw error
    }
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    console.warn([
      '[web-backend][WARN] MML rules import failed',
      `  path          : ${config.sourceDir}`,
      `  message       : ${message}`,
      '  effect        : startup continues, MML rules import skipped',
      ...(stack ? ['  stack:', ...stack.split('\n').map(line => `    ${line}`)] : [])
    ].join('\n'))
    return {
      scannedFiles: 0,
      imported: [],
      skipped: []
    }
  }
}
