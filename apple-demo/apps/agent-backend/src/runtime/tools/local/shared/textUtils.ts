const DEFAULT_OFFSET = 0
const DEFAULT_LIMIT = 200
const MAX_LIMIT = 500
const BINARY_SCAN_BYTES = 4096
const LF = '\n'
const CR = '\r'
const CRLF = '\r\n'

export type DominantLineEnding = typeof LF | typeof CRLF

export function detectBinary(content: string): boolean {
  return content.slice(0, BINARY_SCAN_BYTES).includes(String.fromCharCode(0))
}

export function normalizeOffset(offset: number | undefined): number {
  if (offset === undefined || !Number.isFinite(offset) || offset < DEFAULT_OFFSET) {
    return DEFAULT_OFFSET
  }
  return Math.floor(offset)
}

export function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_LIMIT
  }
  return Math.min(Math.floor(limit), MAX_LIMIT)
}

export function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, LF).replace(/\r/g, LF)
}

export function detectDominantLineEnding(content: string): DominantLineEnding {
  let crlfCount = 0
  let lfCount = 0

  for (let index = 0; index < content.length; index += 1) {
    if (content[index] !== CR) {
      if (content[index] === LF) {
        lfCount += 1
      }
      continue
    }
    if (content[index + 1] === LF) {
      crlfCount += 1
      index += 1
      continue
    }
    lfCount += 1
  }

  return crlfCount > lfCount ? CRLF : LF
}

export function restoreLineEndings(content: string, lineEnding: DominantLineEnding): string {
  const normalized = normalizeLineEndings(content)
  if (lineEnding === LF) {
    return normalized
  }
  return normalized.replace(/\n/g, CRLF)
}

export function buildFilePayload(filePath: string, content: string, offset: number, limit: number): string {
  const lines = normalizeLineEndings(content).split(LF)
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
    continuationHint: nextOffset < lines.length ? `Call read_file again with offset=${nextOffset}.` : 'EOF reached.',
    content: selected.map((line, index) => `${startOffset + index + 1} | ${line}`).join(LF)
  }, null, 2)
}
