import { describe, expect, it } from 'vitest'
import type { MmlSchemaResponse } from '@/api/types'
import {
  buildMmlDiagnostics,
  findCompositeEditTarget,
  getMmlCompletionItems,
  serializeCompositeEditResult
} from './mmlAssistance'

const schema: MmlSchemaResponse = {
  networkType: 'AMF',
  networkVersion: '20.9.2',
  commands: [
    {
      commandName: 'ADD TEST',
      params: [
        {
          paramName: 'MODE',
          label: 'MODE',
          valueType: 'enum',
          valueFormat: 'enum',
          controlType: 'select',
          required: true,
          requiredMode: 'required',
          orderParamId: 10,
          enumValues: ['A', 'B'],
          defaultValue: null,
          editable: true
        },
        {
          paramName: 'FLAGS',
          label: 'FLAGS',
          valueType: 'token',
          valueFormat: 'composite_flag_set',
          controlType: 'composite',
          required: false,
          requiredMode: 'optional',
          orderParamId: 20,
          enumValues: [],
          compositeFlagSetOptions: ['TLS1', 'TLS2'],
          defaultValue: null,
          editable: true
        }
      ]
    }
  ]
}

describe('mmlAssistance', () => {
  it('suggests command heads and parameter names from shared schema metadata', () => {
    expect(getMmlCompletionItems(schema, '', 0).map(item => item.label)).toEqual(['ADD TEST'])
    expect(getMmlCompletionItems(schema, 'ADD TEST:', 'ADD TEST:'.length).map(item => item.label)).toEqual(['MODE', 'FLAGS'])
  })

  it('builds diagnostics for invalid enum values and missing required parameters', () => {
    const diagnostics = buildMmlDiagnostics(schema, 'ADD TEST:FLAGS=TLS1-1;')
    expect(diagnostics).toEqual([
      expect.objectContaining({
        message: '缺少必选参数: MODE',
        severity: 'error'
      })
    ])

    const invalidEnum = buildMmlDiagnostics(schema, 'ADD TEST:MODE=C;')
    expect(invalidEnum).toContainEqual(expect.objectContaining({
      message: 'MODE: 值必须在枚举范围内: A, B',
      severity: 'error'
    }))
  })

  it('ignores legacy exactLength for string diagnostics while keeping min and max bounds', () => {
    const legacyStringSchema: MmlSchemaResponse = {
      networkType: 'AMF',
      networkVersion: '20.9.2',
      commands: [
        {
          commandName: 'ADD TEST',
          params: [
            {
              paramName: 'NAME',
              label: 'NAME',
              valueType: 'string',
              valueFormat: 'string',
              controlType: 'text',
              required: true,
              requiredMode: 'required',
              orderParamId: 10,
              enumValues: [],
              defaultValue: null,
              editable: true,
              lengthConstraints: {
                minLength: 2,
                maxLength: 5,
                exactLength: 4
              }
            }
          ]
        }
      ]
    }

    expect(buildMmlDiagnostics(legacyStringSchema, 'ADD TEST:NAME="ABC";')).toEqual([])
    expect(buildMmlDiagnostics(legacyStringSchema, 'ADD TEST:NAME="A";')).toContainEqual(expect.objectContaining({
      message: 'NAME: 长度不能小于 2',
      severity: 'error'
    }))
    expect(buildMmlDiagnostics(legacyStringSchema, 'ADD TEST:NAME="ABCDEF";')).toContainEqual(expect.objectContaining({
      message: 'NAME: 长度不能大于 5',
      severity: 'error'
    }))
  })

  it('does not emit false-positive diagnostics for inactive conditional required rules', () => {
    const conditionalSchema: MmlSchemaResponse = {
      networkType: 'UNC',
      networkVersion: '20.11.2',
      commands: [
        {
          commandName: 'ADD TEST',
          params: [
            {
              paramName: 'MODE',
              label: 'MODE',
              valueType: 'enum',
              valueFormat: 'enum',
              controlType: 'select',
              required: false,
              requiredMode: 'optional',
              orderParamId: 10,
              enumValues: ['IPV4', 'IPV6'],
              defaultValue: null,
              editable: true
            },
            {
              paramName: 'LOCALIPV6_1',
              label: 'LOCALIPV6_1',
              valueType: 'string',
              valueFormat: 'ipv6',
              controlType: 'text',
              required: false,
              requiredMode: 'conditional_required',
              orderParamId: 20,
              enumValues: [],
              defaultValue: null,
              editable: true,
              conditions: [
                {
                  expression: '10=IPV6',
                  sourceParamId: 10,
                  operator: '=',
                  expectedValue: 'IPV6',
                  requiredMode: 'required'
                }
              ]
            }
          ]
        }
      ]
    }

    expect(buildMmlDiagnostics(conditionalSchema, 'ADD TEST:MODE=IPV4;')).toEqual([])
    expect(buildMmlDiagnostics(conditionalSchema, 'ADD TEST:MODE=IPV6;').map(item => item.message)).toEqual([
      '缺少条件必选参数: LOCALIPV6_1'
    ])
  })

  it('keeps the investigated UNC 20.11.2 sample free of false-positive diagnostics', () => {
    const uncSchema: MmlSchemaResponse = {
      networkType: 'UNC',
      networkVersion: '20.11.2',
      commands: [
        {
          commandName: 'ADD VLR',
          params: [
            {
              paramName: 'VN',
              label: 'VN',
              valueType: 'string',
              valueFormat: 'string',
              controlType: 'text',
              required: true,
              requiredMode: 'required',
              orderParamId: 1,
              enumValues: [],
              defaultValue: null,
              editable: true
            },
            {
              paramName: 'SVSGS',
              label: 'SVSGS',
              valueType: 'enum',
              valueFormat: 'enum',
              controlType: 'select',
              required: false,
              requiredMode: 'optional',
              orderParamId: 3,
              enumValues: ['INCONSISTENCY', 'CONSISTENT_SELECTION'],
              defaultValue: 'INCONSISTENCY',
              editable: true
            },
            {
              paramName: 'MSCHOSTNAME',
              label: 'MSCHOSTNAME',
              valueType: 'string',
              valueFormat: 'string',
              controlType: 'text',
              required: false,
              requiredMode: 'conditional_required',
              orderParamId: 4,
              enumValues: [],
              defaultValue: null,
              editable: true,
              conditions: [
                {
                  expression: '3=CONSISTENT_SELECTION',
                  sourceParamId: 3,
                  operator: '=',
                  expectedValue: 'CONSISTENT_SELECTION',
                  requiredMode: 'required'
                }
              ]
            }
          ]
        },
        {
          commandName: 'ADD SGSLKS',
          params: [
            {
              paramName: 'LSX',
              label: 'LSX',
              valueType: 'number',
              valueFormat: 'integer',
              controlType: 'text',
              required: true,
              requiredMode: 'required',
              orderParamId: 1,
              enumValues: [],
              defaultValue: null,
              editable: true
            },
            {
              paramName: 'VN',
              label: 'VN',
              valueType: 'string',
              valueFormat: 'string',
              controlType: 'text',
              required: true,
              requiredMode: 'required',
              orderParamId: 2,
              enumValues: [],
              defaultValue: null,
              editable: true
            },
            {
              paramName: 'LSN',
              label: 'LSN',
              valueType: 'string',
              valueFormat: 'string',
              controlType: 'text',
              required: false,
              requiredMode: 'optional',
              orderParamId: 3,
              enumValues: [],
              defaultValue: null,
              editable: true
            }
          ]
        },
        {
          commandName: 'ADD SGSLNK',
          params: [
            {
              paramName: 'LNK',
              label: 'LNK',
              valueType: 'number',
              valueFormat: 'integer',
              controlType: 'text',
              required: true,
              requiredMode: 'required',
              orderParamId: 1,
              enumValues: [],
              defaultValue: null,
              editable: true
            },
            {
              paramName: 'IPTYPE',
              label: 'IPTYPE',
              valueType: 'enum',
              valueFormat: 'enum',
              controlType: 'select',
              required: false,
              requiredMode: 'optional',
              orderParamId: 3,
              enumValues: ['IPV4', 'IPV6'],
              defaultValue: 'IPV4',
              editable: true
            },
            {
              paramName: 'VLRIPV4_1',
              label: 'VLRIPV4_1',
              valueType: 'string',
              valueFormat: 'ipv4',
              controlType: 'text',
              required: false,
              requiredMode: 'conditional_required',
              orderParamId: 4,
              enumValues: [],
              defaultValue: null,
              editable: true,
              conditions: [
                {
                  expression: '3=IPV4',
                  sourceParamId: 3,
                  operator: '=',
                  expectedValue: 'IPV4',
                  requiredMode: 'required'
                }
              ]
            },
            {
              paramName: 'VLRIPV4_2',
              label: 'VLRIPV4_2',
              valueType: 'string',
              valueFormat: 'ipv4',
              controlType: 'text',
              required: false,
              requiredMode: 'conditional_optional',
              orderParamId: 5,
              enumValues: [],
              defaultValue: null,
              editable: true,
              conditions: [
                {
                  expression: '3=IPV4',
                  sourceParamId: 3,
                  operator: '=',
                  expectedValue: 'IPV4',
                  requiredMode: 'optional'
                }
              ]
            },
            {
              paramName: 'VLRIPV6_1',
              label: 'VLRIPV6_1',
              valueType: 'string',
              valueFormat: 'ipv6',
              controlType: 'text',
              required: false,
              requiredMode: 'conditional_required',
              orderParamId: 6,
              enumValues: [],
              defaultValue: null,
              editable: true,
              conditions: [
                {
                  expression: '3=IPV6',
                  sourceParamId: 3,
                  operator: '=',
                  expectedValue: 'IPV6',
                  requiredMode: 'required'
                }
              ]
            },
            {
              paramName: 'LOCALIPV4_1',
              label: 'LOCALIPV4_1',
              valueType: 'string',
              valueFormat: 'ipv4',
              controlType: 'text',
              required: false,
              requiredMode: 'conditional_required',
              orderParamId: 9,
              enumValues: [],
              defaultValue: null,
              editable: true,
              conditions: [
                {
                  expression: '3=IPV4',
                  sourceParamId: 3,
                  operator: '=',
                  expectedValue: 'IPV4',
                  requiredMode: 'required'
                }
              ]
            },
            {
              paramName: 'LOCALIPV4_2',
              label: 'LOCALIPV4_2',
              valueType: 'string',
              valueFormat: 'ipv4',
              controlType: 'text',
              required: false,
              requiredMode: 'conditional_optional',
              orderParamId: 10,
              enumValues: [],
              defaultValue: null,
              editable: true,
              conditions: [
                {
                  expression: '3=IPV4',
                  sourceParamId: 3,
                  operator: '=',
                  expectedValue: 'IPV4',
                  requiredMode: 'optional'
                }
              ]
            },
            {
              paramName: 'LOCALIPV6_1',
              label: 'LOCALIPV6_1',
              valueType: 'string',
              valueFormat: 'ipv6',
              controlType: 'text',
              required: false,
              requiredMode: 'conditional_required',
              orderParamId: 11,
              enumValues: [],
              defaultValue: null,
              editable: true,
              conditions: [
                {
                  expression: '3=IPV6',
                  sourceParamId: 3,
                  operator: '=',
                  expectedValue: 'IPV6',
                  requiredMode: 'required'
                }
              ]
            },
            {
              paramName: 'LSX',
              label: 'LSX',
              valueType: 'number',
              valueFormat: 'integer',
              controlType: 'text',
              required: true,
              requiredMode: 'required',
              orderParamId: 14,
              enumValues: [],
              defaultValue: null,
              editable: true
            },
            {
              paramName: 'SCTPINDX',
              label: 'SCTPINDX',
              valueType: 'number',
              valueFormat: 'integer',
              controlType: 'text',
              required: true,
              requiredMode: 'required',
              orderParamId: 15,
              enumValues: [],
              defaultValue: null,
              editable: true
            },
            {
              paramName: 'VPNNAME',
              label: 'VPNNAME',
              valueType: 'string',
              valueFormat: 'string',
              controlType: 'text',
              required: false,
              requiredMode: 'optional',
              orderParamId: 17,
              enumValues: [],
              defaultValue: null,
              editable: true
            }
          ]
        }
      ]
    }

    const content = [
      '/* ME TYPE=UNC, Version=20.11.2 */',
      '',
      'ADD VLR:VN="111111111111111";',
      'ADD SGSLKS:LSX=0,VN="111111111111111",LSN="sgs1";',
      'ADD SGSLNK:LNK=0,VPNNAME="VPN_SIG",IPTYPE=IPV4,VLRIPV4_1="10.80.47.4",VLRIPV4_2="10.80.47.5",LOCALIPV4_1="192.168.140.1",LOCALIPV4_2="192.168.140.17",LSX=0,SCTPINDX=0;',
      'ADD SGSLNK:LNK=1,VPNNAME="VPN_SIG",IPTYPE=IPV4,VLRIPV4_1="10.80.47.4",VLRIPV4_2="10.80.47.5",LOCALIPV4_1="192.168.140.2",LOCALIPV4_2="192.168.140.18",LSX=0,SCTPINDX=0;'
    ].join('\n')

    expect(buildMmlDiagnostics(uncSchema, content)).toEqual([])
  })

  it('finds composite flag-set edit targets and serializes enabled options only', () => {
    const content = 'ADD TEST:MODE=A, FLAGS=TLS2-1&TLS1-1;'
    const offset = content.indexOf('TLS2')
    const target = findCompositeEditTarget(schema, content, offset)

    expect(target).toMatchObject({
      paramName: 'FLAGS',
      enabledOptions: ['TLS2', 'TLS1']
    })
    expect(serializeCompositeEditResult(target!, ['TLS2'])).toBe('TLS2-1')
  })
})
