/**
 * Memory System Types
 *
 * Based on OpenClaw memory system design
 */

// ============================================================================
// Long-term Memory
// ============================================================================

/**
 * Long-term memory entry
 *
 * Persistent facts, decisions, preferences, and patterns.
 * Stored in MEMORY.md file.
 */
export interface LongTermMemoryEntry {
  id: string
  content: string
  category: LongTermMemoryCategory
  importance: number // 0-1
  tags: string[]
  createdAt: number
  updatedAt: number
  lastAccessed: number
  accessCount: number
}

export type LongTermMemoryCategory = 'preference' | 'decision' | 'pattern' | 'fact'

/**
 * Create long-term memory request
 */
export interface CreateLongTermMemoryRequest {
  content: string
  category?: LongTermMemoryCategory
  importance?: number
  tags?: string[]
}

/**
 * Update long-term memory request
 */
export interface UpdateLongTermMemoryRequest {
  content?: string
  category?: LongTermMemoryCategory
  importance?: number
  tags?: string[]
}

// ============================================================================
// Daily Log
// ============================================================================

/**
 * Daily log entry
 *
 * Running context for the day: tasks, notes, conversation summaries.
 * Stored in memory/YYYY-MM-DD.md files.
 */
export interface DailyLogEntry {
  id: string
  date: string // YYYY-MM-DD
  content: string
  type: DailyLogType
  tags: string[]
  createdAt: number
}

export type DailyLogType = 'task' | 'note' | 'context' | 'conversation'

/**
 * Create daily log request
 */
export interface CreateDailyLogRequest {
  content: string
  date?: string // Defaults to today
  type?: DailyLogType
  tags?: string[]
}

// ============================================================================
// Search
// ============================================================================

/**
 * Memory search result
 */
export interface MemorySearchResult {
  id: string
  content: string
  snippet: string
  score: number
  vectorScore: number
  keywordScore: number
  source: MemorySource
  path: string
  startLine: number
  endLine: number
}

export type MemorySource = 'longterm' | 'daily'

/**
 * Search request
 */
export interface MemorySearchRequest {
  query: string
  limit?: number // Default: 6
  minScore?: number // Default: 0.1
  sources?: MemorySource[]
}

// ============================================================================
// Status
// ============================================================================

/**
 * Memory system status
 */
export interface MemoryStatus {
  backend: 'builtin'
  provider: string
  model?: string
  files: number
  chunks: number
  dirty: boolean
  sources: Array<{
    source: MemorySource
    files: number
    chunks: number
  }>
  vector: {
    enabled: boolean
    available: boolean
    dims?: number
  }
  fts: {
    enabled: boolean
    available: boolean
  }
  workspaceDir: string
  dbPath: string
}

// ============================================================================
// Sync
// ============================================================================

/**
 * Sync progress update
 */
export interface MemorySyncProgress {
  completed: number
  total: number
  label?: string
}

// ============================================================================
// Embedding Provider
// ============================================================================

/**
 * Embedding provider configuration
 */
export interface EmbeddingProviderConfig {
  provider: 'openai' | 'zhipu' | 'none'
  model?: string
  apiKey?: string
  baseUrl?: string
  dimensions?: number  // Vector dimensions (zhipu: 512, openai: 1536)
  timeoutMs?: number
}

/**
 * Embedding provider interface
 */
export interface EmbeddingProvider {
  id: string
  model: string
  embedQuery(text: string): Promise<number[]>
  embedBatch(texts: string[]): Promise<number[][]>
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * File record in database
 */
export interface FileRecord {
  id: number
  path: string
  source: MemorySource
  hash: string | null
  lastModified: number | null
  createdAt: number
}

/**
 * Chunk record in database
 */
export interface ChunkRecord {
  id: number
  fileId: number
  content: string
  startLine: number
  endLine: number
  createdAt: number
}

/**
 * Hybrid search result (internal)
 */
export interface HybridSearchResult {
  id: string
  path: string
  startLine: number
  endLine: number
  source: MemorySource
  snippet: string
  vectorScore: number
  keywordScore: number
  score: number
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Memory manager configuration
 */
export interface MemoryConfig {
  workspaceDir: string
  dbPath: string
  embedding: EmbeddingProviderConfig
  chunkSize: number // Default: 400 tokens
  chunkOverlap: number // Default: 80 tokens
  searchLimit: number // Default: 6
  vectorWeight: number // Default: 0.7
  keywordWeight: number // Default: 0.3
}
