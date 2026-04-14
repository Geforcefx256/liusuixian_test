import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import WorkspaceSidebar from './WorkspaceSidebar.vue'
import workspaceSidebarSource from './WorkspaceSidebar.vue?raw'
import type { AgentWorkspacePayload } from '@/api/types'

const normalizedWorkspaceSidebarSource = workspaceSidebarSource.replace(/\r\n/g, '\n')

type SidebarTestProps = {
  tasks: AgentWorkspacePayload['tasks']
  activeTab: 'workspace' | 'templates'
  collapsed: boolean
  externalRenameRequest?: { fileId: string; requestKey: number } | null
  selectedFileId: string | null
  activeFileId: string | null
  isRunning: boolean
  dirtyFileIds: string[]
  submitRenameFile: (fileId: string, nextFileName: string) => Promise<boolean>
  submitRenameFolder: (folderKey: string, nextFolderName: string) => Promise<boolean>
  createProjectEntry: (kind: 'folder' | 'txt' | 'md', fileName: string, parentPath?: string | null) => Promise<boolean>
}

function buildFileEntries(options: {
  groupId: 'upload' | 'project'
  count: number
  prefix: string
  startAddedAt?: number
}) {
  const {
    groupId,
    count,
    prefix,
    startAddedAt = 1
  } = options

  return Array.from({ length: count }, (_, index) => {
    const fileName = `${prefix}-${index + 1}.md`
    return {
      nodeId: `${groupId}-${index + 1}`,
      fileId: `${groupId}-${index + 1}`,
      fileKey: `${groupId}-${index + 1}`,
      path: `${groupId}/${fileName}`,
      relativePath: fileName,
      fileName,
      nodeType: 'file' as const,
      source: groupId,
      groupId,
      writable: true,
      addedAt: startAddedAt + index
    }
  })
}

function buildProps(overrides: Partial<SidebarTestProps> = {}) {
  return {
    ...baseProps(),
    ...overrides
  }
}

function baseProps(): SidebarTestProps {
  const tasks: AgentWorkspacePayload['tasks'] = [
    {
      id: 'workspace-agent',
      label: '工作目录',
      groups: [
        {
          id: 'upload',
          label: 'upload',
          entries: [
            {
              nodeId: 'f-1',
              fileId: 'f-1',
              fileKey: 'f-1',
              path: 'upload/README.md',
              relativePath: 'README.md',
              fileName: 'README.md',
              nodeType: 'file',
              source: 'upload',
              groupId: 'upload',
              writable: true,
              addedAt: 1
            }
          ]
        },
        {
          id: 'project',
          label: 'project',
          entries: []
        }
      ]
    }
  ]

  return {
    tasks,
    activeTab: 'workspace' as const,
    collapsed: false,
    externalRenameRequest: null,
    selectedFileId: null,
    activeFileId: null,
    isRunning: false,
    dirtyFileIds: [],
    submitRenameFile: vi.fn().mockResolvedValue(true),
    submitRenameFolder: vi.fn().mockResolvedValue(true),
    createProjectEntry: vi.fn().mockResolvedValue(true)
  }
}

describe('WorkspaceSidebar', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('keeps the tab bar as a dedicated top chrome band above the workspace tree', () => {
    const wrapper = mount(WorkspaceSidebar, {
      props: buildProps()
    })

    expect(wrapper.find('.workspace-sidebar__head').exists()).toBe(true)
    expect(wrapper.find('.workspace-sidebar__section-head').exists()).toBe(false)
    expect(wrapper.get('.workspace-sidebar__head').text()).toContain('工作空间')
    expect(wrapper.text()).not.toContain('共享工作区')
    expect(wrapper.text()).toContain('upload')
    expect(wrapper.text()).toContain('project')
    expect(wrapper.text()).not.toContain('新增')
    expect(wrapper.get('.workspace-sidebar__tabs').classes()).toContain('segmented-control')
    expect(wrapper.get('.workspace-sidebar__tabs').classes()).toContain('segmented-control--fill')
    expect(normalizedWorkspaceSidebarSource).toContain(`.workspace-sidebar {
  width: var(--workspace-sidebar-width, 320px);
  display: flex;
  min-width: 0;
  min-height: 0;
  block-size: 100%;
  overflow: hidden;
}`)
    expect(workspaceSidebarSource).toContain('.workspace-sidebar__shell {')
    expect(workspaceSidebarSource).toContain('padding: 0;')
    expect(workspaceSidebarSource).toContain('min-height: 0;')
    expect(workspaceSidebarSource).toContain('overflow: hidden;')
    expect(workspaceSidebarSource).toContain('.workspace-sidebar__head {')
    expect(workspaceSidebarSource).toContain('min-block-size: var(--chrome-secondary-b);')
    expect(workspaceSidebarSource).toContain('padding-inline: var(--pane-inline);')
    expect(workspaceSidebarSource).toContain('segmented-control segmented-control--compact segmented-control--fill')
    expect(workspaceSidebarSource).not.toContain('.workspace-sidebar__tab,\n.workspace-sidebar__toggle {')
    expect(workspaceSidebarSource).not.toContain('workspace-sidebar--collapsed')
    expect(wrapper.text()).not.toContain('当前面板：')
    expect(workspaceSidebarSource).not.toContain('当前面板：')
    expect(workspaceSidebarSource).toContain('.workspace-sidebar__panel {')
    expect(workspaceSidebarSource).toContain('padding: var(--pane-block) var(--pane-inline) 18px;')
    expect(normalizedWorkspaceSidebarSource).toContain(`.workspace-sidebar__panels {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}`)
  })

  it('renders clean upload and project group headers with folder icons and a compact plus trigger', () => {
    const wrapper = mount(WorkspaceSidebar, {
      props: buildProps({
        tasks: [
          {
            id: 'workspace-agent',
            label: '工作目录',
            groups: [
              {
                id: 'upload',
                label: 'upload',
                entries: []
              },
              {
                id: 'project',
                label: 'project',
                entries: []
              }
            ]
          }
        ]
      })
    })

    expect(wrapper.text()).toContain('upload')
    expect(wrapper.text()).toContain('project')
    expect(wrapper.text()).not.toContain('暂无文件')
    expect(wrapper.findAll('.workspace-sidebar__group-meta .icon-svg')).toHaveLength(2)
    expect(wrapper.findAll('.workspace-sidebar__group-count')).toHaveLength(0)
    expect(wrapper.get('.workspace-sidebar__new-trigger').text()).toBe('+')
    expect(wrapper.get('.workspace-sidebar__new-trigger').classes()).toContain('workspace-sidebar__context-new-trigger')
  })

  it('keeps the shared white-active segmented tab style when the template tab is active', () => {
    const wrapper = mount(WorkspaceSidebar, {
      props: buildProps({
        activeTab: 'templates'
      })
    })

    expect(wrapper.findAll('.workspace-sidebar__tab')[1]?.classes()).toContain('segmented-control__item--active')
  })

  it('closes the top plus menu when a pointerdown happens outside trigger and dropdown', async () => {
    const wrapper = mount(WorkspaceSidebar, {
      attachTo: document.body,
      props: buildProps()
    })

    await wrapper.get('.workspace-sidebar__new-trigger').trigger('click')
    expect(wrapper.find('.workspace-sidebar__new-dropdown').exists()).toBe(true)

    document.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.workspace-sidebar__new-dropdown').exists()).toBe(false)
  })

  it('closes the top plus menu when Escape is pressed', async () => {
    const wrapper = mount(WorkspaceSidebar, {
      attachTo: document.body,
      props: buildProps()
    })

    await wrapper.get('.workspace-sidebar__new-trigger').trigger('click')
    expect(wrapper.find('.workspace-sidebar__new-dropdown').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.workspace-sidebar__new-dropdown').exists()).toBe(false)
  })

  it('renders a dedicated row action menu for each workspace file row', async () => {
    const wrapper = mount(WorkspaceSidebar, {
      attachTo: document.body,
      props: buildProps()
    })

    const fileRow = wrapper.get('.workspace-sidebar__file-row')
    expect(fileRow.find('.workspace-sidebar__file').exists()).toBe(true)
    await fileRow.get('.workspace-file-action-menu__trigger').trigger('click')
    const items = Array.from(document.body.querySelectorAll('.workspace-file-action-menu__item')).map(node => node.textContent?.trim())
    expect(items).toEqual(['复制文件名', '重命名', '下载', '删除'])
  })

  it('emits copy-file-name from the row menu without also selecting or opening the file row', async () => {
    const props = buildProps()
    const wrapper = mount(WorkspaceSidebar, {
      attachTo: document.body,
      props
    })

    await wrapper.get('.workspace-file-action-menu__trigger').trigger('click')
    ;(document.body.querySelectorAll('.workspace-file-action-menu__item')[0] as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('copy-file-name')).toEqual([['f-1']])
    expect(wrapper.emitted('select-file')).toBeUndefined()
    expect(wrapper.emitted('open-file')).toBeUndefined()
    expect(props.submitRenameFile).not.toHaveBeenCalled()
  })

  it('starts inline rename from an explicit rename action without also selecting or opening the file row', async () => {
    const props = buildProps()
    const wrapper = mount(WorkspaceSidebar, {
      attachTo: document.body,
      props
    })

    await wrapper.get('.workspace-file-action-menu__trigger').trigger('click')
    ;(document.body.querySelectorAll('.workspace-file-action-menu__item')[1] as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.workspace-sidebar__rename-input').exists()).toBe(true)
    expect(wrapper.emitted('select-file')).toBeUndefined()
    expect(wrapper.emitted('open-file')).toBeUndefined()
    expect(props.submitRenameFile).not.toHaveBeenCalled()
  })

  it('disables rename and delete actions while the session is running', async () => {
    const wrapper = mount(WorkspaceSidebar, {
      attachTo: document.body,
      props: buildProps({
        isRunning: true
      })
    })

    await wrapper.get('.workspace-file-action-menu__trigger').trigger('click')

    const items = Array.from(document.body.querySelectorAll('.workspace-file-action-menu__item')) as HTMLButtonElement[]
    expect(items[1]!.disabled).toBe(true)
    expect(items[3]!.disabled).toBe(true)
    expect(items[1]!.title).toBe('当前会话正在运行，暂不支持重命名。')
  })

  it('disables rename and delete actions for dirty files', async () => {
    const wrapper = mount(WorkspaceSidebar, {
      attachTo: document.body,
      props: buildProps({
        dirtyFileIds: ['f-1']
      })
    })

    await wrapper.get('.workspace-file-action-menu__trigger').trigger('click')

    const items = Array.from(document.body.querySelectorAll('.workspace-file-action-menu__item')) as HTMLButtonElement[]
    expect(items[1]!.disabled).toBe(true)
    expect(items[3]!.disabled).toBe(true)
    expect(items[3]!.title).toBe('文件“README.md”有未保存修改，请先保存后再删除。')
  })

  it('keeps single-click selection and double-click open on the primary file row area', async () => {
    const wrapper = mount(WorkspaceSidebar, {
      props: buildProps()
    })

    await wrapper.get('.workspace-sidebar__file').trigger('click')
    await wrapper.get('.workspace-sidebar__file').trigger('dblclick')

    expect(wrapper.emitted('select-file')).toEqual([['f-1']])
    expect(wrapper.emitted('open-file')).toEqual([['f-1']])
  })

  it('renders inline rename as a stem-only input with autofocus and readonly extension text', async () => {
    const props = buildProps()
    const wrapper = mount(WorkspaceSidebar, {
      attachTo: document.body,
      props
    })

    await wrapper.get('.workspace-file-action-menu__trigger').trigger('click')
    ;(document.body.querySelectorAll('.workspace-file-action-menu__item')[1] as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()

    const input = wrapper.get('.workspace-sidebar__rename-input')
    expect((input.element as HTMLInputElement).value).toBe('README')
    expect(wrapper.get('.workspace-sidebar__rename-extension').text()).toBe('.md')
    expect(props.submitRenameFile).not.toHaveBeenCalled()
  })

  it('submits the recomposed full file name on Enter', async () => {
    const props = buildProps()
    const wrapper = mount(WorkspaceSidebar, {
      attachTo: document.body,
      props
    })

    await wrapper.get('.workspace-file-action-menu__trigger').trigger('click')
    ;(document.body.querySelectorAll('.workspace-file-action-menu__item')[1] as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()
    const input = wrapper.get('.workspace-sidebar__rename-input')
    await input.setValue('README-renamed')
    await input.trigger('keydown.enter')
    await flushPromises()

    expect(props.submitRenameFile).toHaveBeenCalledTimes(1)
    expect(props.submitRenameFile).toHaveBeenCalledWith('f-1', 'README-renamed.md')
    expect(wrapper.find('.workspace-sidebar__rename-input').exists()).toBe(false)
  })

  it('submits file rename with the fileId instead of the tree node id', async () => {
    const props = buildProps({
      tasks: [
        {
          id: 'workspace-agent',
          label: '工作目录',
          groups: [
            {
              id: 'upload',
              label: 'upload',
              entries: [
                {
                  nodeId: 'node-1',
                  fileId: 'file-1',
                  fileKey: 'key-1',
                  path: 'upload/README.md',
                  relativePath: 'README.md',
                  fileName: 'README.md',
                  nodeType: 'file',
                  source: 'upload',
                  groupId: 'upload',
                  writable: true,
                  addedAt: 1
                }
              ]
            },
            {
              id: 'project',
              label: 'project',
              entries: []
            }
          ]
        }
      ]
    })
    const wrapper = mount(WorkspaceSidebar, {
      attachTo: document.body,
      props
    })

    await wrapper.get('.workspace-file-action-menu__trigger').trigger('click')
    ;(document.body.querySelectorAll('.workspace-file-action-menu__item')[1] as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()
    const input = wrapper.get('.workspace-sidebar__rename-input')
    await input.setValue('README-renamed')
    await input.trigger('keydown.enter')
    await flushPromises()

    expect(props.submitRenameFile).toHaveBeenCalledWith('file-1', 'README-renamed.md')
  })

  it('reveals exact long file names while preserving suffix splits for long, extensionless, and hidden files', () => {
    const tasks: AgentWorkspacePayload['tasks'] = [
      {
        id: 'workspace-agent',
        label: '工作目录',
        groups: [
          {
            id: 'upload',
            label: 'upload',
            entries: [
              {
                nodeId: 'f-long',
                fileId: 'f-long',
                fileKey: 'f-long',
                path: 'upload/network-rollback-plan-for-region-a.tar.gz',
                relativePath: 'network-rollback-plan-for-region-a.tar.gz',
                fileName: 'network-rollback-plan-for-region-a.tar.gz',
                nodeType: 'file',
                source: 'upload',
                groupId: 'upload',
                writable: true,
                addedAt: 1
              },
              {
                nodeId: 'f-noext',
                fileId: 'f-noext',
                fileKey: 'f-noext',
                path: 'upload/deployment-rollout-notes-for-handover',
                relativePath: 'deployment-rollout-notes-for-handover',
                fileName: 'deployment-rollout-notes-for-handover',
                nodeType: 'file',
                source: 'upload',
                groupId: 'upload',
                writable: true,
                addedAt: 2
              },
              {
                nodeId: 'f-hidden',
                fileId: 'f-hidden',
                fileKey: 'f-hidden',
                path: 'upload/.env.production.example',
                relativePath: '.env.production.example',
                fileName: '.env.production.example',
                nodeType: 'file',
                source: 'upload',
                groupId: 'upload',
                writable: true,
                addedAt: 3
              }
            ]
          },
          {
            id: 'project',
            label: 'project',
            entries: []
          }
        ]
      }
    ]

    const wrapper = mount(WorkspaceSidebar, {
      props: buildProps({ tasks })
    })

    const suffixes = wrapper.findAll('.workspace-sidebar__file-suffix').map(node => node.text())
    expect(suffixes).toEqual(['.example', '.tar.gz'])
    expect(wrapper.findAll('.workspace-sidebar__file-stem')[1]?.text()).toBe('deployment-rollout-notes-for-handover')
    expect(wrapper.findAll('.workspace-sidebar__file-reveal').map(node => node.text())).toEqual([
      '.env.production.example',
      'deployment-rollout-notes-for-handover',
      'network-rollback-plan-for-region-a.tar.gz'
    ])
    expect(workspaceSidebarSource).toContain('.workspace-sidebar__file:hover .workspace-sidebar__file-reveal')
    expect(workspaceSidebarSource).toContain('.workspace-sidebar__file:focus-visible .workspace-sidebar__file-reveal')
  })

  it('starts inline rename when an external rename request targets the active file', async () => {
    const wrapper = mount(WorkspaceSidebar, {
      attachTo: document.body,
      props: buildProps({
        externalRenameRequest: {
          fileId: 'f-1',
          requestKey: 1
        }
      })
    })

    await wrapper.vm.$nextTick()

    expect(wrapper.find('.workspace-sidebar__rename-input').exists()).toBe(true)
  })

  it('cancels inline rename on Escape without issuing a request', async () => {
    const props = buildProps()
    const wrapper = mount(WorkspaceSidebar, {
      attachTo: document.body,
      props
    })

    await wrapper.get('.workspace-file-action-menu__trigger').trigger('click')
    ;(document.body.querySelectorAll('.workspace-file-action-menu__item')[1] as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()
    const input = wrapper.get('.workspace-sidebar__rename-input')
    await input.setValue('README-renamed')
    await input.trigger('keydown.escape')

    expect(props.submitRenameFile).not.toHaveBeenCalled()
    expect(wrapper.find('.workspace-sidebar__rename-input').exists()).toBe(false)
    expect(wrapper.get('.workspace-sidebar__file-name').text()).toBe('README.md')
  })

  it('submits inline rename on blur without double-firing requests', async () => {
    const props = buildProps()
    const wrapper = mount(WorkspaceSidebar, {
      attachTo: document.body,
      props
    })

    await wrapper.get('.workspace-file-action-menu__trigger').trigger('click')
    ;(document.body.querySelectorAll('.workspace-file-action-menu__item')[1] as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()
    const input = wrapper.get('.workspace-sidebar__rename-input')
    await input.setValue('README-on-blur')
    await input.trigger('blur')
    await flushPromises()

    expect(props.submitRenameFile).toHaveBeenCalledTimes(1)
    expect(props.submitRenameFile).toHaveBeenCalledWith('f-1', 'README-on-blur.md')
  })

  it('keeps extensionless files fully editable during inline rename', async () => {
    const props = buildProps({
      tasks: [
        {
          id: 'workspace-agent',
          label: '工作目录',
          groups: [
            {
              id: 'upload',
              label: 'upload',
              entries: [
                {
                  nodeId: 'f-1',
                  fileId: 'f-1',
                  fileKey: 'f-1',
                  path: 'upload/notes',
                  relativePath: 'notes',
                  fileName: 'notes',
                  nodeType: 'file',
                  source: 'upload',
                  groupId: 'upload',
                  writable: true,
                  addedAt: 1
                }
              ]
            }
          ]
        }
      ]
    })
    const wrapper = mount(WorkspaceSidebar, {
      attachTo: document.body,
      props
    })

    await wrapper.get('.workspace-file-action-menu__trigger').trigger('click')
    ;(document.body.querySelectorAll('.workspace-file-action-menu__item')[1] as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()
    const input = wrapper.get('.workspace-sidebar__rename-input')

    expect((input.element as HTMLInputElement).value).toBe('notes')
    expect(wrapper.find('.workspace-sidebar__rename-extension').exists()).toBe(false)

    await input.setValue('notes-renamed')
    await input.trigger('keydown.enter')
    await flushPromises()

    expect(props.submitRenameFile).toHaveBeenCalledWith('f-1', 'notes-renamed')
  })

  it('creates working folders inline instead of using a prompt flow', async () => {
    const props = buildProps({
      tasks: [
        {
          id: 'workspace-agent',
          label: '工作目录',
          groups: [
            {
              id: 'upload',
              label: 'upload',
              entries: []
            },
            {
              id: 'project',
              label: 'project',
              entries: []
            }
          ]
        }
      ]
    })
    const wrapper = mount(WorkspaceSidebar, {
      attachTo: document.body,
      props
    })

    await wrapper.get('.workspace-sidebar__new-trigger').trigger('click')
    const actions = wrapper.findAll('.workspace-sidebar__new-dropdown button')
    await actions[0]!.trigger('click')
    await wrapper.vm.$nextTick()

    const input = wrapper.get('.workspace-sidebar__rename-input')
    await input.setValue('plans')
    await input.trigger('keydown.enter')
    await flushPromises()

    expect(props.createProjectEntry).toHaveBeenCalledWith('folder', 'plans', null)
  })

  it('creates working files inline with a fixed extension label', async () => {
    const props = buildProps({
      tasks: [
        {
          id: 'workspace-agent',
          label: '工作目录',
          groups: [
            {
              id: 'upload',
              label: 'upload',
              entries: []
            },
            {
              id: 'project',
              label: 'project',
              entries: []
            }
          ]
        }
      ]
    })
    const wrapper = mount(WorkspaceSidebar, {
      attachTo: document.body,
      props
    })

    await wrapper.get('.workspace-sidebar__new-trigger').trigger('click')
    const actions = wrapper.findAll('.workspace-sidebar__new-dropdown button')
    await actions[1]!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.workspace-sidebar__rename-extension').text()).toBe('.txt')

    const input = wrapper.get('.workspace-sidebar__rename-input')
    await input.setValue('notes')
    await input.trigger('keydown.enter')
    await flushPromises()

    expect(props.createProjectEntry).toHaveBeenCalledWith('txt', 'notes.txt', null)
  })

  it('uses the working root for the top plus action even when a folder is selected', async () => {
    const props = buildProps({
      selectedFileId: 'folder-1',
      tasks: [
        {
          id: 'workspace-agent',
          label: '工作目录',
          groups: [
            {
              id: 'upload',
              label: 'upload',
              entries: []
            },
            {
              id: 'project',
              label: 'project',
              entries: [
                {
                  nodeId: 'folder-1',
                  folderKey: 'folder-1',
                  path: 'project/plans',
                  relativePath: 'plans',
                  fileName: 'plans',
                  nodeType: 'folder',
                  source: 'project',
                  groupId: 'project',
                  writable: true,
                  addedAt: 1
                }
              ]
            }
          ]
        }
      ]
    })
    const wrapper = mount(WorkspaceSidebar, {
      attachTo: document.body,
      props
    })

    await wrapper.get('.workspace-sidebar__new-trigger').trigger('click')
    await wrapper.findAll('.workspace-sidebar__new-dropdown button')[1]!.trigger('click')
    await wrapper.vm.$nextTick()

    const input = wrapper.get('.workspace-sidebar__rename-input')
    await input.setValue('notes')
    await input.trigger('keydown.enter')
    await flushPromises()

    expect(props.createProjectEntry).toHaveBeenCalledWith('txt', 'notes.txt', null)
  })

  it('creates working entries inside the current folder from the folder action button', async () => {
    const props = buildProps({
      tasks: [
        {
          id: 'workspace-agent',
          label: '工作目录',
          groups: [
            {
              id: 'upload',
              label: 'upload',
              entries: []
            },
            {
              id: 'project',
              label: 'project',
              entries: [
                {
                  nodeId: 'folder-1',
                  folderKey: 'folder-1',
                  path: 'project/plans',
                  relativePath: 'plans',
                  fileName: 'plans',
                  nodeType: 'folder',
                  source: 'project',
                  groupId: 'project',
                  writable: true,
                  addedAt: 1
                }
              ]
            }
          ]
        }
      ]
    })
    const wrapper = mount(WorkspaceSidebar, {
      attachTo: document.body,
      props
    })

    await wrapper.get('.workspace-sidebar__row-actions .workspace-sidebar__context-new-trigger').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.findAll('.workspace-sidebar__context-new-dropdown button')[2]!.trigger('click')
    await wrapper.vm.$nextTick()

    const input = wrapper.get('.workspace-sidebar__rename-input')
    await input.setValue('summary')
    await input.trigger('keydown.enter')
    await flushPromises()

    expect(props.createProjectEntry).toHaveBeenCalledWith('md', 'summary.md', 'plans')
  })

  it('emits folder deletion for tracked working folders', async () => {
    const props = buildProps({
      tasks: [
        {
          id: 'workspace-agent',
          label: '工作目录',
          groups: [
            {
              id: 'upload',
              label: 'upload',
              entries: []
            },
            {
              id: 'project',
              label: 'project',
              entries: [
                {
                  nodeId: 'folder-1',
                  folderKey: 'folder-1',
                  path: 'project/plans',
                  relativePath: 'plans',
                  fileName: 'plans',
                  nodeType: 'folder',
                  source: 'project',
                  groupId: 'project',
                  writable: true,
                  addedAt: 1
                }
              ]
            }
          ]
        }
      ]
    })
    const wrapper = mount(WorkspaceSidebar, {
      attachTo: document.body,
      props
    })

    await wrapper.get('.workspace-file-action-menu__trigger').trigger('click')
    const items = Array.from(document.body.querySelectorAll('.workspace-file-action-menu__item')).map(node => node.textContent?.trim())
    expect(items).toEqual(['重命名', '删除'])

    ;(document.body.querySelector('.workspace-file-action-menu__item--danger') as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('delete-file')).toEqual([['folder-1']])
  })

  it('uses governed title dense and meta typography roles in the sidebar tree', () => {
    expect(workspaceSidebarSource).toContain('font-size: var(--font-title);')
    expect(workspaceSidebarSource).toContain('font-size: var(--font-dense);')
    expect(workspaceSidebarSource).toContain('font-size: var(--font-meta);')
    expect(workspaceSidebarSource).not.toContain('font-size: 15px;')
    expect(workspaceSidebarSource).not.toContain('font-size: 10px;')
    expect(normalizedWorkspaceSidebarSource).toContain(`.workspace-sidebar__panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: var(--pane-block) var(--pane-inline) 18px;
}`)
    expect(normalizedWorkspaceSidebarSource).toContain(`.workspace-sidebar__group-tree {
  display: grid;
  gap: 4px;
  min-width: 0;
}`)
    expect(normalizedWorkspaceSidebarSource).not.toContain(`.workspace-sidebar__group-tree {
  display: grid;
  gap: 4px;
  min-width: 0;
  overflow-y: auto;
}`)
    expect(normalizedWorkspaceSidebarSource).toContain(`.workspace-sidebar__file-row {
  min-width: 0;
  padding-inline-start: calc(var(--workspace-node-depth, 0) * 14px);
}`)
    expect(normalizedWorkspaceSidebarSource).toContain(`.workspace-sidebar__file-name {
  min-width: 0;
  max-width: 100%;
  display: flex;
  align-items: baseline;
  gap: 0;
  overflow: hidden;
  white-space: nowrap;
}`)
    expect(workspaceSidebarSource).toContain('text-overflow: ellipsis;')
    expect(workspaceSidebarSource).toContain('white-space: nowrap;')
  })

  it('keeps long workspace file lists inside the sidebar panel scroll container', () => {
    const wrapper = mount(WorkspaceSidebar, {
      props: buildProps({
        tasks: [
          {
            id: 'workspace-agent',
            label: '工作目录',
            groups: [
              {
                id: 'upload',
                label: 'upload',
                entries: buildFileEntries({ groupId: 'upload', count: 24, prefix: 'upload-file' })
              },
              {
                id: 'project',
                label: 'project',
                entries: buildFileEntries({ groupId: 'project', count: 24, prefix: 'project-file', startAddedAt: 100 })
              }
            ]
          }
        ]
      })
    })

    const panel = wrapper.get('.workspace-sidebar__panel')
    expect(panel.find('[aria-label="upload-file-24.md"]').exists()).toBe(true)
    expect(panel.find('[aria-label="project-file-24.md"]').exists()).toBe(true)
    expect(wrapper.findAll('.workspace-sidebar__group-tree')).toHaveLength(2)
    expect(normalizedWorkspaceSidebarSource).toContain(`.workspace-sidebar__panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: var(--pane-block) var(--pane-inline) 18px;
}`)
  })

  it('adds compact header rules for constrained widths without relying on a collapsed css hook', () => {
    expect(workspaceSidebarSource).toContain('.workspace-sidebar__tab {')
    expect(workspaceSidebarSource).toContain('.workspace-sidebar__toggle {')
    expect(workspaceSidebarSource).toContain('@media (max-width: 1120px)')
    expect(workspaceSidebarSource).not.toContain('.workspace-sidebar--collapsed')
  })

  it('closes transient rename and creation menus when the sidebar becomes collapsed', async () => {
    const props = buildProps({
      tasks: [
        {
          id: 'workspace-agent',
          label: '工作目录',
          groups: [
            {
              id: 'upload',
              label: 'upload',
              entries: [
                {
                  nodeId: 'f-1',
                  fileId: 'f-1',
                  fileKey: 'f-1',
                  path: 'upload/README.md',
                  relativePath: 'README.md',
                  fileName: 'README.md',
                  nodeType: 'file',
                  source: 'upload',
                  groupId: 'upload',
                  writable: true,
                  addedAt: 1
                }
              ]
            },
            {
              id: 'project',
              label: 'project',
              entries: []
            }
          ]
        }
      ]
    })
    const wrapper = mount(WorkspaceSidebar, {
      attachTo: document.body,
      props
    })

    await wrapper.get('.workspace-file-action-menu__trigger').trigger('click')
    ;(document.body.querySelectorAll('.workspace-file-action-menu__item')[1] as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.workspace-sidebar__rename-input').exists()).toBe(true)

    await wrapper.get('.workspace-sidebar__new-trigger').trigger('click')
    expect(wrapper.find('.workspace-sidebar__new-dropdown').exists()).toBe(true)

    await wrapper.setProps({ collapsed: true })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.workspace-sidebar__rename-input').exists()).toBe(false)
    expect(wrapper.find('.workspace-sidebar__new-dropdown').exists()).toBe(false)
  })

  it('collapses and expands groups on group-row click', async () => {
    const wrapper = mount(WorkspaceSidebar, {
      props: buildProps({
        tasks: [
          {
            id: 'workspace-agent',
            label: '工作目录',
            groups: [
              {
                id: 'upload',
                label: 'upload',
                entries: [
                  {
                    nodeId: 'f-1',
                    fileId: 'f-1',
                    fileKey: 'f-1',
                    path: 'f-1',
                    fileName: 'test.txt',
                    relativePath: 'test.txt',
                    groupId: 'upload',
                    nodeType: 'file' as const,
                    source: 'upload' as const,
                    writable: false,
                    addedAt: 1
                  }
                ]
              },
              {
                id: 'project',
                label: 'project',
                entries: []
              }
            ]
          }
        ]
      })
    })

    // group-tree initially visible
    expect(wrapper.find('.workspace-sidebar__group-tree').exists()).toBe(true)

    // click first group-row (upload) to collapse
    await wrapper.findAll('.workspace-sidebar__group-row')[0].trigger('click')
    expect(wrapper.find('.workspace-sidebar__group-tree').exists()).toBe(false)

    // click again to expand
    await wrapper.findAll('.workspace-sidebar__group-row')[0].trigger('click')
    expect(wrapper.find('.workspace-sidebar__group-tree').exists()).toBe(true)
  })
})
