import DOMPurify from 'dompurify'
import { marked } from 'marked'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeUrl(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  if (/^(https?:|mailto:)/i.test(value)) return value
  if (value.startsWith('#') || value.startsWith('/')) return value
  return null
}

marked.use({
  renderer: {
    html({ text }: { text: string }): string {
      return escapeHtml(text)
    },
    link({ href, text }: { href: string; text: string }): string {
      const normalizedUrl = normalizeUrl(href)
      if (!normalizedUrl) return text
      return `<a href="${escapeHtml(normalizedUrl)}" target="_blank" rel="noreferrer">${text}</a>`
    }
  }
})

const ALLOWED_TAGS = [
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'pre', 'hr',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'br',
  'strong', 'em', 'a', 'code', 'del'
]

export function renderMarkdownToHtml(source: string): string {
  const raw = marked.parse(source, { gfm: true, breaks: true }) as string
  const clean = DOMPurify.sanitize(raw, { ALLOWED_TAGS, ADD_ATTR: ['target'] })
  const wrapped = clean.replace(/<table>/g, '<div class="markdown-table-scroll"><table>').replace(/<\/table>/g, '</table></div>')
  return wrapped || '<p></p>'
}
