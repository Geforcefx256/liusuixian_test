import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { MmlRuleStore } from '../../../../../../cli-tools/mml/src/core/store.js'
import { DbBackedMmlSchemaService } from '../../../../../../cli-tools/mml/src/core/service.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.resolve(__dirname, '..', 'data', 'mml-rules.db')

try {
  const store = new MmlRuleStore(dbPath)
  store.initialize()
  try {
    const service = new DbBackedMmlSchemaService(store)
    const options = service.getOptions()
    process.stdout.write(JSON.stringify(options))
  } finally {
    store.close()
  }
} catch (error) {
  process.stderr.write(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
