import fs from 'fs'
import path from 'path'

export interface SessionInfo {
  port: number
  context: string
  project: string
}

function isSessionInfo(data: unknown): data is SessionInfo {
  return (
    typeof data === 'object' &&
    data !== null &&
    'port' in data &&
    'context' in data &&
    'project' in data &&
    typeof (data as Record<string, unknown>).port === 'number' &&
    typeof (data as Record<string, unknown>).context === 'string' &&
    typeof (data as Record<string, unknown>).project === 'string'
  )
}

export function parseLockFile(lockPath: string): SessionInfo | null {
  try {
    if (!fs.existsSync(lockPath)) {
      return null
    }

    const content = fs.readFileSync(lockPath, 'utf8')
    const data: unknown = JSON.parse(content)

    if (!isSessionInfo(data)) {
      return null
    }

    return {
      port: data.port,
      context: data.context,
      project: data.project,
    }
  } catch (error) {
    return null
  }
}

export function listSessions(lockDir: string = '/tmp'): SessionInfo[] {
  try {
    if (!fs.existsSync(lockDir)) {
      return []
    }

    const files = fs.readdirSync(lockDir)
    const lockFiles = files.filter((file) => file.startsWith('claude-') && file.endsWith('.lock'))

    const sessions: SessionInfo[] = []
    for (const lockFile of lockFiles) {
      const lockPath = path.join(lockDir, lockFile)
      const sessionInfo = parseLockFile(lockPath)
      if (sessionInfo) {
        sessions.push(sessionInfo)
      }
    }

    return sessions
  } catch (error) {
    return []
  }
}
