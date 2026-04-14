import fs from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'

import * as XLSX from 'xlsx'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createApp, initializeAppData } from '../src/app.js'
import { __resetMmlRulesConfigForTests, __setMmlRulesConfigForTests } from '../src/config/index.js'
import { getServiceRoot } from '../src/config/runtimePaths.js'
import { closeAllConnections } from '../src/database/connection.js'
import { closeMmlRuleCatalog } from '../src/mmlRules/catalog.js'
import { invokeApp } from './httpHarness.js'

const SQLITE_ROOT = path.join(getServiceRoot(), 'SQLite')

function extractCookie(setCookieHeader: string | string[] | undefined): string {
  const rawHeader = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader
  if (!rawHeader) {
    throw new Error('Missing set-cookie header')
  }
  return rawHeader.split(';')[0]
}

function writeWorkbook(filePath: string, rows: unknown[][]): void {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, sheet, 'CHECK_RULE')
  XLSX.writeFile(workbook, filePath)
}

describe('mml routes', () => {
  let tempDir: string

  beforeEach(async () => {
    closeMmlRuleCatalog()
    closeAllConnections()
    __resetMmlRulesConfigForTests()
    fs.rmSync(SQLITE_ROOT, { recursive: true, force: true })

    tempDir = fs.mkdtempSync(path.join(tmpdir(), 'web-mml-route-'))
    const sourceDir = path.join(tempDir, 'rules')
    fs.mkdirSync(sourceDir, { recursive: true })
    writeWorkbook(path.join(sourceDir, 'CHECK_RULE_UNC_20.11.2.xlsx'), [
      ['命令', '参数序号', '参数', '类型', '是否可选', '条件', '枚举', '位域值', '默认值', '最大值', '最小值', '区间', '最大长度', '最小长度', '长度', '', '是否区分大小写'],
      ['ADD USER', 1, 'MODE', '枚举', '可选', '', '["AUTO","MANUAL"]', '', 'AUTO', '', '', '', '', '', '', '', '是']
    ])
    writeWorkbook(path.join(sourceDir, 'CHECK_RULE_AMF_20.9.2.xlsx'), [
      ['命令', '参数序号', '参数', '类型', '是否可选', '条件', '枚举', '位域值', '默认值', '最大值', '最小值', '区间', '最大长度', '最小长度', '长度', '', '是否区分大小写'],
      ['ADD DEVICE', 1, 'TYPE', '枚举', '可选', '', '["A","B"]', '', 'A', '', '', '', '', '', '', '', '是']
    ])
    __setMmlRulesConfigForTests({
      sourceDir,
      dbPath: path.join(tempDir, 'mml-rules.db'),
      importOnStartup: true,
      failOnStartupImportError: true
    })

    await initializeAppData()
  })

  afterEach(() => {
    closeMmlRuleCatalog()
    closeAllConnections()
    __resetMmlRulesConfigForTests()
    fs.rmSync(SQLITE_ROOT, { recursive: true, force: true })
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('rejects unauthenticated schema lookup', async () => {
    const response = await invokeApp(createApp(), {
      path: '/web/api/mml/schema?networkType=UNC&networkVersion=20.11.2'
    })

    expect(response.status).toBe(401)
  })

  it('returns imported schema for an authenticated session', async () => {
    const app = createApp()
    const loginResponse = await invokeApp(app, {
      method: 'POST',
      path: '/web/api/auth/login',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5175'
      },
      body: JSON.stringify({
        account: 'admin',
        password: 'Admin@123456'
      })
    })
    const cookie = extractCookie(loginResponse.headers['set-cookie'])

    const response = await invokeApp(app, {
      path: '/web/api/mml/schema?networkType=UNC&networkVersion=20.11.2',
      headers: {
        Cookie: cookie
      }
    })

    expect(response.status).toBe(200)
    const payload = response.json<{
      success: boolean
      data: {
        schema: {
          networkType: string
          networkVersion: string
          commands: Array<{ commandName: string }>
        } | null
      }
    }>()
    expect(payload.success).toBe(true)
    expect(payload.data.schema).toMatchObject({
      networkType: 'UNC',
      networkVersion: '20.11.2'
    })
    expect(payload.data.schema?.commands).toEqual([
      expect.objectContaining({ commandName: 'ADD USER' })
    ])
  })

  it('returns backend-driven type and version options for an authenticated session', async () => {
    const app = createApp()
    const loginResponse = await invokeApp(app, {
      method: 'POST',
      path: '/web/api/auth/login',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5175'
      },
      body: JSON.stringify({
        account: 'admin',
        password: 'Admin@123456'
      })
    })
    const cookie = extractCookie(loginResponse.headers['set-cookie'])

    const response = await invokeApp(app, {
      path: '/web/api/mml/options',
      headers: {
        Cookie: cookie
      }
    })

    expect(response.status).toBe(200)
    expect(response.json<{
      success: boolean
      data: {
        networkTypes: string[]
        networkVersionsByType: Record<string, string[]>
      }
    }>()).toMatchObject({
      success: true,
      data: {
        networkTypes: ['AMF', 'UNC'],
        networkVersionsByType: {
          AMF: ['20.9.2'],
          UNC: ['20.11.2']
        }
      }
    })
  })

  it('returns a null schema when no active ruleset exists', async () => {
    const app = createApp()
    const loginResponse = await invokeApp(app, {
      method: 'POST',
      path: '/web/api/auth/login',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5175'
      },
      body: JSON.stringify({
        account: 'admin',
        password: 'Admin@123456'
      })
    })
    const cookie = extractCookie(loginResponse.headers['set-cookie'])

    const response = await invokeApp(app, {
      path: '/web/api/mml/schema?networkType=AMF&networkVersion=99.9.9',
      headers: {
        Cookie: cookie
      }
    })

    expect(response.status).toBe(200)
    expect(response.json<{ success: boolean; data: { schema: null } }>()).toMatchObject({
      success: true,
      data: {
        schema: null
      }
    })
  })
})
