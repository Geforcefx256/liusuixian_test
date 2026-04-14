import { describe, expect, it } from 'vitest'

import { buildConversationDisplayItems } from './conversationDisplay'
import type { UiMessage } from '@/stores/workbenchStore'

function createAssistantText(id: string, text: string): UiMessage {
  return {
    id,
    role: 'assistant',
    kind: 'text',
    text,
    createdAt: 1,
    status: 'done',
    readingModeEligible: false,
    displayMode: 'raw'
  }
}

function createToolStep(id: string, toolDisplayNames: string[]): UiMessage {
  return {
    id,
    role: 'assistant',
    kind: 'tool-step',
    text: '',
    createdAt: 1,
    status: 'done',
    toolDisplayNames
  }
}

describe('buildConversationDisplayItems', () => {
  it('folds assistant tool-step messages into the process section before the final text message', () => {
    const items = buildConversationDisplayItems([
      createToolStep('tool-1', ['读取工作区文件']),
      createAssistantText('text-1', '已完成检查。')
    ])

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      kind: 'assistant-process',
      mainMessage: { id: 'text-1', kind: 'text' },
      collapsedSteps: [{ id: 'tool-1', kind: 'tool-step', toolDisplayNames: ['读取工作区文件'] }]
    })
  })

  it('merges pure tool-step segment into a tool-step-group', () => {
    const items = buildConversationDisplayItems([
      createToolStep('tool-1', ['读取工作区文件']),
      createToolStep('tool-2', ['查看工作区目录'])
    ])

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      kind: 'tool-step-group',
      steps: [
        { id: 'tool-1', kind: 'tool-step', toolDisplayNames: ['读取工作区文件'] },
        { id: 'tool-2', kind: 'tool-step', toolDisplayNames: ['查看工作区目录'] }
      ]
    })
  })

  it('degrades mixed segment (text + tool-step) into independent MessageDisplayItems', () => {
    const items = buildConversationDisplayItems([
      createAssistantText('text-1', '先检查文件。'),
      createToolStep('tool-1', ['读取工作区文件'])
    ])

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ kind: 'message', message: { id: 'text-1' } })
    expect(items[1]).toMatchObject({ kind: 'message', message: { id: 'tool-1', kind: 'tool-step' } })
  })

  it('keeps single tool-step as independent MessageDisplayItem', () => {
    const items = buildConversationDisplayItems([
      createToolStep('tool-1', ['读取工作区文件'])
    ])

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ kind: 'message', message: { id: 'tool-1', kind: 'tool-step' } })
  })
})
