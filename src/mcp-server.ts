// mcp-server.ts - Pure MCP server for custom tools (stdio transport)
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

export interface MCPServerOptions {
  workspaceFolder?: string
  serverName?: string
  debug?: boolean
  noWait?: boolean
  ideServerPort?: number  // Port of IDE server's internal MCP
}

export class ClaudeTermMCPServer {
  private server: Server
  private transport: StdioServerTransport | null = null

  constructor(private options: MCPServerOptions = {}) {
    
    // Create MCP server with stdio transport
    this.server = new Server(
      {
        name: options.serverName || 'claude-term-mcp',
        version: '0.0.1',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    )

    this.setupTools()
  }

  private setupTools(): void {
    // Handle tools list request
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'review_push',
            description: 'Review unpushed commits and push to remote repository after approval',
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
            name: 'git_status',
            description: 'Get current git status and unpushed commits',
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
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params

      switch (name) {
        case 'review_push':
          const result = await this.forwardToIdeServer('review_push_internal', args)
          return {
            content: [{ type: 'text', text: result }],
          }

        case 'git_status':
          const statusResult = await this.forwardToIdeServer('git_status_internal', {})
          return {
            content: [{ type: 'text', text: statusResult }],
          }

        default:
          throw new Error(`Unknown tool: ${name}`)
      }
    })
  }

  async start(): Promise<void> {
    this.transport = new StdioServerTransport()
    await this.server.connect(this.transport)

    if (!this.options.noWait) {
      const workspace = this.options.workspaceFolder || process.cwd()
      const serverName = this.options.serverName || 'claude-term-mcp'

      // Use stderr for logging (stdout is used for MCP communication)
      console.error('🚀 claude-term MCP server started (stdio)')
      console.error(`📦 Server Name: ${serverName}`)
      console.error(`📁 Workspace: ${workspace}`)
      console.error('\n📋 Available tools:')
      console.error('  • review_push - Review and push commits')
      console.error('  • git_status - Get git status and unpushed commits')
      console.error('\n💡 Add this server to Claude Code MCP settings:')
      console.error(`   claude mcp add ${serverName} node dist/mcp-server.js`)
      console.error('\nWaiting for connection...')
    }
  }

  // Forward requests to IDE Server's internal MCP
  private async forwardToIdeServer(toolName: string, args: any): Promise<string> {
    try {
      const idePort = this.options.ideServerPort || 12345 // Default fallback port
      
      console.error(`\n🔗 Forwarding ${toolName} to IDE Server on port ${idePort}...`)

      const postData = JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      })

      return new Promise(async (resolve, reject) => {
        const options = {
          hostname: 'localhost',
          port: idePort,
          path: '/mcp',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        }

        const http = await import('http')
        const req = http.request(options, (res: any) => {
          let data = ''
          
          res.on('data', (chunk: any) => {
            data += chunk
          })
          
          res.on('end', () => {
            try {
              const response = JSON.parse(data)
              if (response.error) {
                reject(new Error(response.error.message || 'Unknown error'))
              } else {
                // Extract text content from MCP response
                const content = response.result?.content?.[0]?.text || 'No response'
                resolve(content)
              }
            } catch (error) {
              reject(new Error(`Failed to parse response: ${error}`))
            }
          })
        })

        req.on('error', (error: any) => {
          reject(new Error(`Request failed: ${error.message}`))
        })

        req.write(postData)
        req.end()
      })
    } catch (error) {
      const errorMsg = `Failed to forward to IDE server: ${error instanceof Error ? error.message : error}`
      console.error('❌', errorMsg)
      return errorMsg
    }
  }

  async stop(): Promise<void> {
    if (this.transport) {
      await this.transport.close()
    }
  }
}

export async function startMCPServer(options: MCPServerOptions): Promise<void> {
  const server = new ClaudeTermMCPServer(options)

  // Handle graceful shutdown
  const shutdown = async () => {
    console.error('\nShutting down MCP server...')
    await server.stop()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  try {
    await server.start()

    // If this function is called with noWait flag, return immediately
    if (options.noWait) {
      return
    }

    // Keep the process alive
    await new Promise(() => {}) // Never resolves
  } catch (error) {
    console.error('Failed to start MCP server:', error)
    process.exit(1)
  }
}

// If this file is run directly, start the MCP server
if (import.meta.url === `file://${process.argv[1]}`) {
  startMCPServer({
    workspaceFolder: process.cwd(),
    serverName: 'claude-term-mcp',
  })
}