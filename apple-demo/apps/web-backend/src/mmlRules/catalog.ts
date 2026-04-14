import { getMmlRulesConfig, type MmlRulesConfig } from '../config/index.js'
import { bootstrapMmlRules } from './bootstrap.js'
import { MmlRuleImporter } from './importer.js'
import { DbBackedMmlSchemaService, type MmlSchemaService } from './service.js'
import { MmlRuleStore } from './store.js'

interface MmlRuleCatalogState {
  store: MmlRuleStore
  service: MmlSchemaService
}

let catalogState: MmlRuleCatalogState | null = null

export function initializeMmlRuleCatalog(config: MmlRulesConfig = getMmlRulesConfig()): MmlSchemaService {
  closeMmlRuleCatalog()

  const store = new MmlRuleStore(config.dbPath)
  store.initialize()

  const importer = new MmlRuleImporter(store)
  bootstrapMmlRules(config, importer)

  const service = new DbBackedMmlSchemaService(store)
  catalogState = { store, service }
  return service
}

export function getMmlSchemaService(): MmlSchemaService {
  if (!catalogState) {
    return initializeMmlRuleCatalog()
  }
  return catalogState.service
}

export function closeMmlRuleCatalog(): void {
  if (!catalogState) {
    return
  }
  catalogState.store.close()
  catalogState = null
}
