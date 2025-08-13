import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'

export interface SessionInfo {
  pid: number
  port: number
  workspaceFolders: string[]
  ideName: string
  transport: string
  runningInWindows: boolean
  authToken: string
}

interface RawLockFileData {
  pid: number
  workspaceFolders: string[]
  ideName: string
  transport: string
  runningInWindows: boolean
  authToken: string
}

function isValidLockFileData(data: unknown): data is RawLockFileData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'pid' in data &&
    'workspaceFolders' in data &&
    'ideName' in data &&
    'transport' in data &&
    'runningInWindows' in data &&
    'authToken' in data &&
    typeof (data as any).pid === 'number' &&
    Array.isArray((data as any).workspaceFolders) &&
    typeof (data as any).ideName === 'string' &&
    typeof (data as any).transport === 'string' &&
    typeof (data as any).runningInWindows === 'boolean' &&
    typeof (data as any).authToken === 'string'
  )
}

export function parseLockFile(lockPath: string): SessionInfo | null {
  try {
    if (!fs.existsSync(lockPath)) {
      return null
    }

    const content = fs.readFileSync(lockPath, 'utf8')
    const data = JSON.parse(content)

    if (!isValidLockFileData(data)) {
      return null
    }

    const typedData = data

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

// Get standalone Claude MCP sessions (excluding IDE sessions)
function getActiveMCPSessions(): SessionInfo[] {
  const sessions: SessionInfo[] = []

  try {
    // Include all IDE sessions to verify they work
    // Check both IPv4 and IPv6 listening ports
    const netstatOutput = execSync('netstat -an | grep LISTEN', { encoding: 'utf8' })
    const allPorts: number[] = []

    // Parse both IPv4 (127.0.0.1) and IPv6 (*:port) listening addresses
    netstatOutput
      .trim()
      .split('\n')
      .forEach((line) => {
        // IPv4: 127.0.0.1.port or 127.0.0.1:port
        const ipv4Match = line.match(/127\.0\.0\.1[.:](\d+)/)
        if (ipv4Match) {
          const port = parseInt(ipv4Match[1], 10)
          if (port > 16000 && port < 65000) allPorts.push(port)
          return
        }

        // IPv6: *:port (our WebSocket server uses this)
        const ipv6Match = line.match(/\*[.:](\d+)/)
        if (ipv6Match) {
          const port = parseInt(ipv6Match[1], 10)
          if (port > 16000 && port < 65000) allPorts.push(port)
          return
        }
      })

    for (const port of allPorts) {
      const lockPath = path.join(os.homedir(), '.claude', 'ide', `${port}.lock`)
      // Include all IDE sessions
      if (fs.existsSync(lockPath)) {
        const sessionInfo = parseLockFile(lockPath)
        if (sessionInfo) {
          // Mark existing IDE sessions vs our claude-term sessions
          const isClaudeTerm = sessionInfo.ideName.includes('claude-term')
          sessions.push({
            ...sessionInfo,
            ideName: isClaudeTerm ? sessionInfo.ideName : `${sessionInfo.ideName} (IDE)`,
          })
        }
      }
    }

    // Strategy 1: Check if current session is Claude Code by environment variables
    if (process.env.CLAUDECODE === '1' || process.env.CLAUDE_CODE_ENTRYPOINT) {
      // This is a Claude Code session - try to find its MCP server port
      // Look for ports that could be related to this session
      const netstatOutput = execSync('netstat -an | grep LISTEN | grep 127.0.0.1', {
        encoding: 'utf8',
      })
      const allPorts = netstatOutput
        .trim()
        .split('\n')
        .map((line) => {
          const match = line.match(/127\.0\.0\.1[.:](\d+)/)
          return match ? parseInt(match[1], 10) : null
        })
        .filter((port): port is number => port !== null && port > 8000 && port < 65000) // Broader range for Claude Code

      for (const port of allPorts) {
        const lockPath = path.join(os.homedir(), '.claude', 'ide', `${port}.lock`)
        // SKIP if this is an IDE session (has lock file in ide/ directory)
        if (fs.existsSync(lockPath)) {
          continue // Skip IDE sessions - they're already in use by IDE
        }

        // Try to identify the process using this port
        try {
          const lsofOutput = execSync(`lsof -i :${port} -P 2>/dev/null || true`, {
            encoding: 'utf8',
          })
          if (lsofOutput.includes('LISTEN')) {
            const lines = lsofOutput.trim().split('\n')
            for (const line of lines) {
              if (line.includes('LISTEN')) {
                const parts = line.trim().split(/\s+/)
                const processName = parts[0]
                const pid = parseInt(parts[1], 10)

                // Include any process that could be related to Claude Code MCP
                if (
                  !isNaN(pid) &&
                  (processName.toLowerCase().includes('claude') ||
                    processName.toLowerCase().includes('node') ||
                    processName.toLowerCase().includes('code') ||
                    line.toLowerCase().includes('claude') ||
                    // Include common development servers that might be Claude Code related
                    (port >= 8000 && port <= 65000))
                ) {
                  // Add as potential Claude Code session
                  sessions.push({
                    pid,
                    port,
                    workspaceFolders: [process.cwd()], // Use current working directory
                    ideName: 'Claude Code (CLI)',
                    transport: 'ws',
                    runningInWindows: false,
                    authToken: '', // Unknown for standalone sessions
                  })
                  break // Only add once per port
                }
              }
            }
          }
        } catch {
          // Skip ports we can't identify
        }
      }
    } else {
      // Strategy 2: Find listening ports and filter out IDE ports (original logic)
      const netstatOutput = execSync('netstat -an | grep LISTEN | grep 127.0.0.1', {
        encoding: 'utf8',
      })
      const allPorts = netstatOutput
        .trim()
        .split('\n')
        .map((line) => {
          const match = line.match(/127\.0\.0\.1[.:](\d+)/)
          return match ? parseInt(match[1], 10) : null
        })
        .filter((port): port is number => port !== null && port > 16000 && port < 50000) // Common MCP port range

      for (const port of allPorts) {
        const lockPath = path.join(os.homedir(), '.claude', 'ide', `${port}.lock`)
        // SKIP if this is an IDE session (has lock file in ide/ directory)
        if (fs.existsSync(lockPath)) {
          continue // Skip IDE sessions - they're already in use by IDE
        }

        // Try to identify the process using this port
        try {
          const lsofOutput = execSync(`lsof -i :${port} -P 2>/dev/null || true`, {
            encoding: 'utf8',
          })
          if (lsofOutput.includes('LISTEN')) {
            const lines = lsofOutput.trim().split('\n')
            for (const line of lines) {
              if (line.includes('LISTEN')) {
                const parts = line.trim().split(/\s+/)
                const processName = parts[0]
                const pid = parseInt(parts[1], 10)

                // Only include processes that could be Claude Code
                if (
                  !isNaN(pid) &&
                  (processName.toLowerCase().includes('claude') ||
                    processName.toLowerCase().includes('node') ||
                    processName.toLowerCase().includes('code') ||
                    line.toLowerCase().includes('claude'))
                ) {
                  // Only include standalone sessions (no IDE lock file)
                  sessions.push({
                    pid,
                    port,
                    workspaceFolders: [], // Will be populated if we find project info
                    ideName: 'Claude Code (CLI)',
                    transport: 'ws',
                    runningInWindows: false,
                    authToken: '', // Unknown for standalone sessions
                  })
                  break // Only add once per port
                }
              }
            }
          }
        } catch {
          // Skip ports we can't identify - don't add unknown processes
        }
      }
    }
  } catch {
    // If port detection fails, return empty (no fallback to IDE sessions)
    return []
  }

  return sessions
}

// Get current working directory project sessions
function getCurrentProjectSessions(): SessionInfo[] {
  const currentDir = process.cwd()

  // Get all active sessions
  const allSessions = getActiveMCPSessions()

  // Filter sessions that match current directory
  const relevantSessions = allSessions.filter((session) => {
    // Check if any workspace folder matches current directory
    return session.workspaceFolders.some(
      (workspace) => currentDir.startsWith(workspace) || workspace.startsWith(currentDir),
    )
  })

  // If no direct matches, look for partial matches (like parent/child directories)
  if (relevantSessions.length === 0) {
    const partialMatches = allSessions.filter((session) => {
      return session.workspaceFolders.some((workspace) => {
        const currentBasename = path.basename(currentDir)
        const workspaceBasename = path.basename(workspace)
        return (
          currentBasename === workspaceBasename ||
          workspace.includes(currentBasename) ||
          currentDir.includes(workspaceBasename)
        )
      })
    })

    if (partialMatches.length > 0) {
      return partialMatches
    }
  }

  return relevantSessions
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

// Export for getting all standalone sessions (excluding IDE sessions)
export function listAllSessions(): SessionInfo[] {
  // Use process-based detection to get all standalone sessions
  return getActiveMCPSessions()
}
