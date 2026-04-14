import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { MmlRuleStore } from '../../../../../../cli-tools/mml/src/core/store.js'
import { DbBackedMmlSchemaService } from '../../../../../../cli-tools/mml/src/core/service.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.resolve(__dirname, '..', 'data', 'mml-rules.db')

interface SchemaShowArgs {
  type: string
  version: string
  command?: string
}

function main(): void {
  const payload: SchemaShowArgs = JSON.parse(process.argv[2] || '{}')
  const store = new MmlRuleStore(dbPath)
  store.initialize()
  try {
    const service = new DbBackedMmlSchemaService(store)
    const schema = service.getSchema(payload.type, payload.version)
    if (!schema) {
      process.stderr.write(`No schema found for type="${payload.type}" version="${payload.version}"`)
      process.exit(1)
    }
    if (payload.command) {
      const upperCommand = payload.command.trim().toUpperCase()
      const filtered = schema.commands.filter(c => c.commandName === upperCommand)
      process.stdout.write(JSON.stringify({ ...schema, commands: filtered }))
    } else {
      process.stdout.write(JSON.stringify(schema))
    }
  } finally {
    store.close()
  }
}

try {
  main()
} catch (error) {
  process.stderr.write(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
