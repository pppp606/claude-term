import { ConnectionClient } from './connection-client'
import { SessionInfo } from './session-discovery'
import WebSocket from 'ws'
import { EventEmitter } from 'events'

// Mock the WebSocket module
jest.mock('ws')

// Mock WebSocket
class MockWebSocket extends EventEmitter {
  public sentMessages: string[] = []
  public readyState: number = WebSocket.CONNECTING

  constructor() {
    super()
    // Simulate connection opening after a short delay
    setTimeout(() => {
      this.readyState = WebSocket.OPEN
      this.emit('open')
    }, 10)
  }

  send(data: string): void {
    if (this.readyState === WebSocket.OPEN) {
      this.sentMessages.push(data)
    }
  }

  close(): void {
    this.readyState = WebSocket.CLOSED
    this.emit('close')
  }

  // Helper to simulate receiving messages
  simulateMessage(data: string): void {
    this.emit('message', Buffer.from(data))
  }
}

const MockedWebSocket = WebSocket as jest.MockedClass<typeof WebSocket>

beforeEach(() => {
  MockedWebSocket.mockImplementation(() => new MockWebSocket() as any)
})

describe('ConnectionClient', () => {
  let client: ConnectionClient
  let mockSession: SessionInfo

  beforeEach(() => {
    mockSession = {
      pid: 12345,
      port: 8080,
      workspaceFolders: ['/test/workspace'],
      ideName: 'Test IDE',
      transport: 'ws',
      runningInWindows: false,
      authToken: 'test-token',
    }

    client = new ConnectionClient()
  })

  afterEach(() => {
    client.close()
  })

  describe('Connection Management', () => {
    it('should connect to a Claude Code session', async () => {
      const connection = await client.connect(mockSession)

      expect(connection).toBeDefined()
      expect(client.isConnected()).toBe(true)
    })

    it('should handle connection errors gracefully', async () => {
      // Mock a session with invalid port
      const invalidSession: SessionInfo = {
        ...mockSession,
        port: -1,
      }

      // Override WebSocket mock to fail immediately
      MockedWebSocket.mockImplementationOnce(() => {
        const mock = new MockWebSocket()
        mock.readyState = WebSocket.CLOSED
        // Emit error immediately, don't wait for open
        setImmediate(() => mock.emit('error', new Error('Connection failed')))
        return mock as any
      })

      await expect(client.connect(invalidSession)).rejects.toThrow('Connection failed')
      expect(client.isConnected()).toBe(false)
    })

    it('should close connection properly', async () => {
      await client.connect(mockSession)
      expect(client.isConnected()).toBe(true)

      client.close()
      expect(client.isConnected()).toBe(false)
    })
  })

  describe('Session Selection', () => {
    it('should prompt user to select session when multiple available', () => {
      const sessions: SessionInfo[] = [
        mockSession,
        { ...mockSession, port: 8081, ideName: 'Another IDE' },
      ]

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      client.displaySessionList(sessions)

      expect(consoleSpy).toHaveBeenCalledWith('Available Claude Code sessions:')
      expect(consoleSpy).toHaveBeenCalledWith('  1) Test IDE (Port: 8080, PID: 12345)')
      expect(consoleSpy).toHaveBeenCalledWith('  2) Another IDE (Port: 8081, PID: 12345)')
      expect(consoleSpy).toHaveBeenCalledWith('\nSelect a session (1-2):')

      consoleSpy.mockRestore()
    })

    it('should auto-connect when only one session available', () => {
      const sessions: SessionInfo[] = [mockSession]

      const result = client.selectSession(sessions, undefined)

      expect(result).toEqual(mockSession)
    })

    it('should handle invalid session selection', () => {
      const sessions: SessionInfo[] = [mockSession, { ...mockSession, port: 8081 }]

      const result = client.selectSession(sessions, 5) // Invalid index

      expect(result).toBeNull()
    })
  })

  describe('WebSocket URL Construction', () => {
    it('should construct proper WebSocket URL', () => {
      const url = client.buildWebSocketUrl(mockSession)

      expect(url).toBe('ws://127.0.0.1:8080')
    })

    it('should handle different transports', () => {
      const httpsSession: SessionInfo = {
        ...mockSession,
        transport: 'wss',
      }

      const url = client.buildWebSocketUrl(httpsSession)

      expect(url).toBe('wss://127.0.0.1:8080')
    })
  })
})
