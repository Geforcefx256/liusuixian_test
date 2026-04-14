import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { basename, dirname, extname, join, posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const FILE_KEY_PREFIX = 'f_'
const FILE_KEY_LENGTH = 6
const FILE_KEY_MAX_ATTEMPTS = 50
const FILE_MAP_VERSION = 5
const LEGACY_FILE_MAP_VERSION = 4
const LEGACY_FILE_MAP_VERSION_V3 = 3
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000
const FILE_TTL_MS = 24 * MILLISECONDS_PER_HOUR
const USERS_DIR_NAME = 'users'
const AGENTS_DIR_NAME = 'agents'
const UPLOAD_DIR_NAME = 'upload'
const PROJECT_DIR_NAME = 'project'
const TEMP_DIR_NAME = 'temp'
const PLANS_DIR_NAME = 'plans'
const FILE_MAP_NAME = 'file-map.json'
const PROJECT_FILE_PREFIX = 'artifact-'
const PROJECT_FILE_EXTENSION = '.json'
const UPLOAD_GROUP_PREFIX = 'upload'
const PROJECT_GROUP_PREFIX = 'project'
const ROOT_DIRECTORY = '.'
const MAX_CREATE_ATTEMPTS = 10_000
const ALLOWED_PROJECT_FILE_EXTENSIONS = new Set(['.txt', '.md', '.mml'])

type FileMapEntryKind = 'upload' | 'project' | 'folder'

export interface WorkspaceScope {
  userId: number
  agentId: string
}

const DEFAULT_WORKSPACE_SCOPE: WorkspaceScope = {
  userId: 0,
  agentId: 'default-agent'
}

export interface FileMapEntry {
  fileKey: string
  fileId: string
  createdAt: number
  originalName: string
  storageExtension: string
  kind: FileMapEntryKind
  relativePath?: string
  scope: WorkspaceScope
}

interface FileMapFile {
  version: number
  scope: WorkspaceScope
  entries: Array<Omit<FileMapEntry, 'scope'>>
}

export interface ProjectRegistrationResult {
  entry: FileMapEntry
  created: boolean
}

export interface UploadWriteResult {
  entry: FileMapEntry
  created: boolean
  replaced: boolean
}

export class WorkspaceUploadConflictError extends Error {
  readonly relativePath: string

  constructor(relativePath: string) {
    super(`Upload already exists: ${relativePath}`)
    this.name = 'WorkspaceUploadConflictError'
    this.relativePath = relativePath
  }
}

export class WorkspaceRenameConflictError extends Error {
  readonly relativePath: string

  constructor(relativePath: string) {
    super(`Workspace rename target already exists: ${relativePath}`)
    this.name = 'WorkspaceRenameConflictError'
    this.relativePath = relativePath
  }
}

export class WorkspaceRenameValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkspaceRenameValidationError'
  }
}

export class WorkspaceCreateConflictError extends Error {
  readonly relativePath: string

  constructor(relativePath: string) {
    super(`Workspace create target already exists: ${relativePath}`)
    this.name = 'WorkspaceCreateConflictError'
    this.relativePath = relativePath
  }
}

export class WorkspaceCreateValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkspaceCreateValidationError'
  }
}

function getEntryRelativePath(entry: FileMapEntry): string {
  return entry.relativePath || entry.originalName
}

function getBackendRootDir(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url))
  return resolve(currentDir, '..', '..')
}

function getWorkspaceDir(): string {
  return resolve(getBackendRootDir(), 'workspace')
}

function ensurePrefix(value: string, prefix: string): string {
  return value.startsWith(prefix) ? value : `${prefix}${value}`
}

function generateFileKey(existing: Set<string>): string {
  let attempts = 0
  while (attempts < FILE_KEY_MAX_ATTEMPTS) {
    const raw = Math.random().toString(36).slice(2, 2 + FILE_KEY_LENGTH)
    const key = ensurePrefix(raw, FILE_KEY_PREFIX)
    if (!existing.has(key)) return key
    attempts += 1
  }
  throw new Error('Unable to allocate unique file key')
}

function normalizeScope(scope?: WorkspaceScope | null): WorkspaceScope {
  const userId = Number.isFinite(scope?.userId) ? Number(scope?.userId) : DEFAULT_WORKSPACE_SCOPE.userId
  const agentId = typeof scope?.agentId === 'string' && scope.agentId.trim().length > 0
    ? scope.agentId.trim()
    : DEFAULT_WORKSPACE_SCOPE.agentId
  return { userId, agentId }
}

function scopeKey(scope?: WorkspaceScope | null): string {
  const normalized = normalizeScope(scope)
  return `${normalized.userId}:${normalized.agentId}`
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
}

function toMapPayload(scope: WorkspaceScope, entries: FileMapEntry[]): FileMapFile {
  return {
    version: FILE_MAP_VERSION,
    scope,
    entries: entries.map(({ scope: _scope, ...entry }) => entry)
  }
}

function getAgentPathSegment(agentId: string): string {
  return encodeURIComponent(agentId)
}

function splitRelativePath(value: string): string[] {
  return value.split('/').filter(Boolean)
}

function normalizePathSeparators(value: string): string {
  return value.replace(/\\/g, '/')
}

function normalizeRelativePath(
  inputPath: string,
  errorFactory: (message: string) => Error
): string {
  const trimmed = normalizePathSeparators(inputPath).trim()
  if (!trimmed) {
    throw errorFactory('Workspace path is invalid')
  }
  if (trimmed.startsWith('/')) {
    throw errorFactory('Workspace path must stay relative')
  }
  const normalized = posix.normalize(trimmed)
  if (!normalized || normalized === ROOT_DIRECTORY || normalized === '..' || normalized.startsWith('../')) {
    throw errorFactory('Workspace path escapes the current workspace')
  }
  return normalized
}

function normalizeUploadPath(originalName: string, relativePath?: string): string {
  if (typeof relativePath === 'string' && relativePath.trim()) {
    return normalizeRelativePath(relativePath, message => new Error(message))
  }
  const normalizedName = basename(normalizePathSeparators(originalName.trim()))
  if (!normalizedName || normalizedName === ROOT_DIRECTORY || normalizedName === '..') {
    throw new Error('Upload file name is invalid')
  }
  return normalizedName
}

function normalizeRenameFileName(fileName: string, targetType: 'file' | 'folder'): string {
  const trimmed = normalizePathSeparators(fileName.trim())
  if (!trimmed || trimmed === ROOT_DIRECTORY || trimmed === '..') {
    throw new WorkspaceRenameValidationError(`Workspace ${targetType} name is invalid`)
  }
  if (trimmed.includes('/') || basename(trimmed) !== trimmed) {
    throw new WorkspaceRenameValidationError(`Workspace ${targetType} rename only supports basename changes`)
  }
  return trimmed
}

function normalizeCreateName(name: string, targetType: 'file' | 'folder'): string {
  const trimmed = normalizePathSeparators(name.trim())
  if (!trimmed || trimmed === ROOT_DIRECTORY || trimmed === '..') {
    throw new WorkspaceCreateValidationError(`Workspace ${targetType} name is invalid`)
  }
  if (trimmed.includes('/') || basename(trimmed) !== trimmed) {
    throw new WorkspaceCreateValidationError(`Workspace ${targetType} create only supports basename names`)
  }
  return trimmed
}

function normalizeProjectParentPath(parentPath?: string | null): string {
  if (!parentPath || !parentPath.trim()) return ''
  return normalizeRelativePath(parentPath, message => new WorkspaceCreateValidationError(message))
}

function getRelativePathDirectory(relativePath: string): string {
  const separatorIndex = relativePath.lastIndexOf('/')
  return separatorIndex >= 0 ? relativePath.slice(0, separatorIndex) : ''
}

function joinRelativePath(directory: string, fileName: string): string {
  return directory ? `${directory}/${fileName}` : fileName
}

function isDescendantPath(relativePath: string, parentPath: string): boolean {
  return relativePath === parentPath || relativePath.startsWith(`${parentPath}/`)
}

function replacePathPrefix(relativePath: string, fromPrefix: string, toPrefix: string): string {
  if (relativePath === fromPrefix) return toPrefix
  return `${toPrefix}${relativePath.slice(fromPrefix.length)}`
}

function buildCreateFileName(baseName: string, extension: string): string {
  return extension ? `${baseName}${extension}` : baseName
}

function assertAllowedProjectFileExtension(fileName: string): void {
  const extension = extname(fileName).toLowerCase()
  if (!ALLOWED_PROJECT_FILE_EXTENSIONS.has(extension)) {
    throw new WorkspaceCreateValidationError('Only TXT / MD / MML files can be created under project')
  }
}

function toGroupPrefix(kind: FileMapEntryKind): string {
  return kind === 'upload' ? UPLOAD_GROUP_PREFIX : PROJECT_GROUP_PREFIX
}

export class FileStore {
  private readonly workspaceDir = getWorkspaceDir()
  private readonly usersDir = join(this.workspaceDir, USERS_DIR_NAME)
  private readonly entriesByKey = new Map<string, FileMapEntry>()
  private readonly entriesByFileId = new Map<string, FileMapEntry>()
  private initialized = false

  async initialize(): Promise<void> {
    if (this.initialized) return
    await mkdir(this.workspaceDir, { recursive: true })
    await mkdir(this.usersDir, { recursive: true })
    await this.loadMaps()
    await this.migrateLegacyUploadEntries()
    await this.cleanupExpired()
    this.initialized = true
  }

  getWorkspaceRoot(scope?: WorkspaceScope): string {
    const normalizedScope = normalizeScope(scope)
    return join(
      this.usersDir,
      String(normalizedScope.userId),
      AGENTS_DIR_NAME,
      getAgentPathSegment(normalizedScope.agentId)
    )
  }

  getUploadDir(scope?: WorkspaceScope): string {
    return join(this.getWorkspaceRoot(scope), UPLOAD_DIR_NAME)
  }

  getProjectDir(scope?: WorkspaceScope): string {
    return join(this.getWorkspaceRoot(scope), PROJECT_DIR_NAME)
  }

  getTempDir(scope?: WorkspaceScope): string {
    return join(this.getWorkspaceRoot(scope), TEMP_DIR_NAME)
  }

  getPlansDir(scope?: WorkspaceScope): string {
    return join(this.getWorkspaceRoot(scope), PLANS_DIR_NAME)
  }

  getWorkspaceRelativePath(entry: FileMapEntry): string {
    return `${toGroupPrefix(entry.kind)}/${getEntryRelativePath(entry)}`
  }

  getUploadEntryPath(entry: FileMapEntry): string {
    return join(this.getUploadDir(entry.scope), ...splitRelativePath(getEntryRelativePath(entry)))
  }

  getLegacyUploadPath(fileId: string, storageExtension = '.csv', scope?: WorkspaceScope): string {
    return join(this.getUploadDir(scope), `${fileId}${storageExtension}`)
  }

  getProjectPath(fileId: string, scope?: WorkspaceScope): string {
    return join(this.getProjectDir(scope), `${fileId}.json`)
  }

  getProjectEntryPath(entry: FileMapEntry): string {
    if (entry.kind === 'upload') {
      throw new Error('Upload entries do not resolve through project storage')
    }
    if (!entry.relativePath && entry.kind === 'project') {
      return this.getProjectPath(entry.fileId, entry.scope)
    }
    return join(this.getProjectDir(entry.scope), ...splitRelativePath(getEntryRelativePath(entry)))
  }

  async writeUpload(params: {
    originalName: string
    relativePath?: string
    storageExtension?: string
    content: Buffer
    scope?: WorkspaceScope
    overwrite?: boolean
  }): Promise<UploadWriteResult> {
    const scope = normalizeScope(params.scope)
    const relativePath = normalizeUploadPath(params.originalName, params.relativePath)
    const existing = this.findEntryByPath('upload', relativePath, scope)
    if (existing && !params.overwrite) {
      throw new WorkspaceUploadConflictError(this.buildWorkspacePath('upload', relativePath))
    }

    await this.ensureScopeDirs(scope)
    const absolutePath = join(this.getUploadDir(scope), ...splitRelativePath(relativePath))
    await mkdir(dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, params.content)

    const nextEntry = existing
      ? {
          ...existing,
          createdAt: Date.now(),
          originalName: relativePath,
          storageExtension: params.storageExtension || extname(relativePath),
          relativePath
        }
      : this.buildEntry({
          kind: 'upload',
          relativePath,
          storageExtension: params.storageExtension || extname(relativePath),
          scope
        })

    this.setEntry(nextEntry)
    await this.persistScope(scope)
    await this.cleanupExpired()
    return {
      entry: nextEntry,
      created: !existing,
      replaced: Boolean(existing)
    }
  }

  async registerProject(fileId: string, scope?: WorkspaceScope): Promise<FileMapEntry> {
    const normalizedScope = normalizeScope(scope)
    await this.ensureScopeDirs(normalizedScope)
    const existing = this.findProjectEntryByFileId(fileId, normalizedScope)
    if (existing) return existing

    const relativePath = `${PROJECT_FILE_PREFIX}${fileId}${PROJECT_FILE_EXTENSION}`
    const entry = this.buildEntry({
      fileId,
      kind: 'project',
      relativePath,
      storageExtension: PROJECT_FILE_EXTENSION,
      scope: normalizedScope
    })
    this.setEntry(entry)
    await this.persistScope(normalizedScope)
    await this.cleanupExpired()
    return entry
  }

  async registerProjectPath(relativePath: string, scope?: WorkspaceScope): Promise<ProjectRegistrationResult> {
    const normalizedScope = normalizeScope(scope)
    const normalizedPath = normalizeRelativePath(relativePath, message => new Error(message))
    await this.ensureScopeDirs(normalizedScope)
    const existing = this.findEntryByPath('project', normalizedPath, normalizedScope)
    if (existing) {
      const refreshed = {
        ...existing,
        createdAt: Date.now(),
        originalName: normalizedPath,
        storageExtension: extname(normalizedPath),
        relativePath: normalizedPath
      }
      this.setEntry(refreshed)
      await this.persistScope(normalizedScope)
      await this.cleanupExpired()
      return { entry: refreshed, created: false }
    }

    const entry = this.buildEntry({
      kind: 'project',
      relativePath: normalizedPath,
      storageExtension: extname(normalizedPath),
      scope: normalizedScope
    })
    this.setEntry(entry)
    await this.persistScope(normalizedScope)
    await this.cleanupExpired()
    return { entry, created: true }
  }

  async createProjectFolder(parentPath: string | null | undefined, folderName: string, scope?: WorkspaceScope): Promise<FileMapEntry> {
    const normalizedScope = normalizeScope(scope)
    const normalizedParent = normalizeProjectParentPath(parentPath)
    const normalizedName = normalizeCreateName(folderName, 'folder')
    const relativePath = joinRelativePath(normalizedParent, normalizedName)
    await this.assertProjectParentExists(normalizedScope, normalizedParent)
    this.assertCreateTargetAvailable(relativePath, normalizedScope)

    const absolutePath = join(this.getProjectDir(normalizedScope), ...splitRelativePath(relativePath))
    await mkdir(absolutePath, { recursive: false })

    const entry = this.buildEntry({
      kind: 'folder',
      relativePath,
      storageExtension: '',
      scope: normalizedScope
    })
    this.setEntry(entry)

    try {
      await this.persistScope(normalizedScope)
      return entry
    } catch (error) {
      this.deleteEntry(entry)
      await rm(absolutePath, { recursive: true, force: true })
      throw error
    }
  }

  async createProjectFile(parentPath: string | null | undefined, fileName: string, scope?: WorkspaceScope): Promise<FileMapEntry> {
    const normalizedScope = normalizeScope(scope)
    const normalizedParent = normalizeProjectParentPath(parentPath)
    const normalizedName = normalizeCreateName(fileName, 'file')
    assertAllowedProjectFileExtension(normalizedName)
    const relativePath = joinRelativePath(normalizedParent, normalizedName)
    await this.assertProjectParentExists(normalizedScope, normalizedParent)
    this.assertCreateTargetAvailable(relativePath, normalizedScope)

    const absolutePath = join(this.getProjectDir(normalizedScope), ...splitRelativePath(relativePath))
    await mkdir(dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, '', 'utf8')

    const entry = this.buildEntry({
      kind: 'project',
      relativePath,
      storageExtension: extname(relativePath),
      scope: normalizedScope
    })
    this.setEntry(entry)

    try {
      await this.persistScope(normalizedScope)
      return entry
    } catch (error) {
      this.deleteEntry(entry)
      await unlink(absolutePath)
      throw error
    }
  }

  resolveFileKey(fileKey: string): FileMapEntry | null {
    return this.entriesByKey.get(fileKey) ?? null
  }

  resolveFileId(fileId: string): FileMapEntry | null {
    return this.entriesByFileId.get(fileId) ?? null
  }

  listWorkspaceEntries(scope?: WorkspaceScope): FileMapEntry[] {
    const key = scopeKey(scope)
    return Array.from(this.entriesByKey.values())
      .filter(entry => scopeKey(entry.scope) === key)
      .sort((left, right) => left.createdAt - right.createdAt)
  }

  async deleteWorkspaceEntry(fileKey: string, scope?: WorkspaceScope): Promise<FileMapEntry> {
    const normalizedScope = normalizeScope(scope)
    const entry = this.resolveFileKey(fileKey)
    if (!entry || scopeKey(entry.scope) !== scopeKey(normalizedScope)) {
      throw new Error('File not found')
    }
    const entriesToDelete = this.resolveEntriesForDeletion(entry)

    await this.removeTrackedEntryPath(entry)
    entriesToDelete.forEach(candidate => this.deleteEntry(candidate))

    try {
      await this.persistScope(entry.scope)
    } catch (error) {
      entriesToDelete.forEach(candidate => this.setEntry(candidate))
      throw error
    }

    return entry
  }

  async renameWorkspaceEntry(fileKey: string, fileName: string, scope?: WorkspaceScope): Promise<FileMapEntry> {
    const normalizedScope = normalizeScope(scope)
    const entry = this.resolveRenameEntry(fileKey, normalizedScope)
    if (entry.kind === 'folder') {
      throw new WorkspaceRenameValidationError('Use the project-folder rename flow for folders')
    }
    const nextRelativePath = this.buildFileRenameRelativePath(entry, fileName)
    const nextEntry = {
      ...entry,
      originalName: nextRelativePath,
      relativePath: nextRelativePath,
      storageExtension: extname(nextRelativePath)
    }
    const previousPath = this.getAbsoluteEntryPath(entry)
    const nextPath = this.getAbsoluteEntryPath(nextEntry)
    await mkdir(dirname(nextPath), { recursive: true })
    await rename(previousPath, nextPath)
    this.setEntry(nextEntry)

    try {
      await this.persistScope(entry.scope)
      return nextEntry
    } catch (error) {
      await rename(nextPath, previousPath)
      this.setEntry(entry)
      throw error
    }
  }

  async renameProjectFolder(fileKey: string, folderName: string, scope?: WorkspaceScope): Promise<FileMapEntry> {
    const normalizedScope = normalizeScope(scope)
    const entry = this.resolveRenameEntry(fileKey, normalizedScope)
    if (entry.kind !== 'folder') {
      throw new WorkspaceRenameValidationError('Only tracked project folders support folder rename')
    }
    const currentRelativePath = getEntryRelativePath(entry)
    const currentFolderName = basename(currentRelativePath)
    const nextFolderName = normalizeRenameFileName(folderName, 'folder')
    this.assertRenameChangesTarget(currentFolderName, nextFolderName, 'folder')
    this.assertRenameIsNotCaseOnly(currentFolderName, nextFolderName, 'folder')
    const nextRelativePath = joinRelativePath(getRelativePathDirectory(currentRelativePath), nextFolderName)
    this.assertProjectRenameTargetAvailable(entry, nextRelativePath)

    const affectedEntries = this.listWorkspaceEntries(entry.scope)
      .filter(candidate => candidate.kind !== 'upload' && isDescendantPath(getEntryRelativePath(candidate), currentRelativePath))
    const nextEntries = affectedEntries.map(candidate => {
      const relativePath = replacePathPrefix(getEntryRelativePath(candidate), currentRelativePath, nextRelativePath)
      return {
        ...candidate,
        originalName: relativePath,
        relativePath,
        storageExtension: candidate.kind === 'folder' ? '' : extname(relativePath)
      }
    })
    const previousPath = this.getProjectEntryPath(entry)
    const nextPath = join(this.getProjectDir(entry.scope), ...splitRelativePath(nextRelativePath))
    await mkdir(dirname(nextPath), { recursive: true })
    await rename(previousPath, nextPath)
    nextEntries.forEach(nextEntry => this.setEntry(nextEntry))

    try {
      await this.persistScope(entry.scope)
      return nextEntries.find(candidate => candidate.fileKey === entry.fileKey) || entry
    } catch (error) {
      await rename(nextPath, previousPath)
      affectedEntries.forEach(previousEntry => this.setEntry(previousEntry))
      throw error
    }
  }

  async cleanupExpired(): Promise<void> {
    const now = Date.now()
    const expired: FileMapEntry[] = []

    for (const entry of this.entriesByKey.values()) {
      if (now - entry.createdAt > FILE_TTL_MS) {
        expired.push(entry)
      }
    }
    if (expired.length === 0) return

    const changedScopes = new Set<string>()
    for (const entry of expired) {
      const resolvedEntry = this.entriesByKey.get(entry.fileKey)
      if (!resolvedEntry) continue
      await this.removePathIfExists(this.getAbsoluteEntryPath(resolvedEntry), resolvedEntry.kind === 'folder')
      this.deleteEntry(resolvedEntry)
      changedScopes.add(scopeKey(resolvedEntry.scope))
    }

    for (const key of changedScopes) {
      const [userIdRaw, ...agentParts] = key.split(':')
      await this.persistScope({
        userId: Number(userIdRaw),
        agentId: agentParts.join(':')
      })
    }
  }

  private buildEntry(params: {
    fileId?: string
    kind: FileMapEntryKind
    relativePath: string
    storageExtension: string
    scope: WorkspaceScope
  }): FileMapEntry {
    return {
      fileKey: generateFileKey(new Set(this.entriesByKey.keys())),
      fileId: params.fileId || randomUUID(),
      createdAt: Date.now(),
      originalName: params.relativePath,
      storageExtension: params.storageExtension,
      kind: params.kind,
      relativePath: params.relativePath,
      scope: params.scope
    }
  }

  private async loadMaps(): Promise<void> {
    this.entriesByKey.clear()
    this.entriesByFileId.clear()
    if (!existsSync(this.usersDir)) return

    const userDirs = await readdir(this.usersDir, { withFileTypes: true })
    for (const userDir of userDirs) {
      if (!userDir.isDirectory()) continue
      const agentsDir = join(this.usersDir, userDir.name, AGENTS_DIR_NAME)
      if (!existsSync(agentsDir)) continue
      const agentDirs = await readdir(agentsDir, { withFileTypes: true })
      for (const agentDir of agentDirs) {
        if (!agentDir.isDirectory()) continue
        await this.loadScopeMap(join(agentsDir, agentDir.name, FILE_MAP_NAME))
      }
    }
  }

  private async loadScopeMap(mapPath: string): Promise<void> {
    if (!existsSync(mapPath)) return
    const raw = await readFile(mapPath, 'utf8')
    if (!raw.trim()) return
    const parsed = JSON.parse(raw) as Partial<FileMapFile>
    if (!this.isSupportedMap(parsed)) return

    const scope = normalizeScope(parsed.scope)
    for (const entry of parsed.entries || []) {
      if (!entry.fileKey || !entry.fileId || !entry.createdAt) continue
      const kind = entry.kind === 'folder'
        ? 'folder'
        : entry.kind === 'project'
          ? 'project'
          : 'upload'
      this.setEntry({
        ...entry,
        scope,
        kind,
        relativePath: this.normalizeStoredRelativePath(entry),
        storageExtension: this.resolveStorageExtension(entry, kind)
      })
    }
  }

  private isSupportedMap(parsed: Partial<FileMapFile>): parsed is FileMapFile {
    return Boolean(
      parsed.scope
      && Array.isArray(parsed.entries)
      && (
        parsed.version === FILE_MAP_VERSION
        || parsed.version === LEGACY_FILE_MAP_VERSION
        || parsed.version === LEGACY_FILE_MAP_VERSION_V3
      )
    )
  }

  private normalizeStoredRelativePath(entry: Partial<FileMapEntry>): string | undefined {
    if (typeof entry.relativePath === 'string' && entry.relativePath.trim()) {
      return normalizePathSeparators(entry.relativePath)
    }
    if (typeof entry.originalName === 'string' && entry.originalName.trim()) {
      return normalizePathSeparators(entry.originalName)
    }
    return undefined
  }

  private resolveStorageExtension(entry: Partial<FileMapEntry>, kind: FileMapEntryKind): string {
    if (typeof entry.storageExtension === 'string' && entry.storageExtension.trim()) {
      return entry.storageExtension
    }
    if (kind === 'folder') return ''
    const relativePath = typeof entry.relativePath === 'string' ? entry.relativePath : ''
    if (kind === 'project') {
      return extname(relativePath) || PROJECT_FILE_EXTENSION
    }
    return extname(entry.originalName || relativePath || '') || '.csv'
  }

  private async migrateLegacyUploadEntries(): Promise<void> {
    const changedScopes = new Set<string>()
    for (const entry of this.entriesByKey.values()) {
      if (entry.kind !== 'upload') continue
      const targetPath = this.getUploadEntryPath(entry)
      if (existsSync(targetPath)) continue

      const legacyPath = this.getLegacyUploadPath(entry.fileId, entry.storageExtension, entry.scope)
      if (!existsSync(legacyPath)) continue
      await mkdir(dirname(targetPath), { recursive: true })
      await rename(legacyPath, targetPath)
      changedScopes.add(scopeKey(entry.scope))
    }

    for (const key of changedScopes) {
      const [userIdRaw, ...agentParts] = key.split(':')
      await this.persistScope({ userId: Number(userIdRaw), agentId: agentParts.join(':') })
    }
  }

  private async ensureScopeDirs(scope: WorkspaceScope): Promise<void> {
    await mkdir(this.getWorkspaceRoot(scope), { recursive: true })
    await mkdir(this.getUploadDir(scope), { recursive: true })
    await mkdir(this.getProjectDir(scope), { recursive: true })
    await mkdir(this.getTempDir(scope), { recursive: true })
    await mkdir(this.getPlansDir(scope), { recursive: true })
  }

  private async persistScope(scope: WorkspaceScope): Promise<void> {
    await this.ensureScopeDirs(scope)
    const payload = toMapPayload(scope, this.listWorkspaceEntries(scope))
    await writeFile(this.getMapPath(scope), JSON.stringify(payload, null, 2), 'utf8')
  }

  private resolveRenameEntry(fileKey: string, scope: WorkspaceScope): FileMapEntry {
    const entry = this.resolveFileKey(fileKey)
    if (!entry || scopeKey(entry.scope) !== scopeKey(scope)) {
      throw new Error('File not found')
    }
    return entry
  }

  private buildFileRenameRelativePath(entry: FileMapEntry, fileName: string): string {
    const currentRelativePath = this.resolvePathAddressableRelativePath(entry)
    const currentFileName = basename(currentRelativePath)
    const nextFileName = normalizeRenameFileName(fileName, 'file')
    this.assertRenameChangesTarget(currentFileName, nextFileName, 'file')
    this.assertRenameKeepsExtension(currentFileName, nextFileName)
    this.assertRenameIsNotCaseOnly(currentFileName, nextFileName, 'file')
    const nextRelativePath = joinRelativePath(getRelativePathDirectory(currentRelativePath), nextFileName)
    this.assertRenameTargetAvailable(entry, nextRelativePath)
    return nextRelativePath
  }

  private resolvePathAddressableRelativePath(entry: FileMapEntry): string {
    if (entry.kind === 'project' && !entry.relativePath) {
      throw new WorkspaceRenameValidationError('Legacy project files do not support rename')
    }
    if (entry.kind === 'folder') {
      throw new WorkspaceRenameValidationError('Folder rename requires the project-folder API')
    }
    return getEntryRelativePath(entry)
  }

  private assertRenameChangesTarget(currentName: string, nextName: string, targetType: 'file' | 'folder'): void {
    if (currentName === nextName) {
      throw new WorkspaceRenameValidationError(`Workspace ${targetType} name is unchanged`)
    }
  }

  private assertRenameKeepsExtension(currentFileName: string, nextFileName: string): void {
    if (extname(currentFileName).toLowerCase() !== extname(nextFileName).toLowerCase()) {
      throw new WorkspaceRenameValidationError('Workspace rename must keep the existing extension')
    }
  }

  private assertRenameIsNotCaseOnly(currentName: string, nextName: string, targetType: 'file' | 'folder'): void {
    if (currentName.toLowerCase() === nextName.toLowerCase()) {
      throw new WorkspaceRenameValidationError(`Workspace ${targetType} rename does not support case-only changes`)
    }
  }

  private assertRenameTargetAvailable(entry: FileMapEntry, relativePath: string): void {
    const existing = this.findEntryByPath(entry.kind, relativePath, entry.scope)
    if (existing && existing.fileKey !== entry.fileKey) {
      throw new WorkspaceRenameConflictError(this.buildWorkspacePath(entry.kind, relativePath))
    }
    const existingFolder = this.findEntryByPath('folder', relativePath, entry.scope)
    if (existingFolder) {
      throw new WorkspaceRenameConflictError(this.buildWorkspacePath(existingFolder.kind, relativePath))
    }
  }

  private assertProjectRenameTargetAvailable(entry: FileMapEntry, relativePath: string): void {
    const projectEntry = this.findEntryByPath('project', relativePath, entry.scope)
    if (projectEntry && projectEntry.fileKey !== entry.fileKey) {
      throw new WorkspaceRenameConflictError(this.buildWorkspacePath(projectEntry.kind, relativePath))
    }
    const folderEntry = this.findEntryByPath('folder', relativePath, entry.scope)
    if (folderEntry && folderEntry.fileKey !== entry.fileKey) {
      throw new WorkspaceRenameConflictError(this.buildWorkspacePath(folderEntry.kind, relativePath))
    }
  }

  private async assertProjectParentExists(scope: WorkspaceScope, parentPath: string): Promise<void> {
    await this.ensureScopeDirs(scope)
    if (!parentPath) return
    const absolutePath = join(this.getProjectDir(scope), ...splitRelativePath(parentPath))
    try {
      const stats = await stat(absolutePath)
      if (!stats.isDirectory()) {
        throw new WorkspaceCreateValidationError('Project parent path must be a directory')
      }
    } catch (error) {
      if (isMissingFileError(error)) {
        throw new WorkspaceCreateValidationError('Project parent directory does not exist')
      }
      throw error
    }
  }

  private assertCreateTargetAvailable(relativePath: string, scope: WorkspaceScope): void {
    const fileEntry = this.findEntryByPath('project', relativePath, scope)
    if (fileEntry) {
      throw new WorkspaceCreateConflictError(this.buildWorkspacePath(fileEntry.kind, relativePath))
    }
    const folderEntry = this.findEntryByPath('folder', relativePath, scope)
    if (folderEntry) {
      throw new WorkspaceCreateConflictError(this.buildWorkspacePath(folderEntry.kind, relativePath))
    }
  }

  private allocateUniqueFileName(originalName: string, scope: WorkspaceScope): string {
    const normalizedName = originalName.trim() || '未命名.txt'
    const extension = extname(normalizedName)
    const baseName = extension ? basename(normalizedName, extension) : normalizedName
    const existingNames = new Set(this.listWorkspaceEntries(scope).map(entry => entry.originalName))
    if (!existingNames.has(normalizedName)) {
      return normalizedName
    }

    let index = 2
    while (index < MAX_CREATE_ATTEMPTS) {
      const candidate = buildCreateFileName(`${baseName}-${index}`, extension)
      if (!existingNames.has(candidate)) return candidate
      index += 1
    }
    throw new Error('Unable to allocate unique file name')
  }

  private getMapPath(scope: WorkspaceScope): string {
    return join(this.getWorkspaceRoot(scope), FILE_MAP_NAME)
  }

  private buildWorkspacePath(kind: FileMapEntryKind, relativePath: string): string {
    return `${toGroupPrefix(kind)}/${relativePath}`
  }

  private getAbsoluteEntryPath(entry: FileMapEntry): string {
    return entry.kind === 'upload' ? this.getUploadEntryPath(entry) : this.getProjectEntryPath(entry)
  }

  private findProjectEntryByFileId(fileId: string, scope: WorkspaceScope): FileMapEntry | null {
    const key = scopeKey(scope)
    for (const entry of this.entriesByKey.values()) {
      if (entry.fileId === fileId && entry.kind === 'project' && scopeKey(entry.scope) === key) {
        return entry
      }
    }
    return null
  }

  private findEntryByPath(kind: FileMapEntryKind, relativePath: string, scope: WorkspaceScope): FileMapEntry | null {
    const key = scopeKey(scope)
    for (const entry of this.entriesByKey.values()) {
      if (entry.kind !== kind) continue
      if ((entry.relativePath || entry.originalName) !== relativePath) continue
      if (scopeKey(entry.scope) === key) return entry
    }
    return null
  }

  private setEntry(entry: FileMapEntry): void {
    this.entriesByKey.set(entry.fileKey, entry)
    this.entriesByFileId.set(entry.fileId, entry)
  }

  private deleteEntry(entry: FileMapEntry): void {
    this.entriesByKey.delete(entry.fileKey)
    this.entriesByFileId.delete(entry.fileId)
  }

  private resolveEntriesForDeletion(entry: FileMapEntry): FileMapEntry[] {
    if (entry.kind !== 'folder') {
      return [entry]
    }
    const relativePath = getEntryRelativePath(entry)
    return this.listWorkspaceEntries(entry.scope)
      .filter(candidate => candidate.kind !== 'upload' && isDescendantPath(getEntryRelativePath(candidate), relativePath))
  }

  private async removePathIfExists(path: string, isDirectory: boolean): Promise<void> {
    try {
      const stats = await stat(path)
      if (isDirectory && stats.isDirectory()) {
        await rm(path, { recursive: true, force: true })
        return
      }
      if (!isDirectory && stats.isFile()) {
        await unlink(path)
      }
    } catch {
      // ignore missing files
    }
  }

  private async removeTrackedEntryPath(entry: FileMapEntry): Promise<void> {
    const absolutePath = this.getAbsoluteEntryPath(entry)
    try {
      const stats = await stat(absolutePath)
      if (entry.kind === 'folder') {
        if (!stats.isDirectory()) {
          throw new Error(`Workspace path is not a directory: ${absolutePath}`)
        }
        await rm(absolutePath, { recursive: true, force: true })
        return
      }
      if (!stats.isFile()) {
        throw new Error(`Workspace path is not a file: ${absolutePath}`)
      }
      await unlink(absolutePath)
    } catch (error) {
      if (isMissingFileError(error)) {
        return
      }
      throw error
    }
  }
}

export const fileStore = new FileStore()
