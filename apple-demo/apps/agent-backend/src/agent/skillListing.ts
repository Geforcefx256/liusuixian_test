import type { AgentSkill } from './types.js'

const LISTING_DISCOVERY_MODE = 'disabled' as const
const DEFAULT_TOTAL_BUDGET_CHARS = 1600
const DEFAULT_ENTRY_BUDGET_CHARS = 320
const REMINDER_HEADER_LINES = [
  '## Skills',
  'The following skills are available for use with the `skill` tool.',
  'Load a skill with the `skill` tool when you need its full SKILL.md content.',
  'Available skills for this run:'
] as const
const TRIMMED_MARKER = ' [trimmed]'

type TrimMode = 'none' | 'description' | 'whenToUse' | 'description+whenToUse'

interface EntryBudgetState {
  description: number
  whenToUse: number
}

export interface SkillListingEntryDiagnostic {
  skillId: string
  skillName: string
  status: 'included' | 'skipped'
  trimMode: TrimMode
  beforeChars: number
  afterChars: number
  skippedReason?: 'total_budget'
}

export interface SkillListingBuildResult {
  reminder: string
  discoveryMode: typeof LISTING_DISCOVERY_MODE
  budgetChars: number
  entryBudgetChars: number
  sourceSkillCount: number
  includedSkillCount: number
  trimmedSkillCount: number
  skippedSkillCount: number
  totalCharsBeforeBudget: number
  totalCharsAfterBudget: number
  entries: SkillListingEntryDiagnostic[]
}

export interface SkillListingBuildOptions {
  skills: AgentSkill[]
  totalBudgetChars?: number
  entryBudgetChars?: number
}

export function buildSkillListingReminder(options: SkillListingBuildOptions): SkillListingBuildResult {
  const header = REMINDER_HEADER_LINES.join('\n')
  const budgetChars = options.totalBudgetChars ?? DEFAULT_TOTAL_BUDGET_CHARS
  const entryBudgetChars = options.entryBudgetChars ?? DEFAULT_ENTRY_BUDGET_CHARS
  const prepared = options.skills.map(skill => prepareEntry(skill, entryBudgetChars))
  const entries = fitEntriesWithinBudget(prepared, budgetChars, header)
  const reminder = renderReminder(header, entries.includedEntries)
  return {
    reminder,
    discoveryMode: LISTING_DISCOVERY_MODE,
    budgetChars,
    entryBudgetChars,
    sourceSkillCount: options.skills.length,
    includedSkillCount: entries.diagnostics.filter(entry => entry.status === 'included').length,
    trimmedSkillCount: entries.diagnostics.filter(entry => entry.trimMode !== 'none').length,
    skippedSkillCount: entries.diagnostics.filter(entry => entry.status === 'skipped').length,
    totalCharsBeforeBudget: renderReminder(
      header,
      prepared.map(entry => entry.fullText)
    ).length,
    totalCharsAfterBudget: reminder.length,
    entries: entries.diagnostics
  }
}

function fitEntriesWithinBudget(
  entries: PreparedEntry[],
  totalBudgetChars: number,
  header: string
): { includedEntries: string[]; diagnostics: SkillListingEntryDiagnostic[] } {
  const includedEntries: string[] = []
  const diagnostics: SkillListingEntryDiagnostic[] = []
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    const projectedChars = renderReminder(header, [...includedEntries, entry.finalText]).length
    if (projectedChars > totalBudgetChars) {
      diagnostics.push(toSkippedDiagnostic(entry))
      for (let tail = index + 1; tail < entries.length; tail += 1) {
        diagnostics.push(toSkippedDiagnostic(entries[tail]))
      }
      return { includedEntries, diagnostics }
    }
    includedEntries.push(entry.finalText)
    diagnostics.push({
      skillId: entry.skillId,
      skillName: entry.skillName,
      status: 'included',
      trimMode: entry.trimMode,
      beforeChars: entry.beforeChars,
      afterChars: entry.afterChars
    })
  }
  return { includedEntries, diagnostics }
}

interface PreparedEntry {
  skillId: string
  skillName: string
  fullText: string
  finalText: string
  trimMode: TrimMode
  beforeChars: number
  afterChars: number
}

function prepareEntry(skill: AgentSkill, entryBudgetChars: number): PreparedEntry {
  const fullEntry = renderEntry(
    skill.name,
    normalizeSummaryText(skill.description),
    normalizeSummaryText(skill.whenToUse)
  )
  const budgetState = fitEntryBudgets(skill, entryBudgetChars)
  const finalEntry = renderEntry(
    skill.name,
    trimText(normalizeSummaryText(skill.description), budgetState.description),
    trimText(normalizeSummaryText(skill.whenToUse), budgetState.whenToUse)
  )
  return {
    skillId: skill.id,
    skillName: skill.name,
    fullText: fullEntry,
    finalText: finalEntry,
    trimMode: resolveTrimMode(skill, budgetState),
    beforeChars: fullEntry.length,
    afterChars: finalEntry.length
  }
}

function fitEntryBudgets(skill: AgentSkill, entryBudgetChars: number): EntryBudgetState {
  const state: EntryBudgetState = {
    description: normalizeSummaryText(skill.description).length,
    whenToUse: normalizeSummaryText(skill.whenToUse).length
  }
  let currentLength = renderEntry(
    skill.name,
    trimText(normalizeSummaryText(skill.description), state.description),
    trimText(normalizeSummaryText(skill.whenToUse), state.whenToUse)
  ).length
  while (currentLength > entryBudgetChars) {
    const field = pickLongestField(state)
    if (!field) {
      return state
    }
    state[field] = Math.max(0, state[field] - (currentLength - entryBudgetChars))
    currentLength = renderEntry(
      skill.name,
      trimText(normalizeSummaryText(skill.description), state.description),
      trimText(normalizeSummaryText(skill.whenToUse), state.whenToUse)
    ).length
  }
  return state
}

function pickLongestField(state: EntryBudgetState): keyof EntryBudgetState | null {
  if (state.description <= 0 && state.whenToUse <= 0) {
    return null
  }
  if (state.whenToUse > state.description) {
    return 'whenToUse'
  }
  return state.description > 0 ? 'description' : 'whenToUse'
}

function renderReminder(header: string, entries: string[]): string {
  const lines = [header]
  if (entries.length === 0) {
    lines.push('- (none)')
  } else {
    lines.push(...entries)
  }
  return lines.join('\n')
}

function renderEntry(name: string, description: string, whenToUse?: string): string {
  const lines = [`- name: ${name}`, `  description: ${description}`]
  if (whenToUse) {
    lines.push(`  whenToUse: ${whenToUse}`)
  }
  return lines.join('\n')
}

function normalizeSummaryText(value: string | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function trimText(value: string, limit: number): string {
  if (!value) {
    return ''
  }
  if (limit <= 0) {
    return ''
  }
  if (value.length <= limit) {
    return value
  }
  if (limit <= TRIMMED_MARKER.length) {
    return TRIMMED_MARKER.trimStart().slice(0, limit)
  }
  return `${value.slice(0, limit - TRIMMED_MARKER.length).trimEnd()}${TRIMMED_MARKER}`
}

function resolveTrimMode(skill: AgentSkill, state: EntryBudgetState): TrimMode {
  const description = normalizeSummaryText(skill.description)
  const whenToUse = normalizeSummaryText(skill.whenToUse)
  const descriptionTrimmed = description.length > state.description
  const whenToUseTrimmed = whenToUse.length > state.whenToUse
  if (descriptionTrimmed && whenToUseTrimmed) {
    return 'description+whenToUse'
  }
  if (descriptionTrimmed) {
    return 'description'
  }
  if (whenToUseTrimmed) {
    return 'whenToUse'
  }
  return 'none'
}

function toSkippedDiagnostic(entry: PreparedEntry): SkillListingEntryDiagnostic {
  return {
    skillId: entry.skillId,
    skillName: entry.skillName,
    status: 'skipped',
    trimMode: entry.trimMode,
    beforeChars: entry.beforeChars,
    afterChars: 0,
    skippedReason: 'total_budget'
  }
}

export const skillListingDefaults = Object.freeze({
  discoveryMode: LISTING_DISCOVERY_MODE,
  totalBudgetChars: DEFAULT_TOTAL_BUDGET_CHARS,
  entryBudgetChars: DEFAULT_ENTRY_BUDGET_CHARS
})
