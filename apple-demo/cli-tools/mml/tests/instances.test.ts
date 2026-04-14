import { describe, expect, it } from 'vitest'

import { queryMmlContent } from '../src/core/instances.js'

describe('queryMmlContent', () => {
  const content = [
    '/* ME TYPE=AMF, Version=20.9.2 */',
    'ADD SGSLNK:LNK=1, IPTYPE=IPV4, VLRIPV4_1="10.0.0.1";',
    'ADD SGSLNK:LNK=2, IPTYPE=IPV6, VLRIPV6_1="2001::1";',
    'ADD SGSLNK:LNK=3, IPTYPE=IPV4, VLRIPV4_1="10.0.0.9";'
  ].join('\n')

  it('filters command instances by where conditions', () => {
    const result = queryMmlContent(content, {
      filePath: './fixtures/core-a.mml',
      commandName: 'ADD SGSLNK',
      where: [{ paramName: 'IPTYPE', expectedValue: 'ipv4' }]
    })

    expect(result).toEqual({
      file: 'core-a.mml',
      cmd: 'ADD SGSLNK',
      n: 2,
      rows: [
        {
          i: 1,
          text: 'ADD SGSLNK:LNK=1, IPTYPE=IPV4, VLRIPV4_1="10.0.0.1";'
        },
        {
          i: 3,
          text: 'ADD SGSLNK:LNK=3, IPTYPE=IPV4, VLRIPV4_1="10.0.0.9";'
        }
      ]
    })
  })

  it('returns selected values in compact rows', () => {
    const result = queryMmlContent(content, {
      filePath: './fixtures/core-a.mml',
      commandName: 'ADD SGSLNK',
      where: [{ paramName: 'IPTYPE', expectedValue: 'IPV4' }],
      selectParamName: 'VLRIPV4_1'
    })

    expect(result).toEqual({
      file: 'core-a.mml',
      cmd: 'ADD SGSLNK',
      sel: 'VLRIPV4_1',
      n: 2,
      rows: [
        {
          i: 1,
          v: '10.0.0.1',
          text: 'ADD SGSLNK:LNK=1, IPTYPE=IPV4, VLRIPV4_1="10.0.0.1";'
        },
        {
          i: 3,
          v: '10.0.0.9',
          text: 'ADD SGSLNK:LNK=3, IPTYPE=IPV4, VLRIPV4_1="10.0.0.9";'
        }
      ]
    })
  })

  it('supports text-only output', () => {
    const result = queryMmlContent(content, {
      filePath: './fixtures/core-a.mml',
      commandName: 'ADD SGSLNK',
      where: [{ paramName: 'LNK', expectedValue: '2' }],
      textOnly: true
    })

    expect(result).toEqual({
      file: 'core-a.mml',
      cmd: 'ADD SGSLNK',
      n: 1,
      texts: [
        'ADD SGSLNK:LNK=2, IPTYPE=IPV6, VLRIPV6_1="2001::1";'
      ]
    })
  })
})
