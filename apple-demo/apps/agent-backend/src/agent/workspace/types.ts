export type WorkspacePrimaryAgent = 'plan' | 'build'

export type WorkspacePlanStatus =
  | 'draft'
  | 'awaiting_approval'
  | 'approved'
  | 'superseded'

export type WorkspacePlanSubagent = 'explore' | 'general'

export interface WorkspacePlanSnapshot {
  planId: string
  version: number
  status: WorkspacePlanStatus
  title: string
  summary: string
  filePath: string
  approvedSkillIds: string[]
}

export type WorkspaceFileSource = 'upload' | 'project'

export type WorkspaceFileGroupId = 'upload' | 'project'

export type WorkspaceNodeType = 'file' | 'folder'

interface WorkspaceSessionEntryBase {
  nodeId: string
  path: string
  fileName: string
  relativePath: string
  groupId: WorkspaceFileGroupId
  nodeType: WorkspaceNodeType
  addedAt: number
}

export interface WorkspaceSessionFileEntry extends WorkspaceSessionEntryBase {
  nodeType: 'file'
  fileId: string
  fileKey: string
  source: WorkspaceFileSource
  writable: boolean
}

export interface WorkspaceSessionFolderEntry extends WorkspaceSessionEntryBase {
  nodeType: 'folder'
  folderKey: string
  source: 'project'
  writable: true
}

export type WorkspaceSessionEntry = WorkspaceSessionFileEntry | WorkspaceSessionFolderEntry

export interface WorkspaceSessionMeta {
  activePrimaryAgent: WorkspacePrimaryAgent
  planState: WorkspacePlanSnapshot | null
  workspaceFiles: WorkspaceSessionEntry[]
}

export interface WorkspaceSidebarGroup {
  id: WorkspaceFileGroupId
  label: string
  entries: WorkspaceSessionEntry[]
}

export interface WorkspaceSidebarTask {
  id: string
  label: string
  groups: WorkspaceSidebarGroup[]
}

export interface WorkspacePlanDraft {
  title: string
  summary: string
  goal: string
  steps: string[]
  approvedSkillIds: string[]
  skillsReasoning: string[]
  risks: string[]
  openQuestions: string[]
}

export interface WorkspacePlanRecord extends WorkspacePlanSnapshot {
  goal: string
  steps: string[]
  skillsReasoning: string[]
  risks: string[]
  openQuestions: string[]
  markdown: string
  createdAt: number
  updatedAt: number
}
