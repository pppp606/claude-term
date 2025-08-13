import WebSocket from 'ws'
import { SessionInfo } from './session-discovery.js'
import { InteractiveSession } from './interactive-session.js'

export class ConnectionClient {
  private ws: WebSocket | null = null
  private session: InteractiveSession | null = null

  public async connect(sessionInfo: SessionInfo): Promise<InteractiveSession> {
    return new Promise((resolve, reject) => {
      const url = this.buildWebSocketUrl(sessionInfo)
      console.log(`🔌 Connecting to Claude Code session: ${sessionInfo.ideName}`)
      console.log(`📍 URL: ${url}`)

      this.ws = new WebSocket(url)

      this.ws.on('open', () => {
        if (this.ws) {
          this.session = new InteractiveSession(this.ws)
          resolve(this.session)
        }
      })

      this.ws.on('error', (error) => {
        console.error('❌ Connection error:', error.message)
        reject(error)
      })

      this.ws.on('close', () => {
        console.log('👋 Connection closed')
        this.ws = null
        this.session = null
      })
    })
  }

  public buildWebSocketUrl(sessionInfo: SessionInfo): string {
    const protocol = sessionInfo.transport === 'wss' ? 'wss' : 'ws'
    return `${protocol}://127.0.0.1:${sessionInfo.port}`
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  public close(): void {
    if (this.session) {
      this.session.close()
      this.session = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  public displaySessionList(sessions: SessionInfo[]): void {
    console.log('Available Claude Code sessions:')
    sessions.forEach((session, index) => {
      console.log(`  ${index + 1}) ${session.ideName} (Port: ${session.port}, PID: ${session.pid})`)
    })
    console.log(`\nSelect a session (1-${sessions.length}):`)
  }

  public selectSession(sessions: SessionInfo[], choice?: number): SessionInfo | null {
    if (sessions.length === 0) {
      return null
    }

    if (sessions.length === 1) {
      console.log(`Auto-selecting the only available session: ${sessions[0].ideName}`)
      return sessions[0]
    }

    if (choice === undefined) {
      this.displaySessionList(sessions)
      return null // Caller should handle user input
    }

    const index = choice - 1
    if (index >= 0 && index < sessions.length) {
      return sessions[index]
    }

    console.log(`❌ Invalid selection. Please choose a number between 1 and ${sessions.length}`)
    return null
  }

  public async connectWithSelection(
    sessions: SessionInfo[],
    choice?: number,
  ): Promise<InteractiveSession | null> {
    const selectedSession = this.selectSession(sessions, choice)

    if (!selectedSession) {
      return null
    }

    try {
      const interactiveSession = await this.connect(selectedSession)
      return interactiveSession
    } catch (error) {
      console.error(`Failed to connect to session: ${selectedSession.ideName}`)
      throw error
    }
  }
}
