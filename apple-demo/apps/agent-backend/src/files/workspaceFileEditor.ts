import { readFile, writeFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { fileStore, type FileMapEntry } from './fileStore.js'

export type WorkspaceEditorMode = 'text' | 'markdown' | 'csv' | 'mml'

export interface WorkspaceMmlMetadata {
  networkType: string
  networkVersion: string
}

export interface WorkspaceFileOpenPayload {
  fileKey: string
  fileId: string
  fileName: string
  path: string
  source: 'upload' | 'project'
  writable: boolean
  mode: WorkspaceEditorMode
  content: string
  mmlMetadata: WorkspaceMmlMetadata | null
}

export interface WorkspaceFileSaveInput {
  content: string
  mode?: WorkspaceEditorMode
  mmlMetadata?: WorkspaceMmlMetadata | null
}

interface SkillArtifactPayload {
  kind: 'rows_result' | 'sheet_snapshot'
  data: {
    columns: unknown[]
    rows: unknown[]
    sheetName?: unknown
  }
}

const MML_HEADER_PATTERN = /^(\s*\/\*\s*ME TYPE=([^,\r\n*]+),\s*Version=([^*\r\n]+?)\s*\*\/)(\r?\n)?/i

export async function openWorkspaceFile(entry: FileMapEntry): Promise<WorkspaceFileOpenPayload> {
  if (entry.kind === 'folder') {
    throw new Error('Project folders cannot be opened as files.')
  }
  const source = entry.kind === 'upload' ? 'upload' : 'project'
  const path = fileStore.getWorkspaceRelativePath(entry)
  const writable = true

  if (entry.kind === 'project') {
    const artifactRaw = await readFile(fileStore.getProjectEntryPath(entry), 'utf8')
    if (entry.relativePath) {
      return buildTextPayload({
        fileKey: entry.fileKey,
        fileId: entry.fileId,
        fileName: entry.originalName,
        path,
        source,
        writable,
        content: artifactRaw
      })
    }
    const artifact = parseArtifactPayload(artifactRaw)
    if (artifact) {
      const content = serializeCsvArtifact(artifact.data.columns, artifact.data.rows)
      return {
        fileKey: entry.fileKey,
        fileId: entry.fileId,
        fileName: toDisplayName(entry.originalName, '.csv'),
        path,
        source,
        writable,
        mode: 'csv',
        content,
        mmlMetadata: null
      }
    }

    return buildTextPayload({
      fileKey: entry.fileKey,
      fileId: entry.fileId,
      fileName: entry.originalName,
      path,
      source,
      writable,
      content: artifactRaw
    })
  }

  const raw = await readFile(fileStore.getUploadEntryPath(entry), 'utf8')
  return buildTextPayload({
    fileKey: entry.fileKey,
    fileId: entry.fileId,
    fileName: entry.originalName,
    path,
    source,
    writable,
    content: raw
  })
}

export async function saveWorkspaceFile(entry: FileMapEntry, input: WorkspaceFileSaveInput): Promise<WorkspaceFileOpenPayload> {
  if (entry.kind === 'folder') {
    throw new Error('Project folders cannot be saved as files.')
  }
  const nextContent = normalizeSavedContent(input.content, input.mode, input.mmlMetadata)

  if (entry.kind === 'project' && !entry.relativePath && (input.mode || 'text') === 'csv') {
    const payload = parseCsvArtifact(nextContent)
    await writeFile(
      fileStore.getProjectEntryPath(entry),
      JSON.stringify(payload, null, 2),
      'utf8'
    )
  } else if (entry.kind === 'upload') {
    await writeFile(fileStore.getUploadEntryPath(entry), nextContent, 'utf8')
  } else {
    await writeFile(fileStore.getProjectEntryPath(entry), nextContent, 'utf8')
  }

  return openWorkspaceFile(entry)
}

function buildTextPayload(params: {
  fileKey: string
  fileId: string
  fileName: string
  path: string
  source: 'upload' | 'project'
  writable: boolean
  content: string
}): WorkspaceFileOpenPayload {
  const detected = detectFileMode(params.fileName, params.content)
  return {
    ...params,
    mode: detected.mode,
    content: params.content,
    mmlMetadata: detected.mmlMetadata
  }
}

function detectFileMode(fileName: string, content: string): {
  mode: WorkspaceEditorMode
  mmlMetadata: WorkspaceMmlMetadata | null
} {
  const extension = extname(fileName).toLowerCase()
  if (extension === '.csv') {
    return {
      mode: 'csv',
      mmlMetadata: null
    }
  }

  if (extension === '.md') {
    return {
      mode: 'markdown',
      mmlMetadata: null
    }
  }

  if (extension === '.mml') {
    return {
      mode: 'mml',
      mmlMetadata: parseMmlMetadata(content)
    }
  }

  const mmlMetadata = parseMmlMetadata(content)
  if (mmlMetadata) {
    return {
      mode: 'mml',
      mmlMetadata
    }
  }

  return {
    mode: 'text',
    mmlMetadata: null
  }
}

export function parseMmlMetadata(content: string): WorkspaceMmlMetadata | null {
  const match = content.match(MML_HEADER_PATTERN)
  if (!match) return null
  return {
    networkType: match[2]?.trim() || '',
    networkVersion: match[3]?.trim() || ''
  }
}

function normalizeSavedContent(
  content: string,
  mode?: WorkspaceEditorMode,
  mmlMetadata?: WorkspaceMmlMetadata | null
): string {
  if (mode !== 'mml') {
    return content
  }

  const normalizedMetadata = normalizeMmlMetadata(mmlMetadata) || parseMmlMetadata(content)
  if (!normalizedMetadata) {
    return content
  }
  return upsertMmlHeader(content, normalizedMetadata)
}

function normalizeMmlMetadata(metadata?: WorkspaceMmlMetadata | null): WorkspaceMmlMetadata | null {
  if (!metadata) return null
  const networkType = metadata.networkType.trim()
  const networkVersion = metadata.networkVersion.trim()
  if (!networkType || !networkVersion) return null
  return { networkType, networkVersion }
}

function upsertMmlHeader(content: string, metadata: WorkspaceMmlMetadata): string {
  const header = `/* ME TYPE=${metadata.networkType}, Version=${metadata.networkVersion} */`
  if (MML_HEADER_PATTERN.test(content)) {
    return content.replace(MML_HEADER_PATTERN, (_match, _full, _type, _version, lineBreak) => `${header}${lineBreak || '\n'}`)
  }
  return `${header}\n${content}`
}

function parseArtifactPayload(raw: string): SkillArtifactPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<SkillArtifactPayload>
    if (!parsed || typeof parsed !== 'object') return null
    if ((parsed.kind !== 'rows_result' && parsed.kind !== 'sheet_snapshot') || !parsed.data) return null
    if (!Array.isArray(parsed.data.columns) || !Array.isArray(parsed.data.rows)) return null
    return {
      kind: parsed.kind,
      data: {
        columns: parsed.data.columns,
        rows: parsed.data.rows,
        sheetName: parsed.data.sheetName
      }
    }
  } catch {
    return null
  }
}

function serializeCsvArtifact(columns: unknown[], rows: unknown[]): string {
  const normalizedColumns = columns.map(value => String(value))
  const normalizedRows = rows.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      return normalizedColumns.map(() => '')
    }
    return normalizedColumns.map(column => stringifyCsvCell((row as Record<string, unknown>)[column]))
  })
  return [normalizedColumns, ...normalizedRows]
    .map(row => row.map(escapeCsvCell).join(','))
    .join('\n')
}

function parseCsvArtifact(content: string): SkillArtifactPayload {
  const rows = parseCsv(content)
  const headers = rows[0] || []
  return {
    kind: 'rows_result',
    data: {
      columns: headers,
      rows: rows.slice(1).map(row => {
        const record: Record<string, string> = {}
        headers.forEach((header, index) => {
          record[header] = row[index] || ''
        })
        return record
      })
    }
  }
}

function stringifyCsvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function escapeCsvCell(value: string): string {
  if (!/[,"\n\r]/.test(value)) return value
  return `"${value.replace(/"/g, '""')}"`
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]
    const nextChar = content[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(cell)
      cell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1
      }
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows
}

function toDisplayName(fileName: string, extension: string): string {
  return fileName.endsWith('.json')
    ? fileName.replace(/\.json$/i, extension)
    : fileName
}
