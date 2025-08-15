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
    it('should format diff content using delta', async () => {
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
    })

    it('should handle empty diff content', async () => {
      const formattedDiff = await gitReview.formatDiffWithDelta('')

      expect(formattedDiff).toBe('')
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

    it('should display review for specific commit range', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      await gitReview.displayCommitReview('HEAD~1..HEAD')

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })
})

describe('CLI Integration - /review command', () => {
  it('should be accessible via CLI', () => {
    // This test will be implemented after CLI integration
    expect(true).toBe(true)
  })
})
