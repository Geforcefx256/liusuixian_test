/**
 * Memory System - Unified Export
 */

export * from './types.js'
export { MemoryManager } from './MemoryManager.js'
export { SQLiteStore } from './SQLiteStore.js'
export { LongTermMemoryManager } from './LongTermMemory.js'
export { DailyLogManager } from './DailyLogManager.js'
export { HybridSearch } from './HybridSearch.js'
export {
  createEmbeddingProvider,
  computeContentHash,
  normalizeEmbedding
} from './EmbeddingProvider.js'
export { loadConfig, toMemoryConfig, getConfigLoadDiagnostics, type Config, type ConfigLoadDiagnostics } from './ConfigLoader.js'
export { loadVectorExtension, isVectorExtensionAvailable } from './VectorExtension.js'
