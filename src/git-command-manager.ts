import { execSync } from 'child_process'

export interface GitStatus {
  branch: string
  staged: string[]
  unstaged: string[]
  untracked: string[]
}

export interface GitCommit {
  hash: string
  author: string
  date: string
  subject: string
  oneline?: string
}

export interface GitBranches {
  local: string[]
  remote: string[]
  current: string
}

export interface GitOperationResult {
  success: boolean
  message: string
  hash?: string
}

export class GitCommandManager {
  constructor(private workspaceFolder?: string) {}

  async getStatus(): Promise<GitStatus> {
    return Promise.resolve().then(() => {
      try {
        // Get current branch
        const branch = execSync('git branch --show-current', { 
          encoding: 'utf8',
          cwd: this.workspaceFolder 
        }).trim()

        // Get status with porcelain format for easy parsing
        const statusOutput = execSync('git status --porcelain', { 
          encoding: 'utf8',
          cwd: this.workspaceFolder 
        }).trim()

        const staged: string[] = []
        const unstaged: string[] = []
        const untracked: string[] = []

        if (statusOutput) {
          statusOutput.split('\n').forEach((line) => {
            if (!line) return

            const status = line.substring(0, 2)
            const file = line.substring(3)

            // First character is staged status, second is unstaged
            if (status[0] !== ' ' && status[0] !== '?') {
              staged.push(file)
            }
            if (status[1] !== ' ') {
              if (status[1] === '?') {
                untracked.push(file)
              } else {
                unstaged.push(file)
              }
            }
          })
        }

        return {
          branch,
          staged,
          unstaged,
          untracked,
        }
      } catch (error) {
        throw new Error('Failed to get git status')
      }
    })
  }

  async getDiff(file?: string, staged = false): Promise<string> {
    return Promise.resolve().then(() => {
      try {
        let command = 'git diff'
        if (staged) {
          command += ' --cached'
        }
        if (file) {
          command += ` -- "${file}"`
        }

        const diff = execSync(command, { 
          encoding: 'utf8',
          cwd: this.workspaceFolder 
        })
        return diff
      } catch (error) {
        throw new Error('Failed to get git diff')
      }
    })
  }

  async getLog(count = 10, oneline = false): Promise<GitCommit[]> {
    return Promise.resolve().then(() => {
      try {
        let command: string
        if (oneline) {
          command = `git log --oneline -${count}`
          const output = execSync(command, { 
            encoding: 'utf8',
            cwd: this.workspaceFolder 
          }).trim()
          return output
            .split('\n')
            .filter((line) => line.trim())
            .map((line) => ({
              hash: line.split(' ')[0],
              author: '',
              date: '',
              subject: line.substring(line.indexOf(' ') + 1),
              oneline: line,
            }))
        } else {
          command = `git log --format="%H|%an|%ad|%s" -${count}`
          const output = execSync(command, { 
            encoding: 'utf8',
            cwd: this.workspaceFolder 
          }).trim()
          return output
            .split('\n')
            .filter((line) => line.trim())
            .map((line) => {
              const [hash, author, date, subject] = line.split('|')
              return {
                hash: hash || '',
                author: author || '',
                date: date || '',
                subject: subject || '',
              }
            })
        }
      } catch (error) {
        throw new Error('Failed to get git log')
      }
    })
  }

  async getBranches(): Promise<GitBranches> {
    return Promise.resolve().then(() => {
      try {
        // Get current branch
        const current = execSync('git branch --show-current', { 
          encoding: 'utf8',
          cwd: this.workspaceFolder 
        }).trim()

        // Get local branches
        const localOutput = execSync('git branch', { 
          encoding: 'utf8',
          cwd: this.workspaceFolder 
        }).trim()
        const local = localOutput
          .split('\n')
          .map((line) => line.replace(/^\*?\s*/, ''))
          .filter((branch) => branch.trim())

        // Get remote branches
        let remote: string[] = []
        try {
          const remoteOutput = execSync('git branch -r', { 
            encoding: 'utf8',
            cwd: this.workspaceFolder 
          }).trim()
          remote = remoteOutput
            .split('\n')
            .map((line) => line.replace(/^\s*origin\//, '').trim())
            .filter((branch) => branch && !branch.includes('HEAD'))
        } catch (error) {
          // No remote branches, which is fine
        }

        return {
          local,
          remote,
          current,
        }
      } catch (error) {
        throw new Error('Failed to get git branches')
      }
    })
  }

  async addFiles(files: string[]): Promise<GitOperationResult> {
    return Promise.resolve().then(() => {
      try {
        const fileArgs = files.map((f) => `"${f}"`).join(' ')
        const command = `git add ${fileArgs}`
        execSync(command, { 
          encoding: 'utf8',
          cwd: this.workspaceFolder 
        })

        return {
          success: true,
          message: `Successfully staged ${files.length} file(s)`,
        }
      } catch (error) {
        return {
          success: false,
          message: `Failed to stage files: ${error instanceof Error ? error.message : String(error)}`,
        }
      }
    })
  }

  async createCommit(message: string): Promise<GitOperationResult> {
    return Promise.resolve().then(() => {
      try {
        // Check if there's anything to commit by using git diff --cached
        const statusOutput = execSync('git diff --cached --name-only', { 
          encoding: 'utf8',
          cwd: this.workspaceFolder 
        }).trim()
        if (!statusOutput) {
          return {
            success: false,
            message: 'Nothing staged to commit',
          }
        }

        const command = `git commit -m "${message}"`
        const output = execSync(command, { 
          encoding: 'utf8',
          cwd: this.workspaceFolder 
        })

        // Extract commit hash from output
        const hashMatch = output.match(/\[[\w\s]+ ([a-f0-9]+)\]/)
        const hash = hashMatch ? hashMatch[1] : ''

        return {
          success: true,
          message: 'Commit created successfully',
          hash,
        }
      } catch (error) {
        return {
          success: false,
          message: `Failed to create commit: ${error instanceof Error ? error.message : String(error)}`,
        }
      }
    })
  }

  formatWithColors(type: string, data: unknown): string {
    switch (type) {
      case 'status':
        return this.formatStatus(data as GitStatus)
      case 'diff':
        return this.formatDiff(data as string)
      case 'log':
        return this.formatLog(data as GitCommit[])
      case 'branches':
        return this.formatBranches(data as GitBranches)
      default:
        return String(data)
    }
  }

  private formatStatus(status: GitStatus): string {
    let output = ''
    output += `📍 On branch: ${status.branch}\n\n`

    if (status.staged.length > 0) {
      output += `✅ Staged files (${status.staged.length}):\n`
      status.staged.forEach((file) => {
        output += `  + ${file}\n`
      })
      output += '\n'
    }

    if (status.unstaged.length > 0) {
      output += `⚠️  Modified files (${status.unstaged.length}):\n`
      status.unstaged.forEach((file) => {
        output += `  ~ ${file}\n`
      })
      output += '\n'
    }

    if (status.untracked.length > 0) {
      output += `❓ Untracked files (${status.untracked.length}):\n`
      status.untracked.forEach((file) => {
        output += `  ? ${file}\n`
      })
      output += '\n'
    }

    if (
      status.staged.length === 0 &&
      status.unstaged.length === 0 &&
      status.untracked.length === 0
    ) {
      output += '✨ Working directory clean\n'
    }

    return output
  }

  private formatDiff(diff: string): string {
    if (!diff.trim()) {
      return '📝 No changes to display\n'
    }

    // For now, return the raw diff. Later we can integrate with delta like GitReviewManager
    return diff
  }

  private formatLog(commits: GitCommit[]): string {
    if (commits.length === 0) {
      return '📝 No commits found\n'
    }

    let output = `📝 Recent commits (${commits.length}):\n\n`

    commits.forEach((commit) => {
      if (commit.oneline) {
        output += `  ${commit.oneline}\n`
      } else {
        output += `  🔸 ${commit.hash.substring(0, 7)} - ${commit.subject}\n`
        output += `    👤 ${commit.author} • ${commit.date}\n\n`
      }
    })

    return output
  }

  private formatBranches(branches: GitBranches): string {
    let output = `📍 Current branch: ${branches.current}\n\n`

    if (branches.local.length > 0) {
      output += `🌿 Local branches (${branches.local.length}):\n`
      branches.local.forEach((branch) => {
        const marker = branch === branches.current ? '→' : ' '
        output += `  ${marker} ${branch}\n`
      })
      output += '\n'
    }

    if (branches.remote.length > 0) {
      output += `🌐 Remote branches (${branches.remote.length}):\n`
      branches.remote.forEach((branch) => {
        output += `    origin/${branch}\n`
      })
    }

    return output
  }
}
