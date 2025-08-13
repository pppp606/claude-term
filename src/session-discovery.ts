import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'

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

// Get Claude MCP sessions by scanning running processes and ports
function getActiveMCPSessions(): SessionInfo[] {
  const sessions: SessionInfo[] = []
  
  try {
    // Find Claude processes
    const psOutput = execSync('ps aux | grep -E "(claude)" | grep -v grep', { encoding: 'utf8' })
    const claudeProcesses = psOutput.trim().split('\n').filter(line => line.includes('claude'))
    
    for (const processLine of claudeProcesses) {
      const parts = processLine.trim().split(/\s+/)
      const pid = parseInt(parts[1], 10)
      
      if (isNaN(pid)) continue
      
      try {
        // Find listening ports for this PID
        const lsofOutput = execSync(`lsof -p ${pid} -P 2>/dev/null | grep LISTEN || true`, { encoding: 'utf8' })
        const listeningPorts = lsofOutput.trim().split('\n')
          .filter(line => line.includes('LISTEN'))
          .map(line => {
            const match = line.match(/127\.0\.0\.1[:.:](\d+)/)
            return match ? parseInt(match[1], 10) : null
          })
          .filter(port => port !== null) as number[]
        
        // Get workspace info for each port by checking if corresponding lock file exists
        for (const port of listeningPorts) {
          const lockPath = path.join(os.homedir(), '.claude', 'ide', `${port}.lock`)
          let sessionInfo: SessionInfo | null = null
          
          if (fs.existsSync(lockPath)) {
            sessionInfo = parseLockFile(lockPath)
          }
          
          if (sessionInfo) {
            sessions.push(sessionInfo)
          } else {
            // Create basic session info if no lock file
            sessions.push({
              pid,
              port,
              workspaceFolders: [],
              ideName: 'Claude Code',
              transport: 'ws',
              runningInWindows: false,
              authToken: '', // Unknown without lock file
            })
          }
        }
      } catch {
        // Ignore errors for individual processes
      }
    }
  } catch {
    // If process-based detection fails, fall back to lock files
    return getLockFileSessions()
  }
  
  return sessions.length > 0 ? sessions : getLockFileSessions()
}

// Removed unused defaultLockDir - now using auto-detection

// Removed unused path decoding

// Removed unused project session info extraction

// Get current working directory project sessions
function getCurrentProjectSessions(): SessionInfo[] {
  const currentDir = process.cwd()
  
  // Get all active sessions
  const allSessions = getActiveMCPSessions()
  
  // Filter sessions that match current directory
  const relevantSessions = allSessions.filter(session => {
    // Check if any workspace folder matches current directory
    return session.workspaceFolders.some(workspace => 
      currentDir.startsWith(workspace) || workspace.startsWith(currentDir)
    )
  })
  
  // If no direct matches, look for partial matches (like parent/child directories)
  if (relevantSessions.length === 0) {
    const partialMatches = allSessions.filter(session => {
      return session.workspaceFolders.some(workspace => {
        const currentBasename = path.basename(currentDir)
        const workspaceBasename = path.basename(workspace)
        return currentBasename === workspaceBasename || 
               workspace.includes(currentBasename) ||
               currentDir.includes(workspaceBasename)
      })
    })
    
    if (partialMatches.length > 0) {
      return partialMatches
    }
  }
  
  return relevantSessions
}

// Get sessions from lock files in ide directory
function getLockFileSessions(): SessionInfo[] {
  const sessions: SessionInfo[] = []
  const claudeDir = path.join(os.homedir(), '.claude')
  const ideDir = path.join(claudeDir, 'ide')
  
  if (!fs.existsSync(ideDir)) {
    return []
  }
  
  try {
    const files = fs.readdirSync(ideDir)
    const lockFiles = files.filter((file) => file.endsWith('.lock'))

    for (const lockFile of lockFiles) {
      const lockPath = path.join(ideDir, lockFile)
      const sessionInfo = parseLockFile(lockPath)
      if (sessionInfo) {
        sessions.push(sessionInfo)
      }
    }
  } catch {
    // Ignore errors
  }
  
  return sessions
}

// Removed unused legacy directory scanning

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
    const allSessions = getActiveMCPSessions()
    
    // If we found project-specific sessions, return those
    if (currentProjectSessions.length > 0 && currentProjectSessions.length < allSessions.length) {
      return currentProjectSessions
    }

    // Otherwise, return all sessions
    return allSessions
  } catch (error) {
    return []
  }
}

// New export for getting all sessions (including non-current projects)
export function listAllSessions(): SessionInfo[] {
  // Use process-based detection to get all active sessions
  return getActiveMCPSessions()
}
