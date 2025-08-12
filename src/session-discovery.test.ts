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
        port: 8080,
        context: 'test-context',
        project: 'test-project',
      }

      expect(sessionInfo.port).toBe(8080)
      expect(sessionInfo.context).toBe('test-context')
      expect(sessionInfo.project).toBe('test-project')
    })

    it('should handle numeric port values', () => {
      const sessionInfo: SessionInfo = {
        port: 3000,
        context: 'another-context',
        project: 'another-project',
      }

      expect(typeof sessionInfo.port).toBe('number')
      expect(sessionInfo.port).toBe(3000)
    })
  })

  describe('parseLockFile', () => {
    it('should parse a valid lock file', () => {
      const lockContent = JSON.stringify({
        port: 8080,
        context: 'my-context',
        project: 'my-project',
      })

      const lockPath = path.join(tempDir, 'claude-test.lock')
      fs.writeFileSync(lockPath, lockContent)

      const result = parseLockFile(lockPath)

      expect(result).toEqual({
        port: 8080,
        context: 'my-context',
        project: 'my-project',
      })
    })

    it('should return null for malformed JSON', () => {
      const lockPath = path.join(tempDir, 'claude-invalid.lock')
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
        port: 8080,
        context: 'my-context',
        // missing project field
      })

      const lockPath = path.join(tempDir, 'claude-incomplete.lock')
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
      const session1 = { port: 8080, context: 'context1', project: 'project1' }
      const session2 = { port: 8081, context: 'context2', project: 'project2' }

      fs.writeFileSync(path.join(tempDir, 'claude-session1.lock'), JSON.stringify(session1))
      fs.writeFileSync(path.join(tempDir, 'claude-session2.lock'), JSON.stringify(session2))

      const result = listSessions(tempDir)

      expect(result).toHaveLength(2)
      expect(result).toContainEqual(session1)
      expect(result).toContainEqual(session2)
    })

    it('should ignore invalid lock files but return valid ones', () => {
      const validSession = { port: 8080, context: 'valid', project: 'valid-project' }

      fs.writeFileSync(path.join(tempDir, 'claude-valid.lock'), JSON.stringify(validSession))
      fs.writeFileSync(path.join(tempDir, 'claude-invalid.lock'), 'invalid json')
      fs.writeFileSync(
        path.join(tempDir, 'non-claude-file.lock'),
        JSON.stringify({ port: 9999, context: 'other', project: 'other' }),
      )

      const result = listSessions(tempDir)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(validSession)
    })

    it('should use /tmp as default directory', () => {
      const result = listSessions()

      expect(Array.isArray(result)).toBe(true)
    })
  })
})
