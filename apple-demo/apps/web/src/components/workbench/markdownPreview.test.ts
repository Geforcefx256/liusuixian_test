import { describe, expect, it } from 'vitest'

import { renderMarkdownToHtml } from './markdownPreview'

describe('renderMarkdownToHtml', () => {
  it('renders common markdown structures into controlled html', () => {
    const html = renderMarkdownToHtml('# Title\n\n- Alpha\n- Beta\n\n`code`\n')

    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<li>Alpha</li>')
    expect(html).toContain('<li>Beta</li>')
    expect(html).toContain('<code>code</code>')
  })

  it('preserves paragraph line breaks while keeping inline formatting', () => {
    const html = renderMarkdownToHtml('第一行\n第二行含 **强调** 与 `代码`')

    expect(html).toContain('<strong>强调</strong>')
    expect(html).toContain('<code>代码</code>')
    expect(html).toContain('<br>')
  })

  it('keeps blockquote and code-fence rendering on their existing paths', () => {
    const html = renderMarkdownToHtml('> 引用内容\n\n```ts\nconst answer = 42\n```')

    expect(html).toContain('<blockquote>')
    expect(html).toContain('引用内容')
    expect(html).toContain('<pre><code')
    expect(html).toContain('const answer = 42')
  })

  it('escapes raw html instead of trusting source markup', () => {
    const html = renderMarkdownToHtml('<script>alert(1)</script>\n')

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>')
  })

  it('renders GFM tables with header and body rows', () => {
    const html = renderMarkdownToHtml('| Name | Type |\n|------|------|\n| id | int |\n| name | string |')

    expect(html).toContain('<table>')
    expect(html).toContain('<thead>')
    expect(html).toContain('<th>Name</th>')
    expect(html).toContain('<tbody>')
    expect(html).toContain('<td>id</td>')
    expect(html).toContain('<td>name</td>')
    expect(html).not.toContain('|------|')
  })

  it('wraps tables in scrollable container', () => {
    const html = renderMarkdownToHtml('| H1 | H2 |\n|----|----|\n| A | B |')

    expect(html).toContain('<div class="markdown-table-scroll"><table>')
    expect(html).toContain('</table></div>')
  })

  it('renders GFM strikethrough', () => {
    const html = renderMarkdownToHtml('~~deleted text~~')

    expect(html).toContain('<del>deleted text</del>')
  })

  it('shows raw html as literal text without rendering as elements', () => {
    const html = renderMarkdownToHtml('<div class="test">hello</div>\n<img src=x onerror=alert(1)>')

    expect(html).toContain('&lt;div')
    expect(html).toContain('&lt;img')
    expect(html).not.toContain('<div')
    expect(html).not.toContain('<img')
  })

  it('downgrades non-whitelisted link protocols to plain text', () => {
    const html = renderMarkdownToHtml('[click](javascript:alert(1))')

    expect(html).not.toContain('<a')
    expect(html).toContain('click')
    expect(html).not.toContain('javascript:')
  })

  it('allows whitelisted link protocols', () => {
    const html1 = renderMarkdownToHtml('[site](https://example.com)')
    expect(html1).toContain('<a href="https://example.com"')
    expect(html1).toContain('target="_blank"')
    expect(html1).toContain('rel="noreferrer"')

    const html2 = renderMarkdownToHtml('[mail](mailto:test@example.com)')
    expect(html2).toContain('<a href="mailto:test@example.com"')

    const html3 = renderMarkdownToHtml('[section](#intro)')
    expect(html3).toContain('<a href="#intro"')
  })

  it('renders bare URLs as clickable links', () => {
    const html = renderMarkdownToHtml('visit https://example.com for details')

    expect(html).toContain('<a href="https://example.com"')
    expect(html).toContain('example.com')
  })
})
