import { InteractiveSession, DiffProposal, MCPMessage } from './interactive-session'
import WebSocket from 'ws'
import { EventEmitter } from 'events'

// Mock WebSocket
class MockWebSocket extends EventEmitter {
  public sentMessages: string[] = []

  send(data: string): void {
    this.sentMessages.push(data)
  }

  close(): void {
    this.emit('close')
  }

  // Helper to simulate receiving messages
  simulateMessage(data: string): void {
    this.emit('message', Buffer.from(data))
  }
}

describe('InteractiveSession', () => {
  let mockWs: MockWebSocket
  let session: InteractiveSession

  beforeEach(() => {
    mockWs = new MockWebSocket()
    session = new InteractiveSession(mockWs as any as WebSocket)
  })

  afterEach(() => {
    session.close()
  })

  describe('JSON-RPC Message Handling', () => {
    it('should handle claude/provideEdits events', async () => {
      const diffProposal: DiffProposal = {
        filePath: 'src/test.ts',
        originalContent: 'const x = 1',
        modifiedContent: 'const x = 2',
        unified: '@@ -1 +1 @@\n-const x = 1\n+const x = 2',
      }

      const mcpMessage: MCPMessage = {
        jsonrpc: '2.0',
        method: 'claude/provideEdits',
        id: '123',
        params: {
          edits: [diffProposal],
        },
      }

      const receivedEdits: DiffProposal[] = []
      session.on('diffProposal', (diff: DiffProposal) => {
        receivedEdits.push(diff)
      })

      mockWs.simulateMessage(JSON.stringify(mcpMessage))

      expect(receivedEdits).toHaveLength(1)
      expect(receivedEdits[0]).toEqual(diffProposal)
    })

    it('should handle malformed JSON gracefully', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation()

      mockWs.simulateMessage('invalid json')

      expect(errorSpy).toHaveBeenCalledWith('Error parsing message:', expect.any(Error))
      errorSpy.mockRestore()
    })

    it('should ignore non-claude methods', () => {
      const mcpMessage: MCPMessage = {
        jsonrpc: '2.0',
        method: 'other/method',
        id: '123',
        params: {},
      }

      const receivedEdits: DiffProposal[] = []
      session.on('diffProposal', (diff: DiffProposal) => {
        receivedEdits.push(diff)
      })

      mockWs.simulateMessage(JSON.stringify(mcpMessage))

      expect(receivedEdits).toHaveLength(0)
    })
  })

  describe('Diff Display', () => {
    it('should format and display unified diffs', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const diffProposal: DiffProposal = {
        filePath: 'src/example.ts',
        originalContent: 'function hello() { return "world" }',
        modifiedContent: 'function hello() { return "universe" }',
        unified:
          '@@ -1 +1 @@\n-function hello() { return "world" }\n+function hello() { return "universe" }',
      }

      session.displayDiff(diffProposal)

      expect(consoleSpy).toHaveBeenCalledWith('\n📝 Diff proposal for: src/example.ts')
      expect(consoleSpy).toHaveBeenCalledWith(diffProposal.unified)
      expect(consoleSpy).toHaveBeenCalledWith('')

      consoleSpy.mockRestore()
    })
  })

  describe(':send Command', () => {
    it('should send file content via WebSocket', async () => {
      const testFilePath = '/tmp/test-file.txt'
      const testContent = 'Hello, world!'

      // Mock fs.readFileSync
      const fs = require('fs')
      const originalReadFileSync = fs.readFileSync
      fs.readFileSync = jest.fn().mockReturnValue(testContent)

      await session.sendFile(testFilePath)

      expect(mockWs.sentMessages).toHaveLength(1)
      const sentMessage = JSON.parse(mockWs.sentMessages[0])

      expect(sentMessage).toEqual({
        jsonrpc: '2.0',
        method: 'claude/receiveFile',
        id: expect.any(String),
        params: {
          filePath: testFilePath,
          content: testContent,
        },
      })

      // Restore original function
      fs.readFileSync = originalReadFileSync
    })

    it('should handle file read errors', async () => {
      const testFilePath = '/non/existent/file.txt'
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      // Mock fs.readFileSync to throw
      const fs = require('fs')
      const originalReadFileSync = fs.readFileSync
      fs.readFileSync = jest.fn().mockImplementation(() => {
        throw new Error('File not found')
      })

      await session.sendFile(testFilePath)

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error reading file:',
        testFilePath,
        expect.any(Error),
      )
      expect(mockWs.sentMessages).toHaveLength(0)

      // Restore
      fs.readFileSync = originalReadFileSync
      consoleSpy.mockRestore()
    })
  })

  describe('Event Loop Integration', () => {
    it('should process user commands', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      session.processCommand(':help')

      expect(consoleSpy).toHaveBeenCalledWith('Available commands:')
      expect(consoleSpy).toHaveBeenCalledWith('  :send <path> - Send file content to Claude')
      expect(consoleSpy).toHaveBeenCalledWith('  :browse - Browse files with fzf (interactive file picker)')
      expect(consoleSpy).toHaveBeenCalledWith('  :cat <path> - Display file with syntax highlighting (bat)')
      expect(consoleSpy).toHaveBeenCalledWith('  :search <pattern> - Search code with ripgrep')
      expect(consoleSpy).toHaveBeenCalledWith('  :help - Show this help message')
      expect(consoleSpy).toHaveBeenCalledWith('  :quit - Exit the session')

      consoleSpy.mockRestore()
    })

    it('should handle quit command', () => {
      let sessionClosed = false
      session.on('quit', () => {
        sessionClosed = true
      })

      session.processCommand(':quit')

      expect(sessionClosed).toBe(true)
    })

    it('should handle unknown commands', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      session.processCommand(':unknown')

      expect(consoleSpy).toHaveBeenCalledWith('Unknown command: :unknown')
      expect(consoleSpy).toHaveBeenCalledWith('Type :help for available commands')

      consoleSpy.mockRestore()
    })
  })
})
