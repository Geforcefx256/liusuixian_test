const WORKBOOK_NAME_PATTERN = /^CHECK_RULE_([^_]+?)_([^_]+?)\.(xlsx|xlsm|xls|elsx)$/i

export interface ParsedWorkbookFileName {
  networkType: string
  networkVersion: string
}

export function parseWorkbookFileName(fileName: string): ParsedWorkbookFileName | null {
  const trimmed = fileName.trim()
  const match = trimmed.match(WORKBOOK_NAME_PATTERN)
  if (!match) {
    return null
  }

  const [, rawNetworkType, rawNetworkVersion] = match
  const networkType = rawNetworkType.trim().toUpperCase()
  const networkVersion = rawNetworkVersion.trim()
  if (!networkType || !networkVersion) {
    return null
  }

  return {
    networkType,
    networkVersion
  }
}
