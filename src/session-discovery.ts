import fs from 'fs'
import path from 'path'
import os from 'os'

export interface SessionInfo {
  pid: number
  port: number // We'll derive this from the filename
  workspaceFolders: string[]
  ideName: string
  transport: string
  runningInWindows: boolean
  authToken: string
}

function isValidLockFileData(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    'pid' in data &&
    'workspaceFolders' in data &&
    'ideName' in data &&
    'transport' in data &&
    'runningInWindows' in data &&
    'authToken' in data &&
    typeof (data as Record<string, unknown>).pid === 'number' &&
    Array.isArray((data as Record<string, unknown>).workspaceFolders) &&
    typeof (data as Record<string, unknown>).ideName === 'string' &&
    typeof (data as Record<string, unknown>).transport === 'string' &&
    typeof (data as Record<string, unknown>).runningInWindows === 'boolean' &&
    typeof (data as Record<string, unknown>).authToken === 'string'
  )
}

export function parseLockFile(lockPath: string): SessionInfo | null {
  try {
    if (!fs.existsSync(lockPath)) {
      return null
    }

    const content = fs.readFileSync(lockPath, 'utf8')
    const data: unknown = JSON.parse(content)

    if (!isValidLockFileData(data)) {
      return null
    }

    const typedData = data as {
      pid: number
      workspaceFolders: string[]
      ideName: string
      transport: string
      runningInWindows: boolean
      authToken: string
    }

    // Extract port from filename (e.g., "16599.lock" -> 16599)
    const filename = path.basename(lockPath)
    const port = parseInt(filename.replace('.lock', ''), 10)

    if (isNaN(port)) {
      return null
    }

    return {
      pid: typedData.pid,
      port: port,
      workspaceFolders: typedData.workspaceFolders,
      ideName: typedData.ideName,
      transport: typedData.transport,
      runningInWindows: typedData.runningInWindows,
      authToken: typedData.authToken,
    }
  } catch (error) {
    return null
  }
}

// Removed unused defaultLockDir - now using auto-detection

// Get all potential Claude lock directories
function getClaudeLockDirectories(): string[] {
  const claudeDir = path.join(os.homedir(), '.claude')
  const potentialDirs = [
    path.join(claudeDir, 'ide'),    // IDE connections
    path.join(claudeDir, 'cli'),    // CLI direct connections  
    claudeDir,                      // Root claude directory
  ]
  
  return potentialDirs.filter(dir => {
    try {
      return fs.existsSync(dir) && fs.statSync(dir).isDirectory()
    } catch {
      return false
    }
  })
}

export function listSessions(lockDir?: string): SessionInfo[] {
  try {
    // If specific directory provided, use only that
    const dirsToSearch = lockDir ? [lockDir] : getClaudeLockDirectories()
    
    const sessions: SessionInfo[] = []
    
    for (const dir of dirsToSearch) {
      if (!fs.existsSync(dir)) {
        continue
      }

      const files = fs.readdirSync(dir)
      // Accept both claude-*.lock and *.lock files
      const lockFiles = files.filter((file) => file.endsWith('.lock'))

      for (const lockFile of lockFiles) {
        const lockPath = path.join(dir, lockFile)
        const sessionInfo = parseLockFile(lockPath)
        if (sessionInfo) {
          sessions.push(sessionInfo)
        }
      }
    }

    return sessions
  } catch (error) {
    return []
  }
}
