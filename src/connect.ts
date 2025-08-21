import WebSocket from 'ws'
import { debugLog, logMCPMessage, enableDebug } from './debug.js'
import { findMCPSessions, MCPSession } from './session-discovery.js'

export interface ConnectOptions {
  debug?: boolean
  session?: string
}

export async function connectToSession(options: ConnectOptions): Promise<void> {
  if (options.debug) {
    enableDebug()
    debugLog('CONNECT', 'Debug mode enabled')
  }

  const sessions = await findMCPSessions()

  if (sessions.length === 0) {
    console.error('No active Claude Code MCP sessions found.')
    console.error('Make sure Claude Code is running and has an active session.')
    return
  }

  let targetSession: MCPSession

  if (options.session) {
    const found = sessions.find((s) => s.id === options.session)
    if (!found) {
      console.error(`Session '${options.session}' not found.`)
      console.error('Available sessions:')
      sessions.forEach((s) => console.error(`  - ${s.id}`))
      return
    }
    targetSession = found
  } else if (sessions.length === 1) {
    targetSession = sessions[0]
  } else {
    console.log('Multiple sessions found. Please specify one:')
    sessions.forEach((s) => console.log(`  claude-term connect --session ${s.id}`))
    return
  }

  debugLog('CONNECT', `Connecting to session ${targetSession.id}`, targetSession.config)

  await connectToMCPServer(targetSession)
}

async function connectToMCPServer(session: MCPSession): Promise<void> {
  const config = session.config

  if (config.type === 'websocket' && config.port) {
    await connectViaWebSocket(session, config.port)
  } else if (config.type === 'socket' && config.path) {
    debugLog('CONNECT', 'Unix socket connections not yet implemented')
    console.error('Unix socket connections are not yet supported.')
  } else {
    debugLog('CONNECT', 'Unknown session configuration', config)
    console.error('Unknown session configuration type.')
  }
}

async function connectViaWebSocket(session: MCPSession, port: number): Promise<void> {
  const wsUrl = `ws://localhost:${port}`
  debugLog('CONNECT', `Connecting to WebSocket: ${wsUrl}`)

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)

    ws.on('open', () => {
      debugLog('CONNECT', 'WebSocket connection established')
      console.log(`Connected to Claude Code MCP session: ${session.id}`)
      console.log('Listening for MCP messages... (Press Ctrl+C to disconnect)')
    })

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())
        logMCPMessage('RECV', message)

        handleMCPMessage(message, ws)
      } catch (error) {
        debugLog('CONNECT', 'Failed to parse MCP message', error)
        console.error('Received invalid JSON from MCP server')
      }
    })

    ws.on('error', (error) => {
      debugLog('CONNECT', 'WebSocket error', error)
      console.error('WebSocket connection error:', error.message)
      reject(error)
    })

    ws.on('close', () => {
      debugLog('CONNECT', 'WebSocket connection closed')
      console.log('Connection to Claude Code MCP session closed.')
      resolve()
    })

    process.on('SIGINT', () => {
      debugLog('CONNECT', 'Received SIGINT, closing connection')
      console.log('\nDisconnecting...')
      ws.close()
    })
  })
}

function handleMCPMessage(message: any, ws: WebSocket): void {
  debugLog('MCP', 'Processing message', { method: message.method, id: message.id })

  if (message.method === 'notifications/message') {
    console.log('\n📩 Notification from Claude Code:')
    console.log(JSON.stringify(message.params, null, 2))
  } else if (message.method === 'claude/provideEdits') {
    console.log('\n✏️  Edit proposal from Claude Code:')
    console.log(JSON.stringify(message.params, null, 2))

    const response = {
      jsonrpc: '2.0',
      id: message.id,
      result: { accepted: true },
    }

    logMCPMessage('SEND', response)
    ws.send(JSON.stringify(response))
  } else if (message.method) {
    console.log(`\n🔧 MCP method call: ${message.method}`)
    if (message.params) {
      console.log('Parameters:', JSON.stringify(message.params, null, 2))
    }
  } else if (message.result !== undefined || message.error !== undefined) {
    console.log(`\n↩️  MCP response (ID: ${message.id})`)
    if (message.result) {
      console.log('Result:', JSON.stringify(message.result, null, 2))
    }
    if (message.error) {
      console.log('Error:', JSON.stringify(message.error, null, 2))
    }
  }
}
