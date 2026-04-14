#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { Command } from 'commander'

import type { MmlFileQueryCondition, MmlSchemaResponse } from './core/contracts.js'
import { MmlRuleImporter } from './core/importer.js'
import { queryMmlFile } from './core/instances.js'
import { validateCommandAgainstSchema } from './core/semantics.js'
import { DbBackedMmlSchemaService } from './core/service.js'
import { MmlRuleStore } from './core/store.js'

const EXIT_GENERAL_ERROR = 1
const EXIT_USAGE_ERROR = 2
const EXIT_RESOURCE_NOT_FOUND = 3
const DEFAULT_DB_PATH = './data/mml-rules.db'

class CliError extends Error {
  constructor(
    readonly exitCode: number,
    message: string
  ) {
    super(message)
    this.name = 'CliError'
  }
}

const program = new Command()

program
  .name('mml')
  .description('MML catalog, validation, and file query CLI')
  .option('--db <path>', 'SQLite database path for MML rule catalog')
  .option('--json', 'Emit JSON output when supported')
  .option('--quiet', 'Emit compact text output when supported')
  .showHelpAfterError()

const schemaCommand = program
  .command('schema')
  .description('Inspect imported MML schema catalog')

schemaCommand
  .command('list')
  .description('List available network types and versions')
  .action(() => {
    const context = getContext()
    const store = openStore(context.dbPath, true)
    try {
      store.initialize()
      const service = new DbBackedMmlSchemaService(store)
      const payload = service.getOptions()
      if (context.quiet) {
        const lines = Object.entries(payload.networkVersionsByType)
          .flatMap(([networkType, versions]) => versions.map(version => `${networkType}:${version}`))
        process.stdout.write(lines.join('\n'))
        if (lines.length > 0) {
          process.stdout.write('\n')
        }
        return
      }
      writeJson(payload, context.json)
    } finally {
      store.close()
    }
  })

schemaCommand
  .command('show')
  .description('Show schema for a specific network type and version')
  .option('--type <type>', 'Network type')
  .option('--version <version>', 'Network version')
  .option('--command <name>', 'Filter to a single command')
  .action((options: { type?: string; version?: string; command?: string }) => {
    const command = schemaCommand.commands.find(item => item.name() === 'show') || schemaCommand
    requireOption(options.type, '--type is required', command)
    requireOption(options.version, '--version is required', command)

    const context = getContext()
    const store = openStore(context.dbPath, true)
    try {
      store.initialize()
      const service = new DbBackedMmlSchemaService(store)
      const schema = service.getSchema(options.type!, options.version!)
      if (!schema) {
        throw new CliError(EXIT_RESOURCE_NOT_FOUND, 'No matching ruleset found.')
      }
      const payload = options.command
        ? {
            ...schema,
            commands: schema.commands.filter(item => item.commandName === options.command!.trim().toUpperCase())
          }
        : schema
      writeJson(payload, context.json)
    } finally {
      store.close()
    }
  })

program
  .command('validate')
  .description('Validate an MML command against schema rules')
  .option('--type <type>', 'Network type')
  .option('--version <version>', 'Network version')
  .option('--command <command>', 'MML command text')
  .action((options: { type?: string; version?: string; command?: string }) => {
    requireOption(options.type, '--type is required', program.commands.find(item => item.name() === 'validate') || program)
    requireOption(options.version, '--version is required', program.commands.find(item => item.name() === 'validate') || program)
    requireOption(options.command, '--command is required', program.commands.find(item => item.name() === 'validate') || program)

    const context = getContext()
    const store = openStore(context.dbPath, true)
    try {
      store.initialize()
      const service = new DbBackedMmlSchemaService(store)
      const schema = service.getSchema(options.type!, options.version!)
      if (!schema) {
        throw new CliError(EXIT_RESOURCE_NOT_FOUND, 'No matching ruleset found.')
      }
      const result = validateCommandAgainstSchema(options.command!, schema)
      if (!result.valid && result.errors.length === 1 && result.errors[0]?.message === 'unknown command') {
        writeJson(result, context.json)
        process.exitCode = EXIT_RESOURCE_NOT_FOUND
        return
      }
      writeJson(result, context.json)
      if (!result.valid) {
        process.exitCode = EXIT_GENERAL_ERROR
      }
    } finally {
      store.close()
    }
  })

program
  .command('init')
  .description('Initialize the MML rule catalog from a directory of workbooks')
  .option('--dir <path>', 'Directory containing CHECK_RULE workbooks')
  .action((options: { dir?: string }) => {
    requireOption(options.dir, '--dir is required', program.commands.find(item => item.name() === 'init') || program)
    if (!existsSync(options.dir!)) {
      throw new CliError(EXIT_RESOURCE_NOT_FOUND, `Directory not found: ${options.dir}`)
    }

    const context = getContext()
    mkdirSync(dirname(context.dbPath), { recursive: true })
    const store = openStore(context.dbPath, false)
    try {
      store.initialize()
      const importer = new MmlRuleImporter(store)
      const summary = importer.importDirectory(options.dir!)
      writeJson({
        imported: summary.imported.length,
        files: summary.imported.map(item => item.identity.fileName)
      }, context.json)
    } finally {
      store.close()
    }
  })

const fileCommand = program
  .command('file')
  .description('Query business .mml file instances')

fileCommand
  .command('query')
  .description('Query actual command instances from a business .mml file')
  .option('--file <path>', 'Path to the business .mml file')
  .option('--command <name>', 'Command name to match')
  .option('--where <condition...>', 'Repeated PARAM=VALUE filters', [])
  .option('--select <param>', 'Return the selected parameter value')
  .option('--text-only', 'Return only the matched command texts')
  .option('--limit <n>', 'Limit the number of matches returned')
  .action(async (options: {
    file?: string
    command?: string
    where?: string[]
    select?: string
    textOnly?: boolean
    limit?: string
  }) => {
    const command = fileCommand.commands.find(item => item.name() === 'query') || fileCommand
    requireOption(options.file, '--file is required', command)
    requireOption(options.command, '--command is required', command)
    if (!existsSync(options.file!)) {
      throw new CliError(EXIT_RESOURCE_NOT_FOUND, `File not found: ${options.file}`)
    }

    const limit = options.limit ? Number.parseInt(options.limit, 10) : null
    if (options.limit && (!Number.isFinite(limit) || limit! <= 0)) {
      throw new CliError(EXIT_USAGE_ERROR, '--limit must be a positive integer.')
    }

    const conditions = (options.where || []).map(parseWhereCondition)
    const result = await queryMmlFile({
      filePath: options.file!,
      commandName: options.command!,
      where: conditions,
      selectParamName: options.select || null,
      textOnly: options.textOnly === true,
      limit
    })
    writeJson(result, getContext().json)
  })

registerHelpExamples(program, [
  '$ mml --db ./data/mml-rules.db schema list',
  '$ mml --db ./data/mml-rules.db schema show --type AMF --version 20.9.2 --command "ADD SGSLNK"',
  '$ mml --db ./data/mml-rules.db validate --type AMF --version 20.9.2 --command "ADD SGSLNK:LNK=1, IPTYPE=IPV4, VLRIPV4_1=\\"10.0.0.1\\";"',
  '$ mml file query --file ./working/core-a.mml --command "ADD SGSLNK" --where IPTYPE=IPv4 --select VLRIPV4_1',
  '$ mml file query --file ./working/core-a.mml --command "ADD NGPEIPLCY" --text-only'
])

registerHelpExamples(schemaCommand.commands.find(item => item.name() === 'list') || schemaCommand, [
  '$ mml --db ./data/mml-rules.db schema list',
  '$ mml --db ./data/mml-rules.db --quiet schema list'
])

registerHelpExamples(schemaCommand.commands.find(item => item.name() === 'show') || schemaCommand, [
  '$ mml --db ./data/mml-rules.db schema show --type AMF --version 20.9.2',
  '$ mml --db ./data/mml-rules.db schema show --type AMF --version 20.9.2 --command "ADD SGSLNK"'
])

registerHelpExamples(program.commands.find(item => item.name() === 'validate') || program, [
  '$ mml --db ./data/mml-rules.db validate --type AMF --version 20.9.2 --command "ADD SGSLNK:LNK=1, IPTYPE=IPV4, VLRIPV4_1=\\"10.0.0.1\\";"'
])

registerHelpExamples(program.commands.find(item => item.name() === 'init') || program, [
  '$ mml --db ./data/mml-rules.db init --dir ./data/mml-rules'
])

registerHelpExamples(fileCommand.commands.find(item => item.name() === 'query') || fileCommand, [
  '$ mml file query --file ./working/core-a.mml --command "ADD SGSLNK"',
  '$ mml file query --file ./working/core-a.mml --command "ADD SGSLNK" --where IPTYPE=IPv4 --where LNK=3',
  '$ mml file query --file ./working/core-a.mml --command "ADD SGSLNK" --where IPTYPE=IPv4 --select VLRIPV4_1',
  '$ mml file query --file ./working/core-a.mml --command "ADD NGPEIPLCY" --text-only'
])

void run()

async function run(): Promise<void> {
  try {
    await program.parseAsync(process.argv)
  } catch (error) {
    if (error instanceof CliError) {
      process.stderr.write(`${error.message}\n`)
      process.exitCode = error.exitCode
      return
    }
    if (error instanceof Error) {
      process.stderr.write(`${error.message}\n`)
      process.exitCode = process.exitCode || EXIT_GENERAL_ERROR
      return
    }
    process.stderr.write('Unknown error\n')
    process.exitCode = EXIT_GENERAL_ERROR
  }
}

function getContext(): { dbPath: string; json: boolean; quiet: boolean } {
  const options = program.opts<{ db?: string; json?: boolean; quiet?: boolean }>()
  return {
    dbPath: options.db || process.env.MML_DB_PATH || DEFAULT_DB_PATH,
    json: options.json === true,
    quiet: options.quiet === true
  }
}

function openStore(dbPath: string, requireExisting: boolean): MmlRuleStore {
  if (requireExisting && !existsSync(dbPath)) {
    throw new CliError(EXIT_RESOURCE_NOT_FOUND, `Database not found: ${dbPath}`)
  }
  return new MmlRuleStore(dbPath)
}

function requireOption(value: string | undefined, message: string, command: Command): void {
  if (typeof value === 'string' && value.trim()) {
    return
  }
  command.outputHelp({ error: true })
  throw new CliError(EXIT_USAGE_ERROR, message)
}

function parseWhereCondition(input: string): MmlFileQueryCondition {
  const equalsIndex = input.indexOf('=')
  if (equalsIndex <= 0 || equalsIndex === input.length - 1) {
    throw new CliError(EXIT_USAGE_ERROR, `Invalid where condition: ${input}`)
  }
  return {
    paramName: input.slice(0, equalsIndex).trim(),
    expectedValue: input.slice(equalsIndex + 1).trim()
  }
}

function writeJson(payload: unknown, pretty: boolean): void {
  const spacing = pretty ? 2 : 0
  process.stdout.write(`${JSON.stringify(payload, null, spacing)}\n`)
}

function registerHelpExamples(command: Command, examples: string[]): void {
  command.on('--help', () => {
    if (examples.length === 0) {
      return
    }
    process.stdout.write('\nExamples:\n')
    for (const example of examples) {
      process.stdout.write(`  ${example}\n`)
    }
  })
}
