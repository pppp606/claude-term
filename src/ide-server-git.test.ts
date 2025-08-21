import { ClaudeTermIDEServer } from './ide-server.js'

describe('ClaudeTermIDEServer Git Integration', () => {
  let server: ClaudeTermIDEServer
  let consoleSpy: jest.SpyInstance

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()
    
    // Mock console.log to avoid test output noise
    consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    
    server = new ClaudeTermIDEServer({
      workspaceFolder: process.cwd(),
      ideName: 'test-server',
    })
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  describe('Git command integration', () => {
    it('should initialize with GitCommandMapper and GitCommandManager', () => {
      // Verify server can be created with Git functionality
      expect(server).toBeDefined()
      
      // Verify the git components exist on the server
      expect((server as any).gitCommandManager).toBeDefined()
      expect((server as any).gitCommandMapper).toBeDefined()
    })

    it('should process /gs command through GitCommandMapper', async () => {
      // Test that git status command is recognized and processed
      await (server as any).processCommand('/gs')

      // Should execute without throwing an error
      // The actual output depends on the current git status, 
      // but we verify that console.log was called (output was generated)
      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should process /gd command with arguments', async () => {
      // Test that git diff command is recognized and processed
      await (server as any).processCommand('/gd')

      // Should execute without throwing an error
      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should process /gl command with count argument', async () => {
      // Test that git log command is recognized and processed
      await (server as any).processCommand('/gl 5')

      // Should execute without throwing an error
      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should process /gb command', async () => {
      // Test that git branches command is recognized and processed
      await (server as any).processCommand('/gb')

      // Should execute without throwing an error
      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should process /ga command with file arguments', async () => {
      // Test that git add command is recognized and processed
      // Using a non-existent file to avoid side effects
      await (server as any).processCommand('/ga non-existent-file.txt')

      // Should execute without throwing an error (though it may fail gracefully)
      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should process /gc command with commit message', async () => {
      // Test that git commit command is recognized and processed
      await (server as any).processCommand('/gc "test commit message"')

      // Should execute without throwing an error (though it may fail if nothing to commit)
      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should handle git command errors gracefully', async () => {
      // Test error handling with a command that should fail
      await (server as any).processCommand('/ga non-existent-file.txt')

      // Should not throw an error, but handle it gracefully
      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should handle unknown git commands', async () => {
      await (server as any).processCommand('/gx invalid-git-command')

      // Should display unknown command message
      expect(consoleSpy).toHaveBeenCalledWith('Unknown command: /gx invalid-git-command')
    })

    it('should display git help when /help command is used', async () => {
      await (server as any).processCommand('/help')

      expect(consoleSpy).toHaveBeenCalledWith('📋 Claude Term IDE Server - Available Commands')
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🔄 Git Integration:'))
    })
  })

  describe('Tab completion for git commands', () => {
    it('should include git commands in tab completion results', () => {
      // Access the private completeCommand method
      const [completions] = (server as any).completeCommand('/g')

      // Should include git commands
      expect(completions).toContain('/gs')
      expect(completions).toContain('/gd')
      expect(completions).toContain('/gl')
      expect(completions).toContain('/gb')
      expect(completions).toContain('/ga ')  // Note: /ga has space for file completion
      expect(completions).toContain('/gc')
    })

    it('should provide file completions for /ga command', () => {
      // Test that /ga gets file completion support like /cat and /send
      const [completions] = (server as any).completeCommand('/ga src/')

      // Should use existing file completion logic
      expect(completions).toBeDefined()
    })

    it('should match git command prefixes correctly', () => {
      const [completions] = (server as any).completeCommand('/gs')

      expect(completions).toContain('/gs')
    })
  })

  describe('Integration with existing command pipeline', () => {
    it('should not interfere with existing /help command', async () => {
      await (server as any).processCommand('/help')

      // Should still display existing help content with new format
      expect(consoleSpy).toHaveBeenCalledWith('📋 Claude Term IDE Server - Available Commands')
      expect(consoleSpy).toHaveBeenCalledWith('  /send <path>     - Send file to Claude directly')
      expect(consoleSpy).toHaveBeenCalledWith('  /cat <path>      - Display file interactively, select text to send to Claude')
    })

    it('should not interfere with existing /review-push command', async () => {
      // Test that /review-push doesn't get routed to git command handler
      // Mock the git review to avoid the interactive less pager in tests
      const gitReviewSpy = jest.spyOn((server as any).gitReview, 'displayCommitReview')
        .mockImplementation(async () => {
          console.log('🔍 Reviewing commits...')
        })
      
      // Mock readline to avoid hanging on user input
      const mockQuestionInterface = {
        question: jest.fn((_prompt, callback) => {
          console.log('❓ Mock approval prompt')
          callback('n') // Auto-reject to avoid hanging
        }),
        close: jest.fn()
      }
      
      jest.spyOn(require('readline'), 'createInterface').mockReturnValue(mockQuestionInterface)
      
      try {
        await (server as any).processCommand('/review-push')
        
        // Should have called the git review functionality
        expect(gitReviewSpy).toHaveBeenCalled()
        expect(consoleSpy).toHaveBeenCalled()
      } finally {
        gitReviewSpy.mockRestore()
      }
    })

    it('should not interfere with existing /send command', async () => {
      await (server as any).processCommand('/send test.txt')

      // Should still execute existing send logic
      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should handle mixed git and non-git commands in completion', () => {
      const [completions] = (server as any).completeCommand('/h')

      // Should include both git completions and existing commands
      expect(completions).toContain('/help')
      // Git commands starting with /h should not be included (none exist)
      expect(completions).not.toContain('/gs')
    })
  })
})
