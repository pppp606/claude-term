#!/usr/bin/env node

import { startIDEServer } from './ide-server.js'
import { listSessions } from './session-discovery.js'
import { ConnectionClient } from './connection-client.js'
import { fileURLToPath } from 'url'
import path from 'path'
import { Command } from 'commander'
import readline from 'readline'

const program = new Command()

program.name('claude-term').description('Minimal IDE server for Claude Code').version('0.0.1')

// Start IDE server command
program
  .command('start')
  .description('Start claude-term IDE server')
  .option('-p, --port <port>', 'Port to listen on (default: auto-assign)')
  .option('-w, --workspace <path>', 'Workspace folder (default: current directory)')
  .option('-n, --name <name>', 'IDE name (default: auto-generated from directory name)')
  .action(async (options: { port?: string; workspace?: string; name?: string }) => {
    const workspaceFolder = options.workspace || process.cwd()
    const dirName = path.basename(workspaceFolder)
    const ideName = options.name || `claude-term-${dirName}`

    await startIDEServer({
      port: options.port ? parseInt(options.port) : undefined,
      workspaceFolder,
      ideName,
    })
  })

// Make start the default command when no subcommand is provided
program.action(async () => {
  // Default behavior - show help
  program.help()
})

// Sessions command - list available Claude Code sessions
program
  .command('sessions')
  .description('List available Claude Code sessions')
  .option('--lock-dir <path>', 'Directory to scan for lock files (default: ~/.claude/ide)')
  .action(async (options: { lockDir?: string }) => {
    const sessions = listSessions(options.lockDir)

    if (sessions.length === 0) {
      console.log('No Claude Code sessions found.')
      return
    }

    // When using --lock-dir, always show "current project context"
    // When using smart detection, show appropriate label based on context
    const contextLabel = options.lockDir ? 'current project context' : 'available sessions'
    console.log(
      `Found ${sessions.length} Claude Code ${sessions.length === 1 ? 'session' : 'sessions'} (${contextLabel}):`,
    )

    sessions.forEach((session) => {
      const workspaces = session.workspaceFolders.join(', ') || 'unknown'
      console.log(
        `Port: ${session.port}, PID: ${session.pid}, IDE: ${session.ideName}, Workspaces: ${workspaces}`,
      )
    })
  })

// Connect command - connect to a Claude Code session
program
  .command('connect')
  .description('Connect to a Claude Code session for interactive event handling')
  .option('--port <port>', 'Connect to specific port')
  .option('--lock-dir <path>', 'Directory to scan for lock files (default: ~/.claude/ide)')
  .action(async (options: { port?: string; lockDir?: string }) => {
    const sessions = listSessions(options.lockDir)

    if (sessions.length === 0) {
      console.log('❌ No Claude Code sessions found.')
      console.log('Make sure Claude Code is running with an active MCP server.')
      return
    }

    const client = new ConnectionClient()

    try {
      let targetSession = null

      if (options.port) {
        const port = parseInt(options.port)
        targetSession = sessions.find((s) => s.port === port)
        if (!targetSession) {
          console.log(`❌ No session found on port ${port}`)
          return
        }
      } else if (sessions.length === 1) {
        targetSession = sessions[0]
        console.log(`Auto-selecting the only available session: ${targetSession.ideName}`)
      } else {
        // Interactive session selection
        client.displaySessionList(sessions)
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        })

        const choice = await new Promise<number>((resolve) => {
          rl.question('> ', (answer) => {
            rl.close()
            resolve(parseInt(answer))
          })
        })

        targetSession = client.selectSession(sessions, choice)
        if (!targetSession) {
          return
        }
      }

      // Connect to the selected session
      const interactiveSession = await client.connect(targetSession)

      // Set up graceful shutdown
      const cleanup = () => {
        console.log('\n👋 Shutting down...')
        client.close()
        process.exit(0)
      }

      interactiveSession.on('quit', cleanup)
      process.on('SIGINT', cleanup)
      process.on('SIGTERM', cleanup)

      // Start the interactive event loop
      interactiveSession.startEventLoop()
    } catch (error) {
      console.error('❌ Failed to connect:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url)
if (isMainModule) {
  program.parse()
}

export { program }
