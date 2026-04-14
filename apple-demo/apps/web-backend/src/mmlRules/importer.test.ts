import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import * as XLSX from 'xlsx'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { MmlRuleImporter } from './importer.js'
import { MmlRuleStore } from './store.js'

function writeWorkbook(filePath: string, rows: unknown[][]): void {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, sheet, 'CHECK_RULE')
  XLSX.writeFile(workbook, filePath)
}

describe('MmlRuleImporter', () => {
  let tempDir: string
  let store: MmlRuleStore
  let importer: MmlRuleImporter

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'web-mml-rules-'))
    store = new MmlRuleStore(join(tempDir, 'rules.db'))
    store.initialize()
    importer = new MmlRuleImporter(store)
  })

  afterEach(() => {
    store.close()
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('imports a compliant workbook, persists schema metadata, and deletes the source file after success', () => {
    const workbookPath = join(tempDir, 'CHECK_RULE_AMF_20.9.2.xlsx')
    writeWorkbook(workbookPath, [
      ['命令', '参数序号', '参数', '类型', '是否可选', '条件', '枚举', '位域值', '默认值', '最大值', '最小值', '区间', '最大长度', '最小长度', '长度', '', '是否区分大小写'],
      ['ADD SGSLNK', 1, 'LNK', '整数', '必选', '', '', '', '', 8, 0, '', '', '', '', '', '是'],
      ['ADD SGSLNK', 2, 'IPTYPE', '枚举', '必选', '', '["IPV4","IPV6"]', '', 'IPV4', '', '', '', '', '', '', '', '是'],
      ['ADD SGSLNK', 3, 'CIPHER', '位域类型', '条件可选', '{"2=IPV4":"可选","2=IPV6":"必选"}', '', '["TLS1","TLS2","TLS3"]', '', '', '', '', '', '', '', '', '是']
    ])

    const firstImport = importer.importWorkbook(workbookPath)
    const schema = store.getSchema('AMF', '20.9.2')

    expect(firstImport.status).toBe('imported')
    expect(existsSync(workbookPath)).toBe(false)
    expect(schema).toMatchObject({
      networkType: 'AMF',
      networkVersion: '20.9.2'
    })
    expect(schema?.commands[0].params).toEqual([
      expect.objectContaining({
        paramName: 'LNK',
        valueFormat: 'integer',
        numberConstraints: {
          minValue: 0,
          maxValue: 8,
          interval: null
        }
      }),
      expect.objectContaining({
        paramName: 'IPTYPE',
        controlType: 'select',
        enumValues: ['IPV4', 'IPV6']
      }),
      expect.objectContaining({
        paramName: 'CIPHER',
        controlType: 'composite',
        requiredMode: 'conditional_optional',
        compositeFlagSetOptions: ['TLS1', 'TLS2', 'TLS3'],
        conditions: [
          expect.objectContaining({ expression: '2=IPV4', requiredMode: 'optional' }),
          expect.objectContaining({ expression: '2=IPV6', requiredMode: 'required' })
        ]
      })
    ])
  })

  it('replaces stored data for the same network type and version before re-importing', () => {
    const workbookPath = join(tempDir, 'CHECK_RULE_AMF_20.9.2.xlsx')
    writeWorkbook(workbookPath, [
      ['ADD VLR', 1, 'VN', '字符串', '必选', '', '', '', '', '', '', '', 32, 1, 16, '', '是']
    ])
    const firstImport = importer.importWorkbook(workbookPath)

    expect(firstImport.status).toBe('imported')
    expect(existsSync(workbookPath)).toBe(false)

    writeWorkbook(workbookPath, [
      ['ADD VLR', 1, 'VN', '字符串', '必选', '', '', '', '', '', '', '', 64, 1, '', '', '是'],
      ['ADD VLR', 2, 'MODE', '枚举', '可选', '', '["AUTO","MANUAL"]', '', 'AUTO', '', '', '', '', '', '', '', '是']
    ])

    const outcome = importer.importWorkbook(workbookPath)
    const schema = store.getSchema('AMF', '20.9.2')

    expect(outcome.status).toBe('imported')
    expect(existsSync(workbookPath)).toBe(false)
    expect(schema?.commands[0].params).toHaveLength(2)
    expect(schema?.commands[0].params[0]).toMatchObject({
      paramName: 'VN',
      lengthConstraints: {
        minLength: 1,
        maxLength: 64,
        exactLength: null
      }
    })
  })

  it('does not derive string length bounds from the excel exact-length column alone', () => {
    const workbookPath = join(tempDir, 'CHECK_RULE_AMF_20.9.2.xlsx')
    writeWorkbook(workbookPath, [
      ['命令', '参数序号', '参数', '类型', '是否可选', '条件', '枚举', '位域值', '默认值', '最大值', '最小值', '区间', '最大长度', '最小长度', '长度', '', '是否区分大小写'],
      ['ADD VLR', 1, 'VN', '字符串', '必选', '', '', '', '', '', '', '', '', '', 32, '', '是']
    ])

    const outcome = importer.importWorkbook(workbookPath)
    const schema = store.getSchema('AMF', '20.9.2')

    expect(outcome.status).toBe('imported')
    expect(schema?.commands[0].params[0]).toMatchObject({
      paramName: 'VN',
      lengthConstraints: null
    })
  })

  it('keeps conditional requirement metadata separate from unconditional required flags', () => {
    const workbookPath = join(tempDir, 'CHECK_RULE_UNC_20.11.2.xlsx')
    writeWorkbook(workbookPath, [
      ['命令', '参数序号', '参数', '类型', '是否可选', '条件', '枚举', '位域值', '默认值', '最大值', '最小值', '区间', '最大长度', '最小长度', '长度', '', '是否区分大小写'],
      ['ADD SGSLNK', 1, 'LNK', '整数', '必选', '', '', '', '', 511, 0, '', '', '', '', '', '是'],
      ['ADD SGSLNK', 2, 'IPTYPE', '枚举', '可选', '', '["IPV4","IPV6"]', '', 'IPV4', '', '', '', '', '', '', '', '是'],
      ['ADD SGSLNK', 3, 'VLRIPV4_1', 'IPV4', '条件必选', '{"2=IPV4":"必选"}', '', '', '', '', '', '', '', '', '', '', '是'],
      ['ADD SGSLNK', 4, 'VLRIPV6_1', 'IPV6', '条件必选', '{"2=IPV6":"必选"}', '', '', '', '', '', '', '', '', '', '', '是'],
      ['ADD SGSLNK', 5, 'LOCALIPV6_1', 'IPV6', '条件可选', '{"2=IPV6":"可选"}', '', '', '', '', '', '', '', '', '', '', '是']
    ])

    importer.importWorkbook(workbookPath)
    const schema = store.getSchema('UNC', '20.11.2')
    const params = schema?.commands.find(command => command.commandName === 'ADD SGSLNK')?.params || []

    expect(params.find(param => param.paramName === 'LNK')).toMatchObject({
      required: true,
      requiredMode: 'required'
    })
    expect(params.find(param => param.paramName === 'VLRIPV4_1')).toMatchObject({
      required: false,
      requiredMode: 'conditional_required',
      conditions: [expect.objectContaining({ expression: '2=IPV4', requiredMode: 'required' })]
    })
    expect(params.find(param => param.paramName === 'VLRIPV6_1')).toMatchObject({
      required: false,
      requiredMode: 'conditional_required',
      conditions: [expect.objectContaining({ expression: '2=IPV6', requiredMode: 'required' })]
    })
    expect(params.find(param => param.paramName === 'LOCALIPV6_1')).toMatchObject({
      required: false,
      requiredMode: 'conditional_optional',
      conditions: [expect.objectContaining({ expression: '2=IPV6', requiredMode: 'optional' })]
    })
  })
})
