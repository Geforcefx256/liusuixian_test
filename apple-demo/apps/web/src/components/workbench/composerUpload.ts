const ALLOWED_UPLOAD_EXTENSIONS = ['.txt', '.md', '.csv'] as const
const COMPOSER_UPLOAD_ERROR_PREFIX = '\u4ec5\u652f\u6301\u4e0a\u4f20 TXT / MD / CSV \u6587\u4ef6'

export const COMPOSER_UPLOAD_ACCEPT = ALLOWED_UPLOAD_EXTENSIONS.join(',')
export const COMPOSER_PLACEHOLDER = '\u8bf7\u8f93\u5165\u60a8\u7684\u95ee\u9898\uff0c\u6309shift+\u56de\u8f66\u53ef\u6362\u884c'
export const COMPOSER_UPLOAD_TIP = '\u70b9\u51fb\u6216\u62d6\u62fd\u53ef\u4e0a\u4f20\u6587\u4ef6\uff0c\u652f\u6301\u7684\u7c7b\u578b\uff1atxt\u3001md\u3001csv'
export const COMPOSER_SEND_LABEL = '\u53d1\u9001'

export function isSupportedComposerUploadFile(file: File): boolean {
  return ALLOWED_UPLOAD_EXTENSIONS.some(extension => file.name.toLowerCase().endsWith(extension))
}

export function splitComposerUploadFiles(files: readonly File[]): {
  acceptedFiles: File[]
  rejectedFiles: File[]
} {
  return files.reduce<{ acceptedFiles: File[]; rejectedFiles: File[] }>((result, file) => {
    if (isSupportedComposerUploadFile(file)) {
      result.acceptedFiles.push(file)
      return result
    }
    result.rejectedFiles.push(file)
    return result
  }, {
    acceptedFiles: [],
    rejectedFiles: []
  })
}

export function buildComposerUploadError(files: readonly File[]): string {
  const names = files
    .map(file => file.name.trim())
    .filter(Boolean)
  if (!names.length) {
    return COMPOSER_UPLOAD_ERROR_PREFIX
  }
  return `${COMPOSER_UPLOAD_ERROR_PREFIX}\uff1a${names.join('\u3001')}`
}
