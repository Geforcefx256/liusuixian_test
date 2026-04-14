import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SQLiteAgentSessionStore, type AgentSessionStore } from '../sessionStore.js'
import { DeepseekTokenizer } from '../context/index.js'
import type { Tokenizer } from '../context/types.js'
let defaultSessionStore: AgentSessionStore | null = null
let defaultTokenizer: Tokenizer | null = null

export function getDefaultSessionStore(): AgentSessionStore {
  if (defaultSessionStore) {
    return defaultSessionStore
  }

  defaultSessionStore = new SQLiteAgentSessionStore({
    dbPath: isTestRuntime()
      ? ':memory:'
      : resolve(getBackendRootDir(), 'data', 'memory.db')
  })
  return defaultSessionStore
}

export function getDefaultTokenizer(): Tokenizer {
  if (!defaultTokenizer) {
    defaultTokenizer = DeepseekTokenizer.load()
  }
  return defaultTokenizer
}

function getBackendRootDir(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url))
  return resolve(currentDir, '..', '..', '..')
}

function isTestRuntime(): boolean {
  return Boolean(process.env.VITEST || process.env.TEST)
}
