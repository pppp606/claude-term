#!/usr/bin/env node

import { startIDEServer } from './ide-server.js'
import { fileURLToPath } from 'url'
import path from 'path'
import { Command } from 'commander'

const program = new Command()

program
  .name('claude-term')
  .description('Minimal IDE server for Claude Code')
  .version('0.0.1')
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

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url)
if (isMainModule) {
  program.parse()
}

export { program }
