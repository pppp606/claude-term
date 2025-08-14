// ide-server.ts - Minimal IDE server for Claude Code connection

import { WebSocketServer, WebSocket } from 'ws'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { randomUUID } from 'crypto'
import { execSync } from 'child_process'
import * as readline from 'readline'
import { PromptSender } from './prompt-sender.js'
import { TemplateManager } from './template-manager.js'

export interface IDEServerOptions {
  port?: number
  workspaceFolder?: string
  ideName?: string
}

export class ClaudeTermIDEServer {
  private server: WebSocketServer | null = null
  private port: number = 0
  private lockFilePath: string = ''
  private authToken: string = ''
  private connectedWS: WebSocket | null = null
  private rl: readline.Interface | null = null
  private promptSender: PromptSender | null = null
  private templateManager: TemplateManager

  constructor(private options: IDEServerOptions = {}) {
    this.authToken = randomUUID()
    this.templateManager = new TemplateManager()
  }

  async start(): Promise<number> {
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

          // Create lock file
          this.createLockFile()

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
    this.promptSender = new PromptSender(ws)
    this.setupPromptHandlers()

    // Start interactive session
    this.startInteractiveSession()

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString())

        // Log received messages (can be disabled in production)
        if (process.env.CLAUDE_TERM_DEBUG) {
          console.log('\n🔍 DEBUG: Received from Claude Code:')
          console.log(JSON.stringify(message, null, 2))
        }

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
          this.handleToolCall(ws, message)
        } else if (message.method?.startsWith('resources/')) {
          this.handleResourceCall(ws, message)
        } else if (message.method === 'claude/promptResponse' || message.method === 'claude/sendPrompt') {
          // Handle prompt responses
          if (this.promptSender) {
            this.promptSender.handleResponse(message as any)
          }
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
    })

    ws.on('error', (error) => {
      console.error('🔥 WebSocket error:', error)
    })
  }

  private setupPromptHandlers(): void {
    if (!this.promptSender) return

    this.promptSender.on('promptResponse', (result) => {
      console.log('\n✨ Claude responded:')
      console.log(result.response)
      if (result.conversationId) {
        console.log(`\n🔗 Conversation ID: ${result.conversationId}`)
      }
      console.log('')
    })

    this.promptSender.on('promptError', (error) => {
      console.error('\n❌ Error from Claude:')
      console.error(`${error.message} (Code: ${error.code})`)
      console.log('')
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
            name: 'openDiff',
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
            name: 'closeAllDiffTabs',
            description: 'Close all diff tabs',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      },
    }

    ws.send(JSON.stringify(response))
    console.log('📋 Sent tools list to Claude Code')
  }

  private handleToolCall(ws: WebSocket, message: any): void {
    const method = message.method
    const params = message.params || {}

    try {
      let result: any

      if (method === 'tools/call' && params.name === 'openDiff') {
        // Handle Claude Code's openDiff tool call
        result = this.handleOpenDiff(params.arguments)
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

    // Show diff if file exists
    if (fs.existsSync(fullPath)) {
      try {
        const originalContent = fs.readFileSync(fullPath, 'utf8')
        this.displayDiff(filePath, originalContent, newContent)
      } catch (error) {
        console.error('Error reading original file for diff:', error)
      }
    } else {
      console.log(`\n📝 Creating new file: ${filePath}`)
    }

    fs.writeFileSync(fullPath, newContent)
    return `File written successfully: ${filePath}`
  }

  private displayDiff(filePath: string, originalContent: string, newContent: string): void {
    console.log(`\n📝 Changes to: ${filePath}`)

    try {
      // Create temporary files for diff with proper extensions for syntax highlighting
      const tmpDir = os.tmpdir()
      const fileExt = path.extname(filePath) || '.txt'
      const originalFile = path.join(tmpDir, `claude-term-original-${randomUUID()}${fileExt}`)
      const modifiedFile = path.join(tmpDir, `claude-term-modified-${randomUUID()}${fileExt}`)

      fs.writeFileSync(originalFile, originalContent)
      fs.writeFileSync(modifiedFile, newContent)

      // Check if delta is available
      let hasDelta = false
      try {
        execSync('command -v delta', { stdio: 'ignore' })
        hasDelta = true
      } catch {}

      if (hasDelta) {
        // Use delta (ignore exit code as it returns 1 for differences)
        try {
          execSync(
            `delta --pager=never --syntax-theme=Dracula --no-gitconfig --file-style=omit --hunk-header-style=omit --keep-plus-minus-markers "${originalFile}" "${modifiedFile}"`,
            {
              stdio: 'inherit',
            },
          )
        } catch {
          // Delta executed but returned non-zero exit code (normal for diffs)
        }
      } else {
        // Fall back to system diff
        try {
          execSync(`diff -u "${originalFile}" "${modifiedFile}"`, {
            stdio: 'inherit',
          })
        } catch {
          // diff also returns non-zero for differences, which is normal
        }
      }

      // Clean up temp files
      fs.unlinkSync(originalFile)
      fs.unlinkSync(modifiedFile)
    } catch (error) {
      console.error('Error creating diff:', error)
    }

    console.log('')
  }

  private startInteractiveSession(): void {
    console.log('\n🔄 Interactive IDE server session started')
    console.log('Type /help for available commands')
    console.log('Waiting for Claude Code requests...\n')

    // Create readline interface with tab completion
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
      '/prompt ',
      '/ask ',
      '/context ',
      '/template ',
      '/templates',
      '/send ',
      '/browse',
      '/cat ',
      '/search ',
      '/active',
      '/quit',
    ]

    const hits = commands.filter((cmd) => cmd.startsWith(line))

    // If we have file path completion for /cat or /send
    if (line.startsWith('/cat ') || line.startsWith('/send ')) {
      const parts = line.split(' ')
      if (parts.length >= 2) {
        const pathPrefix = parts.slice(1).join(' ')
        const fileHits = this.getFileCompletions(pathPrefix)
        const prefix = parts[0] + ' '
        return [fileHits.map((f) => prefix + f), line]
      }
    }

    return [hits.length ? hits : commands, line]
  }

  private getFileCompletions(pathPrefix: string): string[] {
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

  private async processCommand(command: string): Promise<void> {
    const trimmed = command.trim()
    const workspaceFolder = this.options.workspaceFolder || process.cwd()

    if (trimmed === '/help') {
      console.log('Available commands:')
      console.log('  /prompt <message> - Send prompt/message to Claude')
      console.log('  /ask <message> - Alias for /prompt')
      console.log('  /context <files...> <message> - Send prompt with file context')
      console.log('  /template <name> [params...] - Use a predefined template')
      console.log('  /templates - List available templates')
      console.log('  /send <path> - Send file to Claude directly')
      console.log('  /browse - Browse and interact with files (recommended)')
      console.log('  /cat <path> - Display file interactively, select text to send to Claude')
      console.log('  /search <pattern> - Search code with ripgrep')
      console.log('  /active - Show active files (resources)')
      console.log('  /help - Show this help message')
      console.log('  /quit - Stop the server and exit')
    } else if (trimmed === '/quit') {
      console.log('Stopping IDE server...')
      this.stop()
      process.exit(0)
    } else if (trimmed === '/active') {
      this.showActiveFiles()
    } else if (trimmed === '/browse') {
      await this.browseFiles(workspaceFolder)
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
    } else if (trimmed.startsWith('/prompt ') || trimmed.startsWith('/ask ')) {
      const message = trimmed.startsWith('/prompt ') 
        ? trimmed.substring(8).trim() 
        : trimmed.substring(5).trim()
      if (message) {
        this.sendPrompt(message)
      } else {
        console.log('Usage: /prompt <message> or /ask <message>')
      }
    } else if (trimmed.startsWith('/context ')) {
      this.handleContextCommand(trimmed.substring(9).trim())
    } else if (trimmed.startsWith('/template ')) {
      this.handleTemplateCommand(trimmed.substring(10).trim())
    } else if (trimmed === '/templates') {
      this.listTemplates()
    } else if (trimmed.startsWith('/')) {
      console.log(`Unknown command: ${trimmed}`)
      console.log('Type /help for available commands')
    }
  }

  private async browseFiles(workspaceFolder: string): Promise<void> {
    try {
      console.log('\n📁 Browsing files with fzf...')
      const selectedFile = execSync(
        'find . -type f -not -path "./node_modules/*" -not -path "./.git/*" | fzf --preview="bat --color=always --style=header,grid --line-range :300 {}"',
        {
          encoding: 'utf8',
          stdio: ['inherit', 'pipe', 'inherit'],
          cwd: workspaceFolder,
        },
      ).trim()

      if (selectedFile) {
        console.log(`\n📋 Selected: ${selectedFile}`)
        console.log('Choose action:')
        console.log('1) View file (/cat)')
        console.log('2) Send to Claude (/send)')
        console.log('3) Cancel')

        // Get user choice using readline
        const choice = await this.promptUser('Enter choice (1-3): ')

        const fullPath = path.resolve(workspaceFolder, selectedFile)
        switch (choice) {
          case '1':
            await this.displayFileInteractive(fullPath)
            break
          case '2':
            if (this.connectedWS) {
              this.sendFileToClient(fullPath)
            } else {
              console.log('No Claude Code client connected')
            }
            break
          case '3':
          default:
            console.log('Cancelled')
            break
        }
      }
    } catch (error) {
      console.log('⚠️  fzf not available or no file selected')
      console.log('Install fzf: brew install fzf (macOS) or apt install fzf (Ubuntu)')
    }
  }

  private promptUser(question: string): Promise<string> {
    return new Promise((resolve) => {
      if (this.rl) {
        this.rl.question(question, (answer) => {
          resolve(answer.trim())
        })
      }
    })
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

        if (process.env.CLAUDE_TERM_DEBUG) {
          console.log('🔍 DEBUG: Sending at_mentioned event:')
          console.log(JSON.stringify(atMentionedEvent, null, 2))
        }

        this.connectedWS.send(JSON.stringify(atMentionedEvent))

        // Also notify that resources have changed
        const notification = {
          jsonrpc: '2.0',
          method: 'notifications/resources/list_changed',
          params: {},
        }
        this.connectedWS.send(JSON.stringify(notification))

        if (process.env.CLAUDE_TERM_DEBUG) {
          console.log('✅ Both at_mentioned event and resource notification sent')
        }
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
      const { old_file_path, new_file_path, new_file_contents } = args

      // Read the current file content
      let originalContent = ''
      if (fs.existsSync(old_file_path)) {
        originalContent = fs.readFileSync(old_file_path, 'utf8')
      }

      // Display the diff
      this.displayDiff(new_file_path, originalContent, new_file_contents)

      return `Diff displayed for ${new_file_path}`
    } catch (error) {
      console.error('Error handling openDiff:', error)
      return `Error displaying diff: ${error instanceof Error ? error.message : 'Unknown error'}`
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

    // Clean up lock file
    if (this.lockFilePath && fs.existsSync(this.lockFilePath)) {
      fs.unlinkSync(this.lockFilePath)
      console.log(`Lock file removed: ${this.lockFilePath}`)
    }
  }
  // New prompt sending methods
  private sendPrompt(message: string): void {
    try {
      if (!this.promptSender) {
        console.log('❌ Prompt sender not initialized')
        return
      }
      console.log(`\n📤 Sending prompt to Claude: "${message}"`)
      this.promptSender.sendPrompt(message)
    } catch (error) {
      console.error('Error sending prompt:', error)
    }
  }

  private handleContextCommand(args: string): void {
    const parts = args.split(' ')
    if (parts.length < 2) {
      console.log('Usage: /context <files...> <message>')
      console.log('Example: /context src/main.ts src/utils.ts Please review these files')
      return
    }

    // Find where the message starts (look for the first non-file-like argument)
    let messageStartIndex = -1
    for (let i = 0; i < parts.length; i++) {
      if (!parts[i].includes('.') && !parts[i].startsWith('./') && !parts[i].startsWith('/')) {
        messageStartIndex = i
        break
      }
    }

    if (messageStartIndex === -1) {
      messageStartIndex = parts.length - 1
    }

    const filePaths = parts.slice(0, messageStartIndex)
    const message = parts.slice(messageStartIndex).join(' ')

    if (filePaths.length === 0 || !message) {
      console.log('Usage: /context <files...> <message>')
      return
    }

    try {
      if (!this.promptSender) {
        console.log('❌ Prompt sender not initialized')
        return
      }
      console.log(`\n📤 Sending prompt with context: "${message}"`)
      console.log(`📁 Including files: ${filePaths.join(', ')}`)
      
      const context = this.promptSender.gatherFileContext(filePaths)
      this.promptSender.sendPrompt(message, context)
    } catch (error) {
      console.error('Error sending contextual prompt:', error)
    }
  }

  private handleTemplateCommand(args: string): void {
    const parts = args.split(' ')
    if (parts.length === 0) {
      console.log('Usage: /template <name> [param1=value1] [param2=value2]')
      console.log('Use /templates to list available templates')
      return
    }

    const templateName = parts[0]
    
    if (parts.length === 1) {
      const usage = this.templateManager.getTemplateUsage(templateName)
      if (usage) {
        console.log(usage)
      } else {
        console.log(`Template '${templateName}' not found. Use /templates to list available templates.`)
      }
      return
    }

    const template = this.templateManager.getTemplate(templateName)
    if (!template) {
      console.log(`Template '${templateName}' not found. Use /templates to list available templates.`)
      return
    }

    const parameters: Record<string, string> = {}
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i]
      if (part.includes('=')) {
        const [key, ...valueParts] = part.split('=')
        parameters[key] = valueParts.join('=')
      } else {
        const paramNames = template.parameters || []
        const paramIndex = i - 1
        if (paramIndex < paramNames.length) {
          parameters[paramNames[paramIndex]] = part
        }
      }
    }

    try {
      if (!this.promptSender) {
        console.log('❌ Prompt sender not initialized')
        return
      }
      const promptMessage = this.templateManager.substituteParameters(template, parameters)
      console.log(`\n📋 Using template: ${templateName}`)
      console.log(`📤 Generated prompt: "${promptMessage.substring(0, 100)}${promptMessage.length > 100 ? '...' : ''}"`)
      
      this.promptSender.sendPrompt(promptMessage, undefined, templateName)
    } catch (error) {
      console.error('Error using template:', error)
    }
  }

  private listTemplates(): void {
    const templates = this.templateManager.listTemplates()
    
    if (templates.length === 0) {
      console.log('No templates found. Templates should be placed in docs/prompt-templates/')
      return
    }

    console.log('\nAvailable templates:')
    for (const template of templates) {
      console.log(`  ${template.name} - ${template.description}`)
      if (template.parameters && template.parameters.length > 0) {
        console.log(`    Parameters: {${template.parameters.join('}, {')})}`)
      }
    }
    console.log('\nUsage: /template <name> [params...] or /template <name> for details')
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
      const numberedLines = lines.map((line, index) => 
        `${(index + 1).toString().padStart(4, ' ')}: ${line}`
      ).join('\n')
      
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

  private async processFzfSelection(filePath: string, content: string, selectedLines: string): Promise<void> {
    try {
      const lines = content.split('\n')
      const selections = selectedLines.split('\n')
      
      // Extract line numbers from fzf output
      const lineNumbers = selections.map(line => {
        const match = line.match(/^\s*(\d+):/)
        return match ? parseInt(match[1]) - 1 : -1 // Convert to 0-based
      }).filter(num => num >= 0)

      if (lineNumbers.length === 0) {
        console.log('❌ No valid lines selected')
        return
      }

      // Sort line numbers
      lineNumbers.sort((a, b) => a - b)

      // Get selected text
      const selectedText = lineNumbers.map(lineNum => lines[lineNum]).join('\n')
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
            end: { line: endLine, character: lines[endLine]?.length || 0 }
          },
          text: content,
          selectedText: selectedText
        }
      }

      console.log(`\n📤 Sending selection to Claude Code:`)
      console.log(`📄 File: ${path.relative(this.options.workspaceFolder || process.cwd(), filePath)}`)
      console.log(`📍 Lines: ${startLine + 1}-${endLine + 1}`)
      console.log(`📝 Selected text (${selectedText.length} chars):`)
      console.log(selectedText.substring(0, 200) + (selectedText.length > 200 ? '...' : ''))

      this.connectedWS.send(JSON.stringify(selectionMessage))
      console.log(`\n✅ Selection sent to Claude Code!`)

    } catch (error) {
      console.error('Error processing fzf selection:', error)
    }
  }
}

export async function startIDEServer(options: IDEServerOptions): Promise<void> {
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
          console.log(`⚠️  IDE server "${ideName}" is already running on port ${port}`)
          console.log(`📁 Workspace: ${lockData.workspaceFolders?.[0] || 'unknown'}`)
          console.log('\nOptions:')
          console.log('1. Use the existing session in Claude with /ide')
          console.log('2. Stop this and run: claude-term ide --name <different-name>')
          console.log(`3. Remove lock file: rm ${lockPath}`)
          process.exit(0)
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

  try {
    const port = await server.start()
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
  } catch (error) {
    console.error('Failed to start IDE server:', error)
    process.exit(1)
  }
}
