import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import WorkspaceMarkdownPreview from './WorkspaceMarkdownPreview.vue'
import workspaceMarkdownPreviewSource from './WorkspaceMarkdownPreview.vue?raw'

describe('WorkspaceMarkdownPreview', () => {
  it('renders document content while keeping preview typography scoped to the preview surface', () => {
    const wrapper = mount(WorkspaceMarkdownPreview, {
      props: {
        source: '# 标题\n\n## 小节\n\n正文 `code`'
      }
    })

    expect(wrapper.html()).toContain('<h1>标题</h1>')
    expect(wrapper.html()).toContain('<h2>小节</h2>')
    expect(wrapper.html()).toContain('<code>code</code>')
    expect(workspaceMarkdownPreviewSource).toContain('font-size: var(--font-doc-h1);')
    expect(workspaceMarkdownPreviewSource).toContain('font-size: var(--font-doc-h2);')
    expect(workspaceMarkdownPreviewSource).toContain('font-size: var(--font-doc-h3);')
    expect(workspaceMarkdownPreviewSource).toContain('font-family: var(--font-family-mono);')
    expect(workspaceMarkdownPreviewSource).toContain('font-size: var(--font-code-inline);')
  })
})
