#!/usr/bin/env node

import { Command } from 'commander'
import { listSessions, listAllSessions } from './session-discovery.js'
import { connectCommand } from './connect.js'
import { fileURLToPath } from 'url'

const program = new Command()

program
  .name('claude-term')
  .description('CLI tool for connecting to Claude Code MCP servers')
  .version('0.0.1')

program
  .command('sessions')
  .description('List Claude Code sessions (prioritizes current project)')
  .option(
    '--lock-dir <path>',
    'Directory to scan for lock files (default: auto-detect)',
  )
  .option(
    '--all',
    'Show all sessions from all projects',
  )
  .action((options: { lockDir?: string; all?: boolean }) => {
    const sessions = options.all ? listAllSessions() : listSessions(options.lockDir)

    if (sessions.length === 0) {
      console.log('No Claude Code sessions found.')
      if (!options.all && !options.lockDir) {
        console.log('Tip: Use --all to see sessions from all projects')
      }
    } else {
      const sessionText = sessions.length === 1 ? 'session' : 'sessions'
      const contextText = options.all ? 'all projects' : 'current project context'
      console.log(`Found ${sessions.length} Claude Code ${sessionText} (${contextText}):`)

      sessions.forEach((session) => {
        const workspaces =
          session.workspaceFolders.length > 0 ? session.workspaceFolders.join(', ') : 'No workspace'
        console.log(
          `Port: ${session.port}, PID: ${session.pid}, IDE: ${session.ideName}, Workspaces: ${workspaces}`,
        )
      })
    }
  })

program
  .command('connect')
  .description('Connect to a Claude Code MCP server (auto-connects if single session in current project)')
  .option(
    '--lock-dir <path>',
    'Directory to scan for lock files (default: current project auto-detect)',
  )
  .action(async (options: { lockDir?: string }) => {
    await connectCommand(options)
  })

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url)
if (isMainModule) {
  program.parse()
}

export { program }
