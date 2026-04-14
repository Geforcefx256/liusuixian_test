import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createRequire } from 'node:module'

import type { MmlSchemaCommand, MmlSchemaParameter, MmlSchemaResponse } from './schema.js'
import type { ImportedMmlCommand, ImportedMmlParameter, ImportedMmlRuleset, WorkbookImportOutcome } from './types.js'

interface DatabaseSyncLike {
  exec(sql: string): void
  close(): void
  prepare(sql: string): {
    get(...params: unknown[]): unknown
    all(...params: unknown[]): unknown[]
    run(...params: unknown[]): unknown
  }
}

interface RulesetRow {
  network_type: string
  network_version: string
  checksum: string
  source_file_name: string
  imported_at: number
}

interface NetworkOptionRow {
  network_type: string
  network_version: string
}

interface SchemaRow {
  network_type: string
  network_version: string
  command_name: string
  param_name: string
  label: string
  order_param_id: number
  value_type: MmlSchemaParameter['valueType']
  value_format: NonNullable<MmlSchemaParameter['valueFormat']>
  control_type: MmlSchemaParameter['controlType']
  required: number
  required_mode: MmlSchemaParameter['requiredMode']
  enum_values_json: string
  composite_flag_set_options_json: string
  default_value: string | null
  editable: number
  conditions_json: string
  number_constraints_json: string | null
  length_constraints_json: string | null
  case_sensitive: number
  source_json: string
}

export class MmlRuleStore {
  private readonly db: DatabaseSyncLike

  constructor(private readonly dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true })
    const DatabaseSync = loadDatabaseSync()
    this.db = new DatabaseSync(dbPath)
    this.db.exec('PRAGMA foreign_keys = ON;')
  }

  initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mml_rule_rulesets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        network_type TEXT NOT NULL,
        network_version TEXT NOT NULL,
        source_file_name TEXT NOT NULL,
        source_file_path TEXT NOT NULL,
        checksum TEXT NOT NULL,
        imported_at INTEGER NOT NULL,
        active INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_mml_rule_rulesets_lookup
      ON mml_rule_rulesets (network_type, network_version, active);

      CREATE TABLE IF NOT EXISTS mml_rule_commands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ruleset_id INTEGER NOT NULL REFERENCES mml_rule_rulesets(id) ON DELETE CASCADE,
        command_name TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_mml_rule_commands_unique
      ON mml_rule_commands (ruleset_id, command_name);

      CREATE TABLE IF NOT EXISTS mml_rule_parameters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        command_id INTEGER NOT NULL REFERENCES mml_rule_commands(id) ON DELETE CASCADE,
        param_name TEXT NOT NULL,
        label TEXT NOT NULL,
        order_param_id INTEGER NOT NULL,
        value_type TEXT NOT NULL,
        value_format TEXT NOT NULL,
        control_type TEXT NOT NULL,
        required INTEGER NOT NULL,
        required_mode TEXT NOT NULL,
        enum_values_json TEXT NOT NULL,
        composite_flag_set_options_json TEXT NOT NULL,
        default_value TEXT,
        editable INTEGER NOT NULL,
        conditions_json TEXT NOT NULL,
        number_constraints_json TEXT,
        length_constraints_json TEXT,
        case_sensitive INTEGER NOT NULL,
        source_json TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_mml_rule_parameters_unique
      ON mml_rule_parameters (command_id, param_name);
    `)
  }

  close(): void {
    this.db.close()
  }

  replaceActiveRuleset(ruleset: ImportedMmlRuleset): WorkbookImportOutcome {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      this.db.prepare(`
        DELETE FROM mml_rule_rulesets
        WHERE network_type = ? AND network_version = ?
      `).run(ruleset.networkType, ruleset.networkVersion)

      const insertedRuleset = this.db.prepare(`
        INSERT INTO mml_rule_rulesets (
          network_type,
          network_version,
          source_file_name,
          source_file_path,
          checksum,
          imported_at,
          active
        ) VALUES (?, ?, ?, ?, ?, ?, 1)
      `).run(
        ruleset.networkType,
        ruleset.networkVersion,
        ruleset.fileName,
        ruleset.filePath,
        ruleset.checksum,
        Date.now()
      ) as { lastInsertRowid?: number | bigint }

      const rulesetId = Number(insertedRuleset.lastInsertRowid)
      for (const command of ruleset.commands) {
        const commandId = this.insertCommand(rulesetId, command)
        for (const parameter of command.params) {
          this.insertParameter(commandId, parameter)
        }
      }

      this.db.exec('COMMIT')
      return {
        status: 'imported',
        identity: ruleset,
        commandCount: ruleset.commands.length,
        parameterCount: ruleset.commands.reduce((count, command) => count + command.params.length, 0)
      }
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  getNetworkOptions(): { networkTypes: string[]; networkVersionsByType: Record<string, string[]> } {
    const rows = this.db.prepare(`
      SELECT DISTINCT network_type, network_version
      FROM mml_rule_rulesets
      WHERE active = 1
      ORDER BY network_type ASC, network_version ASC
    `).all() as unknown as NetworkOptionRow[]

    const networkVersionsByType: Record<string, string[]> = {}
    for (const row of rows) {
      const nextVersions = networkVersionsByType[row.network_type] || []
      nextVersions.push(row.network_version)
      networkVersionsByType[row.network_type] = nextVersions
    }

    return {
      networkTypes: Object.keys(networkVersionsByType).sort((left, right) => left.localeCompare(right, 'en')),
      networkVersionsByType
    }
  }

  getSchema(networkType: string, networkVersion: string): MmlSchemaResponse | null {
    const activeRuleset = this.db.prepare(`
      SELECT network_type, network_version, checksum, source_file_name, imported_at
      FROM mml_rule_rulesets
      WHERE network_type = ? AND network_version = ? AND active = 1
      LIMIT 1
    `).get(networkType, networkVersion) as RulesetRow | undefined

    if (!activeRuleset) {
      return null
    }

    const rows = this.db.prepare(`
      SELECT
        rs.network_type,
        rs.network_version,
        c.command_name,
        p.param_name,
        p.label,
        p.order_param_id,
        p.value_type,
        p.value_format,
        p.control_type,
        p.required,
        p.required_mode,
        p.enum_values_json,
        p.composite_flag_set_options_json,
        p.default_value,
        p.editable,
        p.conditions_json,
        p.number_constraints_json,
        p.length_constraints_json,
        p.case_sensitive,
        p.source_json
      FROM mml_rule_rulesets rs
      JOIN mml_rule_commands c
        ON c.ruleset_id = rs.id
      JOIN mml_rule_parameters p
        ON p.command_id = c.id
      WHERE rs.network_type = ? AND rs.network_version = ? AND rs.active = 1
      ORDER BY c.command_name, p.order_param_id, p.param_name
    `).all(networkType, networkVersion) as unknown as SchemaRow[]

    const commands = new Map<string, MmlSchemaCommand>()
    for (const row of rows) {
      const command = commands.get(row.command_name) || {
        commandName: row.command_name,
        params: []
      }
      command.params.push({
        paramName: row.param_name,
        label: row.label,
        valueType: row.value_type,
        valueFormat: row.value_format,
        controlType: row.control_type,
        required: row.required === 1,
        requiredMode: row.required_mode,
        orderParamId: row.order_param_id,
        enumValues: parseJsonArray(row.enum_values_json),
        compositeFlagSetOptions: parseJsonArray(row.composite_flag_set_options_json),
        defaultValue: row.default_value,
        editable: row.editable === 1,
        conditions: parseJsonObject(row.conditions_json, []),
        numberConstraints: parseJsonObject(row.number_constraints_json, null),
        lengthConstraints: parseJsonObject(row.length_constraints_json, null),
        caseSensitive: row.case_sensitive === 1,
        source: parseJsonObject(row.source_json, {})
      })
      commands.set(row.command_name, command)
    }

    return {
      networkType: activeRuleset.network_type,
      networkVersion: activeRuleset.network_version,
      commands: [...commands.values()]
    }
  }

  private insertCommand(rulesetId: number, command: ImportedMmlCommand): number {
    const result = this.db.prepare(`
      INSERT INTO mml_rule_commands (ruleset_id, command_name)
      VALUES (?, ?)
    `).run(rulesetId, command.commandName) as { lastInsertRowid?: number | bigint }
    return Number(result.lastInsertRowid)
  }

  private insertParameter(commandId: number, parameter: ImportedMmlParameter): void {
    this.db.prepare(`
      INSERT INTO mml_rule_parameters (
        command_id,
        param_name,
        label,
        order_param_id,
        value_type,
        value_format,
        control_type,
        required,
        required_mode,
        enum_values_json,
        composite_flag_set_options_json,
        default_value,
        editable,
        conditions_json,
        number_constraints_json,
        length_constraints_json,
        case_sensitive,
        source_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      commandId,
      parameter.paramName,
      parameter.label,
      parameter.orderParamId,
      parameter.valueType,
      parameter.valueFormat,
      parameter.controlType,
      parameter.required ? 1 : 0,
      parameter.requiredMode,
      JSON.stringify(parameter.enumValues),
      JSON.stringify(parameter.compositeFlagSetOptions),
      parameter.defaultValue,
      parameter.editable ? 1 : 0,
      JSON.stringify(parameter.conditions),
      parameter.numberConstraints ? JSON.stringify(parameter.numberConstraints) : null,
      parameter.lengthConstraints ? JSON.stringify(parameter.lengthConstraints) : null,
      parameter.caseSensitive ? 1 : 0,
      JSON.stringify(parameter.source)
    )
  }
}

function loadDatabaseSync(): new (path: string) => DatabaseSyncLike {
  const require = createRequire(import.meta.url)
  const sqliteModule = require('node:sqlite') as {
    DatabaseSync: new (path: string) => DatabaseSyncLike
  }
  return sqliteModule.DatabaseSync
}

function parseJsonArray(value: string): string[] {
  return parseJsonObject<string[]>(value, [])
}

function parseJsonObject<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback
  }
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}
