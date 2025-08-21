import { execSync } from 'child_process'
import * as readline from 'readline'

export interface PushResult {
  success: boolean
  pushed: boolean
  message: string
  branch?: string
}

export class GitPushManager {
  validateRemoteBranch(branchName: string): Promise<boolean> {
    return Promise.resolve().then(() => {
      try {
        const output = execSync(`git ls-remote --heads origin ${branchName}`, {
          encoding: 'utf8',
        })
        return output.trim().length > 0
      } catch (error) {
        throw new Error('Failed to validate remote branch')
      }
    })
  }

  checkForForcePush(): Promise<boolean> {
    return Promise.resolve().then(() => {
      try {
        const output = execSync('git status -sb', {
          encoding: 'utf8',
        })

        // Check if local branch is behind remote (would require force push)
        return output.includes('[behind') || output.includes('[diverged')
      } catch (error) {
        throw new Error('Failed to check push status')
      }
    })
  }

  promptForPushConfirmation(branchName: string, forcePush: boolean): Promise<boolean> {
    return new Promise((resolve) => {
      if (forcePush) {
        console.warn('\n⚠️  WARNING: Force push detected! This will overwrite remote history.')
        console.warn('💀 This action cannot be undone!')
      }

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      })

      const pushType = forcePush ? 'FORCE PUSH' : 'push'
      const prompt = `\n❓ ${pushType} to origin/${branchName}? (y/n): `

      rl.question(prompt, (answer) => {
        rl.close()
        const response = answer.toLowerCase().trim()

        // Small delay to ensure readline cleanup
        setImmediate(() => {
          resolve(response === 'y' || response === 'yes')
        })
      })
    })
  }

  executePush(branchName: string, forcePush: boolean): Promise<void> {
    return Promise.resolve().then(() => {
      const command = forcePush
        ? `git push --force-with-lease origin ${branchName}`
        : `git push origin ${branchName}`

      try {
        execSync(command, {
          encoding: 'utf8',
          stdio: 'inherit',
        })
        console.log(`✅ Successfully pushed to origin/${branchName}`)

        // Ensure stdout/stdin are properly flushed and reset
        if (process.stdout.isTTY) {
          process.stdout.write('')
        }
      } catch (error) {
        throw new Error(`Push failed: ${error}`)
      }
    })
  }

  async autoPushFlow(branchName: string, skipConfirmation = false): Promise<PushResult> {
    try {
      console.log('\n🔍 Validating push prerequisites...')

      // 1. Validate remote branch exists
      const remoteExists = await this.validateRemoteBranch(branchName)
      if (!remoteExists) {
        return {
          success: false,
          pushed: false,
          message: `Remote branch origin/${branchName} does not exist`,
          branch: branchName,
        }
      }

      // 2. Check if force push is required
      const requiresForcePush = await this.checkForForcePush()

      // 3. Get user confirmation (skip if already confirmed in review flow)
      if (!skipConfirmation) {
        const userConfirmed = await this.promptForPushConfirmation(branchName, requiresForcePush)

        if (!userConfirmed) {
          return {
            success: true,
            pushed: false,
            message: 'Push declined by user',
            branch: branchName,
          }
        }
      }

      // 4. Execute push
      await this.executePush(branchName, requiresForcePush)

      return {
        success: true,
        pushed: true,
        message: `Successfully pushed to origin/${branchName}`,
        branch: branchName,
      }
    } catch (error) {
      return {
        success: false,
        pushed: false,
        message: `Push failed: ${error instanceof Error ? error.message : error}`,
        branch: branchName,
      }
    }
  }
}
