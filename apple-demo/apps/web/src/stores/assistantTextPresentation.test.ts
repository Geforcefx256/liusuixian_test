import { describe, expect, it } from 'vitest'

import {
  isAssistantTextReadingModeEligible,
  resolveAssistantTextPresentation
} from './assistantTextPresentation'

describe('assistantTextPresentation', () => {
  it('defaults structured completed assistant text into reading mode', () => {
    const message = {
      role: 'assistant' as const,
      kind: 'text' as const,
      status: 'done' as const,
      text: '# 方案说明\n\n- 第一步\n- 第二步\n\n```ts\nconsole.log(1)\n```'
    }

    expect(isAssistantTextReadingModeEligible(message)).toBe(true)
    expect(resolveAssistantTextPresentation(message)).toEqual({
      readingModeEligible: true,
      displayMode: 'reading'
    })
  })

  it('keeps short conversational replies on the raw bubble path', () => {
    const message = {
      role: 'assistant' as const,
      kind: 'text' as const,
      status: 'done' as const,
      text: '可以，我现在继续处理。'
    }

    expect(isAssistantTextReadingModeEligible(message)).toBe(false)
    expect(resolveAssistantTextPresentation(message)).toEqual({
      readingModeEligible: false,
      displayMode: 'raw'
    })
  })

  it('defaults table-only assistant text into reading mode', () => {
    const message = {
      role: 'assistant' as const,
      kind: 'text' as const,
      status: 'done' as const,
      text: '| 名称 | 类型 |\n|------|------|\n| id | int |\n| name | string |'
    }

    expect(isAssistantTextReadingModeEligible(message)).toBe(true)
    expect(resolveAssistantTextPresentation(message)).toEqual({
      readingModeEligible: true,
      displayMode: 'reading'
    })
  })
})
