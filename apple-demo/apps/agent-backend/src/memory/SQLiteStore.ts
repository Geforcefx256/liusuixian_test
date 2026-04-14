/**
 * SQLite Storage Layer
 *
 * Handles all database operations for memory system.
 * Uses Node.js built-in node:sqlite with sqlite-vec extension for vector search.
 */

import { DatabaseSync } from 'node:sqlite'
import path from 'path'
import fs from 'fs'
import { loadVectorExtension } from './VectorExtension.js'
import { createLogger } from '../logging/index.js'
import type {
  MemorySource,
  FileRecord,
  ChunkRecord,
  MemoryConfig
} from './types.js'

const VECTOR_TABLE = 'chunks_vec'
const FTS_TABLE = 'chunks_fts'
const EMBEDDING_CACHE_TABLE = 'embedding_cache'

const sqliteStoreLogger = createLogger({
  category: 'runtime',
  component: 'sqlite_store'
})

/**
 * SQLite store for memory index
 */
export class SQLiteStore {
  private db: DatabaseSync
  private dbPath: string
  private vectorAvailable = false
  private embeddingDimensions: number

  private constructor(db: DatabaseSync, dbPath: string, vectorAvailable: boolean, embeddingDimensions: number) {
    this.db = db
    this.dbPath = dbPath
    this.vectorAvailable = vectorAvailable
    this.embeddingDimensions = embeddingDimensions
    this.ensureSchema()
  }

  /**
   * Create SQLite store instance
   */
  static async create(config: MemoryConfig): Promise<SQLiteStore> {
    const dbPath = config.dbPath

    // Ensure directory exists
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Open database (creates if not exists)
    // Enable allowExtension for loading sqlite-vec
    const db = new DatabaseSync(dbPath, { allowExtension: true })

    // Enable WAL mode for better performance
    db.exec('PRAGMA journal_mode = WAL')
    db.exec('PRAGMA synchronous = NORMAL')

    // Try to load vector extension
    let vectorAvailable = false
    try {
      vectorAvailable = loadVectorExtension(db)
      if (vectorAvailable) {
        sqliteStoreLogger.info({
          message: 'vector search enabled',
          data: { dbPath }
        })
      } else {
        sqliteStoreLogger.warn({
          message: 'vector search disabled because sqlite-vec extension is unavailable',
          data: { dbPath }
        })
      }
    } catch (error) {
      sqliteStoreLogger.warn({
        message: 'failed to load vector extension',
        data: {
          dbPath,
          error: error instanceof Error ? error.message : String(error)
        }
      })
      sqliteStoreLogger.warn({
        message: 'vector search disabled and keyword search fallback enabled',
        data: { dbPath }
      })
    }

    return new SQLiteStore(db, dbPath, vectorAvailable, config.embedding.dimensions || 1536)
  }

  /**
   * Ensure database schema exists
   */
  private ensureSchema(): void {
    // Files table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT UNIQUE NOT NULL,
        source TEXT NOT NULL,
        hash TEXT,
        last_modified INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `)

    // Chunks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        start_line INTEGER,
        end_line INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
      )
    `)

    // Create index for faster queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_chunks_file_id ON chunks(file_id)
    `)

    // Metadata table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `)

    // Embedding cache table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${EMBEDDING_CACHE_TABLE} (
        content_hash TEXT PRIMARY KEY,
        embedding BLOB,
        model TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `)

    // FTS5 virtual table for full-text search
    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS ${FTS_TABLE} USING fts5(
          content,
          content='chunks',
          content_rowid='id',
          tokenize='porter unicode61'
        )
      `)
    } catch (error) {
      sqliteStoreLogger.warn({
        message: 'fts5 unavailable and like fallback will be used',
        data: {
          dbPath: this.dbPath,
          error: error instanceof Error ? error.message : String(error)
        }
      })
    }

    // Vector table (sqlite-vec) - only if vector extension is available
    if (this.vectorAvailable) {
      try {
        this.db.exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS ${VECTOR_TABLE} USING vec0(
            chunk_id INTEGER PRIMARY KEY,
            embedding FLOAT[${this.embeddingDimensions}]
          )
        `)
        sqliteStoreLogger.info({
          message: 'vector table created',
          data: {
            dbPath: this.dbPath,
            dimensions: this.embeddingDimensions
          }
        })
      } catch (error) {
        sqliteStoreLogger.warn({
          message: 'failed to create vector table',
          data: {
            dbPath: this.dbPath,
            dimensions: this.embeddingDimensions,
            error: error instanceof Error ? error.message : String(error)
          }
        })
        this.vectorAvailable = false
      }
    }
  }

  // ===========================================================================
  // Vector Operations
  // ===========================================================================

  /**
   * Check if vector search is available
   */
  isVectorAvailable(): boolean {
    return this.vectorAvailable
  }

  /**
   * Insert vector embedding for a chunk
   */
  insertVector(chunkId: number, embedding: number[]): void {
    if (!this.vectorAvailable) {
      sqliteStoreLogger.warn({
        message: 'skipped embedding insert because vector search is unavailable',
        data: {
          dbPath: this.dbPath,
          chunkId
        }
      })
      return
    }

    try {
      // Convert embedding to Float32 buffer
      const buffer = Buffer.from(new Float32Array(embedding).buffer)

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO ${VECTOR_TABLE} (chunk_id, embedding)
        VALUES (?, ?)
      `)
      stmt.run(chunkId, buffer)
    } catch (error) {
      sqliteStoreLogger.error({
        message: 'failed to insert vector embedding',
        data: {
          dbPath: this.dbPath,
          chunkId,
          error: error instanceof Error ? error.message : String(error)
        }
      })
    }
  }

  /**
   * Search by vector similarity
   * Returns chunks sorted by cosine similarity (highest first)
   */
  searchVector(embedding: number[], limit: number): Array<{ id: number; score: number }> {
    if (!this.vectorAvailable) return []

    try {
      // Convert embedding to Float32 buffer
      const buffer = Buffer.from(new Float32Array(embedding).buffer)

      const stmt = this.db.prepare(`
        SELECT chunk_id as id, vec_distance_cosine(embedding, ?) as distance
        FROM ${VECTOR_TABLE}
        WHERE embedding MATCH ?
        ORDER BY distance
        LIMIT ?
      `)

      const results = stmt.all(buffer, buffer, limit) as Array<{ id: number; distance: number }>

      // Convert distance to similarity score (1 - distance for cosine)
      return results.map(r => ({
        id: r.id,
        score: 1 - r.distance
      }))
    } catch (error) {
      sqliteStoreLogger.error({
        message: 'vector search failed',
        data: {
          dbPath: this.dbPath,
          limit,
          error: error instanceof Error ? error.message : String(error)
        }
      })
      return []
    }
  }

  // ===========================================================================
  // Full-text Search
  // ===========================================================================

  /**
   * Build FTS5 search query from raw input
   */
  buildFtsQuery(raw: string): string {
    // Escape special FTS5 characters and build OR query
    const terms = raw.toLowerCase()
      .replace(/['"()*]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)

    return terms.join(' OR ')
  }

  /**
   * Search by keywords using FTS5
   */
  searchKeywords(query: string, limit: number): Array<{ id: number; score: number; snippet: string }> {
    const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (searchTerms.length === 0) return []

    // Check if FTS5 table exists
    try {
      const checkStmt = this.db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name=?
      `)
      const ftsExists = checkStmt.get(FTS_TABLE)

      if (ftsExists) {
        return this.searchKeywordsFts(searchTerms, limit)
      }
    } catch {
      // FTS5 not available, fall back to LIKE
    }

    // Fallback to LIKE-based search
    return this.searchKeywordsLike(searchTerms, limit)
  }

  /**
   * FTS5-based keyword search
   */
  private searchKeywordsFts(searchTerms: string[], limit: number): Array<{ id: number; score: number; snippet: string }> {
    const ftsQuery = searchTerms.join(' OR ')

    try {
      const stmt = this.db.prepare(`
        SELECT rowid as id, content, bm25(${FTS_TABLE}) as score
        FROM ${FTS_TABLE}
        WHERE ${FTS_TABLE} MATCH ?
        ORDER BY score
        LIMIT ?
      `)

      const results = stmt.all(ftsQuery, limit) as Array<{ id: number; content: string; score: number }>

      // BM25 returns negative scores, normalize to 0-1 range
      // Typical BM25 range is -20 to 0, so we map accordingly
      return results.map(r => {
        const normalizedScore = Math.max(0, Math.min(1, (20 + r.score) / 20))
        return {
          id: r.id,
          score: normalizedScore,
          snippet: this.createSnippet(r.content, searchTerms[0], 150)
        }
      })
    } catch (error) {
      sqliteStoreLogger.warn({
        message: 'fts5 search failed and like fallback will be used',
        data: {
          dbPath: this.dbPath,
          limit,
          error: error instanceof Error ? error.message : String(error)
        }
      })
      return this.searchKeywordsLike(searchTerms, limit)
    }
  }

  /**
   * LIKE-based keyword search (fallback)
   */
  private searchKeywordsLike(searchTerms: string[], limit: number): Array<{ id: number; score: number; snippet: string }> {
    // Build LIKE conditions for each term
    const conditions = searchTerms.map(() => 'LOWER(content) LIKE ?').join(' OR ')
    const likeParams = searchTerms.map(term => `%${term}%`)

    try {
      const stmt = this.db.prepare(`
        SELECT id, content FROM chunks
        WHERE ${conditions}
        LIMIT ?
      `)

      const results = stmt.all(...likeParams, limit) as Array<{ id: number; content: string }>

      return results.map(r => {
        // Calculate simple score based on term matches
        let matchCount = 0
        const lowerContent = r.content.toLowerCase()
        for (const term of searchTerms) {
          const regex = new RegExp(term, 'gi')
          const matches = r.content.match(regex)
          matchCount += matches ? matches.length : 0
        }

        // Normalize score to 0-1
        const score = Math.min(matchCount / 10, 1)

        return {
          id: r.id,
          score,
          snippet: this.createSnippet(r.content, searchTerms[0], 150)
        }
      })
    } catch (error) {
      sqliteStoreLogger.error({
        message: 'like search failed',
        data: {
          dbPath: this.dbPath,
          limit,
          error: error instanceof Error ? error.message : String(error)
        }
      })
      return []
    }
  }

  /**
   * Create snippet around search term
   */
  private createSnippet(content: string, term: string, maxLength: number): string {
    const lowerContent = content.toLowerCase()
    const index = lowerContent.indexOf(term.toLowerCase())

    if (index === -1) {
      return content.slice(0, maxLength) + (content.length > maxLength ? '...' : '')
    }

    const start = Math.max(0, index - 50)
    const end = Math.min(content.length, index + term.length + 50)

    let snippet = content.slice(start, end)
    if (start > 0) snippet = '...' + snippet
    if (end < content.length) snippet = snippet + '...'

    return snippet
  }

  // ===========================================================================
  // File Operations
  // ===========================================================================

  /**
   * Upsert file record
   */
  upsertFile(filePath: string, source: MemorySource, hash: string | null, lastModified: number | null): number {
    // Check if file exists
    const checkStmt = this.db.prepare('SELECT id FROM files WHERE path = ?')
    const existing = checkStmt.get(filePath) as { id: number } | undefined

    if (existing) {
      // Update existing
      const updateStmt = this.db.prepare(
        'UPDATE files SET hash = ?, last_modified = ? WHERE path = ?'
      )
      updateStmt.run(hash, lastModified, filePath)
      return existing.id
    } else {
      // Insert new
      const insertStmt = this.db.prepare(
        'INSERT INTO files (path, source, hash, last_modified) VALUES (?, ?, ?, ?)'
      )
      const result = insertStmt.run(filePath, source, hash, lastModified)
      return result.lastInsertRowid as number
    }
  }

  /**
   * Get file by path
   */
  getFile(filePath: string): FileRecord | null {
    const stmt = this.db.prepare('SELECT * FROM files WHERE path = ?')
    const row = stmt.get(filePath) as Record<string, unknown> | undefined

    if (!row) return null

    return {
      id: row.id as number,
      path: row.path as string,
      source: row.source as MemorySource,
      hash: row.hash as string | null,
      lastModified: row.last_modified as number | null,
      createdAt: row.created_at as number
    }
  }

  /**
   * Get all files
   */
  getFiles(source?: MemorySource): FileRecord[] {
    let query = 'SELECT * FROM files'
    const params: (string | number)[] = []

    if (source) {
      query += ' WHERE source = ?'
      params.push(source)
    }

    const stmt = this.db.prepare(query)
    const rows = stmt.all(...params) as Record<string, unknown>[]

    return rows.map(row => ({
      id: row.id as number,
      path: row.path as string,
      source: row.source as MemorySource,
      hash: row.hash as string | null,
      lastModified: row.last_modified as number | null,
      createdAt: row.created_at as number
    }))
  }

  /**
   * Delete file and its chunks
   */
  deleteFile(filePath: string): void {
    // First get file to find ID
    const file = this.getFile(filePath)
    if (file) {
      // Delete vector embeddings for this file's chunks
      if (this.vectorAvailable) {
        const chunks = this.getChunksByFileId(file.id)
        for (const chunk of chunks) {
          try {
            const stmt = this.db.prepare(`DELETE FROM ${VECTOR_TABLE} WHERE chunk_id = ?`)
            stmt.run(chunk.id)
          } catch {
            // Ignore errors if vector doesn't exist
          }
        }
      }

      // Delete chunks (cascade should handle this, but be explicit)
      const deleteChunksStmt = this.db.prepare('DELETE FROM chunks WHERE file_id = ?')
      deleteChunksStmt.run(file.id)
    }

    // Delete file record
    const deleteFileStmt = this.db.prepare('DELETE FROM files WHERE path = ?')
    deleteFileStmt.run(filePath)
  }

  // ===========================================================================
  // Chunk Operations
  // ===========================================================================

  /**
   * Insert chunk
   */
  insertChunk(fileId: number, content: string, startLine: number, endLine: number): number {
    const stmt = this.db.prepare(
      'INSERT INTO chunks (file_id, content, start_line, end_line) VALUES (?, ?, ?, ?)'
    )
    const result = stmt.run(fileId, content, startLine, endLine)
    return result.lastInsertRowid as number
  }

  /**
   * Get chunks by file ID
   */
  getChunksByFileId(fileId: number): ChunkRecord[] {
    const stmt = this.db.prepare('SELECT * FROM chunks WHERE file_id = ?')
    const rows = stmt.all(fileId) as Record<string, unknown>[]

    return rows.map(row => ({
      id: row.id as number,
      fileId: row.file_id as number,
      content: row.content as string,
      startLine: row.start_line as number,
      endLine: row.end_line as number,
      createdAt: row.created_at as number
    }))
  }

  /**
   * Delete chunks by file ID
   */
  deleteChunksByFileId(fileId: number): void {
    // Delete vector embeddings first
    if (this.vectorAvailable) {
      const chunks = this.getChunksByFileId(fileId)
      for (const chunk of chunks) {
        try {
          const stmt = this.db.prepare(`DELETE FROM ${VECTOR_TABLE} WHERE chunk_id = ?`)
          stmt.run(chunk.id)
        } catch {
          // Ignore errors if vector doesn't exist
        }
      }
    }

    // Delete chunks
    const stmt = this.db.prepare('DELETE FROM chunks WHERE file_id = ?')
    stmt.run(fileId)
  }

  /**
   * Get chunk by ID
   */
  getChunkById(id: number): ChunkRecord | null {
    const stmt = this.db.prepare('SELECT * FROM chunks WHERE id = ?')
    const row = stmt.get(id) as Record<string, unknown> | undefined

    if (!row) return null

    return {
      id: row.id as number,
      fileId: row.file_id as number,
      content: row.content as string,
      startLine: row.start_line as number,
      endLine: row.end_line as number,
      createdAt: row.created_at as number
    }
  }

  // ===========================================================================
  // Embedding Cache
  // ===========================================================================

  /**
   * Get cached embedding
   */
  getCachedEmbedding(contentHash: string, model: string): number[] | null {
    const stmt = this.db.prepare(
      `SELECT embedding FROM ${EMBEDDING_CACHE_TABLE} WHERE content_hash = ? AND model = ?`
    )
    const row = stmt.get(contentHash, model) as { embedding: Buffer } | undefined

    if (!row || !row.embedding) return null

    try {
      // Convert Buffer to Float32Array then to number array
      const float32 = new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4)
      return Array.from(float32)
    } catch {
      return null
    }
  }

  /**
   * Cache embedding
   */
  cacheEmbedding(contentHash: string, embedding: number[], model: string): void {
    const buffer = Buffer.from(new Float32Array(embedding).buffer)

    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO ${EMBEDDING_CACHE_TABLE} (content_hash, embedding, model) VALUES (?, ?, ?)`
    )
    stmt.run(contentHash, buffer, model)
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  /**
   * Get file count
   */
  getFileCount(source?: MemorySource): number {
    let query = 'SELECT COUNT(*) as count FROM files'
    const params: string[] = []

    if (source) {
      query += ' WHERE source = ?'
      params.push(source)
    }

    const stmt = this.db.prepare(query)
    const row = stmt.get(...params) as { count: number }
    return row.count
  }

  /**
   * Get chunk count
   */
  getChunkCount(source?: MemorySource): number {
    let query = 'SELECT COUNT(*) as count FROM chunks c'
    const params: string[] = []

    if (source) {
      query += ' JOIN files f ON c.file_id = f.id WHERE f.source = ?'
      params.push(source)
    }

    const stmt = this.db.prepare(query)
    const row = stmt.get(...params) as { count: number }
    return row.count
  }

  // ===========================================================================
  // Meta Operations
  // ===========================================================================

  /**
   * Get meta value
   */
  getMeta(key: string): string | null {
    const stmt = this.db.prepare('SELECT value FROM meta WHERE key = ?')
    const row = stmt.get(key) as { value: string } | undefined
    return row?.value ?? null
  }

  /**
   * Set meta value
   */
  setMeta(key: string, value: string): void {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
    stmt.run(key, value)
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Close database connection
   */
  close(): void {
    try {
      // Run checkpoint before closing to ensure all WAL data is written
      this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    } catch {
      // Ignore checkpoint errors
    }

    this.db.close()
  }
}
