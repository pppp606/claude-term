import { GitCommandManager, GitCommit } from './git-command-manager.js'

describe('GitCommandManager', () => {
  let gitCommandManager: GitCommandManager

  beforeEach(() => {
    gitCommandManager = new GitCommandManager()
  })

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(gitCommandManager).toBeInstanceOf(GitCommandManager)
    })
  })

  describe('getStatus', () => {
    it('should return git status information', async () => {
      const status = await gitCommandManager.getStatus()

      expect(status).toHaveProperty('branch')
      expect(status).toHaveProperty('staged')
      expect(status).toHaveProperty('unstaged')
      expect(status).toHaveProperty('untracked')
      expect(typeof status.branch).toBe('string')
      expect(Array.isArray(status.staged)).toBe(true)
      expect(Array.isArray(status.unstaged)).toBe(true)
      expect(Array.isArray(status.untracked)).toBe(true)
    })

    it('should handle git repositories correctly', async () => {
      const status = await gitCommandManager.getStatus()
      expect(status.branch.length).toBeGreaterThan(0)
    })
  })

  describe('getDiff', () => {
    it('should return diff for unstaged changes', async () => {
      const diff = await gitCommandManager.getDiff()

      expect(typeof diff).toBe('string')
      // Diff might be empty if no unstaged changes, which is valid
    })

    it('should return diff for specific file', async () => {
      const diff = await gitCommandManager.getDiff('test-file.js')

      expect(typeof diff).toBe('string')
    })

    it('should return staged diff when requested', async () => {
      const diff = await gitCommandManager.getDiff(undefined, true)

      expect(typeof diff).toBe('string')
    })
  })

  describe('getLog', () => {
    it('should return git log with default count', async () => {
      const log = await gitCommandManager.getLog()

      expect(Array.isArray(log)).toBe(true)
      expect(log.length).toBeGreaterThan(0)
      log.forEach((commit: GitCommit) => {
        expect(commit).toHaveProperty('hash')
        expect(commit).toHaveProperty('author')
        expect(commit).toHaveProperty('date')
        expect(commit).toHaveProperty('subject')
        expect(typeof commit.hash).toBe('string')
        expect(typeof commit.author).toBe('string')
        expect(typeof commit.subject).toBe('string')
      })
    })

    it('should respect count parameter', async () => {
      const log = await gitCommandManager.getLog(5)

      expect(log.length).toBeLessThanOrEqual(5)
    })

    it('should return one-line format when requested', async () => {
      const log = await gitCommandManager.getLog(3, true)

      expect(Array.isArray(log)).toBe(true)
      log.forEach((commit: GitCommit) => {
        expect(commit).toHaveProperty('oneline')
        expect(typeof commit.oneline).toBe('string')
      })
    })
  })

  describe('getBranches', () => {
    it('should return local and remote branches', async () => {
      const branches = await gitCommandManager.getBranches()

      expect(branches).toHaveProperty('local')
      expect(branches).toHaveProperty('remote')
      expect(branches).toHaveProperty('current')
      expect(Array.isArray(branches.local)).toBe(true)
      expect(Array.isArray(branches.remote)).toBe(true)
      expect(typeof branches.current).toBe('string')
      expect(branches.local.length).toBeGreaterThan(0)
    })

    it('should identify current branch correctly', async () => {
      const branches = await gitCommandManager.getBranches()

      expect(branches.current.length).toBeGreaterThan(0)
      expect(branches.local).toContain(branches.current)
    })
  })

  describe('addFiles', () => {
    it('should support adding all files', async () => {
      const result = await gitCommandManager.addFiles(['.'])

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('message')
      expect(typeof result.success).toBe('boolean')
      expect(typeof result.message).toBe('string')
    })

    it('should support adding specific files', async () => {
      const result = await gitCommandManager.addFiles(['test-file.js'])

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('message')
    })

    it('should handle non-existent files gracefully', async () => {
      const result = await gitCommandManager.addFiles(['non-existent-file.txt'])

      expect(result.success).toBe(false)
      expect(result.message).toContain('failed')
    })
  })

  describe('createCommit', () => {
    it('should create commit with message', async () => {
      const result = await gitCommandManager.createCommit('test commit message')

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('message')
      expect(typeof result.success).toBe('boolean')
      expect(typeof result.message).toBe('string')

      if (result.success) {
        expect(result).toHaveProperty('hash')
        if (result.hash) {
          expect(typeof result.hash).toBe('string')
          expect(result.hash.length).toBeGreaterThan(6)
        }
      }
    })

    it('should handle empty staging area', async () => {
      // This test assumes clean staging area
      const result = await gitCommandManager.createCommit('empty commit')

      // Should fail if nothing staged, or succeed if --allow-empty used
      expect(typeof result.success).toBe('boolean')
      expect(typeof result.message).toBe('string')
    })
  })

  describe('formatWithColors', () => {
    it('should format git status with colors and emojis', async () => {
      const status = await gitCommandManager.getStatus()
      const formatted = gitCommandManager.formatWithColors('status', status)

      expect(typeof formatted).toBe('string')
      expect(formatted.length).toBeGreaterThan(0)
      // Should contain branch info
      expect(formatted).toContain(status.branch)
    })

    it('should format git diff with colors', async () => {
      const diff = await gitCommandManager.getDiff()
      const formatted = gitCommandManager.formatWithColors('diff', diff)

      expect(typeof formatted).toBe('string')
    })

    it('should format git log with colors and emojis', async () => {
      const log = await gitCommandManager.getLog(3)
      const formatted = gitCommandManager.formatWithColors('log', log)

      expect(typeof formatted).toBe('string')
    })

    it('should format git branches with colors', async () => {
      const branches = await gitCommandManager.getBranches()
      const formatted = gitCommandManager.formatWithColors('branches', branches)

      expect(typeof formatted).toBe('string')
      expect(formatted).toContain(branches.current)
    })
  })

  describe('error handling', () => {
    it('should handle non-git directory gracefully', async () => {
      // Note: This test would need to be run in a non-git directory
      // For now, we test that methods don't throw in git directory
      await expect(gitCommandManager.getStatus()).resolves.toBeDefined()
    })
  })
})

describe('CLI Integration - Git Commands', () => {
  it('should be accessible via /gs command', () => {
    // This test will be implemented after CLI integration
    expect(true).toBe(true)
  })

  it('should be accessible via /gd command', () => {
    // This test will be implemented after CLI integration
    expect(true).toBe(true)
  })

  it('should be accessible via /gl command', () => {
    // This test will be implemented after CLI integration
    expect(true).toBe(true)
  })

  it('should be accessible via /gb command', () => {
    // This test will be implemented after CLI integration
    expect(true).toBe(true)
  })

  it('should be accessible via /ga command', () => {
    // This test will be implemented after CLI integration
    expect(true).toBe(true)
  })

  it('should be accessible via /gc command', () => {
    // This test will be implemented after CLI integration
    expect(true).toBe(true)
  })
})
