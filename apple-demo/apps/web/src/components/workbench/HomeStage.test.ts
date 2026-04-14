import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import HomeStage from './HomeStage.vue'
import homeStageSource from './HomeStage.vue?raw'

describe('HomeStage', () => {
  it('uses a centered hero header layout for compact agent subtitles', () => {
    const wrapper = mount(HomeStage, {
      props: {
        title: '小曼智能体',
        subtitle: 'MML配置助手',
        starterGroups: [],
        discoverySkills: [],
        searchQuery: ''
      }
    })

    expect(wrapper.get('.home-stage__header-identity').classes()).toContain('agent-identity')
    expect(wrapper.get('.home-stage__header-main').classes()).toContain('agent-identity__main')
    expect(wrapper.get('.home-stage__header-badge').classes()).toContain('agent-identity__badge')
    expect(wrapper.get('.home-stage__header-copy').classes()).toContain('agent-identity__copy')
    expect(wrapper.get('.home-stage__title').text()).toBe('小曼智能体')
    const subtitle = wrapper.get('.home-stage__subtitle')
    expect(subtitle.text()).toBe('MML配置助手')
    expect(subtitle.classes()).toContain('agent-identity__subtitle')
  })

  it('uses the unified composer placeholder and hover tips', () => {
    const wrapper = mount(HomeStage, {
      props: {
        title: '小曼智能体',
        subtitle: 'MML配置助手',
        starterGroups: [],
        discoverySkills: [],
        searchQuery: ''
      }
    })

    expect(wrapper.get('textarea').attributes('placeholder')).toBe('请输入您的问题，按shift+回车可换行')
    expect(wrapper.findAll('.home-stage__icon-tooltip')).toHaveLength(2)
    expect(wrapper.findAll('.home-stage__icon-tooltip')[0]?.text()).toBe('点击或拖拽可上传文件，支持的类型：txt、md、csv')
    expect(wrapper.findAll('.home-stage__icon-tooltip')[1]?.text()).toBe('发送')
    expect(wrapper.get('.home-stage__composer-action').attributes('aria-label')).toBe('发送消息')
    expect(wrapper.get('.home-stage__composer-action').text()).toBe('')
    expect(homeStageSource).toContain('.home-stage__icon-tooltip {')
    expect(homeStageSource).toContain('.home-stage__icon-entry:hover .home-stage__icon-tooltip,')
    expect(homeStageSource).toContain('bottom: calc(100% + 6px);')
    expect(homeStageSource).not.toContain('home-stage__icon-tooltip home-stage__icon-tooltip--wide')
  })
})
