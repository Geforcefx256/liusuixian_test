import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const LOG_ROOT = 'apps/agent-backend/data/logs'
const DEFAULT_LIMIT = 80
const DEFAULT_MESSAGES = new Set([
  'skill.retention.extracted',
  'skill.retention.injected',
  'skill.retention.skipped',
  'context.compaction',
  'post_context_manager'
])

main()

function main() {
  const options = parseArgs(process.argv.slice(2))
  const files = resolveRuntimeLogFiles(options.date)
  const entries = files.flatMap(readJsonLines).filter(entry => matchesFilters(entry, options))
  if (entries.length === 0) {
    console.log('No matching retention logs found.')
    return
  }

  if (!options.sessionId) {
    printSessionSummary(entries)
    return
  }

  printSessionEntries(entries, options)
}

function parseArgs(argv) {
  const options = {
    sessionId: '',
    agentId: '',
    skillName: '',
    date: '',
    limit: DEFAULT_LIMIT,
    json: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const nextValue = argv[index + 1]
    if (argument === '--') {
      continue
    }
    if (argument === '--session' && nextValue) {
      options.sessionId = nextValue
      index += 1
      continue
    }
    if (argument === '--agent' && nextValue) {
      options.agentId = nextValue
      index += 1
      continue
    }
    if (argument === '--skill' && nextValue) {
      options.skillName = nextValue
      index += 1
      continue
    }
    if (argument === '--date' && nextValue) {
      options.date = nextValue
      index += 1
      continue
    }
    if (argument === '--limit' && nextValue) {
      options.limit = parseLimit(nextValue)
      index += 1
      continue
    }
    if (argument === '--json') {
      options.json = true
      continue
    }
    if (argument === '--help') {
      printHelp()
      process.exit(0)
    }
    throw new Error(`Unknown argument: ${argument}`)
  }

  return options
}

function parseLimit(value) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid --limit value: ${value}`)
  }
  return parsed
}

function printHelp() {
  console.log([
    'Usage:',
    '  pnpm logs:skill-retention',
    '  pnpm logs:skill-retention -- --session <sessionId>',
    '  pnpm logs:skill-retention -- --session <sessionId> --skill <skillName>',
    '  pnpm logs:skill-retention -- --date <YYYY-MM-DD> --json',
    '',
    'Options:',
    '  --session <id>   Filter a single session and print detailed entries.',
    '  --agent <id>     Filter by agentId.',
    '  --skill <name>   Filter by retained skill name or preview text.',
    '  --date <date>    Scan one log date; defaults to the latest available date.',
    '  --limit <n>      Max detailed entries to print. Default: 80.',
    '  --json           Print raw JSON for matching entries.',
    '  --help           Show this help.'
  ].join('\n'))
}

function resolveRuntimeLogFiles(date) {
  if (!existsSync(LOG_ROOT)) {
    throw new Error(`Log directory not found: ${LOG_ROOT}`)
  }

  const dates = date ? [date] : resolveLatestDate()
  return dates
    .map(targetDate => join(LOG_ROOT, targetDate, 'runtime.jsonl'))
    .filter(existsSync)
}

function resolveLatestDate() {
  const entries = readdirSync(LOG_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()
  const latest = entries.at(-1)
  if (!latest) {
    throw new Error(`No dated log directories found under ${LOG_ROOT}`)
  }
  return [latest]
}

function readJsonLines(filePath) {
  const content = readFileSync(filePath, 'utf8')
  const lines = content.split('\n').filter(Boolean)
  return lines.map(parseLogLine).sort(compareByTimestamp)
}

function parseLogLine(line) {
  return JSON.parse(line)
}

function compareByTimestamp(left, right) {
  return String(left.timestamp).localeCompare(String(right.timestamp))
}

function matchesFilters(entry, options) {
  if (!DEFAULT_MESSAGES.has(entry.message)) {
    return false
  }
  if (options.sessionId && entry.sessionId !== options.sessionId) {
    return false
  }
  if (options.agentId && entry.agentId !== options.agentId) {
    return false
  }
  if (options.skillName && !entryMatchesSkill(entry, options.skillName)) {
    return false
  }
  return true
}

function entryMatchesSkill(entry, skillName) {
  const needle = skillName.toLowerCase()
  const haystacks = [
    extractSkillNames(entry).join(' '),
    JSON.stringify(entry.data ?? {})
  ]
  return haystacks.some(text => text.toLowerCase().includes(needle))
}

function extractSkillNames(entry) {
  const data = entry.data ?? {}
  const names = [
    ...(Array.isArray(data.skillNames) ? data.skillNames : []),
    ...(Array.isArray(data.selectedSkillNames) ? data.selectedSkillNames : []),
    ...(Array.isArray(data.skippedSkillNames) ? data.skippedSkillNames : [])
  ]
  return Array.from(new Set(names.filter(value => typeof value === 'string')))
}

function printSessionSummary(entries) {
  const sessions = summarizeSessions(entries)
  console.log('Sessions with retention-related events:')
  for (const session of sessions) {
    console.log([
      `- session=${session.sessionId}`,
      `agent=${session.agentId || '-'}`,
      `events=${session.count}`,
      `last=${session.lastTimestamp}`,
      `messages=${session.messages.join(', ')}`,
      session.skills.length > 0 ? `skills=${session.skills.join(', ')}` : 'skills=-'
    ].join(' | '))
  }
  console.log('\nUse --session <id> for detailed entries.')
}

function summarizeSessions(entries) {
  const summaryBySession = new Map()

  for (const entry of entries) {
    if (!entry.sessionId) {
      continue
    }
    const existing = summaryBySession.get(entry.sessionId) ?? createSessionSummary(entry)
    existing.count += 1
    existing.lastTimestamp = entry.timestamp
    existing.messages.add(entry.message)
    for (const skillName of extractSkillNames(entry)) {
      existing.skills.add(skillName)
    }
    summaryBySession.set(entry.sessionId, existing)
  }

  return Array.from(summaryBySession.values())
    .sort((left, right) => right.lastTimestamp.localeCompare(left.lastTimestamp))
    .map(finalizeSessionSummary)
}

function createSessionSummary(entry) {
  return {
    sessionId: entry.sessionId,
    agentId: entry.agentId ?? '',
    count: 0,
    lastTimestamp: entry.timestamp,
    messages: new Set(),
    skills: new Set()
  }
}

function finalizeSessionSummary(summary) {
  return {
    sessionId: summary.sessionId,
    agentId: summary.agentId,
    count: summary.count,
    lastTimestamp: summary.lastTimestamp,
    messages: Array.from(summary.messages).sort(),
    skills: Array.from(summary.skills).sort()
  }
}

function printSessionEntries(entries, options) {
  const limitedEntries = entries.slice(-options.limit)
  if (options.json) {
    for (const entry of limitedEntries) {
      console.log(JSON.stringify(entry))
    }
    return
  }

  console.log(`Retention entries for session ${options.sessionId}:`)
  for (const entry of limitedEntries) {
    console.log(formatEntry(entry))
  }
}

function formatEntry(entry) {
  const parts = [
    `[${entry.timestamp}]`,
    entry.message
  ]
  if (entry.runId) {
    parts.push(`run=${entry.runId}`)
  }
  if (entry.turnId) {
    parts.push(`turn=${entry.turnId}`)
  }

  const detail = describeEntry(entry)
  return detail ? `${parts.join(' ')}\n  ${detail}` : parts.join(' ')
}

function describeEntry(entry) {
  if (entry.message === 'post_context_manager') {
    return describePostContext(entry)
  }
  if (entry.message === 'context.compaction') {
    return describeData(entry.data, ['auto', 'prune', 'compactionNeeded', 'summaryUpdated'])
  }
  if (entry.message.startsWith('skill.retention.')) {
    return describeData(entry.data, [
      'reason',
      'skillCount',
      'skillNames',
      'selectedSkillNames',
      'skippedSkillNames',
      'scannedSkillCalls',
      'failedSkillCalls',
      'skippedNonCanonical',
      'reminderBudget',
      'reminderTokens',
      'reminderChars'
    ])
  }
  return describeData(entry.data, Object.keys(entry.data ?? {}))
}

function describePostContext(entry) {
  const messages = Array.isArray(entry.data?.messages) ? entry.data.messages : []
  const summaryInjected = containsPreview(messages, '【会话摘要】')
  const retentionInjected = containsPreview(messages, '【已调用技能保留】')
  const skillNames = collectSkillNamesFromPostContext(messages)
  return [
    `messageCount=${entry.data?.messageCount ?? messages.length}`,
    `summary=${summaryInjected}`,
    `retention=${retentionInjected}`,
    skillNames.length > 0 ? `skills=${skillNames.join(', ')}` : 'skills=-'
  ].join(' | ')
}

function containsPreview(messages, marker) {
  return messages.some(message => Array.isArray(message.parts) && message.parts.some(part => {
    const preview = typeof part.textPreview === 'string' ? part.textPreview : ''
    return preview.includes(marker)
  }))
}

function collectSkillNamesFromPostContext(messages) {
  const names = new Set()
  for (const message of messages) {
    if (!Array.isArray(message.parts)) {
      continue
    }
    for (const part of message.parts) {
      const preview = typeof part.textPreview === 'string' ? part.textPreview : ''
      const matches = preview.matchAll(/<skill name="([^"]+)">/g)
      for (const match of matches) {
        if (match[1]) {
          names.add(match[1])
        }
      }
    }
  }
  return Array.from(names).sort()
}

function describeData(data, keys) {
  if (!data || typeof data !== 'object') {
    return ''
  }
  const pairs = keys
    .filter(key => data[key] !== undefined)
    .map(key => `${key}=${formatValue(data[key])}`)
  return pairs.join(' | ')
}

function formatValue(value) {
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value)
  }
  return String(value)
}
