import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { connectCommand } from './connect.js'
import { listSessions } from './session-discovery.js'

// Mock session discovery
jest.mock('./session-discovery.js')
const mockListSessions = jest.mocked(listSessions)

// Mock WebSocket
const mockWS = {
  on: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1, // OPEN
}

jest.mock('ws', () => {
  return {
    WebSocket: jest.fn().mockImplementation(() => mockWS),
  }
})

// Mock readline
jest.mock('readline', () => ({
  createInterface: jest.fn().mockReturnValue({
    question: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
    write: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
  }),
}))

import readline from 'readline'
const mockCreateInterface = jest.mocked(readline.createInterface)
let mockRl: any

describe('connect command', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    mockRl = {
      question: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      write: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
    }
    
    mockCreateInterface.mockReturnValue(mockRl)
    
    // Default WebSocket mock behavior - simulate connection error to resolve promise quickly
    mockWS.on.mockImplementation((...args: any[]) => {
      const [event, callback] = args
      if (event === 'error') {
        setTimeout(() => callback(new Error('Mock connection failed')), 10)
      }
    })
    
    mockListSessions.mockReturnValue([
      {
        pid: 1234,
        port: 3001,
        workspaceFolders: ['/test/workspace'],
        ideName: 'VS Code',
        transport: 'ws',
        runningInWindows: false,
        authToken: 'test-token',
      },
      {
        pid: 5678,
        port: 3002,
        workspaceFolders: ['/another/workspace'],
        ideName: 'Cursor',
        transport: 'ws',
        runningInWindows: false,
        authToken: 'test-token-2',
      },
    ])
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should list available sessions and prompt for selection', async () => {
    const mockOptions = { lockDir: '/test/.claude/ide' }

    // Mock user selecting session 1 (index 0)
    mockRl.question.mockImplementationOnce((...args: any[]) => {
      const [prompt, callback] = args
      expect(prompt).toContain('Select a session')
      callback('1')
    })

    await connectCommand(mockOptions)

    expect(mockListSessions).toHaveBeenCalledWith('/test/.claude/ide')
    expect(mockRl.question).toHaveBeenCalledWith(
      expect.stringContaining('Select a session'),
      expect.any(Function),
    )
  })

  it('should display no sessions message when no sessions found', async () => {
    mockListSessions.mockReturnValue([])
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const mockOptions = { lockDir: '/test/.claude/ide' }

    await connectCommand(mockOptions)

    expect(consoleSpy).toHaveBeenCalledWith('No Claude Code sessions found.')
    consoleSpy.mockRestore()
  })

  it('should handle invalid session selection', async () => {
    const mockOptions = { lockDir: '/test/.claude/ide' }
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    // Mock user selecting invalid session number
    mockRl.question.mockImplementationOnce((...args: any[]) => {
      const [_prompt, callback] = args
      callback('99') // Invalid selection
    })

    await connectCommand(mockOptions)

    expect(consoleSpy).toHaveBeenCalledWith('Invalid session selection.')
    consoleSpy.mockRestore()
  })

  describe('WebSocket connection', () => {
    it('should establish WebSocket connection to selected session', async () => {
      const mockOptions = { lockDir: '/test/.claude/ide' }

      // Mock user selecting session 1 (index 0)
      mockRl.question.mockImplementationOnce((...args: any[]) => {
        const [_prompt, callback] = args
        callback('1')
      })

      await connectCommand(mockOptions)

      // Should create WebSocket with correct URL
      const expectedUrl = 'ws://localhost:3001'
      const { WebSocket } = jest.requireMock('ws') as { WebSocket: jest.Mock }
      expect(WebSocket).toHaveBeenCalledWith(expectedUrl)
    })

    it('should handle WebSocket connection success', async () => {
      const mockOptions = { lockDir: '/test/.claude/ide' }
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      // Mock user selecting session 1 (index 0)
      mockRl.question.mockImplementationOnce((...args: any[]) => {
        const [_prompt, callback] = args
        callback('1')
      })

      // Mock WebSocket open event
      mockWS.on.mockImplementation((...args: any[]) => {
        const [event, callback] = args
        if (event === 'open') {
          setTimeout(callback, 0) // Simulate async open
        }
      })

      await connectCommand(mockOptions)

      expect(consoleSpy).toHaveBeenCalledWith('Connected to Claude Code MCP server')
      consoleSpy.mockRestore()
    })

    it('should handle WebSocket connection error', async () => {
      const mockOptions = { lockDir: '/test/.claude/ide' }
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      // Mock user selecting session 1 (index 0)
      mockRl.question.mockImplementationOnce((...args: any[]) => {
        const [_prompt, callback] = args
        callback('1')
      })

      // Mock WebSocket error event
      const mockError = new Error('Connection failed')
      mockWS.on.mockImplementation((...args: any[]) => {
        const [event, callback] = args
        if (event === 'error') {
          setTimeout(() => callback(mockError), 0) // Simulate async error
        }
      })

      await connectCommand(mockOptions)

      expect(consoleSpy).toHaveBeenCalledWith('WebSocket connection error:', mockError)
      consoleSpy.mockRestore()
    })
  })

  describe('Interactive event loop', () => {
    it('should display incoming WebSocket messages as formatted events', async () => {
      const mockOptions = { lockDir: '/test/.claude/ide' }
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      // Mock user selecting session 1
      mockRl.question.mockImplementationOnce((...args: any[]) => {
        const [_prompt, callback] = args
        callback('1')
      })

      // Mock WebSocket receiving a message after connection
      mockWS.on.mockImplementation((...args: any[]) => {
        const [event, callback] = args
        if (event === 'open') {
          setTimeout(() => {
            callback() // Simulate open event
          }, 10)
        } else if (event === 'message') {
          // Store the message callback to trigger later
          setTimeout(() => {
            const mockMessage = JSON.stringify({
              jsonrpc: '2.0',
              method: 'claude/provideEdits',
              params: { files: [{ path: 'test.ts', content: 'console.log("hello")' }] }
            })
            callback(Buffer.from(mockMessage))
          }, 20)
        }
      })

      await connectCommand(mockOptions)

      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should display the formatted event
      expect(consoleSpy).toHaveBeenCalledWith('Event:', expect.stringContaining('claude/provideEdits'))
      consoleSpy.mockRestore()
    })

    it('should handle malformed WebSocket messages gracefully', async () => {
      const mockOptions = { lockDir: '/test/.claude/ide' }
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      // Mock user selecting session 1
      mockRl.question.mockImplementationOnce((...args: any[]) => {
        const [_prompt, callback] = args
        callback('1')
      })

      // Mock WebSocket receiving malformed message
      mockWS.on.mockImplementation((...args: any[]) => {
        const [event, callback] = args
        if (event === 'open') {
          setTimeout(() => {
            callback()
          }, 10)
        } else if (event === 'message') {
          // Send malformed JSON
          setTimeout(() => {
            callback(Buffer.from('invalid json'))
          }, 20)
        }
      })

      await connectCommand(mockOptions)

      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(errorSpy).toHaveBeenCalledWith('Error parsing message:', expect.any(Error))
      consoleSpy.mockRestore()
      errorSpy.mockRestore()
    })
  })

  describe('stdin command handling', () => {
    it('should handle :quit command to exit gracefully', async () => {
      const mockOptions = { lockDir: '/test/.claude/ide' }

      // Mock user selecting session 1
      mockRl.question.mockImplementationOnce((...args: any[]) => {
        const [_prompt, callback] = args
        callback('1')
      })

      // Mock successful WebSocket connection
      mockWS.on.mockImplementation((...args: any[]) => {
        const [event, callback] = args
        if (event === 'open') {
          setTimeout(() => {
            callback() // Simulate open event
            
            // Simulate user typing :quit after connection
            const lineCallback = mockRl.on.mock.calls.find((call: any) => call[0] === 'line')?.[1]
            if (lineCallback && typeof lineCallback === 'function') {
              setTimeout(() => lineCallback(':quit'), 50)
            }
          }, 10)
        }
      })

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      await connectCommand(mockOptions)

      // Wait for command processing
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(consoleSpy).toHaveBeenCalledWith('Exiting...')
      consoleSpy.mockRestore()
    })

    it('should handle unknown commands gracefully', async () => {
      const mockOptions = { lockDir: '/test/.claude/ide' }

      // Mock user selecting session 1
      mockRl.question.mockImplementationOnce((...args: any[]) => {
        const [_prompt, callback] = args
        callback('1')
      })

      // Mock WebSocket connection and unknown command
      mockWS.on.mockImplementation((...args: any[]) => {
        const [event, callback] = args
        if (event === 'open') {
          setTimeout(() => {
            callback()
            
            // Simulate user typing unknown command
            const lineCallback = mockRl.on.mock.calls.find((call: any) => call[0] === 'line')?.[1]
            if (lineCallback && typeof lineCallback === 'function') {
              setTimeout(() => lineCallback(':unknown'), 50)
            }
          }, 10)
        }
      })

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      await connectCommand(mockOptions)

      // Wait for command processing
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(consoleSpy).toHaveBeenCalledWith('Unknown command: :unknown')
      consoleSpy.mockRestore()
    })
  })
})