import { basename, resolve } from 'node:path'
import { readFile } from 'node:fs/promises'

import type {
  MmlFileQueryCondition,
  MmlFileQueryResult,
  MmlFileQueryRow,
  WorkspaceMmlMetadata
} from './contracts.js'
import {
  normalizeCommandHead,
  normalizeIdentifier,
  parseMmlDocument
} from './semantics.js'

const MML_HEADER_PATTERN = /^(\s*\/\*\s*ME TYPE=([^,\r\n*]+),\s*Version=([^*\r\n]+?)\s*\*\/)(\r?\n)?/i

export interface MmlFileQueryOptions {
  filePath: string
  commandName: string
  where?: MmlFileQueryCondition[]
  selectParamName?: string | null
  textOnly?: boolean
  limit?: number | null
  caseSensitiveValues?: boolean
}

export async function queryMmlFile(options: MmlFileQueryOptions): Promise<MmlFileQueryResult> {
  const content = await readFile(resolve(options.filePath), 'utf8')
  return queryMmlContent(content, options)
}

export function queryMmlContent(content: string, options: MmlFileQueryOptions): MmlFileQueryResult {
  const parsed = parseMmlDocument(content)
  const normalizedCommand = normalizeCommandHead(options.commandName)
  const normalizedSelect = options.selectParamName ? normalizeIdentifier(options.selectParamName) : ''
  const conditions = (options.where || []).map(condition => ({
    paramName: normalizeIdentifier(condition.paramName),
    expectedValue: condition.expectedValue,
    normalizedValue: options.caseSensitiveValues ? condition.expectedValue : condition.expectedValue.toLowerCase()
  }))
  const limit = options.limit && options.limit > 0 ? options.limit : null

  const matches: MmlFileQueryRow[] = []
  const texts: string[] = []

  for (let index = 0; index < parsed.statements.length; index += 1) {
    const statement = parsed.statements[index]
    if (statement.commandHead !== normalizedCommand) {
      continue
    }
    if (!matchesConditions(statement.params, conditions, options.caseSensitiveValues === true)) {
      continue
    }

    const text = statement.text.trim()
    if (options.textOnly) {
      texts.push(text)
    } else {
      const row: MmlFileQueryRow = {
        i: index + 1,
        text
      }
      if (normalizedSelect) {
        const selected = statement.params.find(param => param.paramName === normalizedSelect) || null
        row.v = selected ? selected.displayValue : null
      }
      matches.push(row)
    }

    if (limit !== null && (options.textOnly ? texts.length : matches.length) >= limit) {
      break
    }
  }

  const result: MmlFileQueryResult = {
    file: basename(options.filePath),
    cmd: normalizedCommand,
    n: options.textOnly ? texts.length : matches.length
  }
  if (normalizedSelect) {
    result.sel = normalizedSelect
  }
  if (options.textOnly) {
    result.texts = texts
  } else {
    result.rows = matches
  }
  return result
}

export function parseMmlMetadata(content: string): WorkspaceMmlMetadata | null {
  const match = content.match(MML_HEADER_PATTERN)
  if (!match) {
    return null
  }
  return {
    networkType: match[2]?.trim() || '',
    networkVersion: match[3]?.trim() || ''
  }
}

function matchesConditions(
  params: Array<{ paramName: string; displayValue: string }>,
  conditions: Array<{ paramName: string; expectedValue: string; normalizedValue: string }>,
  caseSensitiveValues: boolean
): boolean {
  return conditions.every(condition => {
    const param = params.find(item => item.paramName === condition.paramName)
    if (!param) {
      return false
    }
    return caseSensitiveValues
      ? param.displayValue === condition.expectedValue
      : param.displayValue.toLowerCase() === condition.normalizedValue
  })
}
