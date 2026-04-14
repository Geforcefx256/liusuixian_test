import fs from 'node:fs/promises'
import path from 'node:path'
import { collectFiles } from '../local/shared/fileWalker.js'
import { matchesGlobPattern } from '../local/shared/globUtils.js'
import { readDirectoryEntries } from '../local/shared/pathUtils.js'
import { detectBinary, normalizeLimit, normalizeOffset } from '../local/shared/textUtils.js'

const FIND_ASSETS_DEFAULT_LIMIT = 100
const FIND_ASSETS_MAX_LIMIT = 500
const SKILL_MANIFEST_FILE = 'SKILL.md'
const SKILL_MANIFEST_READ_ERROR = 'Direct SKILL.md reads are not allowed. Use the skill tool instead.'

export interface ReadSkillAssetArgs {
  path: string
  offset?: number
  limit?: number
}

export interface ListSkillAssetsArgs {
  path: string
}

export interface FindSkillAssetsArgs {
  pattern: string
  basePath?: string
  limit?: number
}

export const readAssetInputSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    skillName: {
      type: 'string',
      description: 'Approved skill name or id that owns the target asset.'
    },
    path: {
      type: 'string',
      description: 'Skill-relative file path to read from the approved skill package.'
    },
    offset: {
      type: 'integer',
      minimum: 0,
      description: 'Optional zero-based line offset.'
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: FIND_ASSETS_MAX_LIMIT,
      description: 'Optional max lines to return.'
    }
  },
  required: ['skillName', 'path']
}

export const listAssetsInputSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    skillName: {
      type: 'string',
      description: 'Approved skill name or id that owns the target directory.'
    },
    path: {
      type: 'string',
      description: 'Skill-relative directory path to list within the approved skill package.'
    }
  },
  required: ['skillName', 'path']
}

export const findAssetsInputSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    skillName: {
      type: 'string',
      description: 'Approved skill name or id to search within.'
    },
    pattern: {
      type: 'string',
      description: 'Filename or glob pattern to find within the skill package.'
    },
    basePath: {
      type: 'string',
      description: 'Optional skill-relative directory to search from. Default ".".'
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: FIND_ASSETS_MAX_LIMIT,
      description: `Optional max number of matches. Default ${FIND_ASSETS_DEFAULT_LIMIT}, max ${FIND_ASSETS_MAX_LIMIT}.`
    }
  },
  required: ['skillName', 'pattern']
}

export async function readSkillAsset(skillBaseDir: string, args: ReadSkillAssetArgs): Promise<string> {
  const safePath = resolveSkillAssetPath(skillBaseDir, args.path, 'path')
  assertReadableSkillAssetPath(safePath.relativePath)
  const stats = await statSkillAssetPath(safePath.absolutePath, safePath.relativePath, 'File')
  if (stats.isDirectory()) {
    throw new Error('Path is a directory. Use list_assets instead.')
  }

  const content = await readTextSkillAsset(safePath.absolutePath, safePath.relativePath)
  if (detectBinary(content)) {
    throw new Error('Cannot read binary file content. Only text files are supported.')
  }

  return buildAssetFilePayload(safePath.relativePath, content, normalizeOffset(args.offset), normalizeLimit(args.limit))
}

export async function listSkillAssets(skillBaseDir: string, args: ListSkillAssetsArgs): Promise<string> {
  const safePath = resolveSkillAssetPath(skillBaseDir, args.path, 'path')
  const stats = await statSkillAssetPath(safePath.absolutePath, safePath.relativePath, 'Path')
  if (!stats.isDirectory()) {
    throw new Error('Path is not a directory. Use read_asset instead.')
  }

  const entries = await readDirectoryEntries(safePath.absolutePath)
  return JSON.stringify({
    success: true,
    type: 'directory',
    path: safePath.relativePath,
    entries
  }, null, 2)
}

export async function findSkillAssets(skillBaseDir: string, args: FindSkillAssetsArgs): Promise<string> {
  const pattern = requireNonEmptyString(args.pattern, 'pattern')
  const basePath = resolveSkillAssetPath(skillBaseDir, args.basePath || '.', 'basePath')
  const stats = await statSkillAssetPath(basePath.absolutePath, basePath.relativePath, 'Path')
  if (!stats.isDirectory()) {
    throw new Error('Path is not a directory. Use read_asset instead.')
  }

  const limit = normalizeFindLimit(args.limit)
  const files = await collectFiles(basePath.absolutePath)
  const matches = collectMatches(files, basePath.relativePath, pattern, limit)

  return JSON.stringify({
    success: true,
    type: 'search_results',
    engine: 'node-glob',
    pattern,
    basePath: basePath.relativePath,
    matches: matches.items,
    totalReturned: matches.items.length,
    truncated: matches.truncated
  }, null, 2)
}

function resolveSkillAssetPath(skillBaseDir: string, inputPath: string, fieldName: string): {
  absolutePath: string
  relativePath: string
} {
  const trimmedPath = requireNonEmptyString(inputPath, fieldName)
  const absolutePath = path.resolve(skillBaseDir, trimmedPath)
  const relativePath = path.relative(skillBaseDir, absolutePath).replace(/\\/g, '/')
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Path is outside skill boundary (outside workspace).')
  }
  return {
    absolutePath,
    relativePath: relativePath || '.'
  }
}

async function statSkillAssetPath(
  absolutePath: string,
  displayPath: string,
  subject: 'File' | 'Path'
) {
  try {
    return await fs.stat(absolutePath)
  } catch (error) {
    if (isMissingPathError(error)) {
      const prefix = subject === 'File' ? 'File not found' : 'Path not found'
      throw new Error(`${prefix}: ${displayPath}. Use find_assets if you only know the filename.`)
    }
    throw error
  }
}

async function readTextSkillAsset(absolutePath: string, displayPath: string): Promise<string> {
  try {
    return await fs.readFile(absolutePath, 'utf-8')
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new Error(`File not found: ${displayPath}. Use find_assets if you only know the filename.`)
    }
    throw error
  }
}

function requireNonEmptyString(value: string, fieldName: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) {
    throw new Error(`${fieldName} is required`)
  }
  return trimmed
}

function normalizeFindLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit) || limit <= 0) {
    return FIND_ASSETS_DEFAULT_LIMIT
  }
  return Math.min(Math.floor(limit), FIND_ASSETS_MAX_LIMIT)
}

function collectMatches(
  files: string[],
  basePath: string,
  pattern: string,
  limit: number
): { items: string[]; truncated: boolean } {
  const items: string[] = []
  for (const file of files) {
    if (!matchesGlobPattern(file, pattern)) {
      continue
    }
    if (items.length >= limit) {
      return { items, truncated: true }
    }
    items.push(toSkillRelativePath(basePath, file))
  }
  return { items, truncated: false }
}

function toSkillRelativePath(basePath: string, file: string): string {
  return basePath === '.' ? file : path.posix.join(basePath, file)
}

function buildAssetFilePayload(filePath: string, content: string, offset: number, limit: number): string {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const startOffset = Math.min(offset, lines.length)
  const nextOffset = Math.min(startOffset + limit, lines.length)
  const selected = lines.slice(startOffset, nextOffset)
  return JSON.stringify({
    success: true,
    type: 'file',
    path: filePath,
    startLine: selected.length > 0 ? startOffset + 1 : startOffset,
    endLine: selected.length > 0 ? startOffset + selected.length : startOffset,
    totalLines: lines.length,
    hasMore: nextOffset < lines.length,
    nextOffset: nextOffset < lines.length ? nextOffset : null,
    continuationHint: nextOffset < lines.length ? `Call read_asset again with offset=${nextOffset}.` : 'EOF reached.',
    content: selected.map((line, index) => `${startOffset + index + 1} | ${line}`).join('\n')
  }, null, 2)
}

function assertReadableSkillAssetPath(relativePath: string): void {
  if (!isSkillManifestPath(relativePath)) {
    return
  }
  throw new Error(SKILL_MANIFEST_READ_ERROR)
}

function isSkillManifestPath(relativePath: string): boolean {
  return relativePath.toLowerCase() === SKILL_MANIFEST_FILE.toLowerCase()
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
