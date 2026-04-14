/**
 * Hybrid Search Engine
 *
 * Combines vector similarity search with BM25 keyword search.
 * Based on OpenClaw's hybrid search implementation.
 */

import type { SQLiteStore } from './SQLiteStore.js'
import type { EmbeddingProvider, HybridSearchResult, MemorySource } from './types.js'
import { createLogger } from '../logging/index.js'

const SNIPPET_MAX_CHARS = 700

/**
 * Hybrid search configuration
 */
export interface HybridSearchConfig {
  vectorWeight: number    // Default: 0.7
  keywordWeight: number   // Default: 0.3
  candidateMultiplier: number // Default: 4
}

const DEFAULT_CONFIG: HybridSearchConfig = {
  vectorWeight: 0.7,
  keywordWeight: 0.3,
  candidateMultiplier: 4
}

const hybridSearchLogger = createLogger({
  category: 'runtime',
  component: 'hybrid_search'
})

/**
 * Hybrid search engine
 */
export class HybridSearch {
  private store: SQLiteStore
  private embeddingProvider: EmbeddingProvider | null
  private config: HybridSearchConfig

  constructor(
    store: SQLiteStore,
    embeddingProvider: EmbeddingProvider | null,
    config?: Partial<HybridSearchConfig>
  ) {
    this.store = store
    this.embeddingProvider = embeddingProvider
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Perform hybrid search
   */
  async search(
    query: string,
    options: {
      limit?: number
      minScore?: number
      sources?: MemorySource[]
    } = {}
  ): Promise<HybridSearchResult[]> {
    const limit = options.limit ?? 6
    const minScore = options.minScore ?? 0.1
    const candidates = Math.floor(limit * this.config.candidateMultiplier)

    // Clean query
    const cleaned = query.trim()
    if (!cleaned) return []

    // Get query embedding (if provider available)
    let queryEmbedding: number[] | null = null
    if (this.embeddingProvider && this.store.isVectorAvailable()) {
      try {
        queryEmbedding = await this.embeddingProvider.embedQuery(cleaned)
      } catch (error) {
        hybridSearchLogger.warn({
          message: 'failed to generate query embedding',
          data: {
            error: error instanceof Error ? error.message : String(error)
          }
        })
      }
    }

    // Perform parallel searches
    const [vectorResults, keywordResults] = await Promise.all([
      queryEmbedding
        ? this.searchVector(queryEmbedding, candidates)
        : Promise.resolve([]),
      this.searchKeywords(cleaned, candidates)
    ])

    // If no vector results, just use keyword results
    if (vectorResults.length === 0) {
      return keywordResults
        .filter(r => r.score >= minScore)
        .slice(0, limit)
    }

    // Merge results
    const merged = this.mergeResults(vectorResults, keywordResults)

    return merged
      .filter(r => r.score >= minScore)
      .slice(0, limit)
  }

  /**
   * Vector similarity search
   */
  private async searchVector(
    embedding: number[],
    limit: number
  ): Promise<HybridSearchResult[]> {
    const results = this.store.searchVector(embedding, limit)

    return results.map(r => {
      const chunk = this.store.getChunkById(r.id)
      if (!chunk) return null

      const files = this.store.getFiles()
      const file = files.find(f => f.id === chunk.fileId)

      return {
        id: r.id.toString(),
        path: file?.path || '',
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        source: file?.source || 'longterm' as MemorySource,
        snippet: chunk.content.slice(0, SNIPPET_MAX_CHARS),
        vectorScore: r.score,
        keywordScore: 0,
        score: r.score * this.config.vectorWeight
      }
    }).filter((r): r is HybridSearchResult => r !== null)
  }

  /**
   * BM25 keyword search
   */
  private async searchKeywords(
    query: string,
    limit: number
  ): Promise<HybridSearchResult[]> {
    const results = this.store.searchKeywords(query, limit)

    return results.map(r => {
      const chunk = this.store.getChunkById(r.id)
      if (!chunk) return null

      // Get file info
      const files = this.store.getFiles()
      const file = files.find(f => f.id === chunk.fileId)

      return {
        id: r.id.toString(),
        path: file?.path || '',
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        source: file?.source || 'longterm' as MemorySource,
        snippet: r.snippet || chunk.content.slice(0, SNIPPET_MAX_CHARS),
        vectorScore: 0,
        keywordScore: r.score,
        score: r.score * this.config.keywordWeight
      }
    }).filter((r): r is HybridSearchResult => r !== null)
  }

  /**
   * Merge vector and keyword results
   */
  private mergeResults(
    vectorResults: HybridSearchResult[],
    keywordResults: HybridSearchResult[]
  ): HybridSearchResult[] {
    const byId = new Map<string, HybridSearchResult>()

    // Add vector results
    for (const r of vectorResults) {
      byId.set(r.id, {
        ...r,
        vectorScore: r.vectorScore,
        keywordScore: 0,
        score: r.score
      })
    }

    // Merge keyword results
    for (const r of keywordResults) {
      const existing = byId.get(r.id)
      if (existing) {
        existing.keywordScore = r.keywordScore
        existing.score =
          existing.vectorScore * this.config.vectorWeight +
          r.keywordScore * this.config.keywordWeight
        // Use longer snippet
        if (r.snippet.length > existing.snippet.length) {
          existing.snippet = r.snippet
        }
      } else {
        byId.set(r.id, {
          ...r,
          score: r.keywordScore * this.config.keywordWeight
        })
      }
    }

    // Sort by final score
    return Array.from(byId.values())
      .sort((a, b) => b.score - a.score)
  }

  /**
   * Check if vector search is available
   */
  isVectorAvailable(): boolean {
    return this.store.isVectorAvailable() && this.embeddingProvider !== null
  }

  /**
   * Get search configuration
   */
  getConfig(): HybridSearchConfig {
    return { ...this.config }
  }
}
