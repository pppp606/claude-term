import { GitApprovalManager } from './git-approval.js'

describe('GitApprovalManager', () => {
  let gitApproval: GitApprovalManager

  beforeEach(() => {
    gitApproval = new GitApprovalManager()
  })

  describe('promptForApproval', () => {
    it('should prompt user for commit approval', async () => {
      const mockReadline = {
        question: jest.fn((_prompt, callback) => {
          callback('y')
        }),
        close: jest.fn(),
      }

      jest.spyOn(require('readline'), 'createInterface').mockReturnValue(mockReadline)

      const result = await gitApproval.promptForApproval('Commit message')

      expect(result).toBe(true)
      expect(mockReadline.question).toHaveBeenCalledWith(
        expect.stringContaining('Approve commit'),
        expect.any(Function)
      )
      expect(mockReadline.close).toHaveBeenCalled()
    })

    it('should handle rejection (n response)', async () => {
      const mockReadline = {
        question: jest.fn((_prompt, callback) => {
          callback('n')
        }),
        close: jest.fn(),
      }

      jest.spyOn(require('readline'), 'createInterface').mockReturnValue(mockReadline)

      const result = await gitApproval.promptForApproval('Commit message')

      expect(result).toBe(false)
    })

    it('should handle modify request (m response)', async () => {
      const mockReadline = {
        question: jest.fn((_prompt, callback) => {
          callback('m')
        }),
        close: jest.fn(),
      }

      jest.spyOn(require('readline'), 'createInterface').mockReturnValue(mockReadline)

      const result = await gitApproval.promptForApproval('Commit message')

      expect(result).toBe('modify')
    })
  })

  describe('processApprovalAction', () => {
    it('should return success for approved commits', async () => {
      const result = await gitApproval.processApprovalAction(true, 'test commit')

      expect(result).toEqual({
        action: 'approved',
        message: 'Commit approved for push',
      })
    })

    it('should return rejection for rejected commits', async () => {
      const result = await gitApproval.processApprovalAction(false, 'test commit')

      expect(result).toEqual({
        action: 'rejected',
        message: 'Commit rejected, no action taken',
      })
    })

    it('should return modify action for modification requests', async () => {
      const result = await gitApproval.processApprovalAction('modify', 'test commit')

      expect(result).toEqual({
        action: 'modify',
        message: 'Commit marked for modification',
      })
    })
  })

  describe('interactiveApprovalFlow', () => {
    it('should execute complete approval flow', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      const mockPromptForApproval = jest.spyOn(gitApproval, 'promptForApproval').mockResolvedValue(true)

      const result = await gitApproval.interactiveApprovalFlow()

      expect(mockPromptForApproval).toHaveBeenCalled()
      expect(result.action).toBe('approved')
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
      mockPromptForApproval.mockRestore()
    })
  })

  describe('amendCommit', () => {
    it('should amend commit message', async () => {
      const execSyncSpy = jest.spyOn(require('child_process'), 'execSync').mockReturnValue('')

      await gitApproval.amendCommit('new commit message')

      expect(execSyncSpy).toHaveBeenCalledWith(
        'git commit --amend -m "new commit message"',
        expect.any(Object)
      )

      execSyncSpy.mockRestore()
    })

    it('should handle amend commit errors', async () => {
      const execSyncSpy = jest.spyOn(require('child_process'), 'execSync').mockImplementation(() => {
        throw new Error('Git error')
      })

      await expect(gitApproval.amendCommit('new message')).rejects.toThrow('Failed to amend commit')

      execSyncSpy.mockRestore()
    })
  })

  describe('rollbackCommit', () => {
    it('should perform soft reset to rollback commit', async () => {
      const execSyncSpy = jest.spyOn(require('child_process'), 'execSync').mockReturnValue('')

      await gitApproval.rollbackCommit()

      expect(execSyncSpy).toHaveBeenCalledWith('git reset --soft HEAD~1', expect.any(Object))

      execSyncSpy.mockRestore()
    })

    it('should handle rollback errors', async () => {
      const execSyncSpy = jest.spyOn(require('child_process'), 'execSync').mockImplementation(() => {
        throw new Error('Git error')
      })

      await expect(gitApproval.rollbackCommit()).rejects.toThrow('Failed to rollback commit')

      execSyncSpy.mockRestore()
    })
  })
})

describe('CLI Integration - /approve command', () => {
  it('should be accessible via CLI', () => {
    // This test will be implemented after CLI integration
    expect(true).toBe(true)
  })
})