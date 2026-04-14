import type { MmlSchemaResponse } from './schema.js'
import { MmlRuleStore } from './store.js'

export interface MmlTypeVersionOptions {
  networkTypes: string[]
  networkVersionsByType: Record<string, string[]>
}

export interface MmlSchemaService {
  getSchema(networkType: string, networkVersion: string): MmlSchemaResponse | null
  getOptions(): MmlTypeVersionOptions
}

export class DbBackedMmlSchemaService implements MmlSchemaService {
  constructor(private readonly store: MmlRuleStore) {}

  getSchema(networkType: string, networkVersion: string): MmlSchemaResponse | null {
    return this.store.getSchema(networkType.trim().toUpperCase(), networkVersion.trim())
  }

  getOptions(): MmlTypeVersionOptions {
    return this.store.getNetworkOptions()
  }
}
