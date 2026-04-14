import type { AgentSessionMessage } from '../sessionStore.js'
import type { AgentModelConfig } from '../types.js'
import type { ProviderClient } from '../providerClient.js'
import type { SummaryRecord } from './types.js'
import { serializeSessionPart } from '../sessionParts.js'
import { isHiddenSessionMessage } from '../sessionMessages.js'

const SUMMARY_SYSTEM_PROMPT = '你是一名会话压缩助手。请输出供后续代理继续工作的中文结构化摘要。'
const SUMMARY_TEMPLATE = [
  '请基于下方已有摘要和新增会话内容，输出一个适合后续继续执行任务的中文摘要。',
  '只输出以下 Markdown 结构，不要添加额外说明：',
  '## Goal',
  '## Instructions',
  '## Discoveries',
  '## Accomplished',
  '## Relevant files / directories'
]
const SECTION_SEPARATOR = '\n\n'
const SUMMARY_SECTION_TITLE = '## Existing Summary'
const MESSAGES_SECTION_TITLE = '## New Messages'
const ROLE_PREFIX = '[role] '
const ZERO = 0

interface CompactionDetail {
  activeTailStartIndex: number
  summaryCandidateCount: number
  newMessagesCount: number
  existingSummaryChars: number
  summaryInputChars: number
  summaryOutputChars: number
  summaryMaxTokens: number
  coveredUntil: number | null
}

interface CompactionResult {
  summary: SummaryRecord | null
  updated: boolean
  detail: CompactionDetail
}

export class ConversationCompactor {
  constructor(private readonly providerClient: ProviderClient) {}

  async compact(params: {
    messages: AgentSessionMessage[]
    existingSummary: SummaryRecord | null
    model: AgentModelConfig
    summaryMaxTokens: number
  }): Promise<CompactionResult> {
    const boundary = resolveCompactionBoundary(params.messages)
    if (!boundary) {
      return {
        summary: params.existingSummary,
        updated: false,
        detail: buildNoopDetail(-1, params.existingSummary, params.summaryMaxTokens)
      }
    }

    const summaryCandidates = boundary.summaryCandidates
    const newMessages = filterNewMessages(summaryCandidates, params.existingSummary)
    const summarizableMessages = newMessages.filter(message => !isHiddenSessionMessage(message))
    const baseDetail = buildBaseDetail(
      boundary.activeTailStartIndex,
      summaryCandidates.length,
      summarizableMessages.length,
      params.existingSummary
    )

    if (newMessages.length === ZERO) {
      return {
        summary: params.existingSummary,
        updated: false,
        detail: finalizeDetail(baseDetail, params.existingSummary, '', params.summaryMaxTokens)
      }
    }

    if (summarizableMessages.length === ZERO) {
      const coveredUntil = newMessages[newMessages.length - 1]?.createdAt
      const summary = params.existingSummary && coveredUntil
        ? {
            summary: params.existingSummary.summary,
            coveredUntil
          }
        : params.existingSummary
      return {
        summary,
        updated: Boolean(summary && coveredUntil && summary.coveredUntil !== params.existingSummary?.coveredUntil),
        detail: finalizeDetail(baseDetail, summary, '', params.summaryMaxTokens)
      }
    }

    const summaryInput = buildSummaryInput(params.existingSummary?.summary || null, summarizableMessages)
    const summaryText = await this.generateSummary(summaryInput, params.model, params.summaryMaxTokens)
    const lastCoveredAt = newMessages[newMessages.length - 1]?.createdAt
    const summary = lastCoveredAt ? {
      summary: summaryText,
      coveredUntil: lastCoveredAt
    } : null
    const detail = finalizeDetail(baseDetail, summary, summaryInput, params.summaryMaxTokens, summaryText)
    return { summary, updated: Boolean(summary), detail }
  }

  private async generateSummary(
    input: string,
    model: AgentModelConfig,
    summaryMaxTokens: number
  ): Promise<string> {
    const response = await this.providerClient.complete({
      systemPrompt: SUMMARY_SYSTEM_PROMPT,
      input,
      model: {
        ...model,
        maxTokens: summaryMaxTokens
      },
      signal: new AbortController().signal,
      trace: {
        runId: 'summary',
        turnId: 'summary'
      }
    })
    const summary = response.text.trim()
    if (!summary) {
      throw new Error('Summary model returned empty response')
    }
    return summary
  }
}

function filterNewMessages(messages: AgentSessionMessage[], summary: SummaryRecord | null): AgentSessionMessage[] {
  if (!summary) return messages
  return messages.filter(message => message.createdAt > summary.coveredUntil)
}

function buildSummaryInput(existingSummary: string | null, messages: AgentSessionMessage[]): string {
  const sections: string[] = []

  sections.push(...SUMMARY_TEMPLATE)

  if (existingSummary) {
    sections.push(SUMMARY_SECTION_TITLE)
    sections.push(existingSummary)
  }

  sections.push(MESSAGES_SECTION_TITLE)
  sections.push(messages.map(formatMessage).join('\n'))

  return sections.join(SECTION_SEPARATOR)
}

function buildNoopDetail(
  activeTailStartIndex: number,
  existingSummary: SummaryRecord | null,
  summaryMaxTokens: number
): CompactionDetail {
  return finalizeDetail({
    activeTailStartIndex,
    summaryCandidateCount: ZERO,
    newMessagesCount: ZERO,
    existingSummaryChars: existingSummary?.summary.length ?? ZERO
  }, existingSummary, '', summaryMaxTokens)
}

function buildBaseDetail(
  activeTailStartIndex: number,
  summaryCandidateCount: number,
  newMessagesCount: number,
  existingSummary: SummaryRecord | null
): Pick<CompactionDetail, 'activeTailStartIndex' | 'summaryCandidateCount' | 'newMessagesCount' | 'existingSummaryChars'> {
  return {
    activeTailStartIndex,
    summaryCandidateCount,
    newMessagesCount,
    existingSummaryChars: existingSummary?.summary.length ?? ZERO
  }
}

function finalizeDetail(
  baseDetail: Pick<CompactionDetail, 'activeTailStartIndex' | 'summaryCandidateCount' | 'newMessagesCount' | 'existingSummaryChars'>,
  summary: SummaryRecord | null,
  summaryInput: string,
  summaryMaxTokens: number,
  summaryText = ''
): CompactionDetail {
  return {
    ...baseDetail,
    summaryInputChars: summaryInput.length,
    summaryOutputChars: summaryText.length,
    summaryMaxTokens,
    coveredUntil: summary?.coveredUntil ?? null
  }
}

function formatMessage(message: AgentSessionMessage): string {
  const prefix = `${ROLE_PREFIX}${message.role}`
  const text = message.parts.map(part => serializeSessionPart(part)).join('\n').trim()
  return `${prefix}\n${text}`
}

function findLastUserIndex(messages: AgentSessionMessage[]): number {
  for (let index = messages.length - 1; index >= ZERO; index -= 1) {
    if (messages[index]?.role === 'user') return index
  }
  return -1
}

function resolveCompactionBoundary(messages: AgentSessionMessage[]): {
  activeTailStartIndex: number
  summaryCandidates: AgentSessionMessage[]
} | null {
  const lastUserIndex = findLastUserIndex(messages)
  if (lastUserIndex === -1) return null
  if (lastUserIndex > ZERO) {
    return {
      activeTailStartIndex: lastUserIndex,
      summaryCandidates: messages.slice(0, lastUserIndex)
    }
  }
  if (messages.length <= 2) {
    return null
  }
  return {
    activeTailStartIndex: messages.length - 1,
    summaryCandidates: messages.slice(0, -1)
  }
}
