function escapeRegExp(char: string): string {
  return /[\\^$.*+?()[\]{}|/]/.test(char) ? `\\${char}` : char
}

function globToRegExp(pattern: string): RegExp {
  let output = '^'

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index]
    const next = pattern[index + 1]

    if (char === '*' && next === '*') {
      output += '.*'
      index += 1
      continue
    }
    if (char === '*') {
      output += '[^/]*'
      continue
    }
    if (char === '?') {
      output += '[^/]'
      continue
    }
    output += escapeRegExp(char)
  }

  return new RegExp(`${output}$`)
}

export function matchesGlobPattern(candidate: string, pattern: string): boolean {
  const variants = pattern.startsWith('**/') ? [pattern, pattern.slice(3)] : [pattern]
  return variants.some(item => globToRegExp(item).test(candidate))
}
