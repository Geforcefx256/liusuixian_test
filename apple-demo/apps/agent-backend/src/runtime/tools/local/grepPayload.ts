import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const DEFAULT_CONTEXT = 0

export interface SearchMatch {
  path: string
  line: number
  column: number
  snippet: string
}

export interface RgMatch {
  path: string
  line: number
  column: number
}

export async function buildSnippets(
  basePath: string,
  matches: RgMatch[],
  context: number
): Promise<SearchMatch[]> {
  const fileCache = new Map<string, string[]>()
  const results: SearchMatch[] = []

  for (const match of matches) {
    let lines = fileCache.get(match.path)
    if (lines === undefined) {
      lines = await readFileLines(path.join(basePath, match.path))
      fileCache.set(match.path, lines)
    }
    results.push({
      path: match.path,
      line: match.line,
      column: match.column,
      snippet: formatSnippet(match.path, lines, match.line, context)
    })
  }

  return results
}

export function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_LIMIT
  }
  return Math.min(Math.floor(limit), MAX_LIMIT)
}

export function normalizeContext(context: number | undefined): number {
  if (context === undefined || !Number.isFinite(context) || context < DEFAULT_CONTEXT) {
    return DEFAULT_CONTEXT
  }
  return Math.floor(context)
}

export function buildSearchPayload(
  pattern: string,
  basePath: string,
  glob: string,
  matches: SearchMatch[],
  truncated: boolean
): string {
  return JSON.stringify({
    success: true,
    type: 'search_results',
    engine: 'vendored-rg',
    pattern,
    basePath,
    glob,
    matches,
    totalReturned: matches.length,
    truncated
  }, null, 2)
}

async function readFileLines(absolutePath: string): Promise<string[]> {
  const content = await fs.readFile(absolutePath, 'utf-8')
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
}

function formatSnippet(displayPath: string, lines: string[], line: number, context: number): string {
  const start = Math.max(1, line - context)
  const end = Math.min(lines.length, line + context)
  const output: string[] = []

  for (let current = start; current <= end; current += 1) {
    const separator = current === line ? ':' : '-'
    output.push(`${displayPath}${separator}${current}${separator} ${lines[current - 1]}`)
  }

  return output.join('\n')
}
