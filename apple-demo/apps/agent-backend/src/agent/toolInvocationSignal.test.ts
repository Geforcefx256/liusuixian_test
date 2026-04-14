import { describe, expect, it } from 'vitest'
import {
  buildToolInvocationSignal,
  createToolDisplayNameResolver
} from './toolInvocationSignal.js'

describe('toolInvocationSignal', () => {
  it('prefers configured display names for mapped tools', () => {
    const signal = buildToolInvocationSignal({
      id: 'tool-1',
      name: 'skill:read_asset',
      input: {}
    }, 123, createToolDisplayNameResolver({
      'skill:read_asset': '读取技能文件'
    }))

    expect(signal).toMatchObject({
      tool: 'skill:read_asset',
      displayName: '读取技能文件',
      toolKind: 'tool'
    })
  })

  it('falls back to normalized tool names when no mapping exists', () => {
    const signal = buildToolInvocationSignal({
      id: 'tool-2',
      name: 'mcp:default:normalize_rows',
      input: {}
    }, 456)

    expect(signal.displayName).toBe('default:normalize_rows')
  })

  it('uses governed display names for skill loading calls when the active agent provides one', () => {
    const signal = buildToolInvocationSignal({
      id: 'tool-3',
      name: 'skill:skill',
      input: {
        name: 'openspec-apply-change'
      }
    }, 789, createToolDisplayNameResolver({
      'skill:skill': '加载技能说明'
    }, (skillName, agentId) => {
      return skillName === 'openspec-apply-change' && agentId === 'workspace-agent'
        ? 'OpenSpec 变更实现'
        : null
    }), 'workspace-agent')

    expect(signal).toMatchObject({
      tool: 'skill:skill',
      displayName: 'OpenSpec 变更实现',
      toolKind: 'skill'
    })
  })
})
