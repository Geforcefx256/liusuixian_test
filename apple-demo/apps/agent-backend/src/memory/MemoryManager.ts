/**
 * Memory Manager
 *
 * Main orchestrator for the memory system.
 * Coordinates long-term memory, daily logs, and hybrid search.
 */

import path from 'path'
import { SQLiteStore } from './SQLiteStore.js'
import { LongTermMemoryManager } from './LongTermMemory.js'
import { DailyLogManager } from './DailyLogManager.js'
import { HybridSearch } from './HybridSearch.js'
import { createEmbeddingProvider } from './EmbeddingProvider.js'
import type {
  MemoryConfig,
  MemoryStatus,
  MemorySearchResult,
  MemorySource,
  LongTermMemoryEntry,
  DailyLogEntry,
  CreateLongTermMemoryRequest,
  UpdateLongTermMemoryRequest,
  CreateDailyLogRequest
} from './types.js'

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Partial<MemoryConfig> = {
  chunkSize: 400,
  chunkOverlap: 80,
  searchLimit: 6,
  vectorWeight: 0.7,
  keywordWeight: 0.3,
  embedding: {
    provider: 'none'
  }
}

/**
 * Memory Manager
 */
export class MemoryManager {
  private config: MemoryConfig
  private store: SQLiteStore
  private longTermManager: LongTermMemoryManager
  private dailyLogManager: DailyLogManager
  private hybridSearch: HybridSearch
  private dirty = false

  private constructor(
    store: SQLiteStore,
    config: MemoryConfig
  ) {
    this.config = config
    this.store = store
    this.longTermManager = new LongTermMemoryManager(this.store, this.config.workspaceDir)
    this.dailyLogManager = new DailyLogManager(this.store, this.config.workspaceDir)

    // Initialize embedding provider and hybrid search
    const embeddingProvider = createEmbeddingProvider(this.config.embedding)
    this.hybridSearch = new HybridSearch(this.store, embeddingProvider, {
      vectorWeight: this.config.vectorWeight,
      keywordWeight: this.config.keywordWeight
    })
  }

  /**
   * Create MemoryManager instance
   */
  static async create(config: Partial<MemoryConfig> & { workspaceDir: string; dbPath: string }): Promise<MemoryManager> {
    const fullConfig = { ...DEFAULT_CONFIG, ...config } as MemoryConfig
    const store = await SQLiteStore.create(fullConfig)
    return new MemoryManager(store, fullConfig)
  }

  // ===========================================================================
  // Initialization & Status
  // ===========================================================================

  /**
   * Initialize memory system
   */
  async initialize(): Promise<void> {
    // Sync files to index
    await this.sync()
  }

  /**
   * Get memory system status
   */
  getStatus(): MemoryStatus {
    const longtermFiles = this.store.getFileCount('longterm')
    const longtermChunks = this.store.getChunkCount('longterm')
    const dailyFiles = this.store.getFileCount('daily')
    const dailyChunks = this.store.getChunkCount('daily')

    return {
      backend: 'builtin',
      provider: this.config.embedding.provider,
      model: this.config.embedding.model,
      files: longtermFiles + dailyFiles,
      chunks: longtermChunks + dailyChunks,
      dirty: this.dirty,
      sources: [
        { source: 'longterm', files: longtermFiles, chunks: longtermChunks },
        { source: 'daily', files: dailyFiles, chunks: dailyChunks }
      ],
      vector: {
        enabled: this.config.embedding.provider !== 'none',
        available: this.store.isVectorAvailable(),
        dims: 1536 // OpenAI embedding dimension
      },
      fts: {
        enabled: true,
        available: true
      },
      workspaceDir: this.config.workspaceDir,
      dbPath: this.config.dbPath
    }
  }

  // ===========================================================================
  // Long-term Memory Operations
  // ===========================================================================

  /**
   * Get all long-term memories
   */
  async getLongTermMemories(): Promise<LongTermMemoryEntry[]> {
    return this.longTermManager.getAll()
  }

  /**
   * Get long-term memory by ID
   */
  async getLongTermMemory(id: string): Promise<LongTermMemoryEntry | null> {
    return this.longTermManager.getById(id)
  }

  /**
   * Add long-term memory
   */
  async addLongTermMemory(request: CreateLongTermMemoryRequest): Promise<LongTermMemoryEntry> {
    const entry = await this.longTermManager.add(request)
    this.dirty = true
    return entry
  }

  /**
   * Update long-term memory
   */
  async updateLongTermMemory(id: string, request: UpdateLongTermMemoryRequest): Promise<LongTermMemoryEntry | null> {
    const entry = await this.longTermManager.update(id, request)
    if (entry) {
      this.dirty = true
    }
    return entry
  }

  /**
   * Delete long-term memory
   */
  async deleteLongTermMemory(id: string): Promise<boolean> {
    const deleted = await this.longTermManager.delete(id)
    if (deleted) {
      this.dirty = true
    }
    return deleted
  }

  // ===========================================================================
  // Daily Log Operations
  // ===========================================================================

  /**
   * Get daily log dates
   */
  async getDailyLogDates(): Promise<string[]> {
    return this.dailyLogManager.getDates()
  }

  /**
   * Get daily log entries by date
   */
  async getDailyLog(date: string): Promise<DailyLogEntry[]> {
    return this.dailyLogManager.getByDate(date)
  }

  /**
   * Get today's log entries
   */
  async getTodayLog(): Promise<DailyLogEntry[]> {
    return this.dailyLogManager.getToday()
  }

  /**
   * Add daily log entry
   */
  async addDailyLog(request: CreateDailyLogRequest): Promise<DailyLogEntry> {
    const entry = await this.dailyLogManager.add(request)
    this.dirty = true
    return entry
  }

  /**
   * Delete daily log entry
   */
  async deleteDailyLog(id: string, date: string): Promise<boolean> {
    const deleted = await this.dailyLogManager.delete(id, date)
    if (deleted) {
      this.dirty = true
    }
    return deleted
  }

  // ===========================================================================
  // Search Operations
  // ===========================================================================

  /**
   * Hybrid search
   */
  async search(
    query: string,
    options: {
      limit?: number
      minScore?: number
      sources?: MemorySource[]
    } = {}
  ): Promise<MemorySearchResult[]> {
    // Sync if dirty
    if (this.dirty) {
      await this.sync()
    }

    const results = await this.hybridSearch.search(query, options)

    // Convert to MemorySearchResult format
    return results.map(r => ({
      id: r.id,
      content: r.snippet,
      snippet: r.snippet,
      score: r.score,
      vectorScore: r.vectorScore,
      keywordScore: r.keywordScore,
      source: r.source,
      path: r.path,
      startLine: r.startLine,
      endLine: r.endLine
    }))
  }

  // ===========================================================================
  // Sync Operations
  // ===========================================================================

  /**
   * Sync files to index
   */
  async sync(): Promise<void> {
    await Promise.all([
      this.longTermManager.syncToIndex(),
      this.dailyLogManager.syncToIndex()
    ])
    this.dirty = false
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Close and cleanup
   */
  close(): void {
    this.store.close()
  }
}