export type AssistantTextDisplayMode = 'reading' | 'raw'

export interface AssistantTextPresentationInput {
  role: 'user' | 'assistant'
  kind: 'text' | 'protocol' | 'result' | 'error'
  status: 'done' | 'streaming' | 'error'
  text: string
}

export interface AssistantTextPresentation {
  readingModeEligible: boolean
  displayMode: AssistantTextDisplayMode
}

const MIN_LIST_ITEMS = 2
const MIN_PARAGRAPHS = 2
const MIN_MULTI_PARAGRAPH_CHARS = 140
const HEADING_PATTERN = /^#{1,6}\s+\S/m
const CODE_FENCE_PATTERN = /```/
const TABLE_SEPARATOR_PATTERN = /^\|?[\s]*:?-+:?[\s]*(?:\|[\s]*:?-+:?[\s]*)+\|?$/m
const LIST_ITEM_PATTERN = /^\s*(?:[-*]\s+|\d+\.\s+)/gm
const PARAGRAPH_SEPARATOR_PATTERN = /\n\s*\n/g

function countListItems(text: string): number {
  return text.match(LIST_ITEM_PATTERN)?.length || 0
}

function hasLongParagraphStructure(text: string): boolean {
  const paragraphs = text
    .split(PARAGRAPH_SEPARATOR_PATTERN)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
  if (paragraphs.length < MIN_PARAGRAPHS) return false
  const totalChars = paragraphs.reduce((sum, paragraph) => sum + paragraph.length, 0)
  return totalChars >= MIN_MULTI_PARAGRAPH_CHARS
}

export function isAssistantTextReadingModeEligible(
  message: AssistantTextPresentationInput
): boolean {
  if (message.role !== 'assistant') return false
  if (message.kind !== 'text') return false
  if (message.status !== 'done') return false

  const text = message.text.trim()
  if (!text) return false
  if (HEADING_PATTERN.test(text)) return true
  if (CODE_FENCE_PATTERN.test(text)) return true
  if (TABLE_SEPARATOR_PATTERN.test(text)) return true
  if (countListItems(text) >= MIN_LIST_ITEMS) return true
  return hasLongParagraphStructure(text)
}

export function resolveAssistantTextPresentation(
  message: AssistantTextPresentationInput,
  override: AssistantTextDisplayMode | null = null
): AssistantTextPresentation {
  const readingModeEligible = isAssistantTextReadingModeEligible(message)
  const displayMode = readingModeEligible ? (override || 'reading') : 'raw'
  return {
    readingModeEligible,
    displayMode
  }
}
