import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const refreshActiveAgentGovernance = vi.fn()

vi.mock('@/stores/workbenchStore', () => ({
  useWorkbenchStore: () => ({
    refreshActiveAgentGovernance
  })
}))

vi.mock('@/api/agentApi', () => ({
  agentApi: {
    listManagedSkills: vi.fn(),
    updateManagedSkill: vi.fn(),
    uploadManagedSkill: vi.fn(),
    deleteManagedSkill: vi.fn()
  }
}))

import { agentApi } from '@/api/agentApi'
import AdminSkillManagement from './AdminSkillManagement.vue'
import adminSkillManagementSource from './AdminSkillManagement.vue?raw'

const mockedAgentApi = vi.mocked(agentApi)
const normalizedAdminSkillManagementSource = adminSkillManagementSource.replace(/\r\n/g, '\n')

function buildManagedSkill(overrides: Record<string, unknown> = {}) {
  return {
    skillId: 'dpi-new-bwm-pcc',
    canonicalName: 'dpi_planning_entry',
    canonicalDescription: 'Canonical description',
    displayName: 'DPI Planning Entry',
    displayDescription: 'Governed description',
    starterSummary: 'Starter summary',
    ownerAgentId: 'workspace-agent',
    sourceAgentId: 'workspace-agent',
    sourcePath: '/skills/dpi',
    inputExample: 'Generate a DPI plan',
    outputExample: 'Generated output',
    allowedTools: ['read_file'],
    lifecycle: 'draft' as const,
    intentGroup: 'planning' as const,
    starterEnabled: true,
    starterPriority: 100,
    agentBindings: [{
      agentId: 'workspace-agent'
    }],
    importedAt: 1,
    updatedAt: 2,
    ...overrides
  }
}

function buildAgents() {
  return [{
    id: 'workspace-agent',
    name: 'Workspace Agent',
    description: 'Default workspace agent',
    version: '1.0.0',
    skillCount: 1
  }]
}

describe('AdminSkillManagement', () => {
  beforeEach(() => {
    refreshActiveAgentGovernance.mockReset()
    mockedAgentApi.listManagedSkills.mockReset()
    mockedAgentApi.updateManagedSkill.mockReset()
    mockedAgentApi.uploadManagedSkill.mockReset()
    mockedAgentApi.deleteManagedSkill.mockReset()
    mockedAgentApi.listManagedSkills.mockResolvedValue({
      skills: [buildManagedSkill()],
      agents: buildAgents()
    })
    mockedAgentApi.updateManagedSkill.mockResolvedValue(buildManagedSkill({
      displayName: 'Governed Planning Entry',
      starterSummary: 'Updated starter summary',
      lifecycle: 'published'
    }))
    mockedAgentApi.uploadManagedSkill.mockResolvedValue({
      replaced: false,
      skill: buildManagedSkill({
        skillId: 'uploaded-skill',
        canonicalName: 'uploaded-skill',
        displayName: 'uploaded-skill'
      })
    })
    mockedAgentApi.deleteManagedSkill.mockResolvedValue()
  })

  it('renders the single-skill summary rail as a single summary card', async () => {
    const wrapper = mount(AdminSkillManagement)
    await flushPromises()

    const summaryRail = wrapper.get('.admin-skills__summary-rail')
    const summaryCards = wrapper.findAll('.admin-skills__item--summary')

    expect(summaryRail.text()).toContain('当前治理状态')
    expect(summaryRail.text()).toContain('左侧仅展示当前 Skill 的核心治理状态')
    expect(summaryRail.text()).toContain('DPI Planning Entry')
    expect(summaryRail.text()).toContain('草稿')
    expect(summaryRail.text()).toContain('Starter')
    expect(summaryRail.text()).toContain('已启用')
    expect(summaryRail.text()).toContain('意图分组')
    expect(summaryRail.text()).toContain('方案制作')
    expect(summaryCards).toHaveLength(1)
    expect(summaryCards[0]?.classes()).toContain('admin-skills__item--active')
    expect(wrapper.find('.admin-skills__filters').exists()).toBe(false)
  })

  it('renders summary-card navigation and detail layout for multi-skill datasets', async () => {
    mockedAgentApi.listManagedSkills.mockResolvedValueOnce({
      skills: [
        buildManagedSkill(),
        buildManagedSkill({
          skillId: 'traffic-verifier',
          canonicalName: 'traffic_verifier',
          displayName: 'Traffic Verifier',
          lifecycle: 'published',
          starterEnabled: false,
          intentGroup: null,
          agentBindings: []
        })
      ],
      agents: buildAgents()
    })

    const wrapper = mount(AdminSkillManagement)
    await flushPromises()

    const summaryRail = wrapper.get('.admin-skills__summary-rail')
    const summaryCards = wrapper.findAll('.admin-skills__item--summary')

    expect(wrapper.find('.admin-skills__list').exists()).toBe(true)
    expect(summaryRail.text()).toContain('选择要治理的 Skill')
    expect(summaryRail.text()).toContain('通过左侧摘要卡切换当前治理对象')
    expect(summaryCards).toHaveLength(2)
    expect(summaryCards[0]?.text()).toContain('DPI Planning Entry')
    expect(summaryCards[1]?.text()).toContain('Traffic Verifier')
    expect(summaryCards[1]?.text()).toContain('已发布')
    expect(summaryCards[1]?.text()).toContain('Starter')
    expect(summaryCards[1]?.text()).toContain('未启用')
    expect(summaryCards[1]?.text()).not.toContain('意图分组')
    expect(summaryCards[1]?.text()).not.toContain('traffic_verifier')
    expect(summaryCards[1]?.text()).not.toContain('traffic-verifier')
    expect(wrapper.find('.admin-skills__filters').exists()).toBe(false)
    expect(wrapper.find('.admin-skills__detail').exists()).toBe(true)
    expect(wrapper.find('.admin-skills__detail-body').exists()).toBe(true)
    expect(wrapper.find('.admin-skills__section--starter').exists()).toBe(true)
    expect(normalizedAdminSkillManagementSource).toContain('.admin-skills__detail {\n  display: flex;\n  flex-direction: column;\n  overflow-y: auto;')
    expect(normalizedAdminSkillManagementSource).toContain('.admin-skills__detail-body {\n  flex: 1;\n  min-height: 0;\n  min-width: 0;\n  display: grid;\n  gap: var(--section-gap);\n  overflow: auto;')
    expect(normalizedAdminSkillManagementSource).toContain('.admin-skills__items {\n  flex: 1;\n  min-height: 0;\n  overflow: auto;')
  })

  it('refreshes active workbench governance metadata after saving skill changes', async () => {
    const wrapper = mount(AdminSkillManagement)
    await flushPromises()

    await wrapper.get('.admin-skills__row input[type="text"]').setValue('Governed Planning Entry')
    await wrapper.get('.admin-skills__section--starter textarea').setValue('Updated starter summary')
    await wrapper.get('.admin-skills__actions .primary-btn').trigger('click')
    await flushPromises()

    expect(mockedAgentApi.updateManagedSkill).toHaveBeenCalledWith('dpi-new-bwm-pcc', expect.objectContaining({
      displayName: 'Governed Planning Entry',
      starterSummary: 'Updated starter summary',
      agentBindings: [{
        agentId: 'workspace-agent'
      }],
      lifecycle: 'draft'
    }))
    expect(refreshActiveAgentGovernance).toHaveBeenCalledTimes(1)
  })

  it('uses the display-name field under the base section and keeps bindings enablement-only', async () => {
    const wrapper = mount(AdminSkillManagement)
    await flushPromises()

    expect(wrapper.find('.admin-skills__row input[type="text"]').exists()).toBe(true)
    expect(wrapper.find('.admin-skills__binding-item input[type="text"]').exists()).toBe(false)
  })

  it('shows a starter preview fallback when starter summary is empty', async () => {
    mockedAgentApi.listManagedSkills.mockResolvedValueOnce({
      skills: [buildManagedSkill({ starterSummary: '' })],
      agents: buildAgents()
    })

    const wrapper = mount(AdminSkillManagement)
    await flushPromises()

    expect(wrapper.get('.admin-skills__starter-preview-card-summary').text()).toContain('Governed description')
  })

  it('normalizes legacy invalid intent groups and never resubmits the unknown value', async () => {
    mockedAgentApi.listManagedSkills.mockResolvedValueOnce({
      skills: [buildManagedSkill({ intentGroup: 'data-transformation' as never })],
      agents: buildAgents()
    })

    const wrapper = mount(AdminSkillManagement)
    await flushPromises()

    const intentGroupSelect = wrapper.get('.admin-skills__field--intent select')
    expect((intentGroupSelect.element as HTMLSelectElement).value).toBe('')
    expect(wrapper.text()).toContain('历史意图分组“data-transformation”已失效')

    await wrapper.get('.admin-skills__row input[type="text"]').setValue('Governed Planning Entry')
    await wrapper.get('.admin-skills__actions .primary-btn').trigger('click')
    await flushPromises()

    expect(mockedAgentApi.updateManagedSkill).toHaveBeenCalledWith('dpi-new-bwm-pcc', expect.objectContaining({
      intentGroup: null
    }))
  })

  it('keeps multi-skill selection behavior with clickable summary cards after list controls are removed', async () => {
    mockedAgentApi.listManagedSkills.mockResolvedValueOnce({
      skills: [
        buildManagedSkill(),
        buildManagedSkill({
          skillId: 'traffic-verifier',
          canonicalName: 'traffic_verifier',
          displayName: 'Traffic Verifier',
          lifecycle: 'published',
          starterEnabled: false,
          intentGroup: null,
          agentBindings: []
        })
      ],
      agents: buildAgents()
    })

    const wrapper = mount(AdminSkillManagement)
    await flushPromises()

    const summaryCards = wrapper.findAll('.admin-skills__item--summary')
    expect(summaryCards[0]?.classes()).toContain('admin-skills__item--active')

    await summaryCards[1]!.trigger('click')
    await flushPromises()

    expect(summaryCards[1]?.classes()).toContain('admin-skills__item--active')
    expect(wrapper.get('.admin-skills__detail-head h2').text()).toBe('Traffic Verifier')
    expect(wrapper.get('.admin-skills__detail-head .status-pill').text()).toBe('traffic-verifier')
  })

  it('exposes a dedicated scroll container for governance detail while keeping the starter section structure', async () => {
    mockedAgentApi.listManagedSkills.mockResolvedValueOnce({
      skills: [
        buildManagedSkill(),
        buildManagedSkill({
          skillId: 'traffic-verifier',
          canonicalName: 'traffic_verifier',
          displayName: 'Traffic Verifier',
          lifecycle: 'published',
          starterEnabled: false,
          intentGroup: null,
          agentBindings: []
        })
      ],
      agents: buildAgents()
    })

    const wrapper = mount(AdminSkillManagement)
    await flushPromises()

    expect(wrapper.find('.admin-skills__list').exists()).toBe(true)
    expect(wrapper.find('.admin-skills__items').exists()).toBe(true)
    expect(wrapper.find('.admin-skills__detail').exists()).toBe(true)
    expect(wrapper.find('.admin-skills__detail-body').exists()).toBe(true)
    expect(wrapper.find('.admin-skills__section--starter').text()).toContain('Starter 摘要与预览')
    expect(normalizedAdminSkillManagementSource).toContain('.admin-skills__detail {\n  display: flex;\n  flex-direction: column;\n  overflow-y: auto;')
    expect(normalizedAdminSkillManagementSource).toContain('.admin-skills__items {\n  flex: 1;\n  min-height: 0;\n  overflow: auto;')
  })

  it('shows the explicit placeholder when the governed display name is empty', async () => {
    mockedAgentApi.listManagedSkills.mockResolvedValueOnce({
      skills: [buildManagedSkill({
        displayName: '',
        canonicalName: 'governed_canonical_name',
        skillId: 'governed-skill-id'
      })],
      agents: buildAgents()
    })

    const wrapper = mount(AdminSkillManagement)
    await flushPromises()

    const summaryRail = wrapper.get('.admin-skills__summary-rail')

    expect(summaryRail.text()).toContain('待填写用户可见名称')
    expect(summaryRail.text()).not.toContain('governed_canonical_name')
    expect(summaryRail.text()).not.toContain('governed-skill-id')
  })

  it('omits the intent-group line when starter is disabled in the single-skill summary rail', async () => {
    mockedAgentApi.listManagedSkills.mockResolvedValueOnce({
      skills: [buildManagedSkill({
        starterEnabled: false,
        intentGroup: 'verification'
      })],
      agents: buildAgents()
    })

    const wrapper = mount(AdminSkillManagement)
    await flushPromises()

    const summaryRail = wrapper.get('.admin-skills__summary-rail')

    expect(summaryRail.text()).toContain('Starter')
    expect(summaryRail.text()).toContain('未启用')
    expect(summaryRail.text()).not.toContain('意图分组')
    expect(summaryRail.text()).not.toContain('配置核查')
  })
  it('keeps desktop list and detail panes independently scrollable with stacked mobile fallback', () => {
    expect(normalizedAdminSkillManagementSource).toContain('.admin-skills {\n  flex: 1;')
    expect(normalizedAdminSkillManagementSource).toContain('min-height: 0;\n  display: flex;')
    expect(normalizedAdminSkillManagementSource).toContain('padding-inline: var(--pane-inline);\n  overflow: hidden;')
    expect(normalizedAdminSkillManagementSource).toContain('.admin-skills__list {\n  display: flex;\n  flex-direction: column;')
    expect(normalizedAdminSkillManagementSource).toContain('gap: calc(var(--section-gap) * 0.8);\n  overflow: hidden;')
    expect(normalizedAdminSkillManagementSource).toContain('@media (max-width: 1180px) {\n  .admin-skills {\n    overflow-y: auto;')
    expect(normalizedAdminSkillManagementSource).toContain('.admin-skills__list,\n  .admin-skills__detail,\n  .admin-skills__items {\n    overflow: visible;')
  })

  it('uses compact summary-card density with accent-rail selection', () => {
    expect(normalizedAdminSkillManagementSource).toContain('.admin-skills__item {\n  padding: calc(var(--card-pad-tight) * 0.65) calc(var(--card-pad-tight) * 0.85);')
    expect(normalizedAdminSkillManagementSource).toContain('border-left: 3px solid transparent;')
    expect(normalizedAdminSkillManagementSource).toContain('border-radius: 8px;')
    expect(normalizedAdminSkillManagementSource).toContain('.admin-skills__summary-rail {\n  flex: 1;\n  min-height: 0;\n  display: flex;\n  flex-direction: column;')
    expect(normalizedAdminSkillManagementSource).toContain('.admin-skills__items--summary {\n  gap: calc(var(--section-gap) * 0.55);\n  align-content: start;\n  grid-auto-rows: max-content;')
    expect(normalizedAdminSkillManagementSource).toContain('.admin-skills__item--summary {\n  gap: calc(var(--section-gap) * 0.45);\n  min-block-size: 6.25rem;')
    expect(normalizedAdminSkillManagementSource).toContain('cursor: pointer;')
    expect(normalizedAdminSkillManagementSource).toContain('.admin-skills__item--active {\n  border-color: rgba(96, 165, 250, 0.42);\n  border-left-color: var(--accent);')
    expect(normalizedAdminSkillManagementSource).toContain('box-shadow: 0 8px 18px rgba(59, 130, 246, 0.08);')
    expect(normalizedAdminSkillManagementSource).toContain('.admin-skills__item-meta {\n  display: flex;\n  flex-wrap: wrap;')
    expect(normalizedAdminSkillManagementSource).not.toContain('box-shadow: var(--shadow-md);')
  })

  it('tightens card and section density to match workbench scale', () => {
    expect(normalizedAdminSkillManagementSource).toContain('border-radius: 12px;')
    expect(normalizedAdminSkillManagementSource).toContain('.admin-skills__hero {\n  padding: calc(var(--card-pad) * 0.8) var(--card-pad);')
    expect(normalizedAdminSkillManagementSource).toContain('.admin-skills__section {\n  display: grid;\n  gap: calc(var(--section-gap) * 0.6);')
    expect(normalizedAdminSkillManagementSource).toContain('.admin-skills__canonical {\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  gap: calc(var(--section-gap) * 0.55);')
  })

  it('maps typography to the existing workbench text hierarchy', () => {
    expect(normalizedAdminSkillManagementSource).toContain('.admin-skills__hero p:last-child {\n  margin: calc(var(--section-gap) * 0.6) 0 0;')
    expect(normalizedAdminSkillManagementSource).toContain('color: var(--text-secondary);\n  font-size: var(--font-meta);\n  line-height: var(--line-meta);')
    expect(normalizedAdminSkillManagementSource).toContain('.admin-skills__item-head strong {\n  font-size: var(--font-dense);\n  line-height: var(--line-dense);')
    expect(normalizedAdminSkillManagementSource).toContain('.admin-skills__section-head h3 {\n  margin: 0;\n  font-size: var(--font-title);\n  line-height: var(--line-title);')
    expect(normalizedAdminSkillManagementSource).toContain('.admin-skills__binding-item strong {\n  display: block;\n  font-size: var(--font-dense);\n  line-height: var(--line-dense);')
  })

  it('shows upload conflict confirmation and retries with overwrite', async () => {
    mockedAgentApi.uploadManagedSkill
      .mockRejectedValueOnce(Object.assign(new Error('Conflict'), {
        code: 'SKILL_UPLOAD_CONFLICT',
        conflict: {
          reason: 'id',
          skillId: 'dpi-new-bwm-pcc',
          canonicalName: 'dpi-new-bwm-pcc',
          lifecycle: 'published',
          boundAgents: ['workspace-agent']
        }
      }))
      .mockResolvedValueOnce({
        replaced: true,
        skill: buildManagedSkill({
          canonicalName: 'Canonical Overwrite'
        })
      })

    const wrapper = mount(AdminSkillManagement)
    await flushPromises()

    const file = new File(['zip'], 'skill.zip', { type: 'application/zip' })
    const uploadInput = wrapper.get('.admin-skills__upload-input')
    Object.defineProperty(uploadInput.element, 'files', {
      value: [file],
      configurable: true
    })
    await uploadInput.trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain('发现 canonical skill 冲突')
    expect(wrapper.text()).toContain('本次上传与现有 canonical id 冲突')
    const confirmButton = wrapper.findAll('.admin-skills__notice-actions .primary-btn')[0]
    await confirmButton.trigger('click')
    await flushPromises()

    expect(mockedAgentApi.uploadManagedSkill).toHaveBeenNthCalledWith(1, file, false)
    expect(mockedAgentApi.uploadManagedSkill).toHaveBeenNthCalledWith(2, file, true)
    expect(refreshActiveAgentGovernance).toHaveBeenCalledTimes(1)
  })

  it('blocks overwrite confirmation for canonical name conflicts', async () => {
    mockedAgentApi.uploadManagedSkill.mockRejectedValueOnce(Object.assign(new Error('Conflict'), {
      code: 'SKILL_UPLOAD_CONFLICT',
      conflict: {
        reason: 'name',
        skillId: 'dpi-new-bwm-pcc',
        canonicalName: 'dpi-new-bwm-pcc',
        lifecycle: 'published',
        boundAgents: ['workspace-agent']
      }
    }))

    const wrapper = mount(AdminSkillManagement)
    await flushPromises()

    const file = new File(['zip'], 'skill.zip', { type: 'application/zip' })
    const uploadInput = wrapper.get('.admin-skills__upload-input')
    Object.defineProperty(uploadInput.element, 'files', {
      value: [file],
      configurable: true
    })
    await uploadInput.trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain('发现 canonical skill 冲突')
    expect(wrapper.text()).toContain('本次上传与现有 canonical name 冲突')
    expect(wrapper.text()).toContain('canonical name 冲突不支持覆盖')
    expect(wrapper.find('.admin-skills__notice-actions .primary-btn').exists()).toBe(false)
    expect(mockedAgentApi.uploadManagedSkill).toHaveBeenCalledTimes(1)
  })

  it('shows publish blockers and disables save when publication governance is incomplete', async () => {
    mockedAgentApi.listManagedSkills.mockResolvedValueOnce({
      skills: [buildManagedSkill({
        displayName: '',
        displayDescription: '',
        lifecycle: 'draft',
        agentBindings: []
      })],
      agents: buildAgents()
    })

    const wrapper = mount(AdminSkillManagement)
    await flushPromises()

    await wrapper.get('.admin-skills__row select').setValue('published')
    await flushPromises()

    expect(wrapper.text()).toContain('发布前还需要完成以下治理项')
    expect(wrapper.text()).toContain('请先完成用户可见名称治理。')
    expect(wrapper.text()).toContain('请先填写用户可见描述。')
    expect(wrapper.text()).toContain('请至少绑定一个 Agent。')
    expect(wrapper.text()).toContain('当前未满足发布条件，Skill 必须保持草稿。')
    expect(wrapper.get('.admin-skills__actions .primary-btn').attributes('disabled')).toBeDefined()
  })

  it('shows overwrite reset warning after replacing a managed skill package', async () => {
    mockedAgentApi.listManagedSkills
      .mockResolvedValueOnce({
        skills: [buildManagedSkill()],
        agents: buildAgents()
      })
      .mockResolvedValueOnce({
        skills: [buildManagedSkill({
          displayName: '',
          displayDescription: '',
          starterSummary: '',
          lifecycle: 'draft',
          starterEnabled: false,
          starterPriority: 0,
          agentBindings: []
        })],
        agents: buildAgents()
      })
    mockedAgentApi.uploadManagedSkill.mockResolvedValueOnce({
      replaced: true,
      skill: buildManagedSkill()
    })

    const wrapper = mount(AdminSkillManagement)
    await flushPromises()

    const file = new File(['zip'], 'skill.zip', { type: 'application/zip' })
    const uploadInput = wrapper.get('.admin-skills__upload-input')
    Object.defineProperty(uploadInput.element, 'files', {
      value: [file],
      configurable: true
    })
    await uploadInput.trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain('覆盖已重置治理状态')
    expect(wrapper.text()).toContain('生命周期已重置为草稿')
    expect(wrapper.text()).toContain('Agent 绑定均已清空')
    expect(refreshActiveAgentGovernance).toHaveBeenCalledTimes(1)
  })

  it('renders structured upload validation issues inline', async () => {
    mockedAgentApi.uploadManagedSkill.mockRejectedValueOnce(Object.assign(new Error('Invalid skill package'), {
      code: 'SKILL_UPLOAD_INVALID',
      issues: [{
        code: 'invalid_frontmatter',
        field: 'id',
        path: 'SKILL.md',
        message: 'SKILL.md frontmatter is missing required "id" string.'
      }]
    }))

    const wrapper = mount(AdminSkillManagement)
    await flushPromises()

    const uploadInput = wrapper.get('.admin-skills__upload-input')
    Object.defineProperty(uploadInput.element, 'files', {
      value: [new File(['zip'], 'invalid.zip', { type: 'application/zip' })],
      configurable: true
    })
    await uploadInput.trigger('change')
    await flushPromises()

    expect(wrapper.text()).toContain('上传校验失败')
    expect(wrapper.text()).toContain('missing required "id" string')
  })

  it('requires explicit delete confirmation before deleting a skill', async () => {
    const wrapper = mount(AdminSkillManagement)
    await flushPromises()

    const deleteButton = wrapper.findAll('.admin-skills__actions button').find(button => button.text().includes('删除 Skill'))
    expect(deleteButton).toBeTruthy()
    await deleteButton!.trigger('click')
    await flushPromises()

    expect(mockedAgentApi.deleteManagedSkill).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('确认删除 Skill')

    await deleteButton!.trigger('click')
    await flushPromises()

    expect(mockedAgentApi.deleteManagedSkill).toHaveBeenCalledWith('dpi-new-bwm-pcc')
    expect(refreshActiveAgentGovernance).toHaveBeenCalledTimes(1)
  })
})
