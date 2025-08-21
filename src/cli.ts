#!/usr/bin/env node

import { startIDEServer } from './ide-server.js'
import { startMCPServer } from './mcp-server.js'
import { fileURLToPath } from 'url'
import path from 'path'
import { Command } from 'commander'
import { enableDebug } from './debug.js'

const program = new Command()

program.name('claude-term').description('Minimal IDE server for Claude Code').version('0.0.1')

// Start both IDE and MCP servers command
program
  .command('start')
  .description('Start claude-term IDE server and MCP server')
  .option('-p, --port <port>', 'IDE server port (default: auto-assign)')
  .option('-w, --workspace <path>', 'Workspace folder (default: current directory)')
  .option('-n, --name <name>', 'IDE name (default: auto-generated from directory name)')
  .option('-d, --debug', 'Enable debug mode (logs all MCP messages and WebSocket events)')
  .action(
    async (options: { port?: string; workspace?: string; name?: string; debug?: boolean }) => {
      // Enable debug mode if requested
      if (options.debug) {
        enableDebug()
        console.log('🔍 Debug mode enabled - all MCP messages and WebSocket events will be logged')
      }

      const workspaceFolder = options.workspace || process.cwd()
      const dirName = path.basename(workspaceFolder)
      const ideName = options.name || `claude-term-${dirName}`

      console.log('🚀 Starting claude-term servers...')
      console.log(`📁 Workspace: ${workspaceFolder}`)
      console.log(`📦 IDE Name: ${ideName}`)

      try {
        // Start IDE server and MCP server concurrently
        const internalMcpPort = 12345 // Default internal MCP port
        const [idePort] = await Promise.all([
          startIDEServer({
            port: options.port ? parseInt(options.port) : undefined,
            workspaceFolder,
            ideName,
            debug: options.debug,
            noWait: true,
            internalMcpPort,
          }),
          startMCPServer({
            workspaceFolder,
            serverName: `${ideName}-mcp`,
            debug: options.debug,
            noWait: true,
            ideServerPort: internalMcpPort,
          }),
        ])

        console.log('\n✅ Both servers started successfully!')
        console.log(`🔌 IDE Server: Port ${idePort}`)
        console.log(`🔌 MCP Server: stdio transport`)
        console.log('\n📋 Next steps:')
        console.log('1. In Claude, run: /ide')
        console.log(`2. Select: ${ideName}`)
        console.log(`3. Add MCP server: claude mcp add ${ideName}-tools node dist/mcp-server.js`)
        console.log('4. Start coding!\n')
        console.log('Waiting for connections...')

        // Keep the process alive
        await new Promise(() => {}) // Never resolves
      } catch (error) {
        console.error('Failed to start servers:', error)
        process.exit(1)
      }
    },
  )

// Start MCP server command
program
  .command('mcp')
  .description('Start claude-term MCP server (tools only)')
  .option('-p, --port <port>', 'Port to listen on (default: auto-assign)')
  .option('-w, --workspace <path>', 'Workspace folder (default: current directory)')
  .option('-n, --name <name>', 'MCP server name (default: claude-term-mcp)')
  .option('-d, --debug', 'Enable debug mode (logs all MCP messages and WebSocket events)')
  .action(
    async (options: { port?: string; workspace?: string; name?: string; debug?: boolean }) => {
      // Enable debug mode if requested
      if (options.debug) {
        enableDebug()
        console.log('🔍 Debug mode enabled - all MCP messages and WebSocket events will be logged')
      }

      const workspaceFolder = options.workspace || process.cwd()
      const serverName = options.name || 'claude-term-mcp'

      await startMCPServer({
        workspaceFolder,
        serverName,
        debug: options.debug,
      })
    },
  )

// Make start the default command when no subcommand is provided
program.action(() => {
  // Default behavior - show help
  program.help()
})

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url)
if (isMainModule) {
  program.parse()
}

export { program }
