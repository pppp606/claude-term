import WebSocket from 'ws'
import { EventEmitter } from 'events'
import fs from 'fs'
import { randomUUID } from 'crypto'

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

  constructor(websocket: WebSocket) {
    super()
    this.ws = websocket
    this.setupWebSocketHandlers()
  }

  private setupWebSocketHandlers(): void {
    this.ws.on('message', (data: Buffer) => {
      try {
        const message: MCPMessage = JSON.parse(data.toString())
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

  private handleMCPMessage(message: MCPMessage): void {
    if (message.method === 'claude/provideEdits') {
      this.handleProvideEdits(message)
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
    console.log(diff.unified)
    console.log('')
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
      console.log(`📤 Sent file: ${filePath}`)
    } catch (error) {
      console.error('Error reading file:', filePath, error)
    }
  }

  public processCommand(command: string): void {
    const trimmed = command.trim()

    if (trimmed === ':help') {
      console.log('Available commands:')
      console.log('  :send <path> - Send file content to Claude')
      console.log('  :help - Show this help message')
      console.log('  :quit - Exit the session')
    } else if (trimmed === ':quit') {
      this.emit('quit')
    } else if (trimmed.startsWith(':send ')) {
      const filePath = trimmed.substring(6).trim()
      if (filePath) {
        this.sendFile(filePath)
      } else {
        console.log('Usage: :send <path>')
      }
    } else if (trimmed.startsWith(':')) {
      console.log(`Unknown command: ${trimmed}`)
      console.log('Type :help for available commands')
    }
    // Ignore non-command input for now
  }

  public close(): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.close()
    }
  }

  public startEventLoop(): void {
    console.log('\n🔄 Interactive session started')
    console.log('Type :help for available commands')
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
