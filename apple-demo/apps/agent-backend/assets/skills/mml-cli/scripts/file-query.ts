import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import path from 'node:path'
import { queryMmlFile } from '../../../../../../cli-tools/mml/src/core/instances.js'
import { parseMmlDocument, normalizeCommandHead } from '../../../../../../cli-tools/mml/src/core/semantics.js'
import type { MmlFileQueryCondition } from '../../../../../../cli-tools/mml/src/core/contracts.js'

interface FileQueryArgs {
  file: string
  commandNames?: string[]
  where?: MmlFileQueryCondition[]
  select?: string
  textOnly?: boolean
  limit?: number
}

async function collectCommandNames(filePath: string): Promise<string[]> {
  const content = await readFile(resolve(filePath), 'utf8')
  const parsed = parseMmlDocument(content)
  const seen = new Set<string>()
  for (const statement of parsed.statements) {
    seen.add(statement.commandHead)
  }
  return [...seen]
}

async function main(): Promise<void> {
  const payload: FileQueryArgs = JSON.parse(process.argv[2] || '{}')
  const commandNames = payload.commandNames && payload.commandNames.length > 0
    ? payload.commandNames.map(c => normalizeCommandHead(c))
    : await collectCommandNames(payload.file)

  const results = []
  for (const commandName of commandNames) {
    const result = await queryMmlFile({
      filePath: payload.file,
      commandName,
      where: payload.where,
      selectParamName: payload.select || null,
      textOnly: payload.textOnly === true,
      limit: payload.limit ?? null
    })
    results.push(result)
  }
  process.stdout.write(JSON.stringify({ results }))
}

try {
  await main()
} catch (error) {
  process.stderr.write(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
