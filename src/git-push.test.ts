import { GitPushManager } from './git-push.js'

describe('GitPushManager', () => {
  let gitPush: GitPushManager

  beforeEach(() => {
    gitPush = new GitPushManager()
  })

  describe('validateRemoteBranch', () => {
    it('should validate existing remote branch', async () => {
      const execSyncSpy = jest.spyOn(require('child_process'), 'execSync')
      execSyncSpy.mockReturnValue('origin/main')

      const result = await gitPush.validateRemoteBranch('main')

      expect(result).toBe(true)
      expect(execSyncSpy).toHaveBeenCalledWith(
        'git ls-remote --heads origin main',
        expect.any(Object),
      )

      execSyncSpy.mockRestore()
    })

    it('should return false for non-existent remote branch', async () => {
      const execSyncSpy = jest.spyOn(require('child_process'), 'execSync')
      execSyncSpy.mockReturnValue('')

      const result = await gitPush.validateRemoteBranch('non-existent')

      expect(result).toBe(false)
      execSyncSpy.mockRestore()
    })

    it('should handle validation errors', async () => {
      const execSyncSpy = jest.spyOn(require('child_process'), 'execSync')
      execSyncSpy.mockImplementation(() => {
        throw new Error('Network error')
      })

      await expect(gitPush.validateRemoteBranch('main')).rejects.toThrow(
        'Failed to validate remote branch',
      )

      execSyncSpy.mockRestore()
    })
  })

  describe('checkForForcePush', () => {
    it('should detect force push requirement', async () => {
      const execSyncSpy = jest.spyOn(require('child_process'), 'execSync')
      execSyncSpy.mockReturnValue('main origin/main\n[behind 2]')

      const result = await gitPush.checkForForcePush()

      expect(result).toBe(true)
      execSyncSpy.mockRestore()
    })

    it('should detect normal push scenario', async () => {
      const execSyncSpy = jest.spyOn(require('child_process'), 'execSync')
      execSyncSpy.mockReturnValue('main origin/main\n[ahead 1]')

      const result = await gitPush.checkForForcePush()

      expect(result).toBe(false)
      execSyncSpy.mockRestore()
    })

    it('should handle check errors', async () => {
      const execSyncSpy = jest.spyOn(require('child_process'), 'execSync')
      execSyncSpy.mockImplementation(() => {
        throw new Error('Git error')
      })

      await expect(gitPush.checkForForcePush()).rejects.toThrow('Failed to check push status')

      execSyncSpy.mockRestore()
    })
  })

  describe('promptForPushConfirmation', () => {
    it('should prompt for normal push confirmation', async () => {
      const mockReadline = {
        question: jest.fn((_prompt, callback) => {
          callback('y')
        }),
        close: jest.fn(),
      }

      jest.spyOn(require('readline'), 'createInterface').mockReturnValue(mockReadline)

      const result = await gitPush.promptForPushConfirmation('main', false)

      expect(result).toBe(true)
      expect(mockReadline.question).toHaveBeenCalledWith(
        expect.stringContaining('push to origin/main'),
        expect.any(Function),
      )

      mockReadline.close.mockRestore()
    })

    it('should prompt for force push with warning', async () => {
      const mockReadline = {
        question: jest.fn((_prompt, callback) => {
          callback('n')
        }),
        close: jest.fn(),
      }

      jest.spyOn(require('readline'), 'createInterface').mockReturnValue(mockReadline)
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = await gitPush.promptForPushConfirmation('main', true)

      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  WARNING: Force push detected'),
      )

      mockReadline.close.mockRestore()
      consoleSpy.mockRestore()
    })
  })

  describe('executePush', () => {
    it('should execute normal push', async () => {
      const execSyncSpy = jest.spyOn(require('child_process'), 'execSync')
      execSyncSpy.mockReturnValue('Push successful')

      await gitPush.executePush('main', false)

      expect(execSyncSpy).toHaveBeenCalledWith('git push origin main', expect.any(Object))

      execSyncSpy.mockRestore()
    })

    it('should execute force push when required', async () => {
      const execSyncSpy = jest.spyOn(require('child_process'), 'execSync')
      execSyncSpy.mockReturnValue('Force push successful')

      await gitPush.executePush('main', true)

      expect(execSyncSpy).toHaveBeenCalledWith(
        'git push --force-with-lease origin main',
        expect.any(Object),
      )

      execSyncSpy.mockRestore()
    })

    it('should handle push errors', async () => {
      const execSyncSpy = jest.spyOn(require('child_process'), 'execSync')
      execSyncSpy.mockImplementation(() => {
        throw new Error('Push failed')
      })

      await expect(gitPush.executePush('main', false)).rejects.toThrow('Push failed')

      execSyncSpy.mockRestore()
    })
  })

  describe('autoPushFlow', () => {
    it('should execute complete auto-push workflow', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      // Mock all dependencies
      const mockValidateRemoteBranch = jest
        .spyOn(gitPush, 'validateRemoteBranch')
        .mockResolvedValue(true)
      const mockCheckForForcePush = jest
        .spyOn(gitPush, 'checkForForcePush')
        .mockResolvedValue(false)
      const mockPromptForPushConfirmation = jest
        .spyOn(gitPush, 'promptForPushConfirmation')
        .mockResolvedValue(true)
      const mockExecutePush = jest.spyOn(gitPush, 'executePush').mockResolvedValue(undefined)

      const result = await gitPush.autoPushFlow('main')

      expect(result.success).toBe(true)
      expect(result.pushed).toBe(true)
      expect(mockValidateRemoteBranch).toHaveBeenCalledWith('main')
      expect(mockCheckForForcePush).toHaveBeenCalled()
      expect(mockPromptForPushConfirmation).toHaveBeenCalledWith('main', false)
      expect(mockExecutePush).toHaveBeenCalledWith('main', false)

      // Restore mocks
      consoleSpy.mockRestore()
      mockValidateRemoteBranch.mockRestore()
      mockCheckForForcePush.mockRestore()
      mockPromptForPushConfirmation.mockRestore()
      mockExecutePush.mockRestore()
    })

    it('should handle user declining push', async () => {
      const mockValidateRemoteBranch = jest
        .spyOn(gitPush, 'validateRemoteBranch')
        .mockResolvedValue(true)
      const mockCheckForForcePush = jest
        .spyOn(gitPush, 'checkForForcePush')
        .mockResolvedValue(false)
      const mockPromptForPushConfirmation = jest
        .spyOn(gitPush, 'promptForPushConfirmation')
        .mockResolvedValue(false)

      const result = await gitPush.autoPushFlow('main')

      expect(result.success).toBe(true)
      expect(result.pushed).toBe(false)
      expect(result.message).toContain('declined')

      mockValidateRemoteBranch.mockRestore()
      mockCheckForForcePush.mockRestore()
      mockPromptForPushConfirmation.mockRestore()
    })
  })
})

describe('CLI Integration - auto-push features', () => {
  it('should integrate with approval workflow', () => {
    // This test will be implemented after CLI integration
    expect(true).toBe(true)
  })
})
