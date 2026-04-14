import { lstat, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import { parseSkillFrontmatter } from './frontmatter.js'
import { parseScriptManifest } from './scriptManifest.js'
import { listZipArchiveEntries, extractZipArchive } from './archive.js'
import { SKILL_MANIFEST_FILE, SKILL_SCRIPTS_FILE } from './constants.js'

export interface SkillUploadValidationIssue {
  code: string
  message: string
  path?: string
  field?: string
}

export interface PreparedSkillUpload {
  cleanup: () => Promise<void>
  canonicalDescription: string
  canonicalName: string
  packageDir: string
  skillId: string
  sourcePath: string
}

export class SkillUploadValidationError extends Error {
  constructor(readonly issues: SkillUploadValidationIssue[]) {
    super('Invalid skill upload package')
    this.name = 'SkillUploadValidationError'
  }
}

export async function prepareSkillUpload(buffer: Buffer, originalName: string): Promise<PreparedSkillUpload> {
  const tempRoot = await mkdtemp(join(tmpdir(), 'skill-upload-'))
  try {
    const archivePath = join(tempRoot, sanitizeUploadName(originalName))
    const extractRoot = join(tempRoot, 'extract')
    await mkdir(extractRoot, { recursive: true })
    await writeFile(archivePath, buffer)

    const entries = await listZipArchiveEntries(archivePath)
    validateArchiveEntries(entries)
    await extractZipArchive(archivePath, extractRoot)

    const skillFilePaths = await collectSkillManifestPaths(extractRoot)
    const packageDir = resolvePackageDir(skillFilePaths)
    await assertSinglePackageRoot(extractRoot, packageDir)
    await rejectSymlinks(packageDir)

    const sourcePath = join(packageDir, SKILL_MANIFEST_FILE)
    const content = await readFile(sourcePath, 'utf8')
    const parsed = parseSkillFrontmatter(content)
    if (!parsed.ok) {
      throw new SkillUploadValidationError(parsed.issues.map(issue => ({
        code: issue.code,
        field: issue.field,
        message: issue.message,
        path: SKILL_MANIFEST_FILE
      })))
    }

    const scriptsPath = join(packageDir, SKILL_SCRIPTS_FILE)
    const scriptManifest = parseScriptManifest(scriptsPath, packageDir)
    if (!scriptManifest.ok) {
      throw new SkillUploadValidationError(scriptManifest.issues.map(issue => ({
        code: issue.code,
        field: issue.field,
        message: issue.message,
        path: SKILL_SCRIPTS_FILE
      })))
    }

    return {
      cleanup: async () => rm(tempRoot, { recursive: true, force: true }),
      canonicalDescription: parsed.metadata.description,
      canonicalName: parsed.metadata.name,
      packageDir,
      skillId: parsed.metadata.id,
      sourcePath
    }
  } catch (error) {
    await rm(tempRoot, { recursive: true, force: true })
    throw error
  }
}

function sanitizeUploadName(originalName: string): string {
  const normalized = originalName.trim().replace(/[/\\]/g, '-')
  if (!normalized.toLowerCase().endsWith('.zip')) {
    throw new SkillUploadValidationError([{
      code: 'invalid_archive_type',
      message: 'Only .zip skill packages are supported.'
    }])
  }
  return normalized || 'skill-upload.zip'
}

function validateArchiveEntries(entries: string[]): void {
  if (entries.length === 0) {
    throw new SkillUploadValidationError([{
      code: 'empty_archive',
      message: 'The uploaded zip archive is empty.'
    }])
  }
  const issues = entries
    .map(entry => validateArchiveEntry(entry))
    .filter((issue): issue is SkillUploadValidationIssue => Boolean(issue))
  if (issues.length > 0) {
    throw new SkillUploadValidationError(issues)
  }
}

function validateArchiveEntry(entry: string): SkillUploadValidationIssue | null {
  const normalized = entry.replace(/\\/g, '/').trim()
  if (!normalized) {
    return {
      code: 'invalid_archive_entry',
      message: 'Archive contains an empty entry path.'
    }
  }
  if (normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) {
    return {
      code: 'unsafe_archive_path',
      message: 'Archive contains an absolute path.',
      path: normalized
    }
  }
  if (normalized.split('/').some(segment => segment === '..')) {
    return {
      code: 'unsafe_archive_path',
      message: 'Archive contains path traversal segments.',
      path: normalized
    }
  }
  return null
}

async function collectSkillManifestPaths(extractRoot: string): Promise<string[]> {
  const results: string[] = []
  await walkDirectory(extractRoot, async entryPath => {
    if (entryPath.endsWith(`/${SKILL_MANIFEST_FILE}`) || entryPath.endsWith(`\\${SKILL_MANIFEST_FILE}`)) {
      results.push(entryPath)
    }
  })
  return results.sort((left, right) => left.localeCompare(right, 'en'))
}

function resolvePackageDir(skillFilePaths: string[]): string {
  if (skillFilePaths.length === 0) {
    throw new SkillUploadValidationError([{
      code: 'missing_skill_manifest',
      message: 'The uploaded package must contain exactly one SKILL.md.'
    }])
  }
  if (skillFilePaths.length > 1) {
    throw new SkillUploadValidationError([{
      code: 'multiple_skill_roots',
      message: 'The uploaded zip must contain exactly one canonical skill package.'
    }])
  }
  return dirname(skillFilePaths[0])
}

async function assertSinglePackageRoot(extractRoot: string, packageDir: string): Promise<void> {
  const topLevelPackageRoot = relative(extractRoot, packageDir).split(/[\\/]/).filter(Boolean)[0] || '.'
  if (topLevelPackageRoot === '.') {
    return
  }
  const entries = await readdir(extractRoot, { withFileTypes: true })
  const nonMetadataEntries = entries
    .filter(entry => entry.name !== '__MACOSX')
    .map(entry => entry.name)
  if (nonMetadataEntries.some(entry => entry !== topLevelPackageRoot)) {
    throw new SkillUploadValidationError([{
      code: 'multiple_skill_roots',
      message: 'The uploaded zip must contain exactly one skill package root.'
    }])
  }
}

async function rejectSymlinks(packageDir: string): Promise<void> {
  const issues: SkillUploadValidationIssue[] = []
  await walkDirectory(packageDir, async entryPath => {
    const stats = await lstat(entryPath)
    if (!stats.isSymbolicLink()) {
      return
    }
    issues.push({
      code: 'unsupported_symlink',
      message: 'Symbolic links are not supported in skill uploads.',
      path: entryPath
    })
  })
  if (issues.length > 0) {
    throw new SkillUploadValidationError(issues)
  }
}

async function walkDirectory(directoryPath: string, visitor: (entryPath: string) => Promise<void>): Promise<void> {
  const entries = await readdir(directoryPath, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === '__MACOSX') continue
    const entryPath = join(directoryPath, entry.name)
    await visitor(entryPath)
    if (entry.isDirectory()) {
      await walkDirectory(entryPath, visitor)
    }
  }
}
