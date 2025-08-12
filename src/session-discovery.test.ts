import { SessionInfo, listSessions, parseLockFile } from './session-discovery'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('Session Discovery', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-term-test-'))
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('SessionInfo type', () => {
    it('should have required properties', () => {
      const sessionInfo: SessionInfo = {
        pid: 12345,
        port: 8080,
        workspaceFolders: ['/path/to/workspace'],
        ideName: 'Cursor',
        transport: 'ws',
        runningInWindows: false,
        authToken: 'test-token',
      }

      expect(sessionInfo.pid).toBe(12345)
      expect(sessionInfo.port).toBe(8080)
      expect(sessionInfo.workspaceFolders).toEqual(['/path/to/workspace'])
      expect(sessionInfo.ideName).toBe('Cursor')
      expect(sessionInfo.transport).toBe('ws')
      expect(sessionInfo.runningInWindows).toBe(false)
      expect(sessionInfo.authToken).toBe('test-token')
    })

    it('should handle empty workspace folders', () => {
      const sessionInfo: SessionInfo = {
        pid: 12345,
        port: 3000,
        workspaceFolders: [],
        ideName: 'Cursor',
        transport: 'ws',
        runningInWindows: false,
        authToken: 'test-token',
      }

      expect(sessionInfo.workspaceFolders).toEqual([])
      expect(typeof sessionInfo.port).toBe('number')
      expect(sessionInfo.port).toBe(3000)
    })
  })

  describe('parseLockFile', () => {
    it('should parse a valid lock file', () => {
      const lockContent = JSON.stringify({
        pid: 12345,
        workspaceFolders: ['/path/to/workspace'],
        ideName: 'Cursor',
        transport: 'ws',
        runningInWindows: false,
        authToken: 'test-token',
      })

      const lockPath = path.join(tempDir, '8080.lock')
      fs.writeFileSync(lockPath, lockContent)

      const result = parseLockFile(lockPath)

      expect(result).toEqual({
        pid: 12345,
        port: 8080,
        workspaceFolders: ['/path/to/workspace'],
        ideName: 'Cursor',
        transport: 'ws',
        runningInWindows: false,
        authToken: 'test-token',
      })
    })

    it('should return null for malformed JSON', () => {
      const lockPath = path.join(tempDir, 'invalid.lock')
      fs.writeFileSync(lockPath, 'invalid json content')

      const result = parseLockFile(lockPath)

      expect(result).toBeNull()
    })

    it('should return null for non-existent file', () => {
      const lockPath = path.join(tempDir, 'non-existent.lock')

      const result = parseLockFile(lockPath)

      expect(result).toBeNull()
    })

    it('should return null for lock file missing required fields', () => {
      const lockContent = JSON.stringify({
        pid: 12345,
        workspaceFolders: ['/path/to/workspace'],
        ideName: 'Cursor',
        // missing transport, runningInWindows, authToken fields
      })

      const lockPath = path.join(tempDir, '9000.lock')
      fs.writeFileSync(lockPath, lockContent)

      const result = parseLockFile(lockPath)

      expect(result).toBeNull()
    })

    it('should return null for invalid filename', () => {
      const lockContent = JSON.stringify({
        pid: 12345,
        workspaceFolders: [],
        ideName: 'Cursor',
        transport: 'ws',
        runningInWindows: false,
        authToken: 'test-token',
      })

      const lockPath = path.join(tempDir, 'invalid-name.lock')
      fs.writeFileSync(lockPath, lockContent)

      const result = parseLockFile(lockPath)

      expect(result).toBeNull()
    })
  })

  describe('listSessions', () => {
    it('should return empty array when no lock files exist', () => {
      const result = listSessions(tempDir)

      expect(result).toEqual([])
    })

    it('should return sessions from valid lock files', () => {
      const session1Data = {
        pid: 12345,
        workspaceFolders: ['/workspace1'],
        ideName: 'Cursor',
        transport: 'ws',
        runningInWindows: false,
        authToken: 'token1',
      }
      const session2Data = {
        pid: 12346,
        workspaceFolders: ['/workspace2'],
        ideName: 'Cursor',
        transport: 'ws',
        runningInWindows: false,
        authToken: 'token2',
      }

      fs.writeFileSync(path.join(tempDir, '8080.lock'), JSON.stringify(session1Data))
      fs.writeFileSync(path.join(tempDir, '8081.lock'), JSON.stringify(session2Data))

      const result = listSessions(tempDir)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ ...session1Data, port: 8080 })
      expect(result[1]).toEqual({ ...session2Data, port: 8081 })
    })

    it('should ignore invalid lock files but return valid ones', () => {
      const validSessionData = {
        pid: 12345,
        workspaceFolders: ['/valid/workspace'],
        ideName: 'Cursor',
        transport: 'ws',
        runningInWindows: false,
        authToken: 'valid-token',
      }

      fs.writeFileSync(path.join(tempDir, '8080.lock'), JSON.stringify(validSessionData))
      fs.writeFileSync(path.join(tempDir, '8081.lock'), 'invalid json')

      const result = listSessions(tempDir)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ ...validSessionData, port: 8080 })
    })

    it('should use ~/.claude/ide as default directory', () => {
      const result = listSessions()

      expect(Array.isArray(result)).toBe(true)
    })
  })
})
