#!/usr/bin/env node

import { Command } from 'commander'
import { listSessions } from './session-discovery.js'
import { fileURLToPath } from 'url'
import os from 'os'
import path from 'path'

const program = new Command()

program
  .name('claude-term')
  .description('CLI tool for connecting to Claude Code MCP servers')
  .version('0.0.1')

program
  .command('sessions')
  .description('List available Claude Code sessions')
  .option('--lock-dir <path>', 'Directory to scan for lock files', path.join(os.homedir(), '.claude', 'ide'))
  .action((options: { lockDir: string }) => {
    const sessions = listSessions(options.lockDir)

    if (sessions.length === 0) {
      console.log('No Claude Code sessions found.')
    } else {
      const sessionText = sessions.length === 1 ? 'session' : 'sessions'
      console.log(`Found ${sessions.length} Claude Code ${sessionText}:`)

      sessions.forEach((session) => {
        const workspaces = session.workspaceFolders.length > 0 ? session.workspaceFolders.join(', ') : 'No workspace'
        console.log(
          `Port: ${session.port}, PID: ${session.pid}, IDE: ${session.ideName}, Workspaces: ${workspaces}`,
        )
      })
    }
  })

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url)
if (isMainModule) {
  program.parse()
}

export { program }
