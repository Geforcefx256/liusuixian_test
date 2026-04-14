import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AssistantProcessGroup from './AssistantProcessGroup.vue'
import type { UiTextMessage, UiToolStepMessage } from '@/stores/workbenchStore'

function createMainMessage(): UiTextMessage & { role: 'assistant'; status: 'done' } {
  return {
    id: 'main-1',
    messageId: 1,
    role: 'assistant',
    kind: 'text',
    text: '已完成检查。',
    createdAt: 1,
    status: 'done',
    readingModeEligible: false,
    displayMode: 'raw'
  }
}

function createToolStep(): UiToolStepMessage {
  return {
    id: 'tool-1',
    messageId: 2,
    role: 'assistant',
    kind: 'tool-step',
    text: '',
    createdAt: 2,
    status: 'done',
    toolDisplayNames: ['读取工作区文件', '查看工作区目录']
  }
}

describe('AssistantProcessGroup', () => {
  it('renders each tool display name on its own line for tool-step collapsed steps', () => {
    const wrapper = mount(AssistantProcessGroup, {
      props: {
        mainMessage: createMainMessage(),
        collapsedSteps: [createToolStep()],
        formatTime: () => '10:00'
      }
    })

    expect(wrapper.text()).toContain('查看过程（1）')
    const lines = wrapper.findAll('.assistant-process-group__tool-line')
    expect(lines).toHaveLength(2)
    expect(lines[0]?.text()).toContain('○ 读取工作区文件')
    expect(lines[1]?.text()).toContain('○ 查看工作区目录')
  })
})
