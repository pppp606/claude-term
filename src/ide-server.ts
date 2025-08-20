// ide-server.ts - Minimal IDE server for Claude Code connection

import { WebSocketServer, WebSocket } from 'ws'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { randomUUID } from 'crypto'
import { execSync } from 'child_process'
import * as readline from 'readline'
import { GitReviewManager } from './git-review.js'
import { GitPushManager } from './git-push.js'
import { FileDiscovery, FileInfo } from './file-discovery.js'
import { debugLog, logMCPMessage, logWebSocketEvent } from './debug.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { createServer, IncomingMessage, ServerResponse } from 'http'

export interface IDEServerOptions {
  port?: number
  workspaceFolder?: string
  ideName?: string
  debug?: boolean
  noWait?: boolean
  internalMcpPort?: number
}

export class ClaudeTermIDEServer {
  private server: WebSocketServer | null = null
  private port: number = 0
  private lockFilePath: string = ''
  private authToken: string = ''
  private connectedWS: WebSocket | null = null
  private rl: readline.Interface | null = null
  private gitReview: GitReviewManager
  private gitPush: GitPushManager
  private waitingForApproval: boolean = false
  private fileDiscovery: FileDiscovery
  private fileCache: FileInfo[] = []
  private cacheTimestamp: number = 0
  private readonly CACHE_TTL = 30000 // 30 seconds
  
  // Internal MCP Server for communication with standalone MCP
  private internalMcpServer: Server | null = null
  private internalHttpServer: any = null
  private internalMcpPort: number = 0

  constructor(private options: IDEServerOptions = {}) {
    this.authToken = randomUUID()
    this.gitReview = new GitReviewManager()
    this.gitPush = new GitPushManager()
    this.fileDiscovery = new FileDiscovery()
  }

  async start(): Promise<number> {
    // Start internal MCP server first
    await this.startInternalMcpServer()

    // Create WebSocket server
    this.server = new WebSocketServer({
      port: this.options.port || 0, // Use 0 for dynamic port assignment
    })

    return new Promise((resolve, reject) => {
      if (!this.server) {
        reject(new Error('Server not initialized'))
        return
      }

      this.server.on('listening', () => {
        if (!this.server) return

        const address = this.server.address()
        if (typeof address === 'object' && address) {
          this.port = address.port
          console.log(`IDE Server listening on port ${this.port}`)
          console.log(`Internal MCP Server listening on port ${this.internalMcpPort}`)

          // Create lock file
          this.createLockFile()

          // Initialize file cache
          this.initializeFileCache()

          resolve(this.port)
        } else {
          reject(new Error('Failed to get server address'))
        }
      })

      this.server.on('connection', (ws, request) => {
        this.handleConnection(ws, request)
      })

      this.server.on('error', (error) => {
        reject(error)
      })
    })
  }

  private createLockFile(): void {
    const lockData = {
      pid: process.pid,
      workspaceFolders: [this.options.workspaceFolder || process.cwd()],
      ideName: this.options.ideName || 'claude-term',
      transport: 'ws',
      runningInWindows: false,
      authToken: this.authToken,
    }

    const ideDir = path.join(os.homedir(), '.claude', 'ide')
    if (!fs.existsSync(ideDir)) {
      fs.mkdirSync(ideDir, { recursive: true })
    }

    this.lockFilePath = path.join(ideDir, `${this.port}.lock`)
    fs.writeFileSync(this.lockFilePath, JSON.stringify(lockData))
    console.log(`Lock file created: ${this.lockFilePath}`)
  }

  private handleConnection(ws: WebSocket, request: any): void {
    // Check for authentication header
    const authHeader = request.headers['x-claude-code-ide-authorization']
    if (authHeader && authHeader !== this.authToken) {
      console.log("⚠️  Authentication header provided but doesn't match")
    } else if (!authHeader) {
      console.log('ℹ️  No authentication header provided')
    } else {
      console.log('✅ Authentication header validated')
    }

    console.log('Claude Code connected!')
    this.connectedWS = ws

    logWebSocketEvent('CLIENT_CONNECTED', {
      authHeader: !!authHeader,
      headerMatch: authHeader === this.authToken,
    })

    // Start interactive session
    this.startInteractiveSession()

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString())

        // Log received messages using new debug system
        logMCPMessage('RECV', message)
        debugLog('MCP', `Processing method: ${message.method || 'response'}`, { id: message.id })

        // Handle different MCP message types
        if (message.method === 'initialize') {
          this.handleInitialize(ws, message)
        } else if (message.method === 'notifications/initialized') {
          // Claude Code initialization complete - show prompt
          console.log('\n✅ Claude Code ready! Type /help for commands')
          process.stdout.write('> ')
        } else if (message.method === 'tools/list') {
          this.handleToolsList(ws, message)
        } else if (message.method?.startsWith('tools/')) {
          await this.handleToolCall(ws, message)
        } else if (message.method?.startsWith('resources/')) {
          this.handleResourceCall(ws, message)
        } else {
          // Default response for unknown methods
          const response = {
            jsonrpc: '2.0',
            id: message.id,
            result: { status: 'ok', message: 'Not implemented yet' },
          }
          ws.send(JSON.stringify(response))
        }
      } catch (error) {
        console.error('❌ Error handling message:', error)
      }
    })

    ws.on('close', () => {
      console.log('👋 Claude Code disconnected')
      logWebSocketEvent('CLIENT_DISCONNECTED')
    })

    ws.on('error', (error) => {
      console.error('🔥 WebSocket error:', error)
      logWebSocketEvent('CLIENT_ERROR', { error: error.message })
    })
  }

  private handleInitialize(ws: WebSocket, message: any): void {
    const response = {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: '2025-06-18',
        capabilities: {
          tools: {
            read_file: {
              description: 'Read file contents',
              inputSchema: {
                type: 'object',
                properties: {
                  path: { type: 'string', description: 'File path to read' },
                },
                required: ['path'],
              },
            },
            write_file: {
              description: 'Write file contents',
              inputSchema: {
                type: 'object',
                properties: {
                  path: { type: 'string', description: 'File path to write' },
                  content: { type: 'string', description: 'Content to write' },
                },
                required: ['path', 'content'],
              },
            },
            list_files: {
              description: 'List files in directory',
              inputSchema: {
                type: 'object',
                properties: {
                  path: { type: 'string', description: 'Directory path', default: '.' },
                },
              },
            },
          },
          resources: {
            list: {
              description: 'List available resources (files)',
              inputSchema: {
                type: 'object',
                properties: {},
              },
            },
            read: {
              description: 'Read resource content',
              inputSchema: {
                type: 'object',
                properties: {
                  uri: { type: 'string', description: 'Resource URI' },
                },
                required: ['uri'],
              },
            },
          },
        },
        serverInfo: {
          name: 'claude-term',
          version: '0.0.1',
        },
      },
    }

    logMCPMessage('SEND', response)
    ws.send(JSON.stringify(response))
  }

  private handleToolsList(ws: WebSocket, message: any): void {
    // Return the list of available tools
    const response = {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        tools: [
          {
            name: 'read_file',
            description: 'Read file contents',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'File path to read' },
              },
              required: ['path'],
            },
          },
          {
            name: 'write_file',
            description: 'Write file contents',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'File path to write' },
                content: { type: 'string', description: 'Content to write' },
              },
              required: ['path', 'content'],
            },
          },
          {
            name: 'list_files',
            description: 'List files in directory',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Directory path', default: '.' },
              },
            },
          },
          {
            name: 'open_diff',
            description: 'Open diff view',
            inputSchema: {
              type: 'object',
              properties: {
                old_file_path: { type: 'string' },
                new_file_path: { type: 'string' },
                new_file_contents: { type: 'string' },
              },
              required: ['old_file_path', 'new_file_path', 'new_file_contents'],
            },
          },
          {
            name: 'close_all_diff_tabs',
            description: 'Close all diff tabs',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'review_push',
            description: 'Push commits to remote repository with review and approval',
            inputSchema: {
              type: 'object',
              properties: {},
              required: [],
            },
          },
        ],
      },
    }

    logMCPMessage('SEND', response)
    ws.send(JSON.stringify(response))
    console.log('📋 Sent tools list to Claude Code')
  }

  private async handleReviewPushTool(_params: any): Promise<string> {
    try {
      console.log('\n🔍 Claude Code requested commit review...')

      // Execute the review-push workflow
      await this.handleReviewPushCommand()

      return 'Review-push workflow initiated. User will see commit review in less pager and can approve/reject with y/n.'
    } catch (error) {
      const errorMsg = `Failed to initiate review-push: ${error instanceof Error ? error.message : error}`
      console.error('❌', errorMsg)
      return errorMsg
    }
  }

  private async handleToolCall(ws: WebSocket, message: any): Promise<void> {
    const method = message.method
    const params = message.params || {}

    try {
      let result: any

      if (method === 'tools/call' && params.name === 'open_diff') {
        // Handle Claude Code's open_diff tool call
        result = this.handleOpenDiff(params.arguments)
      } else if (method === 'tools/call' && params.name === 'review_push') {
        // Handle Claude Code's review_push tool call
        result = await this.handleReviewPushTool(params.arguments)
      } else if (method.startsWith('tools/')) {
        const toolName = method.replace('tools/', '')
        switch (toolName) {
          case 'read_file':
            result = this.readFile(params.path)
            break
          case 'write_file':
            result = this.writeFileWithDiff(params.path, params.content)
            break
          case 'list_files':
            result = this.listFiles(params.path || '.')
            break
          default:
            throw new Error(`Unknown tool: ${toolName}`)
        }
      } else {
        throw new Error(`Unknown method: ${method}`)
      }

      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: { content: [{ type: 'text', text: result }] },
      }

      logMCPMessage('SEND', response)
      ws.send(JSON.stringify(response))
    } catch (error) {
      const errorResponse = {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      }

      logMCPMessage('SEND', errorResponse)
      ws.send(JSON.stringify(errorResponse))
    }
  }

  private handleResourceCall(ws: WebSocket, message: any): void {
    const method = message.method
    const params = message.params || {}

    try {
      let result: any

      if (method === 'resources/list') {
        // List available resources
        result = this.listResources()
      } else if (method === 'resources/read') {
        // Read specific resource
        result = this.readResource(params.uri)
      } else {
        result = { resources: [] }
      }

      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: result,
      }

      logMCPMessage('SEND', response)
      ws.send(JSON.stringify(response))
    } catch (error) {
      const errorResponse = {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      }

      logMCPMessage('SEND', errorResponse)
      ws.send(JSON.stringify(errorResponse))
    }
  }

  private activeFiles: Set<string> = new Set()

  private listResources(): any {
    const resources = Array.from(this.activeFiles).map((filePath) => ({
      uri: `file://${filePath}`,
      name: path.basename(filePath),
      mimeType: 'text/plain',
      description: `Active file: ${path.relative(this.options.workspaceFolder || process.cwd(), filePath)}`,
    }))

    return { resources }
  }

  private readResource(uri: string): any {
    try {
      const filePath = uri.replace('file://', '')
      const content = fs.readFileSync(filePath, 'utf8')

      return {
        contents: [
          {
            uri: uri,
            mimeType: 'text/plain',
            text: content,
          },
        ],
      }
    } catch (error) {
      throw new Error(`Failed to read resource: ${uri}`)
    }
  }

  private readFile(filePath: string): string {
    const fs = require('fs')
    const path = require('path')

    const fullPath = path.resolve(this.options.workspaceFolder || process.cwd(), filePath)
    return fs.readFileSync(fullPath, 'utf8')
  }

  // Legacy method - now using writeFileWithDiff

  private listFiles(dirPath: string): string {
    const fs = require('fs')
    const path = require('path')

    const fullPath = path.resolve(this.options.workspaceFolder || process.cwd(), dirPath)
    const files = fs.readdirSync(fullPath)
    return files.join('\n')
  }

  private writeFileWithDiff(filePath: string, newContent: string): string {
    const fs = require('fs')
    const path = require('path')

    const fullPath = path.resolve(this.options.workspaceFolder || process.cwd(), filePath)

    // Simply write the file without showing diff
    // Diff review is now handled by /review-push command
    if (!fs.existsSync(fullPath)) {
      console.log(`\n📝 Creating new file: ${filePath}`)
    }

    fs.writeFileSync(fullPath, newContent)
    return `File written successfully: ${filePath}`
  }

  // Removed displayDiff method - diff review is now handled by /review-push command

  private startInteractiveSession(): void {
    console.log('\n🔄 Interactive IDE server session started')
    console.log('Type /help for available commands')
    console.log('Waiting for Claude Code requests...\n')

    // Create readline interface with tab completion (without delay for startup)
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      completer: this.completeCommand.bind(this),
      prompt: '> ',
    })

    this.rl.on('line', async (input) => {
      const trimmed = input.trim()

      if (trimmed) {
        await this.processCommand(trimmed)
      }

      this.rl?.prompt()
    })

    this.rl.on('SIGINT', () => {
      this.stop()
      process.exit(0)
    })

    // Show initial prompt
    this.rl.prompt()
  }

  private completeCommand(line: string): [string[], string] {
    const commands = [
      '/help',
      '/send ',
      '/cat ',
      '/search ',
      '/active',
      '/quit',
      '/review-push',
      '/rp',
    ]

    // If we have file path completion for /cat or /send
    if (line.startsWith('/cat ') || line.startsWith('/send ')) {
      const parts = line.split(' ')
      if (parts.length >= 2) {
        const pathPrefix = parts.slice(1).join(' ')
        const fileHits = this.getFileCompletionsSync(pathPrefix)

        if (fileHits.length === 0) {
          return [[], line]
        }

        const commandPrefix = parts[0] + ' '

        // Find common prefix for auto-completion
        if (fileHits.length === 1) {
          // Single match: return complete command with file path
          return [[commandPrefix + fileHits[0]], line]
        } else {
          // Multiple matches: find common prefix
          const commonPrefix = this.findCommonPrefix(fileHits)
          if (commonPrefix && commonPrefix.length > pathPrefix.length) {
            // There's a common prefix longer than current input
            return [[commandPrefix + commonPrefix], line]
          } else {
            // No useful common prefix, return all complete commands
            return [fileHits.map((file) => commandPrefix + file), line]
          }
        }
      }
    }

    const hits = commands.filter((cmd) => cmd.startsWith(line))
    return [hits.length ? hits : commands, line]
  }

  private findCommonPrefix(strings: string[]): string {
    if (strings.length === 0) return ''
    if (strings.length === 1) return strings[0]

    let prefix = ''
    const firstString = strings[0]

    for (let i = 0; i < firstString.length; i++) {
      const char = firstString[i]
      if (strings.every((str) => str[i] === char)) {
        prefix += char
      } else {
        break
      }
    }

    return prefix
  }

  private getFileCompletionsSync(pathPrefix: string): string[] {
    // Use cached files for sync completion
    if (this.fileCache.length === 0) {
      // Fallback to basic directory listing for immediate response
      return this.getBasicFileCompletions(pathPrefix)
    }

    try {
      // Filter files: exclude .git, hidden files, and common gitignore patterns
      const visibleFiles = this.fileCache.filter((file) => {
        const path = file.relativePath

        // Exclude .git directory and hidden files (except .env.example pattern)
        if (path.startsWith('.git/') || (path.startsWith('.') && !path.match(/^\.env\.example$/))) {
          return false
        }

        // Extra safety: exclude common patterns in case they slip through FileDiscovery
        const commonIgnorePatterns = [
          'node_modules/',
          'dist/',
          'coverage/',
          '.nyc_output/',
          'build/',
          '.cache/',
          '.next/',
          '.nuxt/',
          '.serverless/',
          '.vscode-test/',
        ]

        if (commonIgnorePatterns.some((pattern) => path.startsWith(pattern))) {
          return false
        }

        return true
      })

      // For empty prefix, return some recent/relevant files
      if (!pathPrefix.trim()) {
        return visibleFiles
          .slice(0, 10)
          .map((file) => {
            try {
              if (
                fs.existsSync(file.absolutePath) &&
                fs.statSync(file.absolutePath).isDirectory()
              ) {
                return file.relativePath + '/'
              }
            } catch {
              // Ignore stat errors, treat as file
            }
            return file.relativePath
          })
          .sort()
      }

      // For prefix matching: match against full relative path OR filename
      const lowerPathPrefix = pathPrefix.toLowerCase()
      const matchingFiles = visibleFiles.filter((file) => {
        // Match against full path (for path completion like "src/cli")
        if (file.relativePath.toLowerCase().startsWith(lowerPathPrefix)) {
          return true
        }
        // Also match against filename only (for simple completion like "user")
        if (!lowerPathPrefix.includes('/') && file.name.toLowerCase().startsWith(lowerPathPrefix)) {
          return true
        }
        return false
      })

      // Sort by path length (shorter matches first), then alphabetically
      const sortedFiles = matchingFiles
        .sort((a, b) => {
          const aPathLen = a.relativePath.length
          const bPathLen = b.relativePath.length
          if (aPathLen !== bPathLen) {
            return aPathLen - bPathLen
          }
          return a.relativePath.localeCompare(b.relativePath)
        })
        .slice(0, 15)

      return sortedFiles.map((file) => {
        try {
          if (fs.existsSync(file.absolutePath) && fs.statSync(file.absolutePath).isDirectory()) {
            return file.relativePath + '/'
          }
        } catch {
          // Ignore stat errors, treat as file
        }
        return file.relativePath
      })
    } catch (error) {
      console.error('Error getting sync file completions:', error)
      return this.getBasicFileCompletions(pathPrefix)
    }
  }

  private getBasicFileCompletions(pathPrefix: string): string[] {
    try {
      const workspaceFolder = this.options.workspaceFolder || process.cwd()
      const fullPrefix = path.resolve(workspaceFolder, pathPrefix || '.')
      const dir = path.dirname(fullPrefix)
      const basename = path.basename(fullPrefix)

      if (!fs.existsSync(dir)) {
        return []
      }

      const files = fs
        .readdirSync(dir)
        .filter((file) => {
          if (file.startsWith('.')) return false // Skip hidden files
          return file.startsWith(basename)
        })
        .map((file) => {
          const fullPath = path.join(dir, file)
          const relativePath = path.relative(workspaceFolder, fullPath)
          return fs.statSync(fullPath).isDirectory() ? relativePath + '/' : relativePath
        })
        .slice(0, 10) // Limit to 10 suggestions

      return files
    } catch {
      return []
    }
  }

  private initializeFileCache(): void {
    // Initialize file cache in background
    const workspaceFolder = this.options.workspaceFolder || process.cwd()
    this.refreshFileCache(workspaceFolder).catch((error) => {
      console.error('Failed to initialize file cache:', error)
    })
  }

  private async refreshFileCache(workspaceFolder: string): Promise<void> {
    const now = Date.now()

    // Check if cache is still fresh
    if (this.fileCache.length > 0 && now - this.cacheTimestamp < this.CACHE_TTL) {
      return
    }

    try {
      // Refresh file cache
      this.fileCache = await this.fileDiscovery.scanFiles(workspaceFolder)
      this.cacheTimestamp = now
    } catch (error) {
      console.error('Error refreshing file cache:', error)
    }
  }

  private async processCommand(command: string): Promise<void> {
    const trimmed = command.trim()
    const workspaceFolder = this.options.workspaceFolder || process.cwd()

    // Note: approval handling is now done via questionInterface in handleReviewPushCommand

    // Check if command is being entered while we expected approval (edge case)
    if (this.waitingForApproval && !['y', 'n', 'yes', 'no'].includes(trimmed.toLowerCase())) {
      this.waitingForApproval = false
      console.log('📋 Approval cancelled.')
    }

    if (trimmed === '/help') {
      console.log('Available commands:')
      console.log('  /send <path> - Send file to Claude directly')
      console.log('  /browse - Browse and interact with files (recommended)')
      console.log('  /cat <path> - Display file interactively, select text to send to Claude')
      console.log('  /search <pattern> - Search code with ripgrep')
      console.log('  /active - Show active files (resources)')
      console.log('  /review-push (/rp) - Review unpushed commits and approve/reject for push')
      console.log('  /help - Show this help message')
      console.log('  /quit - Stop the server and exit')
    } else if (trimmed === '/quit') {
      console.log('Stopping IDE server...')
      this.stop()
      process.exit(0)
    } else if (trimmed === '/active') {
      this.showActiveFiles()
    } else if (trimmed.startsWith('/cat ')) {
      const filePath = trimmed.substring(5).trim()
      if (filePath) {
        await this.displayFileInteractive(path.resolve(workspaceFolder, filePath))
      } else {
        console.log('Usage: /cat <path>')
        console.log('Interactive selection mode enabled - select text to send to Claude')
      }
    } else if (trimmed.startsWith('/search ')) {
      const pattern = trimmed.substring(9).trim()
      if (pattern) {
        this.searchCode(pattern, workspaceFolder)
      } else {
        console.log('Usage: /search <pattern>')
      }
    } else if (trimmed.startsWith('/send ')) {
      const filePath = trimmed.substring(6).trim()
      if (filePath && this.connectedWS) {
        this.sendFileToClient(path.resolve(workspaceFolder, filePath))
      } else if (!this.connectedWS) {
        console.log('No Claude Code client connected')
      } else {
        console.log('Usage: /send <path>')
      }
    } else if (trimmed === '/review-push' || trimmed === '/rp') {
      await this.handleReviewPushCommand()
    } else if (trimmed.startsWith('/')) {
      console.log(`Unknown command: ${trimmed}`)
      console.log('Type /help for available commands')
    }
  }

  private async handleReviewPushCommand(): Promise<void> {
    try {
      // Completely close readline during less operation
      const wasReadlineActive = !!this.rl
      if (this.rl) {
        this.rl.close()
        this.rl = null
      }

      await this.gitReview.displayCommitReview()

      // Get current branch for prompt
      const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim()

      // Use a simple question approach without recreating full readline
      this.waitingForApproval = true

      // Create a temporary readline just for the question
      const questionInterface = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      })

      questionInterface.question(
        `\n❓ push to origin/${currentBranch}? (y/n): `,
        async (answer) => {
          questionInterface.close()

          // Process the answer
          await this.handleApprovalChoice(answer.trim())

          // Recreate the main readline interface after processing
          if (wasReadlineActive) {
            this.createReadlineInterface()
          }
        },
      )
    } catch (error) {
      console.error('❌ Failed to review commit:', error instanceof Error ? error.message : error)
      this.waitingForApproval = false

      // Make sure to recreate readline on error
      if (!this.rl) {
        this.createReadlineInterface()
      }
    }
  }

  private createReadlineInterface(): void {
    // Clear any pending input before creating new readline
    if (process.stdin.readable) {
      process.stdin.pause()
      process.stdin.resume()
    }

    // Small delay to ensure terminal state is clean
    setTimeout(() => {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        completer: this.completeCommand.bind(this),
        prompt: '> ',
      })

      this.rl.on('line', async (input) => {
        const trimmed = input.trim()

        if (trimmed) {
          await this.processCommand(trimmed)
        }

        if (this.rl && !this.waitingForApproval) {
          this.rl.prompt()
        }
      })

      this.rl.on('SIGINT', () => {
        this.stop()
        process.exit(0)
      })

      // Only show prompt if not waiting for approval
      if (!this.waitingForApproval) {
        this.rl.prompt()
      }
    }, 100)
  }

  private async handleApprovalChoice(choice: string): Promise<void> {
    this.waitingForApproval = false

    try {
      if (choice === 'y' || choice === 'yes') {
        console.log('\n🚀 Initiating push workflow...')

        // Get current branch name
        const currentBranch = execSync('git branch --show-current', {
          encoding: 'utf8',
        }).trim()

        const pushResult = await this.gitPush.autoPushFlow(currentBranch, true)

        if (pushResult.success && pushResult.pushed) {
          console.log(`\n🎉 ${pushResult.message}`)
        } else if (pushResult.success && !pushResult.pushed) {
          console.log(`\n📋 ${pushResult.message}`)
        } else {
          console.error(`\n❌ ${pushResult.message}`)
        }
      } else if (choice === 'n' || choice === 'no') {
        console.log('\n🔄 Rejecting commit and undoing...')

        try {
          // Get unpushed commit count to reset
          const unpushedCount = await this.gitReview.getUnpushedCommitCount()

          if (unpushedCount === 0) {
            console.log('⚠️  No unpushed commits to undo.')
            return
          }

          // Show current commit hash before reset
          const currentCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
          console.log(`📍 Current commit: ${currentCommit.substring(0, 8)}`)
          console.log(
            `🔄 Undoing ${unpushedCount} unpushed commit${unpushedCount > 1 ? 's' : ''}...`,
          )

          // Reset to before unpushed commits but keep changes in working directory
          const resetCommand = `git reset --soft HEAD~${unpushedCount}`
          console.log(`🔧 Executing: ${resetCommand}`)
          const resetResult = execSync(resetCommand, {
            encoding: 'utf8',
          })
          console.log(`✅ Reset soft result: ${resetResult || 'Success (no output)'}`)

          // Unstage all changes
          console.log('🔧 Executing: git reset')
          const unstageResult = execSync('git reset', {
            encoding: 'utf8',
          })
          console.log(`✅ Unstage result: ${unstageResult || 'Success (no output)'}`)

          // Show final status
          const finalCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
          console.log(`📍 Final commit: ${finalCommit.substring(0, 8)}`)

          console.log(
            `✅ ${unpushedCount} commit${unpushedCount > 1 ? 's' : ''} undone successfully`,
          )
          console.log('📝 Changes remain in working directory (unstaged)')
        } catch (error) {
          console.error('❌ Failed to undo commit:', error instanceof Error ? error.message : error)
        }
      } else {
        console.log('❌ Invalid choice. Please enter y or n.')
        console.log('📋 Approval cancelled. Use "/rp" again to retry.')
      }
    } catch (error) {
      console.error('❌ Approval process failed:', error instanceof Error ? error.message : error)
    }
  }

  private searchCode(pattern: string, workspaceFolder: string): void {
    try {
      console.log(`\n🔍 Searching for: ${pattern}`)
      try {
        execSync(`rg --color=always --heading --line-number "${pattern}"`, {
          stdio: 'inherit',
          cwd: workspaceFolder,
        })
      } catch {
        try {
          execSync(
            `grep -r -n --color=always "${pattern}" . --exclude-dir=node_modules --exclude-dir=.git`,
            {
              stdio: 'inherit',
              cwd: workspaceFolder,
            },
          )
        } catch {
          console.log('⚠️  No matches found or search tools unavailable')
          console.log(
            'Install ripgrep: brew install ripgrep (macOS) or apt install ripgrep (Ubuntu)',
          )
        }
      }
    } catch (error) {
      console.error('Error searching code:', error)
    }
  }

  private getLanguageFromExt(ext: string): string {
    const langMap: { [key: string]: string } = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.md': 'markdown',
      '.json': 'json',
      '.yml': 'yaml',
      '.yaml': 'yaml',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sh': 'bash',
    }
    return langMap[ext] || 'text'
  }

  private showActiveFiles(): void {
    console.log('\n📋 Active Files (Resources):')
    if (this.activeFiles.size === 0) {
      console.log('  No active files')
    } else {
      Array.from(this.activeFiles).forEach((file, index) => {
        const relativePath = path.relative(this.options.workspaceFolder || process.cwd(), file)
        console.log(`  ${index + 1}. ${relativePath}`)
      })
    }
    console.log(`\nTotal: ${this.activeFiles.size} file(s)`)
    console.log('Claude Code can access these files via resources API\n')
  }

  private sendFileToClient(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      const relativePath = path.relative(this.options.workspaceFolder || process.cwd(), filePath)

      // Add file to active files list
      this.activeFiles.add(filePath)

      // Send at_mentioned event to Claude Code
      if (this.connectedWS) {
        const atMentionedEvent = {
          jsonrpc: '2.0',
          method: 'at_mentioned',
          params: {
            filePath: filePath,
            // Optional: specify line range if needed
            // lineStart: 0,
            // lineEnd: content.split('\n').length - 1
          },
        }

        debugLog('MCP', 'Sending at_mentioned event', atMentionedEvent)
        logMCPMessage('SEND', atMentionedEvent)
        this.connectedWS.send(JSON.stringify(atMentionedEvent))

        // Also notify that resources have changed
        const notification = {
          jsonrpc: '2.0',
          method: 'notifications/resources/list_changed',
          params: {},
        }
        logMCPMessage('SEND', notification)
        this.connectedWS.send(JSON.stringify(notification))

        debugLog('MCP', 'Both at_mentioned event and resource notification sent')
      } else {
        console.log('❌ No WebSocket connection available')
      }

      console.log(`📤 File sent to Claude using at_mentioned event: ${relativePath}`)
      console.log(`💡 Claude should now be aware of this file`)
      console.log(`📋 Active files: ${this.activeFiles.size}`)

      // Show a preview
      const lang = this.getLanguageFromExt(path.extname(filePath))
      console.log(`\nPreview (first 200 chars):`)
      console.log(`\`\`\`${lang}`)
      console.log(content.substring(0, 200))
      if (content.length > 200) {
        console.log(`... (${content.length - 200} more characters)`)
      }
      console.log(`\`\`\`\n`)
    } catch (error) {
      console.error('Error reading file:', filePath, error)
    }
  }

  private handleOpenDiff(args: any): string {
    try {
      const { new_file_path } = args

      // No longer display individual diffs - use /review-push for comprehensive diff review
      console.log(`📝 File modified: ${new_file_path}`)
      console.log('💡 Use /review-push (/rp) to review all changes before pushing')

      return `File modification noted for ${new_file_path}`
    } catch (error) {
      console.error('Error handling openDiff:', error)
      return `Error handling file modification: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }

  // Internal MCP Server methods
  private async startInternalMcpServer(): Promise<void> {
    // Create internal MCP server for communication with standalone MCP
    this.internalMcpServer = new Server(
      {
        name: 'claude-term-internal',
        version: '0.0.1',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    )

    this.setupInternalMcpTools()

    // Start HTTP server for MCP communication
    this.internalHttpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method === 'POST' && req.url === '/mcp') {
        await this.handleInternalMcpRequest(req, res)
      } else {
        res.writeHead(404)
        res.end('Not Found')
      }
    })

    return new Promise((resolve) => {
      this.internalHttpServer.listen(this.options.internalMcpPort || 0, () => {
        const address = this.internalHttpServer.address()
        if (typeof address === 'object' && address) {
          this.internalMcpPort = address.port
          resolve()
        }
      })
    })
  }

  private setupInternalMcpTools(): void {
    if (!this.internalMcpServer) return

    // Handle tools list request
    this.internalMcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'review_push_internal',
            description: 'Internal tool for review and push workflow',
            inputSchema: {
              type: 'object',
              properties: {
                branch: {
                  type: 'string',
                  description: 'Target branch to push to (optional, defaults to current branch)',
                },
              },
              required: [],
            },
          },
          {
            name: 'git_status_internal',
            description: 'Internal tool for git status',
            inputSchema: {
              type: 'object',
              properties: {},
              required: [],
            },
          },
        ],
      }
    })

    // Handle tool call request
    this.internalMcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params

      switch (name) {
        case 'review_push_internal':
          const result = await this.executeReviewPushInternal(args)
          return {
            content: [{ type: 'text', text: result }],
          }

        case 'git_status_internal':
          const statusResult = await this.executeGitStatusInternal()
          return {
            content: [{ type: 'text', text: statusResult }],
          }

        default:
          throw new Error(`Unknown internal tool: ${name}`)
      }
    })
  }

  private async handleInternalMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
    })

    req.on('end', async () => {
      try {
        const request = JSON.parse(body)
        
        // Create a mock transport to handle the request
        const result = await this.processInternalMcpMessage(request)
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }))
      }
    })
  }

  private async processInternalMcpMessage(message: any): Promise<any> {
    if (!this.internalMcpServer) {
      throw new Error('Internal MCP server not initialized')
    }

    // Process the MCP message using the internal server
    // This is a simplified approach - in a real implementation, you'd properly handle the MCP protocol
    if (message.method === 'tools/list') {
      const handler = (this.internalMcpServer as any)._requestHandlers?.get('tools/list')
      if (handler) {
        const result = await handler(message)
        return { jsonrpc: '2.0', id: message.id, result }
      }
    } else if (message.method === 'tools/call') {
      const handler = (this.internalMcpServer as any)._requestHandlers?.get('tools/call')
      if (handler) {
        const result = await handler(message)
        return { jsonrpc: '2.0', id: message.id, result }
      }
    }

    throw new Error(`Unsupported method: ${message.method}`)
  }

  private async executeReviewPushInternal(args: any): Promise<string> {
    try {
      const targetBranch = args.branch
      console.log('\n🔍 Internal MCP request: review_push_internal')

      // Execute the same review workflow as /rp command
      // The issue is that we need to handle the readline state properly after less exits
      
      // Save current readline state
      const wasReadlineActive = !!this.rl
      if (this.rl) {
        this.rl.close()
        this.rl = null
      }

      try {
        // Check for unpushed commits
        const unpushedCount = await this.gitReview.getUnpushedCommitCount()
        
        // Get current branch for prompt
        const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim()
        const branch = targetBranch || currentBranch
        
        if (unpushedCount > 0) {
          // Show commit review (same as /rp) - this is what the user wants!
          console.log(`\n📊 Found ${unpushedCount} unpushed commit${unpushedCount > 1 ? 's' : ''} to review`)
          await this.gitReview.displayCommitReview()

          // For MCP, auto-approve after showing the review
          console.log(`\n🚀 Auto-approving push after review (MCP execution)...`)
        } else {
          console.log('✅ No unpushed commits to review.')

          // For MCP, proceed with push
          console.log(`\n🚀 Auto-pushing (MCP mode - no commits to review)...`)
        }
        
        const pushResult = await this.gitPush.autoPushFlow(branch, true)
        
        // Ensure readline is properly restored
        if (wasReadlineActive) {
          // Small delay to let terminal settle after less and push operations
          setTimeout(() => {
            this.createReadlineInterface()
          }, 200)
        }
        
        if (pushResult.success && pushResult.pushed) {
          return `✅ Push successful: ${pushResult.message}`
        } else if (pushResult.success && !pushResult.pushed) {
          return `📋 No push needed: ${pushResult.message}`
        } else {
          return `❌ Push failed: ${pushResult.message}`
        }
      } catch (error) {
        // Ensure readline is restored even on error
        if (wasReadlineActive && !this.rl) {
          setTimeout(() => {
            this.createReadlineInterface()
          }, 200)
        }
        throw error
      }
    } catch (error) {
      const errorMsg = `Failed to execute internal review-push: ${error instanceof Error ? error.message : error}`
      console.error('❌', errorMsg)
      return errorMsg
    }
  }

  private async executeGitStatusInternal(): Promise<string> {
    try {
      const workspaceFolder = this.options.workspaceFolder || process.cwd()
      
      // Get git status
      const status = execSync('git status --porcelain', { 
        cwd: workspaceFolder, 
        encoding: 'utf8' 
      })
      
      // Get unpushed commits
      const unpushedCount = await this.gitReview.getUnpushedCommitCount()
      
      // Get current branch
      const currentBranch = execSync('git branch --show-current', { 
        cwd: workspaceFolder, 
        encoding: 'utf8' 
      }).trim()

      let result = `Current branch: ${currentBranch}\n`
      result += `Unpushed commits: ${unpushedCount}\n\n`
      
      if (status.trim()) {
        result += 'Working directory changes:\n'
        result += status
      } else {
        result += 'Working directory clean'
      }

      return result
    } catch (error) {
      return `Error getting git status: ${error instanceof Error ? error.message : error}`
    }
  }



  async stop(): Promise<void> {
    if (this.rl) {
      this.rl.close()
      this.rl = null
    }

    if (this.server) {
      this.server.close()
    }

    if (this.internalHttpServer) {
      this.internalHttpServer.close()
    }

    // Clean up lock file
    if (this.lockFilePath && fs.existsSync(this.lockFilePath)) {
      fs.unlinkSync(this.lockFilePath)
      console.log(`Lock file removed: ${this.lockFilePath}`)
    }
  }

  // Interactive file selection methods
  private async displayFileInteractive(filePath: string): Promise<void> {
    try {
      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`)
        return
      }

      const content = fs.readFileSync(filePath, 'utf8')

      console.log(`\n📄 Interactive File Selector: ${path.basename(filePath)}`)
      console.log('📝 Instructions:')
      console.log('  • Use ↑↓ arrows or j/k to navigate')
      console.log('  • Press Tab to select multiple lines')
      console.log('  • Press Enter to send selected lines to Claude')
      console.log('  • Press Esc to cancel\n')

      await this.selectLinesWithFzf(filePath, content)
    } catch (error) {
      console.error('Error in interactive file display:', error)
    }
  }

  private async selectLinesWithFzf(filePath: string, content: string): Promise<void> {
    try {
      const lines = content.split('\n')

      // Create temporary file with numbered lines for fzf
      const tmpDir = os.tmpdir()
      const tmpFile = path.join(tmpDir, `claude-term-lines-${randomUUID()}.txt`)

      // Format lines with line numbers
      const numberedLines = lines
        .map((line, index) => `${(index + 1).toString().padStart(4, ' ')}: ${line}`)
        .join('\n')

      fs.writeFileSync(tmpFile, numberedLines)

      // Use fzf for line selection - simple and reliable
      const fzfCommand = `cat "${tmpFile}" | fzf \\
        --multi \\
        --reverse \\
        --height=80% \\
        --border \\
        --header="Select lines with Tab, press Enter to send to Claude" \\
        --prompt="Lines> "`

      console.log('🔍 Opening fzf line selector...')
      console.log('💡 Select lines with Tab, press Enter to send to Claude')

      const selectedLines = execSync(fzfCommand, {
        encoding: 'utf8',
        stdio: ['inherit', 'pipe', 'inherit'],
      }).trim()

      // Clean up temp files
      fs.unlinkSync(tmpFile)

      if (selectedLines) {
        await this.processFzfSelection(filePath, content, selectedLines)
      } else {
        console.log('❌ No lines selected')
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Command failed')) {
        console.log('❌ Selection cancelled or fzf not available')
        console.log('💡 Install fzf: brew install fzf (macOS) or apt install fzf (Ubuntu)')
      } else {
        console.error('Error in fzf selection:', error)
      }
    }
  }

  private async processFzfSelection(
    filePath: string,
    content: string,
    selectedLines: string,
  ): Promise<void> {
    try {
      const lines = content.split('\n')
      const selections = selectedLines.split('\n')

      // Extract line numbers from fzf output
      const lineNumbers = selections
        .map((line) => {
          const match = line.match(/^\s*(\d+):/)
          return match ? parseInt(match[1]) - 1 : -1 // Convert to 0-based
        })
        .filter((num) => num >= 0)

      if (lineNumbers.length === 0) {
        console.log('❌ No valid lines selected')
        return
      }

      // Sort line numbers
      lineNumbers.sort((a, b) => a - b)

      // Get selected text
      const selectedText = lineNumbers.map((lineNum) => lines[lineNum]).join('\n')
      const startLine = lineNumbers[0]
      const endLine = lineNumbers[lineNumbers.length - 1]

      if (!this.connectedWS) {
        console.error('❌ No Claude Code connection available')
        return
      }

      // Send selection_changed event to Claude Code
      const selectionMessage = {
        jsonrpc: '2.0',
        method: 'selection_changed',
        params: {
          filePath: filePath,
          selection: {
            start: { line: startLine, character: 0 },
            end: { line: endLine, character: lines[endLine]?.length || 0 },
          },
          text: content,
          selectedText: selectedText,
        },
      }

      console.log(`\n📤 Sending selection to Claude Code:`)
      console.log(
        `📄 File: ${path.relative(this.options.workspaceFolder || process.cwd(), filePath)}`,
      )
      console.log(`📍 Lines: ${startLine + 1}-${endLine + 1}`)
      console.log(`📝 Selected text (${selectedText.length} chars):`)
      console.log(selectedText.substring(0, 200) + (selectedText.length > 200 ? '...' : ''))

      logMCPMessage('SEND', selectionMessage)
      this.connectedWS.send(JSON.stringify(selectionMessage))
      console.log(`\n✅ Selection sent to Claude Code!`)
    } catch (error) {
      console.error('Error processing fzf selection:', error)
    }
  }
}

// Helper function to check if a process is still running
function isProcessRunning(pid: number): boolean {
  try {
    // Signal 0 doesn't kill the process, just checks if it exists
    process.kill(pid, 0)
    return true
  } catch (error) {
    return false
  }
}

export async function startIDEServer(options: IDEServerOptions): Promise<number> {
  // Check if an IDE with the same name already exists
  const ideName = options.ideName || 'claude-term'
  const ideDir = path.join(os.homedir(), '.claude', 'ide')

  if (fs.existsSync(ideDir)) {
    const lockFiles = fs.readdirSync(ideDir).filter((f) => f.endsWith('.lock'))
    for (const lockFile of lockFiles) {
      try {
        const lockPath = path.join(ideDir, lockFile)
        const lockData = JSON.parse(fs.readFileSync(lockPath, 'utf8'))

        if (lockData.ideName === ideName) {
          const port = parseInt(lockFile.replace('.lock', ''))
          
          // Check if the process is actually still running
          if (isProcessRunning(lockData.pid)) {
            console.log(`⚠️  IDE server "${ideName}" is already running on port ${port}`)
            console.log(`📁 Workspace: ${lockData.workspaceFolders?.[0] || 'unknown'}`)
            
            if (options.noWait) {
              // When called from dual-server startup, return the existing port
              console.log('📌 Using existing IDE server for MCP integration')
              return port
            } else {
              console.log('\nOptions:')
              console.log('1. Use the existing session in Claude with /ide')
              console.log('2. Stop this and run: claude-term ide --name <different-name>')
              console.log(`3. Remove lock file: rm ${lockPath}`)
              process.exit(0)
            }
          } else {
            // Process is dead, remove stale lock file
            console.log(`🧹 Removing stale lock file for dead process (PID: ${lockData.pid})`)
            fs.unlinkSync(lockPath)
          }
        }
      } catch {
        // Ignore invalid lock files
      }
    }
  }

  const server = new ClaudeTermIDEServer(options)

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down IDE server...')
    await server.stop()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  process.on('SIGHUP', shutdown)
  
  // Handle uncaught exceptions to ensure cleanup
  process.on('uncaughtException', async (error) => {
    console.error('❌ Uncaught exception:', error)
    await server.stop()
    process.exit(1)
  })
  
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('❌ Unhandled rejection at:', promise, 'reason:', reason)
    await server.stop()
    process.exit(1)
  })

  try {
    const port = await server.start()
    
    // If this function is called with noWait flag, return the port without logging
    if (options.noWait) {
      return port
    }
    
    const workspace = options.workspaceFolder || process.cwd()
    const name = ideName

    console.log('🚀 claude-term IDE server started')
    console.log(`📦 IDE Name: ${name}`)
    console.log(`📁 Workspace: ${workspace}`)
    console.log(`🔌 Port: ${port}`)
    console.log('\n📋 Next steps:')
    console.log('1. In Claude, run: /ide')
    console.log(`2. Select: ${name}`)
    console.log('3. Start coding!\n')
    console.log('Waiting for connection...')

    // Keep the process alive
    await new Promise(() => {}) // Never resolves
    return port // This line will never be reached, but satisfies TypeScript
  } catch (error) {
    console.error('Failed to start IDE server:', error)
    process.exit(1)
  }
}
