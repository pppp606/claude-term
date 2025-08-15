import { execSync } from 'child_process'

export interface CommitDiff {
  commitHash: string
  author: string
  date: string
  message: string
  diffContent: string
}

export interface CommitMetadata {
  hash: string
  author: string
  authorEmail: string
  date: string
  subject: string
  body: string
}

export class GitReviewManager {
  getCommitDiff(commitRange?: string): Promise<CommitDiff> {
    return Promise.resolve().then(() => {
      try {
        const range = commitRange || 'HEAD'

        // Get commit metadata
        const metadataCmd = `git show --format="%H|%an|%ad|%s" --no-patch ${range}`
        const metadataOutput = execSync(metadataCmd, { encoding: 'utf8' }).trim()
        const [commitHash, author, date, message] = metadataOutput.split('|')

        // Get diff content
        const diffCmd = `git show --format="" ${range}`
        const diffContent = execSync(diffCmd, { encoding: 'utf8' })

        return {
          commitHash: commitHash || '',
          author: author || '',
          date: date || '',
          message: message || '',
          diffContent: diffContent || '',
        }
      } catch (error) {
        throw new Error('Invalid commit range')
      }
    })
  }

  formatDiffWithDelta(diffContent: string): Promise<string> {
    return Promise.resolve().then(() => {
      if (!diffContent) {
        return ''
      }

      try {
        // Use delta to format diff if available with enhanced configuration
        const deltaOutput = execSync('echo "$DIFF" | delta --no-gitconfig --line-numbers --side-by-side', {
          encoding: 'utf8',
          env: { ...process.env, DIFF: diffContent },
        })
        return deltaOutput
      } catch (error) {
        // Fallback to original diff if delta is not available
        console.warn('⚠️  Delta not available, using plain diff format')
        return diffContent
      }
    })
  }

  getCommitMetadata(commitRef = 'HEAD'): Promise<CommitMetadata> {
    return Promise.resolve().then(() => {
      try {
        const cmd = `git show --format="%H|%an|%ae|%ad|%s|%b" --no-patch ${commitRef}`
        const output = execSync(cmd, { encoding: 'utf8' }).trim()
        const [hash, author, authorEmail, date, subject, body] = output.split('|')

        return {
          hash: hash || '',
          author: author || '',
          authorEmail: authorEmail || '',
          date: date || '',
          subject: subject || '',
          body: body || '',
        }
      } catch (error) {
        throw new Error(`Failed to get commit metadata for ${commitRef}`)
      }
    })
  }

  async displayCommitReview(commitRange?: string): Promise<void> {
    try {
      const diff = await this.getCommitDiff(commitRange)
      const formattedDiff = await this.formatDiffWithDelta(diff.diffContent)

      console.log(`\n📝 Commit Review\n`)
      console.log(`🔸 Hash: ${diff.commitHash}`)
      console.log(`👤 Author: ${diff.author}`)
      console.log(`📅 Date: ${diff.date}`)
      console.log(`💬 Message: ${diff.message}`)
      console.log(`\n📊 Changes:\n`)
      console.log(formattedDiff)
    } catch (error) {
      console.error('❌ Failed to display commit review:', error)
      throw error
    }
  }
}
