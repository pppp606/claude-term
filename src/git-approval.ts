import { execSync } from 'child_process'
import * as readline from 'readline'

export interface ApprovalResult {
  action: 'approved' | 'rejected' | 'modify'
  message: string
}

export class GitApprovalManager {
  promptForApproval(commitMessage: string): Promise<boolean | 'modify'> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      })

      console.log(`\n🔍 Commit: ${commitMessage}`)
      console.log('\n📝 Options:')
      console.log('  y - Approve and proceed')
      console.log('  n - Reject (no action)')
      console.log('  m - Modify commit')

      rl.question('\n❓ Approve commit? (y/n/m): ', (answer) => {
        rl.close()

        const response = answer.toLowerCase().trim()
        if (response === 'y' || response === 'yes') {
          resolve(true)
        } else if (response === 'm' || response === 'modify') {
          resolve('modify')
        } else {
          resolve(false)
        }
      })
    })
  }

  processApprovalAction(
    approval: boolean | 'modify',
    _commitMessage: string
  ): Promise<ApprovalResult> {
    return Promise.resolve().then(() => {
      if (approval === true) {
        return {
          action: 'approved',
          message: 'Commit approved for push',
        }
      } else if (approval === 'modify') {
        return {
          action: 'modify',
          message: 'Commit marked for modification',
        }
      } else {
        return {
          action: 'rejected',
          message: 'Commit rejected, no action taken',
        }
      }
    })
  }

  async interactiveApprovalFlow(): Promise<ApprovalResult> {
    try {
      // Get latest commit message
      const commitMessage = execSync('git log -1 --pretty=format:"%s"', {
        encoding: 'utf8',
      }).trim()

      console.log('\n🚀 Interactive Commit Approval')
      console.log('═'.repeat(50))

      const approval = await this.promptForApproval(commitMessage)
      const result = await this.processApprovalAction(approval, commitMessage)

      console.log(`\n✅ ${result.message}`)
      return result
    } catch (error) {
      console.error('❌ Approval flow failed:', error)
      throw error
    }
  }

  amendCommit(newMessage: string): Promise<void> {
    return Promise.resolve().then(() => {
      try {
        execSync(`git commit --amend -m "${newMessage}"`, {
          encoding: 'utf8',
          stdio: 'inherit',
        })
        console.log('✅ Commit amended successfully')
      } catch (error) {
        throw new Error('Failed to amend commit')
      }
    })
  }

  rollbackCommit(): Promise<void> {
    return Promise.resolve().then(() => {
      try {
        execSync('git reset --soft HEAD~1', {
          encoding: 'utf8',
          stdio: 'inherit',
        })
        console.log('🔄 Commit rolled back successfully')
      } catch (error) {
        throw new Error('Failed to rollback commit')
      }
    })
  }
}