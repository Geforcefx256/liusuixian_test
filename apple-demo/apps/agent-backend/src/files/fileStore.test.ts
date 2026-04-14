import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FileStore, type WorkspaceScope } from './fileStore.js'
import { openWorkspaceFile } from './workspaceFileEditor.js'

const scope: WorkspaceScope = {
  userId: 999001,
  agentId: 'workspace-agent-create-test'
}

describe('FileStore workspace entries', () => {
  let store: FileStore

  beforeEach(async () => {
    store = new FileStore()
    await store.initialize()
  })

  afterEach(async () => {
    await rm(store.getWorkspaceRoot(scope), { recursive: true, force: true })
  })

  it('normalizes uploaded file names to a safe basename', async () => {
    const result = await store.writeUpload({
      originalName: '../nested/demo.csv',
      content: Buffer.from('name\nalpha\n', 'utf8'),
      scope
    })

    expect(result.entry.originalName).toBe('demo.csv')
    expect(result.entry.relativePath).toBe('demo.csv')
  })

  it('renames uploads and path-addressed outputs without changing stable identity', async () => {
    const upload = await store.writeUpload({
      originalName: 'source.csv',
      content: Buffer.from('name\nalpha\n', 'utf8'),
      scope
    })
    const output = await store.registerProjectPath('reports/final/result.md', scope)
    const outputPath = store.getProjectEntryPath(output.entry)
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, '# Result\n', 'utf8')

    const renamedUpload = await store.renameWorkspaceEntry(upload.entry.fileKey, 'renamed.csv', scope)
    const renamedOutput = await store.renameWorkspaceEntry(output.entry.fileKey, 'summary.md', scope)

    expect(renamedUpload).toMatchObject({
      fileKey: upload.entry.fileKey,
      fileId: upload.entry.fileId,
      createdAt: upload.entry.createdAt,
      originalName: 'renamed.csv',
      relativePath: 'renamed.csv'
    })
    expect(await readFile(store.getUploadEntryPath(renamedUpload), 'utf8')).toBe('name\nalpha\n')
    expect(renamedOutput).toMatchObject({
      fileKey: output.entry.fileKey,
      fileId: output.entry.fileId,
      createdAt: output.entry.createdAt,
      originalName: 'reports/final/summary.md',
      relativePath: 'reports/final/summary.md'
    })
    expect(await openWorkspaceFile(renamedOutput)).toMatchObject({
      fileKey: output.entry.fileKey,
      fileName: 'reports/final/summary.md',
      path: 'project/reports/final/summary.md'
    })
  })

  it('rejects rename requests outside the v1 boundary', async () => {
    const upload = await store.writeUpload({
      originalName: 'source.csv',
      content: Buffer.from('name\nalpha\n', 'utf8'),
      scope
    })
    const output = await store.registerProjectPath('reports/final/result.md', scope)
    const legacyOutput = await store.registerProject('legacy-output', scope)
    ;(store as unknown as { setEntry: (entry: typeof legacyOutput) => void }).setEntry({
      ...legacyOutput,
      relativePath: undefined
    })

    await expect(store.renameWorkspaceEntry(upload.entry.fileKey, 'nested/renamed.csv', scope))
      .rejects.toThrow('Workspace file rename only supports basename changes')
    await expect(store.renameWorkspaceEntry(upload.entry.fileKey, 'source.txt', scope))
      .rejects.toThrow('Workspace rename must keep the existing extension')
    await expect(store.renameWorkspaceEntry(upload.entry.fileKey, 'SOURCE.csv', scope))
      .rejects.toThrow('Workspace file rename does not support case-only changes')
    await expect(store.renameWorkspaceEntry(output.entry.fileKey, 'result.md', scope))
      .rejects.toThrow('Workspace file name is unchanged')
    await expect(store.renameWorkspaceEntry(legacyOutput.fileKey, 'legacy.json', scope))
      .rejects.toThrow('Legacy project files do not support rename')
  })

  it('rolls rename back when metadata persistence fails', async () => {
    const output = await store.registerProjectPath('reports/final/result.csv', scope)
    const originalPath = store.getProjectEntryPath(output.entry)
    const originalEntry = store.resolveFileKey(output.entry.fileKey)
    await mkdir(dirname(originalPath), { recursive: true })
    await writeFile(originalPath, 'name,value\nalpha,1\n', 'utf8')
    vi.spyOn(
      store as unknown as { persistScope: (scope: WorkspaceScope) => Promise<void> },
      'persistScope'
    ).mockRejectedValueOnce(new Error('persist exploded'))

    await expect(store.renameWorkspaceEntry(output.entry.fileKey, 'summary.csv', scope))
      .rejects.toThrow('persist exploded')

    const resolvedEntry = store.resolveFileKey(output.entry.fileKey)
    expect(resolvedEntry).toEqual(originalEntry)
    expect(await readFile(originalPath, 'utf8')).toBe('name,value\nalpha,1\n')
    await expect(readFile(join(store.getProjectDir(scope), 'reports/final/summary.csv'), 'utf8')).rejects.toThrow()
  })
})
