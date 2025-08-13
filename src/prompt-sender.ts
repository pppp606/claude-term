import WebSocket from 'ws'
import { EventEmitter } from 'events'
import { PromptContext, PromptMessage, PromptResponse } from './types/prompt-types.js'
import { randomUUID } from 'crypto'
import fs from 'fs'

export class PromptSender extends EventEmitter {
  private ws: WebSocket
  private version: string

  constructor(websocket: WebSocket) {
    super()
    this.ws = websocket
    this.version = '0.0.1' // TODO: Read from package.json
  }

  public sendPrompt(message: string, context?: PromptContext, template?: string): void {
    if (this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected')
    }

    const promptMessage: PromptMessage = {
      jsonrpc: '2.0',
      method: 'claude/sendPrompt',
      id: randomUUID(),
      params: {
        message,
        context,
        template,
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'claude-term',
          version: this.version,
        },
      },
    }

    this.validateMessage(promptMessage)
    this.ws.send(JSON.stringify(promptMessage))
  }

  public gatherFileContext(filePaths: string[]): PromptContext {
    const files: Array<{ path: string; content: string }> = []

    for (const filePath of filePaths) {
      try {
        const content = fs.readFileSync(filePath, 'utf8')
        files.push({ path: filePath, content })
      } catch (error) {
        // Silently skip files that cannot be read
        console.warn(`Warning: Could not read file ${filePath}`)
      }
    }

    return {
      files,
      workspace: process.cwd(),
    }
  }

  public validateMessage(message: PromptMessage): void {
    if (message.jsonrpc !== '2.0') {
      throw new Error('Invalid jsonrpc version')
    }

    if (!message.params.message) {
      throw new Error('Message is required')
    }

    if (!message.id) {
      throw new Error('Message ID is required')
    }

    if (message.method !== 'claude/sendPrompt') {
      throw new Error('Invalid method')
    }
  }

  public handleResponse(response: PromptResponse): void {
    if (response.result) {
      this.emit('promptResponse', response.result)
    } else if (response.error) {
      this.emit('promptError', response.error)
    }
  }
}
