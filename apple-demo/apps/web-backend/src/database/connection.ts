import fs from 'node:fs'
import path from 'node:path'

import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js'

import { SQLITE_DATA_PATH } from '../config/index.js'
import { DatabaseError } from '../utils/errors.js'

let SQL: SqlJsStatic | null = null
const dbInstances = new Map<string, SqlJsDatabase>()

async function initSqlJsEngine(): Promise<SqlJsStatic> {
  if (SQL) {
    return SQL
  }
  SQL = await initSqlJs()
  return SQL
}

export function getDatabasePath(dbName: string): string {
  const filename = dbName.endsWith('.db') ? dbName : `${dbName}.db`
  return path.join(SQLITE_DATA_PATH, filename)
}

export async function getDatabase(dbName: string): Promise<SqlJsDatabase> {
  const sqlJs = await initSqlJsEngine()
  const dbPath = getDatabasePath(dbName)

  if (dbInstances.has(dbPath)) {
    return dbInstances.get(dbPath)!
  }

  try {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    const db = fs.existsSync(dbPath)
      ? new sqlJs.Database(fs.readFileSync(dbPath))
      : new sqlJs.Database()
    dbInstances.set(dbPath, db)
    return db
  } catch (error) {
    throw new DatabaseError(`Failed to open database '${dbName}': ${String(error)}`)
  }
}

export function saveDatabase(dbName: string): void {
  const dbPath = getDatabasePath(dbName)
  const db = dbInstances.get(dbPath)
  if (!db) {
    return
  }
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  fs.writeFileSync(dbPath, Buffer.from(db.export()))
}

export function closeAllConnections(): void {
  for (const [dbPath, db] of dbInstances) {
    try {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true })
      fs.writeFileSync(dbPath, Buffer.from(db.export()))
      db.close()
    } catch (error) {
      console.error(`Failed to close database ${dbPath}`, error)
    }
  }
  dbInstances.clear()
}
