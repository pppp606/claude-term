import { readdir, readFile } from 'fs/promises'
import { debugLog } from './debug.js'

export interface MCPSession {
  id: string
  lockFile: string
  config: any
}

export async function findMCPSessions(): Promise<MCPSession[]> {
  debugLog('SESSION', 'Scanning for MCP session lock files in /tmp')

  try {
    const files = await readdir('/tmp')
    const lockFiles = files.filter((file) => file.startsWith('claude-') && file.endsWith('.lock'))

    debugLog('SESSION', `Found ${lockFiles.length} potential lock files`, lockFiles)

    const sessions: MCPSession[] = []

    for (const lockFile of lockFiles) {
      try {
        const lockPath = `/tmp/${lockFile}`
        const content = await readFile(lockPath, 'utf-8')
        const config = JSON.parse(content)

        const sessionId = lockFile.replace('claude-', '').replace('.lock', '')

        sessions.push({
          id: sessionId,
          lockFile: lockPath,
          config,
        })

        debugLog('SESSION', `Loaded session ${sessionId}`, config)
      } catch (error) {
        debugLog('SESSION', `Failed to parse lock file ${lockFile}`, error)
      }
    }

    return sessions
  } catch (error) {
    debugLog('SESSION', 'Failed to scan /tmp directory', error)
    return []
  }
}

export async function listSessions(options: { json?: boolean }): Promise<void> {
  const sessions = await findMCPSessions()

  if (options.json) {
    console.log(JSON.stringify(sessions, null, 2))
  } else {
    if (sessions.length === 0) {
      console.log('No active Claude Code MCP sessions found.')
      console.log('Make sure Claude Code is running and has an active session.')
      return
    }

    console.log(`Found ${sessions.length} active MCP session(s):\n`)

    for (const session of sessions) {
      console.log(`Session ID: ${session.id}`)
      console.log(`Lock file: ${session.lockFile}`)
      if (session.config.port) {
        console.log(`Port: ${session.config.port}`)
      }
      if (session.config.path) {
        console.log(`Socket path: ${session.config.path}`)
      }
      console.log('')
    }
  }
}
