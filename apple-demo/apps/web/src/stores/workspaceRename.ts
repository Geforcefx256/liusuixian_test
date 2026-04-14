import type { WorkspaceSidebarFileItem } from '@/api/types'

function resolveWorkspaceLeafName(fileName: string): string {
  const normalized = fileName.replace(/\\/g, '/')
  return normalized.split('/').at(-1) || fileName
}

export function resolveWorkspaceRenameParts(fileName: string): {
  editableStem: string
  extension: string
} {
  const leafName = resolveWorkspaceLeafName(fileName)
  const lastDotIndex = leafName.lastIndexOf('.')
  if (lastDotIndex <= 0) {
    return {
      editableStem: leafName,
      extension: ''
    }
  }
  return {
    editableStem: leafName.slice(0, lastDotIndex),
    extension: leafName.slice(lastDotIndex)
  }
}

export function buildWorkspaceRenameTarget(
  editableStem: string,
  extension: string
): string {
  const normalizedStem = editableStem.trim()
  if (!normalizedStem) {
    throw new Error('文件名不能为空')
  }
  return extension ? `${normalizedStem}${extension}` : normalizedStem
}

export function resolveWorkspaceRenameTarget(
  file: Pick<WorkspaceSidebarFileItem, 'fileName'>,
  editableStem: string
): string {
  const { extension } = resolveWorkspaceRenameParts(file.fileName)
  return buildWorkspaceRenameTarget(editableStem, extension)
}
