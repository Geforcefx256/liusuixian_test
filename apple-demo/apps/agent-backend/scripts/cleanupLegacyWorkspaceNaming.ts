import { mkdir } from 'node:fs/promises'
import {
  cleanupLegacyWorkspaceNaming,
  resolveLegacyWorkspacePaths
} from '../src/support/legacyWorkspaceNaming.js'

async function main(): Promise<void> {
  const paths = resolveLegacyWorkspacePaths(import.meta.url, 1)
  await mkdir(paths.workspaceDir, { recursive: true })
  const summary = await cleanupLegacyWorkspaceNaming(paths)
  process.stdout.write([
    'Legacy workspace naming cleanup complete.',
    `removed_scopes=${summary.removedScopeCount}`,
    `removed_legacy_dirs=${summary.removedLegacyDirCount}`,
    `removed_file_maps=${summary.removedFileMapCount}`,
    `cleaned_sessions=${summary.cleanedSessionCount}`
  ].join('\n'))
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exit(1)
})
