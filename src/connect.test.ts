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
})