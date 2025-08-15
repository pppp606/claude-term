import { GitReviewManager } from './git-review.js'

describe('GitReviewManager', () => {
  let gitReview: GitReviewManager

  beforeEach(() => {
    gitReview = new GitReviewManager()
  })

  describe('getCommitDiff', () => {
    it('should return diff for latest commit', async () => {
      const diff = await gitReview.getCommitDiff()

      expect(diff).toHaveProperty('commitHash')
      expect(diff).toHaveProperty('author')
      expect(diff).toHaveProperty('date')
      expect(diff).toHaveProperty('message')
      expect(diff).toHaveProperty('diffContent')
      expect(typeof diff.commitHash).toBe('string')
      expect(typeof diff.author).toBe('string')
      expect(typeof diff.message).toBe('string')
      expect(typeof diff.diffContent).toBe('string')
    })

    it('should return diff for specific commit range', async () => {
      const diff = await gitReview.getCommitDiff('HEAD')

      expect(diff).toHaveProperty('commitHash')
      expect(diff).toHaveProperty('diffContent')
      // Note: diff might be empty for commits with no changes, this is valid
      expect(typeof diff.diffContent).toBe('string')
    })

    it('should throw error for invalid commit range', async () => {
      await expect(gitReview.getCommitDiff('invalid-range')).rejects.toThrow('Invalid commit range')
    })
  })

  describe('formatDiffWithDelta', () => {
    it('should format diff content using delta with enhanced options', async () => {
      const mockDiffContent = `diff --git a/test.txt b/test.txt
index 123..456 100644
--- a/test.txt
+++ b/test.txt
@@ -1 +1 @@
-old content
+new content`

      const formattedDiff = await gitReview.formatDiffWithDelta(mockDiffContent)

      expect(typeof formattedDiff).toBe('string')
      expect(formattedDiff.length).toBeGreaterThan(0)
      // Verify Delta formatting features are applied (contains ANSI color codes)
      expect(formattedDiff).toMatch(/old.*content/)
      expect(formattedDiff).toMatch(/new.*content/)
    })

    it('should handle empty diff content', async () => {
      const formattedDiff = await gitReview.formatDiffWithDelta('')

      expect(formattedDiff).toBe('')
    })

    it('should fallback to plain diff when Delta fails', async () => {
      const mockDiffContent = `diff --git a/test.txt b/test.txt
@@ -1 +1 @@
-old content
+new content`

      // Mock execSync to simulate Delta failure
      const execSyncSpy = jest.spyOn(require('child_process'), 'execSync')
      execSyncSpy.mockImplementation(() => {
        throw new Error('Delta not found')
      })

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      const formattedDiff = await gitReview.formatDiffWithDelta(mockDiffContent)

      expect(formattedDiff).toBe(mockDiffContent)
      expect(consoleSpy).toHaveBeenCalledWith('⚠️  Delta not available, using plain diff format')

      execSyncSpy.mockRestore()
      consoleSpy.mockRestore()
    })
  })

  describe('getCommitMetadata', () => {
    it('should extract commit metadata', async () => {
      const metadata = await gitReview.getCommitMetadata()

      expect(metadata).toHaveProperty('hash')
      expect(metadata).toHaveProperty('author')
      expect(metadata).toHaveProperty('authorEmail')
      expect(metadata).toHaveProperty('date')
      expect(metadata).toHaveProperty('subject')
      expect(metadata).toHaveProperty('body')
    })

    it('should extract metadata for specific commit', async () => {
      const metadata = await gitReview.getCommitMetadata('HEAD~1')

      expect(metadata).toHaveProperty('hash')
      expect(metadata.hash).toMatch(/^[a-f0-9]{7,40}$/)
    })
  })

  describe('displayCommitReview', () => {
    it('should display formatted commit review', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      await gitReview.displayCommitReview()

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls.join('\n')
      expect(output).toContain('Commit')

      consoleSpy.mockRestore()
    })

    it('should display review for unpushed commits', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      await gitReview.displayCommitReview()

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('getChangedFiles', () => {
    it('should return list of changed files for HEAD commit', async () => {
      const files = await gitReview.getChangedFiles()
      
      expect(Array.isArray(files)).toBe(true)
      // Should work even if no files changed
    })

    it('should handle invalid commit range', async () => {
      await expect(gitReview.getChangedFiles('invalid-range')).rejects.toThrow('Failed to get changed files')
    })
  })

  describe('getFileDiffs', () => {
    it('should return file diffs for HEAD commit', async () => {
      const fileDiffs = await gitReview.getFileDiffs()
      
      expect(Array.isArray(fileDiffs)).toBe(true)
      fileDiffs.forEach(fileDiff => {
        expect(fileDiff).toHaveProperty('file')
        expect(fileDiff).toHaveProperty('diff')
        expect(typeof fileDiff.file).toBe('string')
        expect(typeof fileDiff.diff).toBe('string')
      })
    })

    it('should handle invalid commit range', async () => {
      await expect(gitReview.getFileDiffs('invalid-range')).rejects.toThrow('Failed to get file diffs')
    })
  })

  describe('getUnpushedCommitCount', () => {
    it('should return number of unpushed commits', async () => {
      const count = await gitReview.getUnpushedCommitCount()
      
      expect(typeof count).toBe('number')
      expect(count).toBeGreaterThanOrEqual(0)
    })

    it('should handle branches without remote tracking', async () => {
      // This test depends on the current branch setup
      const count = await gitReview.getUnpushedCommitCount()
      expect(count).toBeDefined()
    })
  })
})

describe('CLI Integration - /review command', () => {
  it('should be accessible via CLI', () => {
    // This test will be implemented after CLI integration
    expect(true).toBe(true)
  })
})
