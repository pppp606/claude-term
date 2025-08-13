// ide-server.ts - Minimal IDE server for Claude Code connection

import { WebSocketServer, WebSocket } from 'ws'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { randomUUID } from 'crypto'

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

  constructor(private options: IDEServerOptions = {}) {
    this.authToken = randomUUID()
  }

  async start(): Promise<number> {
    // Create WebSocket server
    this.server = new WebSocketServer({ 
      port: this.options.port || 0 // Use 0 for dynamic port assignment
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

      this.server.on('connection', this.handleConnection.bind(this))
      
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
      authToken: this.authToken
    }

    const ideDir = path.join(os.homedir(), '.claude', 'ide')
    if (!fs.existsSync(ideDir)) {
      fs.mkdirSync(ideDir, { recursive: true })
    }

    this.lockFilePath = path.join(ideDir, `${this.port}.lock`)
    fs.writeFileSync(this.lockFilePath, JSON.stringify(lockData))
    console.log(`Lock file created: ${this.lockFilePath}`)
  }

  private handleConnection(ws: WebSocket): void {
    console.log('Claude Code connected!')
    
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString())
        console.log('\n📨 Received from Claude:', JSON.stringify(message, null, 2))
        
        // Handle different MCP message types
        if (message.method === 'initialize') {
          this.handleInitialize(ws, message)
        } else if (message.method === 'notifications/initialized') {
          console.log('✅ Claude Code initialization complete')
        } else if (message.method?.startsWith('tools/')) {
          this.handleToolCall(ws, message)
        } else if (message.method?.startsWith('resources/')) {
          this.handleResourceCall(ws, message)
        } else {
          // Default response for unknown methods
          const response = {
            jsonrpc: '2.0',
            id: message.id,
            result: { status: 'ok', message: 'Not implemented yet' }
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
                  path: { type: 'string', description: 'File path to read' }
                },
                required: ['path']
              }
            },
            write_file: {
              description: 'Write file contents', 
              inputSchema: {
                type: 'object',
                properties: {
                  path: { type: 'string', description: 'File path to write' },
                  content: { type: 'string', description: 'Content to write' }
                },
                required: ['path', 'content']
              }
            },
            list_files: {
              description: 'List files in directory',
              inputSchema: {
                type: 'object', 
                properties: {
                  path: { type: 'string', description: 'Directory path', default: '.' }
                }
              }
            }
          },
          resources: {}
        },
        serverInfo: {
          name: 'claude-term',
          version: '0.0.1'
        }
      }
    }
    
    console.log('🤝 Sending initialization response...')
    ws.send(JSON.stringify(response))
  }

  private handleToolCall(ws: WebSocket, message: any): void {
    const toolName = message.method.replace('tools/', '')
    const params = message.params || {}
    
    console.log(`🔧 Tool call: ${toolName}`, params)
    
    try {
      let result: any
      
      switch (toolName) {
        case 'read_file':
          result = this.readFile(params.path)
          break
        case 'write_file':
          result = this.writeFile(params.path, params.content)
          break
        case 'list_files':
          result = this.listFiles(params.path || '.')
          break
        default:
          throw new Error(`Unknown tool: ${toolName}`)
      }
      
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: { content: [{ type: 'text', text: result }] }
      }
      
      ws.send(JSON.stringify(response))
    } catch (error) {
      const errorResponse = {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      }
      
      ws.send(JSON.stringify(errorResponse))
    }
  }

  private handleResourceCall(ws: WebSocket, message: any): void {
    // Handle resource requests (files, etc.)
    const response = {
      jsonrpc: '2.0',
      id: message.id,
      result: { resources: [] }
    }
    
    ws.send(JSON.stringify(response))
  }

  private readFile(filePath: string): string {
    const fs = require('fs')
    const path = require('path')
    
    const fullPath = path.resolve(this.options.workspaceFolder || process.cwd(), filePath)
    console.log(`📖 Reading file: ${fullPath}`)
    
    return fs.readFileSync(fullPath, 'utf8')
  }

  private writeFile(filePath: string, content: string): string {
    const fs = require('fs')
    const path = require('path')
    
    const fullPath = path.resolve(this.options.workspaceFolder || process.cwd(), filePath)
    console.log(`✏️  Writing file: ${fullPath}`)
    
    fs.writeFileSync(fullPath, content)
    return `File written successfully: ${filePath}`
  }

  private listFiles(dirPath: string): string {
    const fs = require('fs')
    const path = require('path')
    
    const fullPath = path.resolve(this.options.workspaceFolder || process.cwd(), dirPath)
    console.log(`📁 Listing directory: ${fullPath}`)
    
    const files = fs.readdirSync(fullPath)
    return files.join('\n')
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.close()
    }

    // Clean up lock file
    if (this.lockFilePath && fs.existsSync(this.lockFilePath)) {
      fs.unlinkSync(this.lockFilePath)
      console.log(`Lock file removed: ${this.lockFilePath}`)
    }
  }
}

// CLI command for starting IDE server
export async function startIDEServer(options: IDEServerOptions): Promise<void> {
  // Check if an IDE with the same name already exists
  const ideName = options.ideName || 'claude-term'
  const ideDir = path.join(os.homedir(), '.claude', 'ide')
  
  if (fs.existsSync(ideDir)) {
    const lockFiles = fs.readdirSync(ideDir).filter(f => f.endsWith('.lock'))
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