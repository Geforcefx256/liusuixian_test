/**
 * Daily Log Manager
 *
 * Manages daily log files stored in memory/YYYY-MM-DD.md format.
 * Based on OpenClaw's daily log implementation.
 */

import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { SQLiteStore } from './SQLiteStore.js'
import type {
  DailyLogEntry,
  CreateDailyLogRequest,
  DailyLogType
} from './types.js'

const MEMORY_DIR = 'memory'

/**
 * Daily log manager
 */
export class DailyLogManager {
  private store: SQLiteStore
  private workspaceDir: string
  private memoryDir: string
  private entriesByDate: Map<string, DailyLogEntry[]> = new Map()
  private loadedDates: Set<string> = new Set()

  constructor(store: SQLiteStore, workspaceDir: string) {
    this.store = store
    this.workspaceDir = workspaceDir
    this.memoryDir = path.join(workspaceDir, MEMORY_DIR)
  }

  /**
   * Ensure memory directory exists
   */
  private async ensureDir(): Promise<void> {
    try {
      await fs.mkdir(this.memoryDir, { recursive: true })
    } catch {
      // Ignore
    }
  }

  /**
   * Get file path for a date
   */
  private getFilePath(date: string): string {
    return path.join(this.memoryDir, `${date}.md`)
  }

  /**
   * Load entries for a specific date
   */
  private async loadDate(date: string): Promise<void> {
    if (this.loadedDates.has(date)) return

    const filePath = this.getFilePath(date)
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const entries = this.parseMarkdown(content, date)
      this.entriesByDate.set(date, entries)
    } catch {
      // File doesn't exist
      this.entriesByDate.set(date, [])
    }

    this.loadedDates.add(date)
  }

  /**
   * Save entries for a specific date
   */
  private async saveDate(date: string): Promise<void> {
    await this.ensureDir()

    const entries = this.entriesByDate.get(date) ?? []
    const content = this.toMarkdown(entries, date)
    const filePath = this.getFilePath(date)

    await fs.writeFile(filePath, content, 'utf-8')
  }

  /**
   * Parse daily log markdown
   */
  private parseMarkdown(content: string, date: string): DailyLogEntry[] {
    const entries: DailyLogEntry[] = []

    // Parse entries marked with special format
    // Format: <!-- log:ID type:TYPE tags:TAG1,TAG2 -->
    const regex = /<!-- log:([a-f0-9-]+) type:(\w+) tags:([^>]+) -->\n(.+?)(?=\n<!-- log:|$)/gs

    let match
    while ((match = regex.exec(content)) !== null) {
      const [_, id, type, tags, contentText] = match

      entries.push({
        id,
        date,
        content: contentText.trim(),
        type: type as DailyLogType,
        tags: tags.split(',').filter(Boolean),
        createdAt: Date.now() // We don't store exact time in file
      })
    }

    return entries
  }

  /**
   * Convert entries to Markdown
   */
  private toMarkdown(entries: DailyLogEntry[], date: string): string {
    const lines: string[] = [
      `# Daily Log - ${date}`,
      '',
      `This file contains daily context, tasks, and notes for ${date}.`,
      '',
      '## Entries',
      ''
    ]

    // Group by type
    const byType = new Map<DailyLogType, DailyLogEntry[]>()
    for (const entry of entries) {
      if (!byType.has(entry.type)) {
        byType.set(entry.type, [])
      }
      byType.get(entry.type)!.push(entry)
    }

    // Write entries by type
    for (const [type, typeEntries] of byType) {
      lines.push(`### ${type}`)
      lines.push('')

      for (const entry of typeEntries) {
        lines.push(`<!-- log:${entry.id} type:${entry.type} tags:${entry.tags.join(',')} -->`)
        lines.push(entry.content)
        lines.push('')
      }
    }

    return lines.join('\n')
  }

  /**
   * Get today's date string
   */
  private getTodayDateString(): string {
    return new Date().toISOString().split('T')[0]
  }

  // ===========================================================================
  // CRUD Operations
  // ===========================================================================

  /**
   * Get all entries for a date
   */
  async getByDate(date: string): Promise<DailyLogEntry[]> {
    await this.loadDate(date)
    return this.entriesByDate.get(date) ?? []
  }

  /**
   * Get today's entries
   */
  async getToday(): Promise<DailyLogEntry[]> {
    return this.getByDate(this.getTodayDateString())
  }

  /**
   * Get entries for date range
   */
  async getByDateRange(start: string, end: string): Promise<DailyLogEntry[]> {
    const entries: DailyLogEntry[] = []
    const startDate = new Date(start)
    const endDate = new Date(end)

    for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      const dateEntries = await this.getByDate(dateStr)
      entries.push(...dateEntries)
    }

    return entries
  }

  /**
   * Get list of dates with entries
   */
  async getDates(): Promise<string[]> {
    await this.ensureDir()

    const files = await fs.readdir(this.memoryDir)
    return files
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace('.md', ''))
      .sort((a, b) => b.localeCompare(a)) // Most recent first
  }

  /**
   * Get entry by ID
   */
  async getById(id: string): Promise<DailyLogEntry | null> {
    // We need to search all loaded dates
    for (const entries of this.entriesByDate.values()) {
      const found = entries.find(e => e.id === id)
      if (found) return found
    }

    // If not found, we might need to load all dates
    // For now, return null
    return null
  }

  /**
   * Add new log entry
   */
  async add(request: CreateDailyLogRequest): Promise<DailyLogEntry> {
    const date = request.date ?? this.getTodayDateString()
    await this.loadDate(date)

    const id = uuidv4()

    const entry: DailyLogEntry = {
      id,
      date,
      content: request.content,
      type: request.type ?? 'note',
      tags: request.tags ?? [],
      createdAt: Date.now()
    }

    const entries = this.entriesByDate.get(date) ?? []
    entries.push(entry)
    this.entriesByDate.set(date, entries)

    await this.saveDate(date)

    return entry
  }

  /**
   * Delete log entry
   */
  async delete(id: string, date: string): Promise<boolean> {
    await this.loadDate(date)

    const entries = this.entriesByDate.get(date) ?? []
    const index = entries.findIndex(e => e.id === id)

    if (index === -1) return false

    entries.splice(index, 1)
    this.entriesByDate.set(date, entries)

    await this.saveDate(date)

    return true
  }

  /**
   * Search logs by content
   */
  async search(query: string, dateRange?: { start: string; end: string }): Promise<DailyLogEntry[]> {
    const results: DailyLogEntry[] = []
    const lowerQuery = query.toLowerCase()

    let dates: string[]
    if (dateRange) {
      dates = await this.getDatesInRange(dateRange.start, dateRange.end)
    } else {
      dates = await this.getDates()
    }

    for (const date of dates) {
      const entries = await this.getByDate(date)
      for (const entry of entries) {
        if (entry.content.toLowerCase().includes(lowerQuery)) {
          results.push(entry)
        } else if (entry.tags.some(t => t.toLowerCase().includes(lowerQuery))) {
          results.push(entry)
        }
      }
    }

    return results
  }

  /**
   * Get dates in range
   */
  private async getDatesInRange(start: string, end: string): Promise<string[]> {
    const dates: string[] = []
    const startDate = new Date(start)
    const endDate = new Date(end)

    for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0])
    }

    return dates
  }

  /**
   * Sync to SQLite index
   */
  async syncToIndex(): Promise<void> {
    await this.ensureDir()

    const dates = await this.getDates()

    for (const date of dates) {
      const filePath = this.getFilePath(date)

      // Get existing file record
      let fileRecord = this.store.getFile(filePath)

      // Check if we need to reindex
      try {
        const stat = await fs.stat(filePath)
        const lastModified = stat.mtimeMs
        const existingModified = fileRecord?.lastModified ?? 0

        if (fileRecord && existingModified >= lastModified) {
          // Already up to date
          continue
        }

        // Delete existing chunks
        if (fileRecord) {
          this.store.deleteChunksByFileId(fileRecord.id)
        }

        // Create/update file record
        const fileId = this.store.upsertFile(
          filePath,
          'daily',
          null,
          lastModified
        )

        // Chunk and index content
        const content = await fs.readFile(filePath, 'utf-8')
        const lines = content.split('\n')

        // Simple chunking
        const CHUNK_SIZE = 1600
        const CHUNK_OVERLAP = 320

        let currentChunk: string[] = []
        let currentStartLine = 1
        let currentLine = 1

        for (let i = 0; i < lines.length; i++) {
          currentChunk.push(lines[i])

          if (currentChunk.join('\n').length >= CHUNK_SIZE) {
            this.store.insertChunk(
              fileId,
              currentChunk.join('\n'),
              currentStartLine,
              currentLine
            )

            const overlapLines = currentChunk.slice(-Math.floor(CHUNK_OVERLAP / 40))
            currentChunk = overlapLines
            currentStartLine = currentLine - overlapLines.length + 1
          }

          currentLine++
        }

        if (currentChunk.length > 0) {
          this.store.insertChunk(
            fileId,
            currentChunk.join('\n'),
            currentStartLine,
            currentLine - 1
          )
        }
      } catch {
        // File might have been deleted
        continue
      }
    }
  }
}