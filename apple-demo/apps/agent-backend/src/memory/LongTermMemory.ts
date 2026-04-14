/**
 * Long-term Memory Manager
 *
 * Manages persistent memories stored in MEMORY.md file.
 * Based on OpenClaw's long-term memory implementation.
 */

import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { SQLiteStore } from './SQLiteStore.js'
import type {
  LongTermMemoryEntry,
  CreateLongTermMemoryRequest,
  UpdateLongTermMemoryRequest,
  LongTermMemoryCategory
} from './types.js'

const MEMORY_FILE = 'MEMORY.md'

/**
 * Long-term memory manager
 */
export class LongTermMemoryManager {
  private store: SQLiteStore
  private workspaceDir: string
  private memoryFilePath: string
  private entries: Map<string, LongTermMemoryEntry> = new Map()
  private loaded = false

  constructor(store: SQLiteStore, workspaceDir: string) {
    this.store = store
    this.workspaceDir = workspaceDir
    this.memoryFilePath = path.join(workspaceDir, MEMORY_FILE)
  }

  /**
   * Load memories from file
   */
  async load(): Promise<void> {
    if (this.loaded) return

    try {
      const content = await fs.readFile(this.memoryFilePath, 'utf-8')
      this.entries = this.parseMarkdown(content)
    } catch (error) {
      // File doesn't exist, start fresh
      this.entries = new Map()
      await this.ensureFile()
    }

    this.loaded = true
  }

  /**
   * Save memories to file
   */
  private async save(): Promise<void> {
    const content = this.toMarkdown()
    await fs.writeFile(this.memoryFilePath, content, 'utf-8')
  }

  /**
   * Ensure MEMORY.md file exists
   */
  private async ensureFile(): Promise<void> {
    try {
      await fs.access(this.memoryFilePath)
    } catch {
      await fs.mkdir(this.workspaceDir, { recursive: true })
      await fs.writeFile(this.memoryFilePath, this.getDefaultContent(), 'utf-8')
    }
  }

  /**
   * Get default MEMORY.md content
   */
  private getDefaultContent(): string {
    return `# Long-term Memory

This file stores persistent facts, decisions, preferences, and patterns.

## Categories

- **preference**: User preferences and choices
- **decision**: Important decisions made
- **pattern**: Recurring patterns observed
- **fact**: Important facts to remember

## Entries

<!-- Memory entries will be added below -->

`
  }

  /**
   * Parse MEMORY.md content
   */
  private parseMarkdown(content: string): Map<string, LongTermMemoryEntry> {
    const entries = new Map<string, LongTermMemoryEntry>()

    // Parse entries marked with special format
    // Format: <!-- mem:ID category:CAT importance:NUM tags:TAG1,TAG2 -->
    // Content follows
    const regex = /<!-- mem:([a-f0-9-]+) category:(\w+) importance:([0-9.]+) tags:([^>]+) -->\n(.+?)(?=\n<!-- mem:|$)/gs

    let match
    while ((match = regex.exec(content)) !== null) {
      const [_, id, category, importance, tags, contentText] = match
      const now = Date.now()

      entries.set(id, {
        id,
        content: contentText.trim(),
        category: category as LongTermMemoryCategory,
        importance: parseFloat(importance),
        tags: tags.split(',').filter(Boolean),
        createdAt: now, // We don't store exact creation time in file
        updatedAt: now,
        lastAccessed: now,
        accessCount: 0
      })
    }

    return entries
  }

  /**
   * Convert memories to Markdown format
   */
  private toMarkdown(): string {
    const lines: string[] = [
      '# Long-term Memory',
      '',
      'This file stores persistent facts, decisions, preferences, and patterns.',
      '',
      '## Categories',
      '',
      '- **preference**: User preferences and choices',
      '- **decision**: Important decisions made',
      '- **pattern**: Recurring patterns observed',
      '- **fact**: Important facts to remember',
      '',
      '## Entries',
      ''
    ]

    // Group by category
    const byCategory = new Map<LongTermMemoryCategory, LongTermMemoryEntry[]>()
    for (const entry of this.entries.values()) {
      const cat = entry.category
      if (!byCategory.has(cat)) {
        byCategory.set(cat, [])
      }
      byCategory.get(cat)!.push(entry)
    }

    // Write entries by category
    for (const [category, entries] of byCategory) {
      lines.push(`### ${category}`)
      lines.push('')

      for (const entry of entries) {
        lines.push(`<!-- mem:${entry.id} category:${entry.category} importance:${entry.importance} tags:${entry.tags.join(',')} -->`)
        lines.push(entry.content)
        lines.push('')
      }
    }

    return lines.join('\n')
  }

  // ===========================================================================
  // CRUD Operations
  // ===========================================================================

  /**
   * Get all memories
   */
  async getAll(): Promise<LongTermMemoryEntry[]> {
    await this.load()
    return Array.from(this.entries.values())
  }

  /**
   * Get memory by ID
   */
  async getById(id: string): Promise<LongTermMemoryEntry | null> {
    await this.load()
    const entry = this.entries.get(id)
    if (entry) {
      entry.lastAccessed = Date.now()
      entry.accessCount++
    }
    return entry ?? null
  }

  /**
   * Add new memory
   */
  async add(request: CreateLongTermMemoryRequest): Promise<LongTermMemoryEntry> {
    await this.load()

    const id = uuidv4()
    const now = Date.now()

    const entry: LongTermMemoryEntry = {
      id,
      content: request.content,
      category: request.category ?? 'fact',
      importance: request.importance ?? 0.5,
      tags: request.tags ?? [],
      createdAt: now,
      updatedAt: now,
      lastAccessed: now,
      accessCount: 0
    }

    this.entries.set(id, entry)
    await this.save()

    return entry
  }

  /**
   * Update memory
   */
  async update(id: string, request: UpdateLongTermMemoryRequest): Promise<LongTermMemoryEntry | null> {
    await this.load()

    const existing = this.entries.get(id)
    if (!existing) return null

    const updated: LongTermMemoryEntry = {
      ...existing,
      content: request.content ?? existing.content,
      category: request.category ?? existing.category,
      importance: request.importance ?? existing.importance,
      tags: request.tags ?? existing.tags,
      updatedAt: Date.now()
    }

    this.entries.set(id, updated)
    await this.save()

    return updated
  }

  /**
   * Delete memory
   */
  async delete(id: string): Promise<boolean> {
    await this.load()

    if (!this.entries.has(id)) return false

    this.entries.delete(id)
    await this.save()

    return true
  }

  /**
   * Search memories by content
   */
  async search(query: string): Promise<LongTermMemoryEntry[]> {
    await this.load()

    const lowerQuery = query.toLowerCase()
    const results: LongTermMemoryEntry[] = []

    for (const entry of this.entries.values()) {
      if (entry.content.toLowerCase().includes(lowerQuery)) {
        results.push(entry)
      } else if (entry.tags.some(t => t.toLowerCase().includes(lowerQuery))) {
        results.push(entry)
      }
    }

    return results
  }

  /**
   * Get memories by category
   */
  async getByCategory(category: LongTermMemoryCategory): Promise<LongTermMemoryEntry[]> {
    await this.load()
    return Array.from(this.entries.values())
      .filter(e => e.category === category)
  }

  /**
   * Sync to SQLite index
   */
  async syncToIndex(): Promise<void> {
    await this.load()

    // Get existing file record
    let fileRecord = this.store.getFile(this.memoryFilePath)

    // Check if we need to reindex
    const stat = await fs.stat(this.memoryFilePath)
    const lastModified = stat.mtimeMs
    const existingModified = fileRecord?.lastModified ?? 0

    if (fileRecord && existingModified >= lastModified) {
      // Already up to date
      return
    }

    // Delete existing chunks
    if (fileRecord) {
      this.store.deleteChunksByFileId(fileRecord.id)
    }

    // Create/update file record
    const fileId = this.store.upsertFile(
      this.memoryFilePath,
      'longterm',
      null,
      lastModified
    )

    // Chunk and index content
    const content = await fs.readFile(this.memoryFilePath, 'utf-8')
    const lines = content.split('\n')

    // Simple chunking: ~400 tokens per chunk (roughly 4 chars per token)
    const CHUNK_SIZE = 1600
    const CHUNK_OVERLAP = 320

    let currentChunk: string[] = []
    let currentStartLine = 1
    let currentLine = 1

    for (let i = 0; i < lines.length; i++) {
      currentChunk.push(lines[i])

      if (currentChunk.join('\n').length >= CHUNK_SIZE) {
        // Save chunk
        this.store.insertChunk(
          fileId,
          currentChunk.join('\n'),
          currentStartLine,
          currentLine
        )

        // Start new chunk with overlap
        const overlapLines = currentChunk.slice(-Math.floor(CHUNK_OVERLAP / 40))
        currentChunk = overlapLines
        currentStartLine = currentLine - overlapLines.length + 1
      }

      currentLine++
    }

    // Save remaining chunk
    if (currentChunk.length > 0) {
      this.store.insertChunk(
        fileId,
        currentChunk.join('\n'),
        currentStartLine,
        currentLine - 1
      )
    }
  }
}