import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

export interface SkillFixtureEntry {
  id: string
  content: string
  enabled?: boolean
  files?: Record<string, string>
  scriptsYaml?: string
}

export async function createSkillFixtureSet(skills: SkillFixtureEntry[]): Promise<{
  assetsRoot: string
  cleanup: () => Promise<void>
}> {
  const tempRoot = await mkdtemp(join(tmpdir(), 'skill-fixture-'))
  const assetsRoot = join(tempRoot, 'assets')
  await writeAgentFiles(assetsRoot)
  await writeSkillFiles(assetsRoot, skills)
  return {
    assetsRoot,
    cleanup: async () => rm(tempRoot, { recursive: true, force: true })
  }
}

async function writeAgentFiles(assetsRoot: string): Promise<void> {
  const workspaceAgentDir = join(assetsRoot, 'agents', 'workspace-agent')
  await mkdir(workspaceAgentDir, { recursive: true })
  await writeFile(join(assetsRoot, 'agents', 'manifest.json'), JSON.stringify({
    version: '1.0.0',
    agents: [{
      id: 'workspace-agent',
      path: '/agents/workspace-agent',
      enabled: true
    }]
  }, null, 2))
  await writeFile(join(workspaceAgentDir, 'AGENT.md'), [
    '---',
    'id: workspace-agent',
    'name: Workspace Agent',
    'description: Test workspace agent',
    'version: 1.0.0',
    '---',
    '',
    'Use skills carefully.'
  ].join('\n'))
}

async function writeSkillFiles(assetsRoot: string, skills: SkillFixtureEntry[]): Promise<void> {
  const skillsDir = join(assetsRoot, 'skills')
  await mkdir(skillsDir, { recursive: true })
  await Promise.all(skills.map(skill => writeSkillFile(skillsDir, skill)))
}

async function writeSkillFile(
  skillsDir: string,
  skill: SkillFixtureEntry
): Promise<void> {
  const skillDir = join(skillsDir, skill.id)
  await mkdir(skillDir, { recursive: true })
  await writeFile(join(skillDir, 'SKILL.md'), skill.content)
  if (typeof skill.scriptsYaml === 'string') {
    await writeFile(join(skillDir, 'SCRIPTS.yaml'), skill.scriptsYaml)
  }
  if (!skill.files) {
    return
  }
  for (const [relativePath, content] of Object.entries(skill.files)) {
    const absolutePath = join(skillDir, relativePath)
    await mkdir(dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, content)
  }
}
