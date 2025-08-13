import { PromptSender } from './prompt-sender.js'
import { PromptContext, PromptMessage } from './types/prompt-types.js'
import WebSocket from 'ws'
import { randomUUID } from 'crypto'

// Mock WebSocket
jest.mock('ws')

describe('PromptSender', () => {
  let mockWebSocket: jest.Mocked<WebSocket>
  let promptSender: PromptSender

  beforeEach(() => {
    mockWebSocket = {
      send: jest.fn(),
      readyState: WebSocket.OPEN,
      on: jest.fn(),
      close: jest.fn(),
    } as any
    promptSender = new PromptSender(mockWebSocket)
  })

  describe('sendPrompt', () => {
    it('should send a basic prompt message', () => {
      const message = 'Explain this code'

      promptSender.sendPrompt(message)

      expect(mockWebSocket.send).toHaveBeenCalledTimes(1)
      const sentMessage = JSON.parse((mockWebSocket.send as jest.Mock).mock.calls[0][0])

      expect(sentMessage).toMatchObject({
        jsonrpc: '2.0',
        method: 'claude/sendPrompt',
        params: {
          message,
          metadata: {
            source: 'claude-term',
            version: expect.any(String),
            timestamp: expect.any(String),
          },
        },
      })
      expect(sentMessage.id).toBeDefined()
    })

    it('should send a prompt with file context', () => {
      const message = 'Review this code'
      const context: PromptContext = {
        files: [{ path: 'src/main.ts', content: 'console.log("hello")' }],
        workspace: '/home/user/project',
      }

      promptSender.sendPrompt(message, context)

      const sentMessage = JSON.parse((mockWebSocket.send as jest.Mock).mock.calls[0][0])
      expect(sentMessage.params.context).toEqual(context)
    })

    it('should send a prompt with template reference', () => {
      const message = 'Review this code'
      const template = 'code_review'

      promptSender.sendPrompt(message, undefined, template)

      const sentMessage = JSON.parse((mockWebSocket.send as jest.Mock).mock.calls[0][0])
      expect(sentMessage.params.template).toBe(template)
    })

    it('should throw error when WebSocket is not open', () => {
      Object.defineProperty(mockWebSocket, 'readyState', {
        value: WebSocket.CLOSED,
        writable: true,
      })

      expect(() => promptSender.sendPrompt('test message')).toThrow(
        'WebSocket is not connected',
      )
    })
  })

  describe('gatherFileContext', () => {
    it('should read file content and create context', () => {
      // Create a real test file
      const fs = jest.requireActual('fs')
      const testContent = 'const x = 1;'
      const testPath = 'test-temp.ts'

      fs.writeFileSync(testPath, testContent)

      try {
        const context = promptSender.gatherFileContext([testPath])

        expect(context.files).toHaveLength(1)
        expect(context.files![0]).toEqual({
          path: testPath,
          content: testContent,
        })
      } finally {
        // Clean up
        fs.unlinkSync(testPath)
      }
    })

    it('should handle file read errors gracefully', () => {
      const filePaths = ['nonexistent.ts']

      const context = promptSender.gatherFileContext(filePaths)

      expect(context.files).toHaveLength(0)
    })
  })

  describe('validateMessage', () => {
    it('should validate correct message format', () => {
      const message: PromptMessage = {
        jsonrpc: '2.0',
        method: 'claude/sendPrompt',
        id: randomUUID(),
        params: {
          message: 'test',
          metadata: {
            timestamp: new Date().toISOString(),
            source: 'claude-term',
            version: '1.0.0',
          },
        },
      }

      expect(() => promptSender.validateMessage(message)).not.toThrow()
    })

    it('should throw error for invalid jsonrpc version', () => {
      const message = {
        jsonrpc: '1.0',
        method: 'claude/sendPrompt',
        id: randomUUID(),
        params: { message: 'test' },
      } as any

      expect(() => promptSender.validateMessage(message)).toThrow('Invalid jsonrpc version')
    })

    it('should throw error for missing message in params', () => {
      const message = {
        jsonrpc: '2.0',
        method: 'claude/sendPrompt',
        id: randomUUID(),
        params: {},
      } as any

      expect(() => promptSender.validateMessage(message)).toThrow('Message is required')
    })
  })

  describe('handleResponse', () => {
    it('should process successful response', () => {
      const response = {
        jsonrpc: '2.0' as const,
        id: 'test-id',
        result: {
          response: "This is Claude's response",
          conversationId: 'conv-123',
        },
      }

      const mockCallback = jest.fn()
      promptSender.on('promptResponse', mockCallback)

      promptSender.handleResponse(response)

      expect(mockCallback).toHaveBeenCalledWith(response.result)
    })

    it('should process error response', () => {
      const response = {
        jsonrpc: '2.0' as const,
        id: 'test-id',
        error: {
          code: -32600,
          message: 'Invalid request',
        },
      }

      const mockCallback = jest.fn()
      promptSender.on('promptError', mockCallback)

      promptSender.handleResponse(response)

      expect(mockCallback).toHaveBeenCalledWith(response.error)
    })
  })
})
