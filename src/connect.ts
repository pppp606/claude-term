// connect.ts - Implementation of connect command for MCP WebSocket connection

import { listSessions } from './session-discovery.js'
import readline from 'readline'

export interface ConnectOptions {
  lockDir: string
}

export async function connectCommand(options: ConnectOptions): Promise<void> {
  const sessions = listSessions(options.lockDir)

  if (sessions.length === 0) {
    console.log('No Claude Code sessions found.')
    return
  }

  const sessionText = sessions.length === 1 ? 'session' : 'sessions'
  console.log(`Found ${sessions.length} Claude Code ${sessionText}:`)

  sessions.forEach((session, index) => {
    const workspaces =
      session.workspaceFolders.length > 0 ? session.workspaceFolders.join(', ') : 'No workspace'
    console.log(
      `${index + 1}. Port: ${session.port}, PID: ${session.pid}, IDE: ${session.ideName}, Workspaces: ${workspaces}`,
    )
  })

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question('Select a session (1-' + sessions.length + '): ', (answer) => {
      rl.close()
      
      const sessionIndex = parseInt(answer, 10) - 1
      if (isNaN(sessionIndex) || sessionIndex < 0 || sessionIndex >= sessions.length) {
        console.error('Invalid session selection.')
        resolve()
        return
      }

      const selectedSession = sessions[sessionIndex]
      console.log(`Connecting to session on port ${selectedSession.port}...`)
      // TODO: Implement WebSocket connection
      resolve()
    })
  })
}