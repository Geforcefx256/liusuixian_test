import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp } from 'node:fs/promises'
import { afterEach, describe, expect, it } from 'vitest'
import {
  assertNoLegacyWorkspaceNaming,
  cleanupLegacyWorkspaceNaming,
  detectLegacyWorkspaceNaming
} from './legacyWorkspaceNaming.js'
import { ensureDbDirectory, ensureSchema, loadDatabaseSync } from '../agent/sessionStoreUtils.js'

describe('legacyWorkspaceNaming', () => {
  let tempRoot = ''

  afterEach(async () => {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true })
    }
  })

  it('detects legacy workspace roots, file maps, and session metadata', async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'legacy-workspace-'))
    const paths = await setupLegacyFixture(tempRoot)

    const state = await detectLegacyWorkspaceNaming(paths)

    expect(state.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'workspace-root' }),
      expect.objectContaining({ type: 'file-map' }),
      expect.objectContaining({ type: 'session-meta' })
    ]))
    await expect(assertNoLegacyWorkspaceNaming(paths)).rejects.toThrow(
      'Run pnpm --filter @apple-demo/agent-backend run cleanup:legacy-workspace-naming'
    )
  })

  it('cleans legacy workspace state and preserves canonical session entries', async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'legacy-workspace-'))
    const paths = await setupLegacyFixture(tempRoot)

    const summary = await cleanupLegacyWorkspaceNaming(paths)

    expect(summary).toMatchObject({
      removedScopeCount: 1,
      removedLegacyDirCount: 2,
      removedFileMapCount: 1,
      cleanedSessionCount: 1
    })
    await expect(readFile(join(paths.workspaceDir, 'users/42/agents/workspace-agent/uploads/legacy.txt'), 'utf8'))
      .rejects.toThrow()
    await expect(readFile(join(paths.workspaceDir, 'users/42/agents/workspace-agent/file-map.json'), 'utf8'))
      .rejects.toThrow()

    const state = await detectLegacyWorkspaceNaming(paths)
    expect(state.issues).toEqual([])

    const DatabaseSync = loadDatabaseSync()
    const db = new DatabaseSync(paths.sessionDbPath)
    const rows = db.prepare('SELECT meta_json FROM agent_sessions').all() as Array<{ meta_json: string | null }>
    db.close()
    expect(rows[0]?.meta_json).toContain('"groupId":"upload"')
    expect(rows[0]?.meta_json).not.toContain('"groupId":"working"')
  })
})

async function setupLegacyFixture(tempDir: string): Promise<{ workspaceDir: string; sessionDbPath: string }> {
  const workspaceDir = join(tempDir, 'workspace')
  const sessionDbPath = join(tempDir, 'data', 'memory.db')
  const scopeDir = join(workspaceDir, 'users', '42', 'agents', 'workspace-agent')
  await mkdir(join(scopeDir, 'uploads'), { recursive: true })
  await mkdir(join(scopeDir, 'outputs'), { recursive: true })
  await writeFile(join(scopeDir, 'uploads', 'legacy.txt'), 'legacy', 'utf8')
  await writeFile(join(scopeDir, 'outputs', 'legacy.mml'), 'legacy', 'utf8')
  await writeFile(join(scopeDir, 'file-map.json'), JSON.stringify({
    version: 4,
    scope: { userId: 42, agentId: 'workspace-agent' },
    entries: [{
      fileKey: 'f_demo',
      fileId: 'file-1',
      createdAt: 1,
      originalName: 'legacy.mml',
      storageExtension: '.mml',
      kind: 'output'
    }]
  }, null, 2), 'utf8')
  seedLegacySessionDb(sessionDbPath)
  return { workspaceDir, sessionDbPath }
}

function seedLegacySessionDb(sessionDbPath: string): void {
  ensureDbDirectory(sessionDbPath)
  const DatabaseSync = loadDatabaseSync()
  const db = new DatabaseSync(sessionDbPath)
  ensureSchema(db)
  db.prepare(`
    INSERT INTO agent_sessions (
      user_id, agent_id, session_id, title, created_at, updated_at, message_count, meta_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    42,
    'workspace-agent',
    'session-1',
    'Legacy Session',
    1,
    1,
    0,
    JSON.stringify({
      activePrimaryAgent: 'build',
      planState: null,
      workspaceFiles: [
        {
          nodeId: 'file-1',
          fileId: 'file-1',
          fileKey: 'file-1',
          path: 'working/output.mml',
          fileName: 'output.mml',
          relativePath: 'output.mml',
          nodeType: 'file',
          source: 'output',
          groupId: 'working',
          writable: true,
          addedAt: 1
        },
        {
          nodeId: 'file-2',
          fileId: 'file-2',
          fileKey: 'file-2',
          path: 'upload/input.csv',
          fileName: 'input.csv',
          relativePath: 'input.csv',
          nodeType: 'file',
          source: 'upload',
          groupId: 'upload',
          writable: true,
          addedAt: 2
        }
      ]
    })
  )
  db.close()
}
