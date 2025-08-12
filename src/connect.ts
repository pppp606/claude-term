// connect.ts - Implementation of connect command for MCP WebSocket connection

import { listSessions } from './session-discovery.js'
import readline from 'readline'
import { WebSocket } from 'ws'

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

      // Establish WebSocket connection to MCP server
      const wsUrl = `ws://localhost:${selectedSession.port}`
      const ws = new WebSocket(wsUrl)

      ws.on('open', () => {
        console.log('Connected to Claude Code MCP server')
        console.log('Listening for events... (type :quit to exit)')

        // Set up stdin command handling
        const stdinRl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        })

        stdinRl.on('line', (line: string) => {
          const trimmed = line.trim()

          if (trimmed === ':quit') {
            console.log('Exiting...')
            stdinRl.close()
            ws.close()
            resolve()
            return
          }

          if (trimmed.startsWith(':')) {
            console.log(`Unknown command: ${trimmed}`)
            return
          }

          // For non-commands, ignore for now (placeholder for future functionality)
        })

        // For testing, resolve immediately after setup
        // In real usage, this would stay in the interactive loop
        if (process.env.NODE_ENV === 'test') {
          resolve()
        }
      })

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString())
          console.log('Event:', JSON.stringify(message, null, 2))
        } catch (error) {
          console.error('Error parsing message:', error)
        }
      })

      ws.on('error', (error: Error) => {
        console.error('WebSocket connection error:', error)
        resolve()
      })

      ws.on('close', () => {
        console.log('Disconnected from Claude Code MCP server')
        resolve()
      })
    })
  })
}
