import { enableDebug, disableDebug, isDebugEnabled, debugLog, logMCPMessage } from './debug'

describe('Debug utilities', () => {
  let consoleLogSpy: jest.SpyInstance

  beforeEach(() => {
    disableDebug()
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    disableDebug()
  })

  describe('enableDebug', () => {
    it('should enable debug mode', () => {
      enableDebug()
      expect(isDebugEnabled()).toBe(true)
    })
  })

  describe('debugLog', () => {
    it('should not log when debug is disabled', () => {
      debugLog('TEST', 'This should not be logged')
      expect(consoleLogSpy).not.toHaveBeenCalled()
    })

    it('should log when debug is enabled', () => {
      enableDebug()
      debugLog('TEST', 'This should be logged')
      expect(consoleLogSpy).toHaveBeenCalled()
      expect(consoleLogSpy.mock.calls[0][0]).toContain('[DEBUG')
      expect(consoleLogSpy.mock.calls[0][0]).toContain('[TEST]')
      expect(consoleLogSpy.mock.calls[0][0]).toContain('This should be logged')
    })

    it('should log with data when provided', () => {
      enableDebug()
      const testData = { key: 'value' }
      debugLog('TEST', 'Message with data', testData)
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Message with data'),
        testData,
      )
    })
  })

  describe('logMCPMessage', () => {
    it('should not log when debug is disabled', () => {
      const message = { method: 'test', id: '123' }
      logMCPMessage('RECV', message)
      expect(consoleLogSpy).not.toHaveBeenCalled()
    })

    it('should log received messages when debug is enabled', () => {
      enableDebug()
      const message = { method: 'test', id: '123' }
      logMCPMessage('RECV', message)

      expect(consoleLogSpy).toHaveBeenCalledTimes(3)
      expect(consoleLogSpy.mock.calls[0][0]).toContain('[MCP RECV')
      expect(consoleLogSpy.mock.calls[0][0]).toContain('←')
      expect(consoleLogSpy.mock.calls[1][0]).toContain('"method": "test"')
      expect(consoleLogSpy.mock.calls[1][0]).toContain('"id": "123"')
    })

    it('should log sent messages when debug is enabled', () => {
      enableDebug()
      const message = { result: 'success', id: '456' }
      logMCPMessage('SEND', message)

      expect(consoleLogSpy).toHaveBeenCalledTimes(3)
      expect(consoleLogSpy.mock.calls[0][0]).toContain('[MCP SEND')
      expect(consoleLogSpy.mock.calls[0][0]).toContain('→')
    })
  })
})
