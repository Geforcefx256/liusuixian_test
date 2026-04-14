import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import ConversationPane from './ConversationPane.vue'
import conversationPaneSource from './ConversationPane.vue?raw'
import assistantMessageHeaderSource from './AssistantMessageHeader.vue?raw'
import starterSkillHoverHelpSource from './StarterSkillHoverHelp.vue?raw'
import type { UiMessage } from '@/stores/workbenchStore'

const normalizedConversationPaneSource = conversationPaneSource.replace(/\r\n/g, '\n')

function buildProps() {
  return {
    title: 'AI MML',
    subtitle: '工作区助手',
    messages: [] as UiMessage[],
    composerDraft: '',
    composerBlocked: false,
    composerSendBlocked: false,
    composerLockReason: null,
    isRunning: false,
    canStopRun: false,
    stopPending: false,
    error: null,
    userAvatarUrl: '',
    userAvatarInitial: '管',
    editableMessageId: null,
    editRerunTarget: null,
    starterGroups: [],
    searchableSkills: [],
    searchQuery: '',
    selectedStarterSkillId: null as string | null,
    workspaceFileCount: 0
  }
}

function buildTextMessage(overrides: Partial<UiMessage> = {}): UiMessage {
  return {
    id: 'message-1',
    kind: 'text',
    role: 'assistant',
    text: '处理完成',
    createdAt: 1,
    status: 'done',
    readingModeEligible: false,
    displayMode: 'raw',
    ...overrides
  } as UiMessage
}

function buildProtocolMessage(overrides: Partial<UiMessage> = {}): UiMessage {
  return {
    id: 'protocol-1',
    kind: 'protocol',
    role: 'assistant',
    text: '{"version":"1.0"}',
    createdAt: 1,
    status: 'done',
    protocol: {
      version: '1.0',
      components: [{ type: 'text', content: '等待确认' }],
      actions: []
    },
    protocolState: null,
    ...overrides
  } as UiMessage
}

function buildQuestionMessage(
  overrides: Partial<Extract<UiMessage, { kind: 'question' }>> = {}
): Extract<UiMessage, { kind: 'question' }> {
  return {
    id: 'interaction-1',
    kind: 'question',
    role: 'assistant',
    text: '请输入信息',
    createdAt: 1,
    status: 'done',
    interaction: {
      interactionId: 'interaction-1',
      runId: 'run-1',
      kind: 'question',
      status: 'pending',
      payload: {
        questionId: 'question-1',
        title: '补充信息',
        prompt: '请输入信息',
        required: true,
        fields: [{ id: 'answer', label: '回答', type: 'text' }]
      },
      createdAt: 1,
      resolvedAt: null
    },
    ...overrides
  } as Extract<UiMessage, { kind: 'question' }>
}

function buildSkill(id: string, name: string, intentGroup: 'planning' | 'configuration-authoring' | 'verification' = 'planning') {
  return {
    id,
    name,
    description: `${name} 的描述`,
    governedTitleText: name,
    governedDescriptionText: `${name} 的描述`,
    starterSummary: `${name} 的摘要`,
    intentGroup,
    starterPrompt: `请帮我使用 ${name}`,
    starterSummaryText: `${name} 的摘要`
  }
}

function buildGroup(id: 'planning' | 'configuration-authoring' | 'verification', skill: ReturnType<typeof buildSkill> | null = null) {
  const meta = {
    planning: {
      title: '方案制作',
      subtitle: '选则场景快速开始生成配置方案',
      discoveryQuery: '方案 制作'
    },
    'configuration-authoring': {
      title: '配置生成',
      subtitle: '选则场景快速开始生成MML配置',
      discoveryQuery: '配置 生成'
    },
    verification: {
      title: '配置核查',
      subtitle: '选则业务场景快速开始核查',
      discoveryQuery: '配置 核查'
    }
  } as const

  return {
    id,
    title: meta[id].title,
    subtitle: meta[id].subtitle,
    icon: meta[id].title.slice(0, 1),
    discoveryQuery: meta[id].discoveryQuery,
    emptyTitle: `搜索${meta[id].title}技能`,
    emptyDescription: '暂无默认技能',
    previewSkills: skill ? [skill] : []
  }
}

function formatLocalTimestamp(timestamp: number): string {
  const d = new Date(timestamp)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

describe('ConversationPane', () => {
  it('keeps its root pane stretched after switching from empty state to message state', async () => {
    const wrapper = mount(ConversationPane, {
      props: buildProps()
    })

    const root = wrapper.get('.conversation-pane')

    expect(wrapper.find('.conversation-pane__empty-shell').exists()).toBe(true)
    expect(root.classes()).toContain('conversation-pane')
    expect(conversationPaneSource).toContain('.conversation-pane {')
    expect(conversationPaneSource).toContain('flex: 1;')
    expect(conversationPaneSource).toContain('min-width: 0;')
    expect(conversationPaneSource).toContain('min-height: 0;')
    expect(conversationPaneSource).toContain('width: 100%;')
    expect(conversationPaneSource).toContain('grid-template-rows: minmax(0, 1fr) auto;')

    await wrapper.setProps({
      messages: [
        {
          ...buildTextMessage({
            id: 'assistant-1'
          })
        }
      ]
    })

    expect(wrapper.find('.conversation-pane__empty-shell').exists()).toBe(false)
    expect(wrapper.find('.conversation-pane__messages').exists()).toBe(true)
    expect(wrapper.get('.conversation-pane__bubble').text()).toContain('处理完成')
    expect(root.classes()).toContain('conversation-pane')
    expect(conversationPaneSource).toContain('min-inline-size: 0;')
  })

  it('keeps the composer in the bottom grid row and disables manual textarea resize', () => {
    const wrapper = mount(ConversationPane, {
      props: buildProps()
    })

    expect(wrapper.find('.conversation-pane__composer').exists()).toBe(true)
    expect(conversationPaneSource).toContain('.conversation-pane__composer {')
    expect(normalizedConversationPaneSource).toContain('.conversation-pane {\n  flex: 1;\n  min-width: 0;\n  min-height: 0;\n  width: 100%;\n  block-size: 100%;\n  display: grid;\n  grid-template-rows: minmax(0, 1fr) auto;')
    expect(normalizedConversationPaneSource).toContain('.conversation-pane__composer {\n  z-index: 1;\n  padding-block-start: calc(var(--pane-block) * 0.8);')
    expect(normalizedConversationPaneSource).toContain('.conversation-pane__composer-shell {\n  padding: var(--card-pad-tight);')
    expect(conversationPaneSource).toContain('.conversation-pane__composer textarea {')
    expect(normalizedConversationPaneSource).toContain('min-block-size: var(--composer-min-block);')
    expect(normalizedConversationPaneSource).toContain('max-block-size: var(--composer-max-block);')
    expect(conversationPaneSource).toContain('resize: none;')
  })

  it('keeps the message list and composer aligned to the quick-start surface width', async () => {
    const wrapper = mount(ConversationPane, {
      props: buildProps()
    })

    expect(wrapper.find('.conversation-pane__surface-measure').exists()).toBe(true)

    await wrapper.setProps({
      messages: [
        {
          ...buildTextMessage({
            id: 'assistant-1'
          })
        }
      ]
    })

    expect(wrapper.find('.conversation-pane__surface-measure--messages').exists()).toBe(true)
    expect(wrapper.find('.conversation-pane__surface-measure--composer').exists()).toBe(true)
    expect(conversationPaneSource).toContain('class="conversation-pane__surface-measure conversation-pane__surface-measure--messages"')
    expect(conversationPaneSource).toContain('class="conversation-pane__surface-measure conversation-pane__surface-measure--composer"')
    expect(conversationPaneSource).toContain('ref="messagesViewportRef"')
    expect(conversationPaneSource).toContain(':style="messagesViewportStyle"')
    expect(normalizedConversationPaneSource).toContain(".conversation-pane__messages {\n  padding-block: calc(var(--pane-block) * 0.8);\n  padding-inline-start: var(--pane-inline);\n  padding-inline-end: calc(var(--pane-inline) - var(--conversation-pane-scrollbar-width, 0px));")
  })

  it('keeps the messages viewport pinned to the newest reply when new content arrives', async () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        messages: [buildTextMessage({ id: 'assistant-1', text: '第一段回复' })]
      }
    })

    const viewport = wrapper.get('.conversation-pane__messages').element as HTMLDivElement
    let scrollTop = 40
    let scrollHeight = 140

    Object.defineProperty(viewport, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: value => {
        scrollTop = value
      }
    })
    Object.defineProperty(viewport, 'scrollHeight', {
      configurable: true,
      get: () => scrollHeight
    })
    Object.defineProperty(viewport, 'clientHeight', {
      configurable: true,
      get: () => 100
    })
    Object.defineProperty(viewport, 'offsetWidth', {
      configurable: true,
      get: () => 100
    })
    Object.defineProperty(viewport, 'clientWidth', {
      configurable: true,
      get: () => 90
    })

    scrollHeight = 220

    await wrapper.setProps({
      messages: [
        buildTextMessage({ id: 'assistant-1', text: '第一段回复' }),
        buildTextMessage({ id: 'assistant-2', text: '第二段回复' })
      ]
    })

    expect(scrollTop).toBe(220)
  })

  it('does not yank the viewport to the bottom after the user scrolls up', async () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        messages: [buildTextMessage({ id: 'assistant-1', text: '第一段回复' })]
      }
    })

    const viewport = wrapper.get('.conversation-pane__messages').element as HTMLDivElement
    let scrollTop = 0
    const scrollHeight = 300

    Object.defineProperty(viewport, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value
      }
    })
    Object.defineProperty(viewport, 'scrollHeight', {
      configurable: true,
      get: () => scrollHeight
    })
    Object.defineProperty(viewport, 'clientHeight', {
      configurable: true,
      get: () => 100
    })
    Object.defineProperty(viewport, 'offsetWidth', {
      configurable: true,
      get: () => 100
    })
    Object.defineProperty(viewport, 'clientWidth', {
      configurable: true,
      get: () => 90
    })

    // 让 composable 的初始 auto-scroll 完成
    await wrapper.get('.conversation-pane__messages').trigger('scroll')

    // 模拟用户上滚：把 scrollTop 设为远离底部的值
    scrollTop = 10
    // 触发 scroll 事件让 composable 检测到"不在底部"
    await wrapper.get('.conversation-pane__messages').trigger('scroll')
    // distanceToBottom = 300 - 100 - 10 = 190 > 48, autoScrollEnabled 应变为 false

    await wrapper.setProps({
      messages: [
        buildTextMessage({ id: 'assistant-1', text: '第一段回复' }),
        buildTextMessage({ id: 'assistant-2', text: '第二段回复' })
      ]
    })

    expect(scrollTop).toBe(10)
  })

  it('keeps a single completed assistant message on the normal render path', () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        messages: [buildTextMessage({ id: 'assistant-single', text: '最终回复' })]
      }
    })

    expect(wrapper.find('.assistant-process-group').exists()).toBe(false)
    expect(wrapper.findAll('.conversation-pane__message')).toHaveLength(1)
    expect(wrapper.text()).toContain('最终回复')
  })

  it('collapses contiguous completed assistant text steps into one grouped history bubble', () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        messages: [
          buildTextMessage({ id: 'assistant-step-1', text: '先检查输入' }),
          buildTextMessage({ id: 'assistant-step-2', text: '再整理结果' }),
          buildTextMessage({ id: 'assistant-step-3', text: '最终结论' })
        ]
      }
    })

    const details = wrapper.get('.assistant-process-group__details')

    expect(wrapper.findAll('.conversation-pane__message')).toHaveLength(1)
    expect(wrapper.findAll('.assistant-process-group__step')).toHaveLength(2)
    expect(details.attributes('open')).toBeUndefined()
    expect(wrapper.get('.assistant-process-group__summary').text()).toContain('查看过程（2）')
  })

  it('keeps protocol and streaming assistant messages on their dedicated render paths', () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        messages: [
          buildTextMessage({ id: 'assistant-step-1', text: '先检查输入' }),
          buildTextMessage({ id: 'assistant-step-2', text: '整理中' }),
          buildProtocolMessage({ id: 'assistant-protocol' }),
          buildTextMessage({ id: 'assistant-streaming', status: 'streaming', text: '' })
        ]
      }
    })

    expect(wrapper.findAll('.conversation-pane__message')).toHaveLength(3)
    expect(wrapper.findAll('.assistant-process-group')).toHaveLength(1)
    expect(wrapper.find('.protocol-card').exists()).toBe(true)
    expect(wrapper.text()).toContain('正在生成内容...')
  })

  it('uses governed typography roles for chrome and message copy', () => {
    expect(conversationPaneSource).toContain('font-size: var(--font-overline);')
    expect(conversationPaneSource).toContain('font-size: var(--font-title);')
    expect(conversationPaneSource).toContain('font-size: var(--font-meta);')
    expect(conversationPaneSource).toContain('font-size: var(--font-body);')
    expect(conversationPaneSource).not.toContain('font-size: 10px;')
    expect(conversationPaneSource).not.toContain('font-size: clamp(')
  })

  it('uses a compact plus attachment trigger without passive upload chrome', () => {
    const wrapper = mount(ConversationPane, {
      props: buildProps()
    })

    expect(wrapper.get('.conversation-pane__attach-btn').text()).toContain('+')
    expect(wrapper.text()).not.toContain('新增文件')
    expect(wrapper.text()).not.toContain('新建 TXT')
    expect(wrapper.get('.conversation-pane__icon-entry .conversation-pane__icon-tooltip').text()).toBe('点击或拖拽可上传文件，支持的类型：txt、md、csv')
    expect(wrapper.emitted('create-file')).toBeFalsy()
    expect(conversationPaneSource).toContain('class="conversation-pane__attach-btn"')
    expect(conversationPaneSource).not.toContain('conversation-pane__upload-help-popover')
    expect(conversationPaneSource).toContain('.conversation-pane__icon-entry:hover .conversation-pane__icon-tooltip,')
    expect(conversationPaneSource).toContain('bottom: calc(100% + 6px);')
    expect(conversationPaneSource).not.toContain('conversation-pane__icon-tooltip conversation-pane__icon-tooltip--wide')
    expect(conversationPaneSource).toContain('.conversation-pane__composer-action {')
    expect(conversationPaneSource).toContain('inline-size: 44px;')
  })

  it('emits dropped supported files from the composer surface', async () => {
    const wrapper = mount(ConversationPane, {
      props: buildProps()
    })

    const file = new File(['name,value\nalpha,1\n'], 'input.csv', { type: 'text/csv' })
    await wrapper.get('.conversation-pane__composer-shell').trigger('drop', {
      dataTransfer: {
        files: [file],
        types: ['Files']
      }
    })

    expect(wrapper.emitted('upload-files')?.[0]?.[0]).toEqual([file])
  })

  it('keeps unsupported dropped files as visible composer-local failures', async () => {
    const wrapper = mount(ConversationPane, {
      props: buildProps()
    })

    const file = new File(['{}'], 'bad.json', { type: 'application/json' })
    await wrapper.get('.conversation-pane__composer-shell').trigger('drop', {
      dataTransfer: {
        files: [file],
        types: ['Files']
      }
    })

    expect(wrapper.emitted('upload-files')).toBeFalsy()
    expect(wrapper.get('.conversation-pane__error--upload').text()).toContain('仅支持上传 TXT / MD / CSV 文件')
    expect(wrapper.get('.conversation-pane__error--upload').text()).toContain('bad.json')
  })

  it('shows quick starts first and keeps more search collapsed by default', () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        starterGroups: [buildGroup('planning', buildSkill('skill-1', 'DPI 规划入口'))],
        searchableSkills: [buildSkill('skill-1', 'DPI 规划入口')]
      }
    })

    expect(wrapper.text()).toContain('快速开始')
    expect(wrapper.text()).toContain('更多搜索')
    expect(wrapper.text()).toContain('DPI 规划入口')
    expect(wrapper.text()).not.toContain('立即开始')
    expect(wrapper.text()).not.toContain('治理发现')
    expect(wrapper.text()).not.toContain('治理技能库')
    expect(wrapper.find('label[for="skill-search-input"]').exists()).toBe(true)
  })

  it('renders governed starter summary in a dedicated action row for starter cards', async () => {
    const skill = buildSkill('skill-1', 'DPI 规划入口')
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        selectedStarterSkillId: 'skill-1',
        starterGroups: [{
          ...buildGroup('planning', skill),
          previewSkills: [skill]
        }]
      }
    })

    expect(wrapper.find('.conversation-pane__starter-summary').text()).toContain('DPI 规划入口 的摘要')
    expect(wrapper.find('.conversation-pane__starter-action-row').exists()).toBe(true)
    expect(wrapper.find('.conversation-pane__starter-action').text()).toContain('开始使用')
    expect(wrapper.find('.starter-skill-hover-help__trigger').exists()).toBe(true)
    expect(conversationPaneSource).toContain('.conversation-pane__starter-action-row {')
    expect(conversationPaneSource).toContain('.conversation-pane__starter-preview-item--selected {')
  })

  it('uses the same starter action button in more search results', async () => {
    const skill = buildSkill('skill-1', 'DPI 规划入口')
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        searchQuery: 'DPI',
        selectedStarterSkillId: 'skill-1',
        searchableSkills: [skill]
      }
    })

    expect(wrapper.find('.conversation-pane__result-item .conversation-pane__skill-description').text()).toContain('DPI 规划入口 的描述')
    expect(wrapper.find('.conversation-pane__result-item .conversation-pane__starter-action').text()).toContain('开始使用')
    expect(wrapper.find('.starter-skill-hover-help__trigger').exists()).toBe(false)
    expect(conversationPaneSource).toContain('.conversation-pane__skill-description {')
  })

  it('shows desktop hover help for expanded starter skills only and keeps a single start action', async () => {
    const planningSkill = buildSkill('skill-1', 'DPI 规划入口')
    const authoringSkill = buildSkill('skill-2', 'MML 配置生成', 'configuration-authoring')
    const verificationSkill = buildSkill('skill-3', '配置核查入口', 'verification')
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        starterGroups: [
          { ...buildGroup('planning', planningSkill), previewSkills: [planningSkill] },
          { ...buildGroup('configuration-authoring', authoringSkill), previewSkills: [authoringSkill] },
          { ...buildGroup('verification', verificationSkill), previewSkills: [verificationSkill] }
        ],
        selectedStarterSkillId: 'skill-1'
      }
    })

    expect(wrapper.findAll('.conversation-pane__starter-card')[0]?.classes()).toContain('conversation-pane__starter-card--active')
    expect(wrapper.findAll('.conversation-pane__starter-card')[1]?.classes()).not.toContain('conversation-pane__starter-card--active')

    await wrapper.get('.starter-skill-hover-help').trigger('mouseenter')

    expect(wrapper.get('.starter-skill-hover-help__card').classes()).toContain('starter-skill-hover-help__card--right')
    expect(wrapper.get('.starter-skill-hover-help__card').text()).toContain('DPI 规划入口 的摘要')
    expect(wrapper.get('.starter-skill-hover-help__card').text()).not.toContain('DPI 规划入口 的描述')
    expect(wrapper.get('.starter-skill-hover-help__card').text()).not.toContain('开始使用')
    expect(wrapper.findAll('.conversation-pane__starter-action')).toHaveLength(1)
    expect(wrapper.emitted('update:search-query')).toBeFalsy()
    expect(wrapper.emitted('select-starter-skill')).toBeFalsy()
    expect(wrapper.find('.conversation-pane__starter-action-row')?.element.firstElementChild?.className).toContain('conversation-pane__starter-action')
    expect(wrapper.find('.conversation-pane__starter-action-row')?.element.lastElementChild?.className).toContain('starter-skill-hover-help')

    await wrapper.get('.starter-skill-hover-help').trigger('mouseleave')
    expect(wrapper.find('.starter-skill-hover-help__card').exists()).toBe(false)

    await wrapper.setProps({ selectedStarterSkillId: 'skill-2' })
    await wrapper.get('.starter-skill-hover-help').trigger('mouseenter')
    expect(wrapper.get('.starter-skill-hover-help__card').classes()).toContain('starter-skill-hover-help__card--bottom')

    await wrapper.get('.starter-skill-hover-help').trigger('mouseleave')
    await wrapper.setProps({ selectedStarterSkillId: 'skill-3' })
    await wrapper.get('.starter-skill-hover-help').trigger('focusin')
    expect(wrapper.get('.starter-skill-hover-help__card').classes()).toContain('starter-skill-hover-help__card--left')
    expect(starterSkillHoverHelpSource).toContain('-webkit-line-clamp: 6;')
    expect(starterSkillHoverHelpSource).toContain('white-space: nowrap;')
    expect(conversationPaneSource).toContain('.conversation-pane__starter-card--active {')
    expect(conversationPaneSource).toContain('isolation: isolate;')
  })

  it('uses governed preview chips with responsive truncation rules for starter cards', () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        starterGroups: [{
          ...buildGroup('planning', null),
          previewSkills: [
            buildSkill('skill-1', '治理后的规划技能一'),
            buildSkill('skill-2', '治理后的规划技能二'),
            buildSkill('skill-3', '治理后的规划技能三')
          ]
        }]
      }
    })

    expect(wrapper.findAll('.conversation-pane__starter-preview-item')).toHaveLength(3)
    expect(conversationPaneSource).toContain('.conversation-pane__starter-preview-item:nth-child(n + 3) {')
    expect(conversationPaneSource).toContain('@media (min-width: 720px) {')
    expect(conversationPaneSource).toContain('text-overflow: ellipsis;')
  })

  it('shows hot skills in the search panel by default', () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        searchableSkills: Array.from({ length: 3 }, (_, index) => buildSkill(`skill-${index + 1}`, `技能 ${index + 1}`))
      }
    })

    expect(wrapper.find('label[for="skill-search-input"]').exists()).toBe(true)
    expect(wrapper.get('label[for="skill-search-input"]').text()).toContain('技能搜索')
    expect(wrapper.text()).toContain('热门技能')
    expect(wrapper.findAll('.conversation-pane__suggestion-chip--hot')).toHaveLength(3)
  })

  it('shows all search results immediately without truncation', () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        searchQuery: '技能',
        searchableSkills: Array.from({ length: 4 }, (_, index) => buildSkill(`skill-${index + 1}`, `技能 ${index + 1}`))
      }
    })

    expect(wrapper.findAll('.conversation-pane__result-item')).toHaveLength(4)
    expect(wrapper.find('.conversation-pane__show-more').exists()).toBe(false)
  })

  it('renders a suggestion-based empty state when search has no matches', () => {
    const planningSkill = buildSkill('skill-1', 'DPI 规划入口')
    const verificationSkill = buildSkill('skill-2', '配置核查入口', 'verification')
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        searchQuery: '不存在的技能',
        starterGroups: [
          { ...buildGroup('planning', planningSkill), previewSkills: [planningSkill] },
          buildGroup('configuration-authoring'),
          { ...buildGroup('verification', verificationSkill), previewSkills: [verificationSkill] }
        ]
      }
    })

    expect(wrapper.text()).toContain('没有找到匹配技能')
    const suggestions = wrapper.findAll('.conversation-pane__suggestion-chip')
    expect(suggestions).toHaveLength(2)
    expect(suggestions.map(node => node.text())).toEqual(['方案制作', '配置核查'])
  })

  it('shows only the single available category in the empty state', () => {
    const planningSkill = buildSkill('skill-1', 'DPI 规划入口')
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        searchQuery: '不存在的技能',
        starterGroups: [
          { ...buildGroup('planning', planningSkill), previewSkills: [planningSkill] },
          buildGroup('configuration-authoring'),
          buildGroup('verification')
        ]
      }
    })

    const suggestions = wrapper.findAll('.conversation-pane__suggestion-chip')
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]?.text()).toBe('方案制作')
  })

  it('does not render empty-state suggestions when no category has skills', () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        searchQuery: '不存在的技能',
        starterGroups: [
          buildGroup('planning'),
          buildGroup('configuration-authoring'),
          buildGroup('verification')
        ]
      }
    })

    expect(wrapper.text()).toContain('没有找到匹配技能')
    expect(wrapper.find('.conversation-pane__search-suggestions').exists()).toBe(false)
  })

  it('emits spaced category query when clicking an empty-state suggestion', async () => {
    const planningSkill = buildSkill('skill-1', 'DPI 规划入口')
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        searchQuery: '不存在的技能',
        starterGroups: [
          { ...buildGroup('planning', planningSkill), previewSkills: [planningSkill] },
          buildGroup('configuration-authoring'),
          buildGroup('verification')
        ]
      }
    })

    await wrapper.get('.conversation-pane__suggestion-chip').trigger('click')

    expect(wrapper.emitted('update:search-query')?.[0]?.[0]).toBe('方案 制作')
  })

  it('expands skill summary on click and sends prompt via starter button', async () => {
    const skill = buildSkill('skill-1', 'DPI 规划入口')
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        starterGroups: [{
          ...buildGroup('planning', skill),
          previewSkills: [skill]
        }]
      }
    })

    await wrapper.get('.conversation-pane__skill-toggle').trigger('click')

    expect(wrapper.emitted('select-starter-skill')?.[0]?.[0]).toBe('skill-1')

    await wrapper.setProps({ selectedStarterSkillId: 'skill-1' })

    expect(wrapper.text()).toContain('DPI 规划入口 的摘要')
    expect(wrapper.find('.conversation-pane__skill-detail').exists()).toBe(true)
    expect(wrapper.find('.conversation-pane__starter-action').exists()).toBe(true)

    await wrapper.get('.conversation-pane__starter-action').trigger('click')

    expect(wrapper.emitted('send-prompt')?.[0]?.[0]).toBe('请帮我使用 DPI 规划入口')
    expect(wrapper.emitted('select-starter-skill')?.[1]?.[0]).toBe(null)
  })

  it('shows full description instead of summary in more search results', () => {
    const skill = buildSkill('skill-1', 'DPI 规划入口')
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        searchQuery: 'DPI',
        selectedStarterSkillId: 'skill-1',
        searchableSkills: [skill]
      }
    })

    expect(wrapper.text()).toContain('DPI 规划入口 的描述')
    expect(wrapper.text()).not.toContain('DPI 规划入口 的摘要')
  })

  it('toggles skill selection off when clicking the same skill again', async () => {
    const skill = buildSkill('skill-1', 'DPI 规划入口')
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        selectedStarterSkillId: 'skill-1',
        starterGroups: [{
          ...buildGroup('planning', skill),
          previewSkills: [skill]
        }]
      }
    })

    expect(wrapper.find('.conversation-pane__skill-detail').exists()).toBe(true)

    await wrapper.get('.conversation-pane__skill-toggle').trigger('click')

    expect(wrapper.emitted('select-starter-skill')?.[0]?.[0]).toBe(null)
  })

  it('keeps search independent from quick start selection', async () => {
    const skill = buildSkill('skill-1', 'DPI 规划入口')
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        starterGroups: [{
          ...buildGroup('planning', skill),
          previewSkills: [skill]
        }]
      }
    })

    const textarea = wrapper.get('textarea')
    expect((textarea.element as HTMLTextAreaElement).value).toBe('')
    expect(wrapper.emitted('update:search-query')).toBeFalsy()
  })

  it('renders assistant headers above assistant bubbles only', () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        messages: [
          buildTextMessage({
            id: 'assistant-1',
            assistantHeader: {
              label: '思考中',
              tone: 'progress',
              liveMode: 'polite'
            }
          }),
          {
            id: 'user-1',
            kind: 'text',
            role: 'user',
            text: '用户消息',
            createdAt: 2,
            status: 'done',
            assistantHeader: {
              label: '不应显示',
              tone: 'summary'
            }
          } as UiMessage
        ]
      }
    })

    const headers = wrapper.findAll('.assistant-message-header')
    expect(headers).toHaveLength(1)
    expect(headers[0]?.text()).toContain('思考中')
    expect(headers[0]?.attributes('role')).toBe('status')
    expect(headers[0]?.attributes('aria-live')).toBe('polite')
    expect(wrapper.text()).not.toContain('不应显示')
    expect(assistantMessageHeaderSource).toContain('justify-self: start;')
    expect(assistantMessageHeaderSource).toContain('inline-size: fit-content;')
    expect(assistantMessageHeaderSource).toContain('white-space: nowrap;')
  })

  it('shows a persistent pencil edit affordance only for the last editable user bubble', () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        editableMessageId: 12,
        messages: [
          {
            id: 'user-1',
            messageId: 11,
            kind: 'text',
            role: 'user',
            text: '第一条用户消息',
            createdAt: 1,
            status: 'done',
            readingModeEligible: false,
            displayMode: 'raw'
          } as UiMessage,
          {
            id: 'user-2',
            messageId: 12,
            kind: 'text',
            role: 'user',
            text: '最后一条用户消息',
            createdAt: 2,
            status: 'done',
            readingModeEligible: false,
            displayMode: 'raw'
          } as UiMessage
        ]
      }
    })

    expect(wrapper.findAll('.conversation-pane__message-edit-btn')).toHaveLength(2)
    expect(wrapper.findAll('.conversation-pane__message-edit-btn:not(.conversation-pane__message-edit-btn--hidden)')).toHaveLength(1)
    expect(wrapper.get('.conversation-pane__message-edit-btn:not(.conversation-pane__message-edit-btn--hidden)').attributes('aria-label')).toBe('编辑消息')
    expect(wrapper.findAll('.conversation-pane__message-edit-icon')).toHaveLength(2)
    expect(conversationPaneSource).toContain('.conversation-pane__message-edit-btn {')
    expect(conversationPaneSource).toContain('inline-size: 30px;')
    expect(conversationPaneSource).toContain('opacity: 1;')
    expect(conversationPaneSource).toContain('.conversation-pane__message-edit-icon {')
    expect(conversationPaneSource).toContain('background: rgba(255, 255, 255, 0.82);')
    expect(conversationPaneSource).toContain('background: linear-gradient(135deg, rgba(219, 234, 254, 0.98), rgba(191, 219, 254, 0.98));')
    expect(conversationPaneSource).toContain('color: rgba(15, 23, 42, 0.94);')
  })

  it('renders user timestamps above the user message body', () => {
    const createdAt = new Date('2026-04-02T10:15:00+08:00').getTime()
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        messages: [
          {
            id: 'user-1',
            messageId: 11,
            kind: 'text',
            role: 'user',
            text: '用户消息正文',
            createdAt,
            status: 'done',
            readingModeEligible: false,
            displayMode: 'raw'
          } as UiMessage
        ]
      }
    })

    const userCopy = wrapper.get('.conversation-pane__user-copy').element

    expect(userCopy.firstElementChild?.className).toBe('conversation-pane__message-meta')
    expect(userCopy.lastElementChild?.tagName).toBe('P')
    expect(wrapper.get('.conversation-pane__message-meta small').text()).toBe(formatLocalTimestamp(createdAt))
    expect(wrapper.get('.conversation-pane__user-copy p').text()).toBe('用户消息正文')
  })

  it('renders assistant and user avatars inside the message bubble', () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        messages: [
          buildTextMessage({
            id: 'assistant-1'
          }),
          {
            id: 'user-1',
            messageId: 11,
            kind: 'text',
            role: 'user',
            text: '带头像的用户消息',
            createdAt: 2,
            status: 'done',
            readingModeEligible: false,
            displayMode: 'raw'
          } as UiMessage
        ]
      }
    })

    expect(wrapper.findAll('.conversation-pane__message > .conversation-pane__avatar')).toHaveLength(0)
    expect(wrapper.findAll('.conversation-pane__bubble .conversation-pane__avatar')).toHaveLength(2)
    expect(wrapper.findAll('.conversation-pane__message--assistant .conversation-pane__avatar .agent-glyph')).toHaveLength(1)
    expect(wrapper.get('.conversation-pane__message--user .conversation-pane__avatar').text()).toContain('管')
  })

  it('prefills the composer and shows destructive rerun state when edit mode starts', async () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        editRerunTarget: {
          messageId: 21,
          text: '把这条消息改成新的内容'
        }
      }
    })

    await wrapper.vm.$nextTick()

    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('把这条消息改成新的内容')
    expect(wrapper.text()).toContain('编辑并重跑最后一条用户消息')
    expect(wrapper.text()).toContain('工作区文件和之前的工具副作用不会回滚')
    expect(wrapper.get('.conversation-pane__composer-action').attributes('aria-label')).toBe('编辑并重跑')
  })

  it('submits edit rerun directly without a confirmation dialog', async () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        editRerunTarget: {
          messageId: 22,
          text: '旧内容'
        }
      }
    })

    await wrapper.get('textarea').setValue('新内容')
    await wrapper.get('.conversation-pane__composer-action').trigger('click')

    expect(wrapper.emitted('submit-edit-rerun')).toEqual([['新内容']])
  })

  it('emits upload-files from the composer upload button', async () => {
    const wrapper = mount(ConversationPane, {
      props: buildProps()
    })

    await wrapper.get('.conversation-pane__attach-btn').trigger('click')

    expect(wrapper.emitted('upload-files')).toEqual([[]])
  })

  it('renders pending question cards inside the message flow while keeping the composer visible', () => {
    const questionMessage = buildQuestionMessage()
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        composerBlocked: true,
        pendingInteraction: questionMessage.interaction,
        messages: [questionMessage]
      }
    })

    expect(wrapper.find('.conversation-pane__messages .pending-question-card').exists()).toBe(true)
    expect(wrapper.find('.conversation-pane__composer .pending-question-card').exists()).toBe(false)
    expect(wrapper.find('textarea').exists()).toBe(true)
    expect(wrapper.get('textarea').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.conversation-pane__attach-btn').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.conversation-pane__composer-action').attributes('disabled')).toBeDefined()
  })

  it('keeps the draft editable while the active session is generating a reply', async () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        isRunning: true,
        canStopRun: true
      }
    })

    await wrapper.get('textarea').setValue('先预写下一条消息')

    expect(wrapper.get('textarea').attributes('disabled')).toBeUndefined()
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('先预写下一条消息')
    expect(wrapper.get('.conversation-pane__attach-btn').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.conversation-pane__composer-action').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('.conversation-pane__composer-action').attributes('aria-label')).toBe('停止运行')
    expect(wrapper.get('textarea').attributes('placeholder')).toBe('请输入您的问题，按shift+回车可换行')
    expect(wrapper.text()).not.toContain('你可以先预写下一条消息')
  })

  it('keeps the draft editable but blocks send and upload while another session occupies the shared workspace', async () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        composerSendBlocked: true,
        composerLockReason: '会话“运行中会话”还在处理中。你可以继续编辑草稿，等它结束后再发送。'
      }
    })

    await wrapper.get('textarea').setValue('先写草稿')

    expect(wrapper.get('textarea').attributes('disabled')).toBeUndefined()
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('先写草稿')
    expect(wrapper.get('.conversation-pane__attach-btn').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.conversation-pane__composer-action').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('你可以继续编辑草稿')
  })

  it('does not submit the draft with enter while shared-workspace send is blocked', async () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        composerSendBlocked: true,
        composerLockReason: '会话“运行中会话”还在处理中。你可以继续编辑草稿，等它结束后再发送。'
      }
    })

    await wrapper.get('textarea').setValue('仍然只是草稿')
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('send-prompt')).toBeFalsy()
  })

  it('renders the send action with a dedicated disabled visual state while shared-workspace send is blocked', () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        composerDraft: '仍然只是草稿',
        composerSendBlocked: true,
        composerLockReason: '会话“运行中会话”还在处理中。你可以继续编辑草稿，等它结束后再发送。'
      }
    })

    const action = wrapper.get('.conversation-pane__composer-action')

    expect(action.attributes('disabled')).toBeDefined()
    expect(action.classes()).toContain('conversation-pane__composer-action--send')
    expect(conversationPaneSource).toContain('.conversation-pane__composer-action--send:disabled {')
  })

  it('shows the unified idle placeholder and hover tips in the composer', () => {
    const wrapper = mount(ConversationPane, {
      props: buildProps()
    })

    expect(wrapper.get('textarea').attributes('placeholder')).toBe('请输入您的问题，按shift+回车可换行')
    expect(wrapper.findAll('.conversation-pane__icon-tooltip')).toHaveLength(2)
    expect(wrapper.findAll('.conversation-pane__icon-tooltip')[0]?.text()).toBe('点击或拖拽可上传文件，支持的类型：txt、md、csv')
    expect(wrapper.findAll('.conversation-pane__icon-tooltip')[1]?.text()).toBe('发送')
  })

  it('renders a single icon-first send action with an accessible name while idle', async () => {
    const wrapper = mount(ConversationPane, {
      props: buildProps()
    })

    await wrapper.get('textarea').setValue('发送一条消息')

    const action = wrapper.get('.conversation-pane__composer-action')

    expect(wrapper.findAll('.conversation-pane__composer-action')).toHaveLength(1)
    expect(action.attributes('aria-label')).toBe('发送消息')
    expect(action.classes()).toContain('primary-btn')
    expect(action.text()).toBe('')
    expect(wrapper.findAll('.conversation-pane__icon-tooltip')[1]?.text()).toBe('发送')
    expect(action.find('.conversation-pane__composer-action-icon').attributes('aria-hidden')).toBe('true')
    expect(action.find('path').exists()).toBe(true)
    expect(action.find('rect').exists()).toBe(false)

    await action.trigger('click')

    expect(wrapper.emitted('send-prompt')).toEqual([['发送一条消息']])
  })

  it('submits the draft when pressing enter in the composer', async () => {
    const wrapper = mount(ConversationPane, {
      props: buildProps()
    })

    await wrapper.get('textarea').setValue('回车发送')
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('send-prompt')).toEqual([['回车发送']])
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('')
  })

  it('keeps shift+enter and alt+enter as newline input in the composer', async () => {
    const wrapper = mount(ConversationPane, {
      props: buildProps()
    })

    await wrapper.get('textarea').setValue('第一行')
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter', shiftKey: true })
    await wrapper.get('textarea').setValue('第一行\n第二行')
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter', altKey: true })
    await wrapper.get('textarea').setValue('第一行\n第二行\n第三行')

    expect(wrapper.emitted('send-prompt')).toBeFalsy()
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('第一行\n第二行\n第三行')
  })

  it('does not submit while the input method editor is composing', async () => {
    const wrapper = mount(ConversationPane, {
      props: buildProps()
    })

    await wrapper.get('textarea').setValue('拼音输入中')
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter', isComposing: true })

    expect(wrapper.emitted('send-prompt')).toBeFalsy()
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('拼音输入中')
  })

  it('switches the single primary action slot to stop while running', async () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        isRunning: true,
        canStopRun: true
      }
    })

    const action = wrapper.get('.conversation-pane__composer-action')

    expect(wrapper.findAll('.conversation-pane__composer-action')).toHaveLength(1)
    expect(action.attributes('aria-label')).toBe('停止运行')
    expect(action.classes()).toContain('secondary-btn--danger')
    expect(action.attributes('disabled')).toBeUndefined()
    expect(action.find('rect').exists()).toBe(true)
    expect(action.find('path').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('停止只会取消当前运行')
    expect(conversationPaneSource).not.toContain('.conversation-pane__stop-note {')

    await action.trigger('click')

    expect(wrapper.emitted('stop-run')).toEqual([[]])
  })

  it('does not trigger stop or send when pressing enter while running', async () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        isRunning: true,
        canStopRun: true
      }
    })

    await wrapper.get('textarea').setValue('运行中继续写草稿')
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('stop-run')).toBeFalsy()
    expect(wrapper.emitted('send-prompt')).toBeFalsy()
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('运行中继续写草稿')
  })

  it('keeps the stop action in the same slot with pending affordance while cancellation is in flight', () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        canStopRun: true,
        stopPending: true
      }
    })

    const action = wrapper.get('.conversation-pane__composer-action')

    expect(wrapper.findAll('.conversation-pane__composer-action')).toHaveLength(1)
    expect(action.attributes('aria-label')).toBe('停止中')
    expect(action.attributes('disabled')).toBeDefined()
    expect(action.classes()).toContain('secondary-btn--danger')
    expect(wrapper.find('.conversation-pane__composer-action-spinner').exists()).toBe(true)
    expect(wrapper.find('.conversation-pane__composer-note').exists()).toBe(false)
    expect(wrapper.findAll('.conversation-pane__actions > *')).toHaveLength(2)
    expect(conversationPaneSource).toContain('.conversation-pane__composer-action-spinner {')
    expect(conversationPaneSource).toContain('.conversation-pane__composer-action--stop .conversation-pane__composer-action-icon {')
  })

  it('renders protocol messages and emits protocol actions', async () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        messages: [
          {
            id: 'protocol-1',
            kind: 'protocol',
            role: 'assistant',
            text: '{"version":"1.0"}',
            createdAt: 1,
            status: 'done',
            protocolState: null,
            protocol: {
              version: '1.0',
              components: [
                { type: 'text', id: 'title', content: '计划 v1: 升级消息层', style: 'heading' },
                {
                  type: 'list',
                  id: 'steps',
                  label: '执行步骤',
                  items: [{ id: 'step-1', title: '升级消息模型', description: '先保留结构化 payload' }]
                }
              ],
              actions: [
                {
                  id: 'plan-approve',
                  label: '批准执行',
                  type: 'tool',
                  tool: 'plan_decision',
                  toolInput: { decision: 'approve', planId: 'plan-1' }
                }
              ]
            }
          }
        ]
      }
    })

    expect(wrapper.text()).toContain('计划 v1: 升级消息层')
    expect(wrapper.text()).toContain('升级消息模型')

    await wrapper.get('.protocol-card__action-btn').trigger('click')

    expect(wrapper.emitted('protocol-action')?.[0]?.[0]).toBe('protocol-1')
  })

  it('renders rich result, artifact reference, and structured runtime error cards', async () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        messages: [
          {
            id: 'result-1',
            kind: 'result',
            role: 'assistant',
            text: '{"kind":"rows_result"}',
            createdAt: 1,
            status: 'done',
            result: {
              kind: 'rows_result',
              data: {
                columns: ['name', 'value'],
                rows: [{ name: 'foo', value: 'bar' }]
              }
            }
          },
          {
            id: 'artifact-1',
            kind: 'result',
            role: 'assistant',
            text: '{"kind":"artifact_ref"}',
            createdAt: 2,
            status: 'done',
            result: {
              kind: 'artifact_ref',
              data: {
                fileId: 'artifact-42',
                mimeType: 'text/csv'
              }
            }
          },
          {
            id: 'error-1',
            kind: 'error',
            role: 'assistant',
            text: '模型输出失败',
            createdAt: 3,
            status: 'error',
            runtimeError: {
              code: 'MODEL',
              stage: 'tool',
              retryable: true,
              userMessage: '工具 read_file 执行失败',
              detail: 'finish_reason=length'
            }
          }
        ]
      }
    })

    expect(wrapper.text()).toContain('结构化结果')
    expect(wrapper.text()).toContain('foo')
    expect(wrapper.text()).toContain('产物引用')
    expect(wrapper.text()).toContain('artifact-42')
    expect(wrapper.text()).toContain('工具执行失败')
    expect(wrapper.find('.conversation-pane__error-card small').exists()).toBe(false)
    expect(wrapper.get('.conversation-pane__error-card').attributes('role')).toBe('alert')
    expect(wrapper.get('.conversation-pane__error-card').attributes('aria-live')).toBe('assertive')
    expect(wrapper.get('.conversation-pane__error-details summary').text()).toBe('查看失败详情')
    expect(wrapper.get('.conversation-pane__error-detail-body').text()).toContain('finish_reason=length')

    await wrapper.get('.rich-result-card__action').trigger('click')

    expect(wrapper.emitted('open-artifact-file')?.[0]).toEqual(['artifact-42'])
  })

  it('renders eligible assistant text in reading mode and emits a per-message toggle', async () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        messages: [
          buildTextMessage({
            id: 'assistant-1',
            text: '# 标题\n\n- 第一项\n- 第二项',
            readingModeEligible: true,
            displayMode: 'reading'
          })
        ]
      }
    })

    expect(wrapper.find('.assistant-text-message__reading').exists()).toBe(true)
    expect(wrapper.text()).toContain('原文')

    await wrapper.get('.assistant-text-message__toggle').trigger('click')

    expect(wrapper.emitted('toggle-assistant-reading-mode')).toEqual([[ 'assistant-1' ]])
  })

  it('preserves visible line breaks only for eligible reading-mode assistant text', () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        messages: [
          buildTextMessage({
            id: 'assistant-reading',
            text: '整理结果如下：\n第一项 **已完成**\n第二项 `待确认`',
            readingModeEligible: true,
            displayMode: 'reading'
          }),
          buildTextMessage({
            id: 'assistant-raw',
            text: '收到\n继续处理',
            readingModeEligible: false,
            displayMode: 'raw'
          })
        ]
      }
    })

    const reading = wrapper.get('.assistant-text-message__reading')
    const raw = wrapper.get('.assistant-text-message__raw')

    expect(reading.html()).toContain('<br>')
    expect(reading.html()).toContain('<strong>已完成</strong>')
    expect(reading.html()).toContain('<code>待确认</code>')
    expect(raw.text()).toBe('收到\n继续处理')
    expect(raw.html()).not.toContain('<br>')
  })

  it('keeps streaming assistant text on the raw path without a reading toggle', () => {
    const wrapper = mount(ConversationPane, {
      props: {
        ...buildProps(),
        messages: [
          buildTextMessage({
            id: 'assistant-streaming',
            text: '# 标题\n\n- 第一项\n- 第二项',
            status: 'streaming',
            readingModeEligible: false,
            displayMode: 'raw'
          })
        ]
      }
    })

    expect(wrapper.find('.assistant-text-message__reading').exists()).toBe(false)
    expect(wrapper.find('.assistant-text-message__toggle').exists()).toBe(false)
    expect(wrapper.text()).toContain('# 标题')
  })
})
