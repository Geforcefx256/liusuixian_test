const COMPOUND_SUFFIX_MAX_LENGTH = 8
const REVEAL_THRESHOLD = 20

export interface WorkspaceFileNamePresentation {
  fullName: string
  stem: string
  suffix: string
  hasSuffix: boolean
  needsReveal: boolean
}

export function buildWorkspaceFileNamePresentation(fileName: string): WorkspaceFileNamePresentation {
  const fullName = fileName.trim() || fileName
  const { stem, suffix } = splitWorkspaceFileName(fullName)

  return {
    fullName,
    stem: stem || fullName,
    suffix,
    hasSuffix: Boolean(suffix),
    needsReveal: fullName.length > REVEAL_THRESHOLD
  }
}

function splitWorkspaceFileName(fileName: string): { stem: string; suffix: string } {
  if (!fileName || fileName === '.' || fileName === '..') {
    return { stem: fileName, suffix: '' }
  }

  if (fileName.startsWith('.') && fileName.indexOf('.', 1) === -1) {
    return { stem: fileName, suffix: '' }
  }

  const segments = fileName.split('.')
  if (segments.length < 2) {
    return { stem: fileName, suffix: '' }
  }

  const compoundSuffix = `.${segments.slice(-2).join('.')}`
  if (segments.length > 2 && compoundSuffix.length <= COMPOUND_SUFFIX_MAX_LENGTH) {
    return {
      stem: fileName.slice(0, -compoundSuffix.length),
      suffix: compoundSuffix
    }
  }

  const lastDotIndex = fileName.lastIndexOf('.')
  if (lastDotIndex <= 0) {
    return { stem: fileName, suffix: '' }
  }

  return {
    stem: fileName.slice(0, lastDotIndex),
    suffix: fileName.slice(lastDotIndex)
  }
}
