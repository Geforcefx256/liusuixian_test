import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'

import * as XLSX from 'xlsx'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

function writeWorkbook(filePath: string, rows: unknown[][]): void {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, sheet, 'CHECK_RULE')
  XLSX.writeFile(workbook, filePath)
}

function runCli(args: string[], cwd: string) {
  return spawnSync(
    process.execPath,
    ['--import', 'tsx', './src/cli.ts', ...args],
    {
      cwd,
      encoding: 'utf8'
    }
  )
}

describe('mml cli init command', () => {
  let tempDir: string
  let rulesDir: string
  let dbPath: string
  const packageDir = process.cwd()

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'mml-cli-'))
    rulesDir = join(tempDir, 'rules')
    dbPath = join(tempDir, 'data', 'mml-rules.db')
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('initializes the database from workbooks and replaces existing rulesets', () => {
    const workbookPath = join(rulesDir, 'CHECK_RULE_AMF_20.9.2.xlsx')
    mkdirSync(rulesDir, { recursive: true })
    writeWorkbook(workbookPath, [
      ['命令', '参数序号', '参数', '类型', '是否可选', '条件', '枚举', '位域值', '默认值', '最大值', '最小值', '区间', '最大长度', '最小长度', '长度', '', '是否区分大小写'],
      ['ADD SGSLNK', 1, 'LNK', '整数', '必选', '', '', '', '', 8, 0, '', '', '', '', '', '是']
    ])

    const firstRun = runCli(['--db', dbPath, 'init', '--dir', rulesDir], packageDir)
    expect(firstRun.status).toBe(0)
    expect(existsSync(dbPath)).toBe(true)
    expect(JSON.parse(firstRun.stdout)).toEqual({
      imported: 1,
      files: ['CHECK_RULE_AMF_20.9.2.xlsx']
    })

    writeWorkbook(workbookPath, [
      ['命令', '参数序号', '参数', '类型', '是否可选', '条件', '枚举', '位域值', '默认值', '最大值', '最小值', '区间', '最大长度', '最小长度', '长度', '', '是否区分大小写'],
      ['ADD SGSLNK', 1, 'LNK', '整数', '必选', '', '', '', '', 511, 0, '', '', '', '', '', '是'],
      ['ADD SGSLNK', 2, 'IPTYPE', '枚举', '可选', '', '["IPV4","IPV6"]', '', 'IPV4', '', '', '', '', '', '', '', '是']
    ])

    const secondRun = runCli(['--db', dbPath, 'init', '--dir', rulesDir], packageDir)
    expect(secondRun.status).toBe(0)

    const showRun = runCli(['--db', dbPath, 'schema', 'show', '--type', 'AMF', '--version', '20.9.2'], packageDir)
    expect(showRun.status).toBe(0)

    const payload = JSON.parse(showRun.stdout)
    expect(payload.commands).toHaveLength(1)
    expect(payload.commands[0].params).toHaveLength(2)
    expect(payload.commands[0].params[0]).toMatchObject({
      paramName: 'LNK',
      numberConstraints: {
        minValue: 0,
        maxValue: 511,
        interval: null
      }
    })
  })

  it('returns exit code 3 when the source directory does not exist', () => {
    const response = runCli(['--db', dbPath, 'init', '--dir', join(tempDir, 'missing-rules')], packageDir)

    expect(response.status).toBe(3)
    expect(response.stderr).toContain('Directory not found:')
    expect(existsSync(dbPath)).toBe(false)
  })

  it('does not expose the legacy import command in help or execution', () => {
    const help = runCli(['--help'], packageDir)
    expect(help.status).toBe(0)
    expect(help.stdout).toContain('init')
    expect(help.stdout).not.toContain(' import ')
    expect(help.stdout).not.toContain('mml --db ./data/mml-rules.db import --dir ./data/mml-rules')

    const legacy = runCli(['import', '--dir', tempDir], packageDir)
    expect(legacy.status).not.toBe(0)
    expect(`${legacy.stderr}${legacy.stdout}`).toContain("unknown command 'import'")
  })
})
