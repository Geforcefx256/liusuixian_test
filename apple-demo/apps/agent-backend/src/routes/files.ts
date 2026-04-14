import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { requireUser, type AuthenticatedRequest } from '../auth/requireUser.js'
import {
  fileStore,
  type WorkspaceScope,
  WorkspaceCreateConflictError,
  WorkspaceCreateValidationError,
  WorkspaceRenameConflictError,
  WorkspaceRenameValidationError,
  WorkspaceUploadConflictError
} from '../files/fileStore.js'
import {
  normalizeUploadedText,
  UnsupportedUploadEncodingError
} from '../files/uploadTextNormalizer.js'
import { openWorkspaceFile, saveWorkspaceFile } from '../files/workspaceFileEditor.js'

const ALLOWED_EXTENSIONS = new Set(['.txt', '.md', '.csv'])
const UTF8_UPLOAD_OPTIONS: multer.Options & { defParamCharset: 'utf8' } = {
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8',
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (!isAllowedFile(file)) {
      cb(new Error('Only TXT/MD/CSV files are allowed'))
      return
    }
    cb(null, true)
  }
}

function resolveStorageExtension(originalName: string): string {
  const normalized = originalName.toLowerCase()
  if (normalized.endsWith('.tar.gz')) return '.tar.gz'
  const dotIndex = normalized.lastIndexOf('.')
  return dotIndex >= 0 ? normalized.slice(dotIndex) : ''
}

function isAllowedFile(file: Express.Multer.File): boolean {
  return ALLOWED_EXTENSIONS.has(resolveStorageExtension(file.originalname))
}

function resolveAgentId(req: Request): string {
  const raw = typeof req.query.agentId === 'string' ? req.query.agentId : ''
  const agentId = raw.trim()
  if (!agentId) {
    throw new Error('Missing agentId')
  }
  return agentId
}

function resolveScope(req: AuthenticatedRequest): WorkspaceScope {
  const userId = req.auth?.userId
  if (!userId) {
    throw new Error('Unauthorized')
  }
  return {
    userId,
    agentId: resolveAgentId(req)
  }
}

function matchesScope(entry: { scope: WorkspaceScope }, scope: WorkspaceScope): boolean {
  return entry.scope.userId === scope.userId && entry.scope.agentId === scope.agentId
}

function resolveDownloadFileName(originalName: string): string {
  const normalized = basename(originalName.trim())
  if (!normalized) {
    throw new Error('Invalid download file name')
  }
  return normalized
}

function isMissingStorageError(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
}

function resolveEntryPath(entry: Parameters<typeof fileStore.getWorkspaceRelativePath>[0]): string {
  return entry.kind === 'upload' ? fileStore.getUploadEntryPath(entry) : fileStore.getProjectEntryPath(entry)
}

function resolveRenameFileName(body: unknown): string {
  const fileName = typeof (body as { fileName?: unknown })?.fileName === 'string'
    ? (body as { fileName: string }).fileName.trim()
    : ''
  if (!fileName) {
    throw new Error('Missing fileName')
  }
  return fileName
}

function resolveOptionalRelativePath(body: unknown): string | undefined {
  const relativePath = typeof (body as { relativePath?: unknown })?.relativePath === 'string'
    ? (body as { relativePath: string }).relativePath.trim()
    : ''
  return relativePath || undefined
}

function resolveProjectCreateRequest(body: unknown): {
  kind: 'folder' | 'txt' | 'md' | 'mml'
  fileName: string
  parentPath?: string
} {
  const kind = typeof (body as { kind?: unknown })?.kind === 'string'
    ? (body as { kind: string }).kind.trim()
    : ''
  const fileName = typeof (body as { fileName?: unknown })?.fileName === 'string'
    ? (body as { fileName: string }).fileName.trim()
    : ''
  const parentPath = typeof (body as { parentPath?: unknown })?.parentPath === 'string'
    ? (body as { parentPath: string }).parentPath.trim()
    : ''
  if (kind !== 'folder' && kind !== 'txt' && kind !== 'md' && kind !== 'mml') {
    throw new Error('Invalid project create kind')
  }
  if (!fileName) {
    throw new Error('Missing fileName')
  }
  return {
    kind,
    fileName,
    ...(parentPath ? { parentPath } : {})
  }
}

function resolveProjectFileName(kind: 'folder' | 'txt' | 'md' | 'mml', fileName: string): string {
  if (kind === 'folder') return fileName
  if (fileName.includes('.')) return fileName
  const extension = kind === 'txt' ? '.txt' : kind === 'md' ? '.md' : '.mml'
  return `${fileName}${extension}`
}

export function createFilesRouter(): Router {
  const router = Router()
  router.use(requireUser)
  const upload = multer(UTF8_UPLOAD_OPTIONS)

  router.post('/upload', upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'Missing upload record' })
      return
    }
    try {
      const scope = resolveScope(req)
      const overwrite = String(req.query.overwrite || '').trim() === 'true'
      const normalizedUpload = normalizeUploadedText(req.file.buffer)
      const result = await fileStore.writeUpload({
        originalName: req.file.originalname,
        relativePath: resolveOptionalRelativePath(req.body),
        storageExtension: resolveStorageExtension(req.file.originalname),
        content: Buffer.from(normalizedUpload.content, 'utf8'),
        scope,
        overwrite
      })
      res.json({
        fileKey: result.entry.fileKey,
        originalName: result.entry.originalName,
        path: fileStore.getWorkspaceRelativePath(result.entry),
        source: 'upload',
        writable: true,
        replaced: result.replaced
      })
    } catch (error) {
      if (error instanceof WorkspaceUploadConflictError) {
        res.status(409).json({
          error: `Upload already exists: ${error.relativePath}`,
          code: 'UPLOAD_CONFLICT',
          path: error.relativePath
        })
        return
      }
      if (error instanceof UnsupportedUploadEncodingError) {
        res.status(415).json({
          error: error.message,
          code: error.code
        })
        return
      }
      const message = error instanceof Error ? error.message : 'Upload failed'
      res.status(400).json({ error: message })
    }
  })

  router.get('/:fileId/content', async (req: AuthenticatedRequest, res: Response) => {
    const fileId = String(req.params.fileId || '').trim()
    if (!fileId) {
      res.status(400).json({ error: 'Missing fileId' })
      return
    }
    const entry = fileStore.resolveFileId(fileId)
    if (!entry || entry.kind !== 'project' || entry.scope.userId !== req.auth?.userId) {
      res.status(404).json({ error: 'File not found' })
      return
    }
    const projectPath = fileStore.getProjectEntryPath(entry)
    try {
      const content = await readFile(projectPath, 'utf8')
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.send(content)
    } catch {
      res.status(404).json({ error: 'File not found' })
    }
  })

  router.get('/:fileKey', async (req: AuthenticatedRequest, res: Response) => {
    const fileKey = String(req.params.fileKey || '').trim()
    if (!fileKey) {
      res.status(400).json({ error: 'Missing fileKey' })
      return
    }
    const entry = fileStore.resolveFileKey(fileKey)
    if (!entry || entry.scope.userId !== req.auth?.userId) {
      res.status(404).json({ error: 'File not found' })
      return
    }

    try {
      const file = await openWorkspaceFile(entry)
      res.json({ ok: true, file })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'File not found'
      res.status(404).json({ error: message })
    }
  })

  router.get('/:fileKey/download', async (req: AuthenticatedRequest, res: Response) => {
    const fileKey = String(req.params.fileKey || '').trim()
    if (!fileKey) {
      res.status(400).json({ error: 'Missing fileKey' })
      return
    }

    let scope: WorkspaceScope
    try {
      scope = resolveScope(req)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized'
      res.status(400).json({ error: message })
      return
    }

    const entry = fileStore.resolveFileKey(fileKey)
    if (!entry || !matchesScope(entry, scope)) {
      res.status(404).json({ error: 'File not found' })
      return
    }
    if (entry.kind === 'folder') {
      res.status(400).json({ error: 'Project folders cannot be downloaded as files' })
      return
    }

    try {
      const content = await readFile(resolveEntryPath(entry))
      res.attachment(resolveDownloadFileName(entry.originalName))
      res.send(content)
    } catch (error) {
      if (isMissingStorageError(error)) {
        res.status(404).json({ error: 'File content missing' })
        return
      }
      const message = error instanceof Error ? error.message : 'Failed to download file'
      res.status(500).json({ error: message })
    }
  })

  router.post('/project', async (req: AuthenticatedRequest, res: Response) => {
    let scope: WorkspaceScope
    let request: ReturnType<typeof resolveProjectCreateRequest>
    try {
      scope = resolveScope(req)
      request = resolveProjectCreateRequest(req.body)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid project create request'
      res.status(400).json({ error: message })
      return
    }

    try {
      if (request.kind === 'folder') {
        const folder = await fileStore.createProjectFolder(request.parentPath, request.fileName, scope)
        res.status(201).json({
          ok: true,
          entry: {
            nodeId: folder.fileKey,
            folderKey: folder.fileKey,
            nodeType: 'folder',
            fileName: folder.originalName,
            relativePath: folder.relativePath || folder.originalName,
            path: fileStore.getWorkspaceRelativePath(folder),
            source: 'project',
            groupId: 'project',
            writable: true,
            addedAt: folder.createdAt
          }
        })
        return
      }

      const fileName = resolveProjectFileName(request.kind, request.fileName)
      const entry = await fileStore.createProjectFile(request.parentPath, fileName, scope)
      const file = await openWorkspaceFile(entry)
      res.status(201).json({ ok: true, file })
    } catch (error) {
      if (error instanceof WorkspaceCreateConflictError) {
        res.status(409).json({
          error: error.message,
          code: 'WORKSPACE_CREATE_CONFLICT',
          path: error.relativePath
        })
        return
      }
      const message = error instanceof Error ? error.message : 'Failed to create project entry'
      const status = error instanceof WorkspaceCreateValidationError ? 400 : 500
      res.status(status).json({ error: message })
    }
  })

  router.patch('/project/folders/:folderKey/rename', async (req: AuthenticatedRequest, res: Response) => {
    const folderKey = String(req.params.folderKey || '').trim()
    if (!folderKey) {
      res.status(400).json({ error: 'Missing folderKey' })
      return
    }

    let scope: WorkspaceScope
    let fileName: string
    try {
      scope = resolveScope(req)
      fileName = resolveRenameFileName(req.body)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid folder rename request'
      res.status(400).json({ error: message })
      return
    }

    try {
      const entry = await fileStore.renameProjectFolder(folderKey, fileName, scope)
      res.json({
        ok: true,
        entry: {
          nodeId: entry.fileKey,
          folderKey: entry.fileKey,
          nodeType: 'folder',
          fileName: entry.originalName,
          relativePath: entry.relativePath || entry.originalName,
          path: fileStore.getWorkspaceRelativePath(entry),
          source: 'project',
          groupId: 'project',
          writable: true,
          addedAt: entry.createdAt
        }
      })
    } catch (error) {
      if (error instanceof WorkspaceRenameConflictError) {
        res.status(409).json({
          error: error.message,
          code: 'WORKSPACE_RENAME_CONFLICT',
          path: error.relativePath
        })
        return
      }
      const message = error instanceof Error ? error.message : 'Failed to rename folder'
      const status = message === 'File not found'
        ? 404
        : error instanceof WorkspaceRenameValidationError
          ? 400
          : 500
      res.status(status).json({ error: message })
    }
  })

  router.put('/:fileKey', async (req: AuthenticatedRequest, res: Response) => {
    const fileKey = String(req.params.fileKey || '').trim()
    if (!fileKey) {
      res.status(400).json({ error: 'Missing fileKey' })
      return
    }
    const content = typeof req.body?.content === 'string' ? req.body.content : null
    if (content === null) {
      res.status(400).json({ error: 'Missing content' })
      return
    }
    const entry = fileStore.resolveFileKey(fileKey)
    if (!entry || entry.scope.userId !== req.auth?.userId) {
      res.status(404).json({ error: 'File not found' })
      return
    }

    const mode = req.body?.mode === 'csv'
      || req.body?.mode === 'mml'
      || req.body?.mode === 'text'
      || req.body?.mode === 'markdown'
      ? req.body.mode
      : undefined
    const mmlMetadata = req.body?.mmlMetadata && typeof req.body.mmlMetadata === 'object'
      ? {
          networkType: typeof req.body.mmlMetadata.networkType === 'string' ? req.body.mmlMetadata.networkType : '',
          networkVersion: typeof req.body.mmlMetadata.networkVersion === 'string' ? req.body.mmlMetadata.networkVersion : ''
        }
      : undefined

    try {
      const file = await saveWorkspaceFile(entry, {
        content,
        mode,
        mmlMetadata
      })
      res.json({ ok: true, file })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save file'
      res.status(400).json({ error: message })
    }
  })

  router.patch('/:fileKey/rename', async (req: AuthenticatedRequest, res: Response) => {
    const fileKey = String(req.params.fileKey || '').trim()
    if (!fileKey) {
      res.status(400).json({ error: 'Missing fileKey' })
      return
    }

    let scope: WorkspaceScope
    let fileName: string
    try {
      scope = resolveScope(req)
      fileName = resolveRenameFileName(req.body)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid rename request'
      res.status(400).json({ error: message })
      return
    }

    try {
      const entry = await fileStore.renameWorkspaceEntry(fileKey, fileName, scope)
      const file = await openWorkspaceFile(entry)
      res.json({ ok: true, file })
    } catch (error) {
      if (error instanceof WorkspaceRenameConflictError) {
        res.status(409).json({
          error: error.message,
          code: 'WORKSPACE_RENAME_CONFLICT',
          path: error.relativePath
        })
        return
      }
      const message = error instanceof Error ? error.message : 'Failed to rename file'
      const status = message === 'File not found'
        ? 404
        : error instanceof WorkspaceRenameValidationError
          ? 400
          : 500
      res.status(status).json({ error: message })
    }
  })

  router.delete('/:fileKey', async (req: AuthenticatedRequest, res: Response) => {
    const fileKey = String(req.params.fileKey || '').trim()
    if (!fileKey) {
      res.status(400).json({ error: 'Missing fileKey' })
      return
    }

    let scope: WorkspaceScope
    try {
      scope = resolveScope(req)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized'
      res.status(400).json({ error: message })
      return
    }

    const entry = fileStore.resolveFileKey(fileKey)
    if (!entry || !matchesScope(entry, scope)) {
      res.status(404).json({ error: 'File not found' })
      return
    }

    try {
      await fileStore.deleteWorkspaceEntry(fileKey, scope)
      res.json({ ok: true, fileKey })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete file'
      res.status(500).json({ error: message })
    }
  })

  router.use((err: unknown, _req: Request, res: Response, _next: () => void) => {
    const message = err instanceof Error ? err.message : 'Upload failed'
    res.status(400).json({ error: message })
  })

  return router
}
