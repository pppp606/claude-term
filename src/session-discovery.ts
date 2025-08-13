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

// Decode project path from Claude's encoding format
function decodeProjectPath(encodedPath: string): string {
  // Claude encodes paths like: -Users-yuki-t-Dev-claude-term
  // Convert back to: /Users/yuki.t/Dev/claude-term
  return encodedPath.replace(/^-/, '/').replace(/-/g, '/')
}

// Get current working directory project sessions
function getCurrentProjectSessions(): SessionInfo[] {
  const currentDir = process.cwd()
  const claudeDir = path.join(os.homedir(), '.claude')
  const projectsDir = path.join(claudeDir, 'projects')
  
  if (!fs.existsSync(projectsDir)) {
    return []
  }
  
  const sessions: SessionInfo[] = []
  
  try {
    const projectDirs = fs.readdirSync(projectsDir)
    
    for (const encodedProjectPath of projectDirs) {
      const decodedPath = decodeProjectPath(encodedProjectPath)
      
      // Check if current directory is within this project
      if (currentDir.startsWith(decodedPath)) {
        const projectDir = path.join(projectsDir, encodedProjectPath)
        
        if (fs.statSync(projectDir).isDirectory()) {
          const lockFiles = fs.readdirSync(projectDir).filter(file => file.endsWith('.lock'))
          
          for (const lockFile of lockFiles) {
            const lockPath = path.join(projectDir, lockFile)
            const sessionInfo = parseLockFile(lockPath)
            if (sessionInfo) {
              sessions.push(sessionInfo)
            }
          }
        }
      }
    }
  } catch {
    // Ignore errors in project scanning
  }
  
  return sessions
}

// Get all potential Claude lock directories (legacy support)
function getClaudeLockDirectories(): string[] {
  const claudeDir = path.join(os.homedir(), '.claude')
  const potentialDirs = [
    path.join(claudeDir, 'ide'),    // IDE connections (legacy)
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
    if (lockDir) {
      const sessions: SessionInfo[] = []
      if (fs.existsSync(lockDir)) {
        const files = fs.readdirSync(lockDir)
        const lockFiles = files.filter((file) => file.endsWith('.lock'))

        for (const lockFile of lockFiles) {
          const lockPath = path.join(lockDir, lockFile)
          const sessionInfo = parseLockFile(lockPath)
          if (sessionInfo) {
            sessions.push(sessionInfo)
          }
        }
      }
      return sessions
    }

    // Smart detection: prioritize current project sessions
    const currentProjectSessions = getCurrentProjectSessions()
    if (currentProjectSessions.length > 0) {
      return currentProjectSessions
    }

    // Fallback to legacy directory scanning
    const sessions: SessionInfo[] = []
    const dirsToSearch = getClaudeLockDirectories()
    
    for (const dir of dirsToSearch) {
      if (!fs.existsSync(dir)) {
        continue
      }

      const files = fs.readdirSync(dir)
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

// New export for getting all sessions (including non-current projects)
export function listAllSessions(): SessionInfo[] {
  const allSessions: SessionInfo[] = []
  
  try {
    // Get sessions from projects directory
    const claudeDir = path.join(os.homedir(), '.claude')
    const projectsDir = path.join(claudeDir, 'projects')
    
    if (fs.existsSync(projectsDir)) {
      const projectDirs = fs.readdirSync(projectsDir)
      
      for (const projectDir of projectDirs) {
        const fullProjectPath = path.join(projectsDir, projectDir)
        
        if (fs.statSync(fullProjectPath).isDirectory()) {
          const lockFiles = fs.readdirSync(fullProjectPath).filter(file => file.endsWith('.lock'))
          
          for (const lockFile of lockFiles) {
            const lockPath = path.join(fullProjectPath, lockFile)
            const sessionInfo = parseLockFile(lockPath)
            if (sessionInfo) {
              // Add project context
              const decodedPath = decodeProjectPath(projectDir)
              sessionInfo.workspaceFolders = sessionInfo.workspaceFolders.length > 0 
                ? sessionInfo.workspaceFolders 
                : [decodedPath]
              allSessions.push(sessionInfo)
            }
          }
        }
      }
    }

    // Add legacy sessions
    const legacySessions = getClaudeLockDirectories().flatMap(dir => {
      if (!fs.existsSync(dir)) return []
      
      const files = fs.readdirSync(dir)
      const lockFiles = files.filter((file) => file.endsWith('.lock'))
      
      return lockFiles.map(lockFile => {
        const lockPath = path.join(dir, lockFile)
        return parseLockFile(lockPath)
      }).filter(session => session !== null) as SessionInfo[]
    })

    allSessions.push(...legacySessions)
  } catch {
    // Ignore errors
  }

  return allSessions
}
