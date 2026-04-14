const FALLBACK_OWNER_LABEL = '另一会话'

function resolveWorkspaceOwnerLabel(ownerTitle?: string | null): string {
  const normalizedTitle = ownerTitle?.trim()
  if (!normalizedTitle) {
    return FALLBACK_OWNER_LABEL
  }
  return `会话“${normalizedTitle}”`
}

export function buildComposerLockReason(ownerTitle?: string | null): string {
  const ownerLabel = resolveWorkspaceOwnerLabel(ownerTitle)
  return `${ownerLabel}还在处理中。你可以继续编辑草稿，等它结束后再发送。`
}

export function buildHistoryLockReason(ownerTitle?: string | null): string {
  const ownerLabel = resolveWorkspaceOwnerLabel(ownerTitle)
  return `${ownerLabel}还在处理中，暂时不能删除会话或清空历史。`
}

export function buildWorkspaceOccupiedErrorMessage(ownerTitle?: string | null): string {
  const ownerLabel = resolveWorkspaceOwnerLabel(ownerTitle)
  return `${ownerLabel}还在处理中，请等它结束后再发送。`
}
