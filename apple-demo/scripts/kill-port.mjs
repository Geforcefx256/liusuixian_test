import { execSync } from 'node:child_process'

const PORTS = [3100, 3200, 5173, 5174, 5175, 5176]

function run(command) {
  return execSync(command, { stdio: 'pipe' }).toString('utf8')
}

function tryRun(command) {
  try {
    return run(command)
  } catch (error) {
    const err = error
    if (err && typeof err === 'object' && 'status' in err && err.status === 1) {
      return ''
    }
    throw error
  }
}

function killPids(port, pids) {
  if (pids.length === 0) return
  console.log(`killing port ${port} pid(s): ${pids.join(' ')}`)
  if (process.platform === 'win32') {
    for (const pid of pids) {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'inherit' })
    }
    return
  }
  execSync(`kill -9 ${pids.join(' ')}`, { stdio: 'inherit' })
}

function findPidsDarwinLinux(port) {
  const output = tryRun(`lsof -tiTCP:${port} -sTCP:LISTEN`)
  return output
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}

function findPidsWindows(port) {
  const output = tryRun(`netstat -ano | findstr :${port}`)
  const pids = new Set()
  for (const line of output.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parts = trimmed.split(/\s+/)
    const pid = parts[parts.length - 1]
    if (pid && /^\d+$/.test(pid)) {
      pids.add(pid)
    }
  }
  return Array.from(pids)
}

for (const port of PORTS) {
  const pids = process.platform === 'win32'
    ? findPidsWindows(port)
    : findPidsDarwinLinux(port)
  if (pids.length > 0) {
    killPids(port, pids)
  }
}
