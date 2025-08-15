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
        // Use delta to format diff with same configuration as diff preview
        const deltaOutput = execSync(
          'echo "$DIFF" | delta --pager=never --syntax-theme=Dracula --no-gitconfig --file-style=omit --hunk-header-style=omit --keep-plus-minus-markers',
          {
            encoding: 'utf8',
            env: { ...process.env, DIFF: diffContent },
          },
        )
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

  getChangedFiles(commitRange?: string): Promise<string[]> {
    return Promise.resolve().then(() => {
      try {
        const range = commitRange || 'HEAD'
        const cmd = `git show --name-only --format="" ${range}`
        const output = execSync(cmd, { encoding: 'utf8' }).trim()
        return output ? output.split('\n').filter(line => line.trim()) : []
      } catch (error) {
        throw new Error('Failed to get changed files')
      }
    })
  }

  getFileDiffs(commitRange?: string): Promise<Array<{file: string, diff: string}>> {
    return Promise.resolve().then(() => {
      try {
        const range = commitRange || 'HEAD'
        let changedFilesCommand: string
        if (range.includes('..')) {
          // Range like origin/branch..HEAD
          changedFilesCommand = `git diff --name-only ${range}`
        } else {
          // Single commit like HEAD
          changedFilesCommand = `git show --name-only --format="" ${range}`
        }
        const changedFiles = execSync(changedFilesCommand, { encoding: 'utf8' })
          .trim().split('\n').filter(line => line.trim())
        
        const fileDiffs = changedFiles.map(file => {
          try {
            // Get diff content for the range
            let diffCommand: string
            if (range.includes('..')) {
              // Range like origin/branch..HEAD
              diffCommand = `git diff ${range} -- ${file}`
            } else {
              // Single commit like HEAD
              diffCommand = `git diff ${range}~1..${range} -- ${file}`
            }
            const fileDiff = execSync(diffCommand, { encoding: 'utf8' })
            return { file, diff: fileDiff }
          } catch (error) {
            return { file, diff: '' }
          }
        })
        
        return fileDiffs
      } catch (error) {
        throw new Error('Failed to get file diffs')
      }
    })
  }

  getUnpushedCommitCount(): Promise<number> {
    return Promise.resolve().then(() => {
      try {
        // Get current branch
        const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim()
        
        // Check if remote tracking branch exists
        try {
          execSync(`git rev-parse --verify origin/${currentBranch}`, { encoding: 'utf8' })
        } catch (error) {
          // No remote tracking branch, count all commits
          const totalCommits = execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim()
          return parseInt(totalCommits) || 0
        }
        
        // Count commits ahead of origin
        const aheadCount = execSync(`git rev-list --count origin/${currentBranch}..HEAD`, { encoding: 'utf8' }).trim()
        return parseInt(aheadCount) || 0
      } catch (error) {
        throw new Error('Failed to get unpushed commit count')
      }
    })
  }

  async generateCommitReviewContent(): Promise<string> {
    const unpushedCount = await this.getUnpushedCommitCount()
    
    if (unpushedCount === 0) {
      return '✅ No unpushed commits to review.'
    }
    
    // Get range for all unpushed commits
    const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim()
    let commitRange: string
    
    try {
      // Try to use origin tracking branch
      execSync(`git rev-parse --verify origin/${currentBranch}`, { encoding: 'utf8' })
      commitRange = `origin/${currentBranch}..HEAD`
    } catch (error) {
      // No remote tracking, show all commits
      commitRange = 'HEAD'
    }
    
    const fileDiffs = await this.getFileDiffs(commitRange)
    
    let content = ''
    content += `🔍 Reviewing latest commit for push...\n`
    content += `${'═'.repeat(50)}\n\n`
    content += `📝 Commit Review (${unpushedCount} unpushed commit${unpushedCount > 1 ? 's' : ''})\n\n`
    
    // Show commit list
    const commitList = execSync(`git log --oneline ${commitRange}`, { encoding: 'utf8' }).trim()
    if (commitList) {
      content += `📋 Commits to push:\n`
      commitList.split('\n').forEach(commit => {
        content += `  ${commit}\n`
      })
    }
    
    content += `\n📊 Changes:\n\n`
    
    for (const fileDiff of fileDiffs) {
      content += `📁 ${fileDiff.file}\n`
      content += `${'─'.repeat(50)}\n`
      if (fileDiff.diff) {
        const formattedDiff = await this.formatDiffWithDelta(fileDiff.diff)
        content += `${formattedDiff}\n`
      }
      content += `${'─'.repeat(50)}\n\n`
    }
    
    return content
  }

  async displayCommitReview(): Promise<void> {
    try {
      const content = await this.generateCommitReviewContent()
      
      // Try to use less with proper terminal handling
      try {
        const { spawn } = await import('child_process')
        const { writeFileSync, unlinkSync } = await import('fs')
        const { join } = await import('path')
        const { tmpdir } = await import('os')
        
        // Create temp file for less to read
        const tempFile = join(tmpdir(), `claude-commit-review-${Date.now()}.txt`)
        writeFileSync(tempFile, content)
        
        // Create less process with full stdio inheritance
        const less = spawn('less', ['-R', tempFile], {
          stdio: 'inherit',
          detached: false
        })
        
        // Return a promise that resolves when less exits
        return new Promise((resolve, reject) => {
          less.on('close', (code) => {
            // Clean up temp file
            try {
              unlinkSync(tempFile)
            } catch (error) {
              // Ignore cleanup errors
            }
            
            if (code === 0 || code === null) {
              resolve()
            } else {
              reject(new Error(`less exited with code ${code}`))
            }
          })
          
          less.on('error', (error) => {
            // Clean up temp file on error
            try {
              unlinkSync(tempFile)
            } catch (cleanupError) {
              // Ignore cleanup errors
            }
            reject(error)
          })
        })
        
      } catch (error) {
        // Fallback to console output
        console.log('\n' + '═'.repeat(80))
        console.log('🔍 COMMIT REVIEW')
        console.log('═'.repeat(80))
        console.log(content)
        console.log('═'.repeat(80))
      }
    } catch (error) {
      console.error('❌ Failed to display commit review:', error)
      throw error
    }
  }
}
