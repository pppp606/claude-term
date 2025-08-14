import WebSocket from 'ws'
import { EventEmitter } from 'events'
import fs from 'fs'
import { randomUUID } from 'crypto'
import { execSync } from 'child_process'
import path from 'path'
import os from 'os'
import { PromptSender } from './prompt-sender.js'
import { PromptResponse } from './types/prompt-types.js'
import { TemplateManager } from './template-manager.js'

export interface DiffProposal {
  filePath: string
  originalContent: string
  modifiedContent: string
  unified: string
}

export interface MCPMessage {
  jsonrpc: string
  method: string
  id: string
  params?: any
}

export class InteractiveSession extends EventEmitter {
  private ws: WebSocket
  private promptSender: PromptSender
  private templateManager: TemplateManager

  constructor(websocket: WebSocket) {
    super()
    this.ws = websocket
    this.promptSender = new PromptSender(websocket)
    this.templateManager = new TemplateManager()
    this.setupWebSocketHandlers()
    this.setupPromptHandlers()
  }

  private setupWebSocketHandlers(): void {
    this.ws.on('message', (data: Buffer) => {
      try {
        const message: MCPMessage = JSON.parse(data.toString())
        console.log('\n🔍 DEBUG: Received message from Claude Code:')
        console.log(JSON.stringify(message, null, 2))
        this.handleMCPMessage(message)
      } catch (error) {
        console.error('Error parsing message:', error)
      }
    })

    this.ws.on('close', () => {
      console.log('Connection closed')
      this.emit('close')
    })

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error)
      this.emit('error', error)
    })
  }

  private setupPromptHandlers(): void {
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

  private handleMCPMessage(message: MCPMessage): void {
    if (message.method === 'claude/provideEdits') {
      this.handleProvideEdits(message)
    } else if (message.method === 'claude/promptResponse' || message.method === 'claude/sendPrompt') {
      // Handle prompt responses
      const response = message as unknown as PromptResponse
      this.promptSender.handleResponse(response)
    }
    // Ignore other methods for now
  }

  private handleProvideEdits(message: MCPMessage): void {
    if (message.params && message.params.edits) {
      for (const edit of message.params.edits) {
        const diffProposal: DiffProposal = {
          filePath: edit.filePath,
          originalContent: edit.originalContent,
          modifiedContent: edit.modifiedContent,
          unified: edit.unified,
        }

        this.displayDiff(diffProposal)
        this.emit('diffProposal', diffProposal)
      }
    }
  }

  public displayDiff(diff: DiffProposal): void {
    console.log(`\n📝 Diff proposal for: ${diff.filePath}`)

    try {
      // Create temporary files for original and modified content
      const tmpDir = os.tmpdir()
      const originalFile = path.join(tmpDir, `claude-term-original-${randomUUID()}`)
      const modifiedFile = path.join(tmpDir, `claude-term-modified-${randomUUID()}`)

      fs.writeFileSync(originalFile, diff.originalContent)
      fs.writeFileSync(modifiedFile, diff.modifiedContent)

      // Try to use delta first, fall back to diff
      try {
        const deltaOutput = execSync(`delta "${originalFile}" "${modifiedFile}"`, {
          encoding: 'utf8',
        })
        console.log(deltaOutput)
      } catch (deltaError) {
        // Delta not available, try diff with unified format
        try {
          const diffOutput = execSync(`diff -u "${originalFile}" "${modifiedFile}"`, {
            encoding: 'utf8',
          })
          console.log(diffOutput)
        } catch (diffError) {
          // Both delta and diff failed, fall back to simple unified diff display
          console.log('⚠️  External diff tools not available, showing basic diff:')
          console.log(diff.unified)
        }
      }

      // Clean up temporary files
      fs.unlinkSync(originalFile)
      fs.unlinkSync(modifiedFile)
    } catch (error) {
      console.error('Error creating diff display:', error)
      console.log('Falling back to basic diff:')
      console.log(diff.unified)
    }

    console.log('')
  }

  public sendPrompt(message: string): void {
    try {
      console.log(`\n📤 Sending prompt to Claude: "${message}"`)
      this.promptSender.sendPrompt(message)
    } catch (error) {
      console.error('Error sending prompt:', error)
    }
  }

  public handleContextCommand(args: string): void {
    // Parse arguments: files come first, message is the last part
    const parts = args.split(' ')
    if (parts.length < 2) {
      console.log('Usage: /context <files...> <message>')
      console.log('Example: /context src/main.ts src/utils.ts Please review these files')
      return
    }

    // Find where the message starts (look for the first non-file-like argument)
    let messageStartIndex = -1
    for (let i = 0; i < parts.length; i++) {
      // If the part doesn't look like a file path, consider it the start of the message
      if (!parts[i].includes('.') && !parts[i].startsWith('./') && !parts[i].startsWith('/')) {
        messageStartIndex = i
        break
      }
    }

    if (messageStartIndex === -1) {
      // If we can't find a clear message start, assume the last part is the message
      messageStartIndex = parts.length - 1
    }

    const filePaths = parts.slice(0, messageStartIndex)
    const message = parts.slice(messageStartIndex).join(' ')

    if (filePaths.length === 0 || !message) {
      console.log('Usage: /context <files...> <message>')
      return
    }

    try {
      console.log(`\n📤 Sending prompt with context: "${message}"`)
      console.log(`📁 Including files: ${filePaths.join(', ')}`)
      
      const context = this.promptSender.gatherFileContext(filePaths)
      this.promptSender.sendPrompt(message, context)
    } catch (error) {
      console.error('Error sending contextual prompt:', error)
    }
  }

  public handleTemplateCommand(args: string): void {
    const parts = args.split(' ')
    if (parts.length === 0) {
      console.log('Usage: /template <name> [param1=value1] [param2=value2]')
      console.log('Use /templates to list available templates')
      return
    }

    const templateName = parts[0]
    
    // Show template info if just the name is provided
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

    // Parse parameters (format: param1=value1 param2=value2)
    const parameters: Record<string, string> = {}
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i]
      if (part.includes('=')) {
        const [key, ...valueParts] = part.split('=')
        parameters[key] = valueParts.join('=') // Handle values with '=' in them
      } else {
        // If no '=' found, treat as a positional parameter
        const paramNames = template.parameters || []
        const paramIndex = i - 1
        if (paramIndex < paramNames.length) {
          parameters[paramNames[paramIndex]] = part
        }
      }
    }

    try {
      const promptMessage = this.templateManager.substituteParameters(template, parameters)
      console.log(`\n📋 Using template: ${templateName}`)
      console.log(`📤 Generated prompt: "${promptMessage.substring(0, 100)}${promptMessage.length > 100 ? '...' : ''}"`)
      
      this.promptSender.sendPrompt(promptMessage, undefined, templateName)
    } catch (error) {
      console.error('Error using template:', error)
    }
  }

  public listTemplates(): void {
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

  public async sendFile(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf8')

      const message = {
        jsonrpc: '2.0',
        method: 'claude/receiveFile',
        id: randomUUID(),
        params: {
          filePath,
          content,
        },
      }

      this.ws.send(JSON.stringify(message))
    } catch (error) {
      console.error('Error reading file:', filePath, error)
    }
  }

  public processCommand(command: string): void {
    const trimmed = command.trim()

    if (trimmed === '/help') {
      console.log('Available commands:')
      console.log('  /prompt <message> - Send prompt/message to Claude')
      console.log('  /ask <message> - Alias for /prompt')
      console.log('  /context <files...> <message> - Send prompt with file context')
      console.log('  /template <name> [params...] - Use a predefined template')
      console.log('  /templates - List available templates')
      console.log('  /send <path> - Send file content to Claude')
      console.log('  /browse - Browse files with fzf (interactive file picker)')
      console.log('  /cat <path> - Display file with syntax highlighting (bat)')
      console.log('  /search <pattern> - Search code with ripgrep')
      console.log('  /help - Show this help message')
      console.log('  /quit - Exit the session')
    } else if (trimmed === '/quit') {
      this.emit('quit')
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
    } else if (trimmed.startsWith('/send ')) {
      const filePath = trimmed.substring(6).trim()
      if (filePath) {
        this.sendFile(filePath)
      } else {
        console.log('Usage: /send <path>')
      }
    } else if (trimmed === '/browse') {
      this.browseFiles()
    } else if (trimmed.startsWith('/cat ')) {
      const filePath = trimmed.substring(5).trim()
      if (filePath) {
        this.displayFile(filePath)
      } else {
        console.log('Usage: /cat <path>')
      }
    } else if (trimmed.startsWith('/search ')) {
      const pattern = trimmed.substring(8).trim()
      if (pattern) {
        this.searchCode(pattern)
      } else {
        console.log('Usage: /search <pattern>')
      }
    } else if (trimmed.startsWith('/')) {
      console.log(`Unknown command: ${trimmed}`)
      console.log('Type /help for available commands')
    }
    // Ignore non-command input for now
  }

  public browseFiles(): void {
    try {
      console.log('\n📁 Browsing files with fzf...')
      const selectedFile = execSync(
        'find . -type f -not -path "./node_modules/*" -not -path "./.git/*" | fzf --preview="bat --color=always --style=header,grid --line-range :300 {}"',
        {
          encoding: 'utf8',
          stdio: 'inherit',
        },
      ).trim()

      if (selectedFile) {
        console.log(`\n📋 Selected: ${selectedFile}`)
        console.log('Available actions:')
        console.log(`  :send ${selectedFile}`)
        console.log(`  :cat ${selectedFile}`)
      }
    } catch (error) {
      console.log('⚠️  fzf not available or no file selected')
      console.log('Install fzf: brew install fzf (macOS) or apt install fzf (Ubuntu)')
    }
  }

  public displayFile(filePath: string): void {
    try {
      console.log(`\n📄 Displaying: ${filePath}`)
      // Try bat first for syntax highlighting
      try {
        execSync(`bat --color=always --style=header,grid,numbers "${filePath}"`, {
          stdio: 'inherit',
        })
      } catch {
        // Fall back to cat if bat is not available
        try {
          execSync(`cat "${filePath}"`, { stdio: 'inherit' })
        } catch {
          console.error(`Cannot read file: ${filePath}`)
        }
      }
    } catch (error) {
      console.error('Error displaying file:', error)
    }
  }

  public searchCode(pattern: string): void {
    try {
      console.log(`\n🔍 Searching for: ${pattern}`)
      // Try ripgrep first
      try {
        execSync(`rg --color=always --heading --line-number "${pattern}"`, {
          stdio: 'inherit',
          cwd: process.cwd(),
        })
      } catch {
        // Fall back to grep if rg is not available
        try {
          execSync(
            `grep -r -n --color=always "${pattern}" . --exclude-dir=node_modules --exclude-dir=.git`,
            {
              stdio: 'inherit',
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

  public close(): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.close()
    }
  }

  public startEventLoop(): void {
    console.log('\n🔄 Interactive session started')
    console.log('Type /help for available commands')
    console.log('Waiting for events from Claude Code...\n')

    // Set up stdin for interactive commands
    if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
      process.stdin.setRawMode(false)
    }
    process.stdin.setEncoding('utf8')
    process.stdin.resume()

    let inputBuffer = ''

    process.stdin.on('data', (chunk) => {
      const input = chunk.toString()

      if (input === '\n' || input === '\r\n') {
        if (inputBuffer.trim()) {
          this.processCommand(inputBuffer.trim())
          inputBuffer = ''
        }
        process.stdout.write('> ')
      } else if (input === '\u0003') {
        // Ctrl+C
        this.emit('quit')
      } else {
        inputBuffer += input
        process.stdout.write(input)
      }
    })

    // Show initial prompt
    process.stdout.write('> ')
  }
}
