import { 
  GitCommandMapper, 
  ArgValidator
} from './git-command-mapping.js'
import { GitCommandManager } from './git-command-manager.js'

describe('GitCommandMapping', () => {
  let commandMapper: GitCommandMapper
  let gitCommandManager: GitCommandManager

  beforeEach(() => {
    gitCommandManager = new GitCommandManager()
    commandMapper = new GitCommandMapper(gitCommandManager)
  })

  describe('GitCommandMapper', () => {
    it('should create an instance with GitCommandManager', () => {
      expect(commandMapper).toBeInstanceOf(GitCommandMapper)
    })
  })

  describe('Command Registration', () => {
    it('should register all git commands with correct mapping', () => {
      const commands = commandMapper.getAllCommands()
      
      // Should have all 6 git commands
      expect(commands).toHaveProperty('/gs')
      expect(commands).toHaveProperty('/gd')  
      expect(commands).toHaveProperty('/gl')
      expect(commands).toHaveProperty('/gb')
      expect(commands).toHaveProperty('/ga')
      expect(commands).toHaveProperty('/gc')
      
      expect(Object.keys(commands)).toHaveLength(6)
    })

    it('should map /gs to git status command', () => {
      const commands = commandMapper.getAllCommands()
      const gsCommand = commands['/gs']

      expect(gsCommand).toBeDefined()
      expect(gsCommand.description).toBe('Show git status')
      expect(gsCommand.usage).toBe('/gs')
      expect(gsCommand.requiresArgs).toBe(false)
    })

    it('should map /gd to git diff command with optional file arg', () => {
      const commands = commandMapper.getAllCommands()
      const gdCommand = commands['/gd']

      expect(gdCommand).toBeDefined()
      expect(gdCommand.description).toBe('Show git diff')
      expect(gdCommand.usage).toBe('/gd [<file>] [--staged]')
      expect(gdCommand.requiresArgs).toBe(false)
    })

    it('should map /gl to git log command', () => {
      const commands = commandMapper.getAllCommands()
      const glCommand = commands['/gl']

      expect(glCommand).toBeDefined()
      expect(glCommand.description).toBe('Show git log')
      expect(glCommand.usage).toBe('/gl [<count>] [--oneline]')
      expect(glCommand.requiresArgs).toBe(false)
    })

    it('should map /gb to git branches command', () => {
      const commands = commandMapper.getAllCommands()
      const gbCommand = commands['/gb']

      expect(gbCommand).toBeDefined()
      expect(gbCommand.description).toBe('Show git branches')
      expect(gbCommand.usage).toBe('/gb')
      expect(gbCommand.requiresArgs).toBe(false)
    })

    it('should map /ga to git add command with required path argument', () => {
      const commands = commandMapper.getAllCommands()
      const gaCommand = commands['/ga']

      expect(gaCommand).toBeDefined()
      expect(gaCommand.description).toBe('Add files to staging')
      expect(gaCommand.usage).toBe('/ga <path...>')
      expect(gaCommand.requiresArgs).toBe(true)
    })

    it('should map /gc to git commit command with required message', () => {
      const commands = commandMapper.getAllCommands()
      const gcCommand = commands['/gc']

      expect(gcCommand).toBeDefined()
      expect(gcCommand.description).toBe('Create commit')
      expect(gcCommand.usage).toBe('/gc "<message>"')
      expect(gcCommand.requiresArgs).toBe(true)
    })
  })

  describe('Command Execution', () => {
    it('should execute /gs command successfully', async () => {
      const result = await commandMapper.executeCommand('/gs', [])

      expect(result.success).toBe(true)
      expect(result.output).toBeDefined()
      expect(typeof result.output).toBe('string')
      expect(result.error).toBeUndefined()
    })

    it('should execute /gd command without arguments', async () => {
      const result = await commandMapper.executeCommand('/gd', [])

      expect(result.success).toBe(true)
      expect(result.output).toBeDefined()
      expect(typeof result.output).toBe('string')
    })

    it('should execute /gd command with file argument', async () => {
      const result = await commandMapper.executeCommand('/gd', ['test-file.js'])

      expect(result.success).toBe(true)
      expect(result.output).toBeDefined()
      expect(typeof result.output).toBe('string')
    })

    it('should execute /gd command with --staged flag', async () => {
      const result = await commandMapper.executeCommand('/gd', ['--staged'])

      expect(result.success).toBe(true)
      expect(result.output).toBeDefined()
      expect(typeof result.output).toBe('string')
    })

    it('should execute /gl command with default options', async () => {
      const result = await commandMapper.executeCommand('/gl', [])

      expect(result.success).toBe(true)
      expect(result.output).toBeDefined()
      expect(result.output).toContain('Recent commits')
    })

    it('should execute /gl command with count argument', async () => {
      const result = await commandMapper.executeCommand('/gl', ['5'])

      expect(result.success).toBe(true)
      expect(result.output).toBeDefined()
      expect(result.output).toContain('Recent commits')
    })

    it('should execute /gl command with --oneline flag', async () => {
      const result = await commandMapper.executeCommand('/gl', ['--oneline'])

      expect(result.success).toBe(true)
      expect(result.output).toBeDefined()
    })

    it('should execute /gb command successfully', async () => {
      const result = await commandMapper.executeCommand('/gb', [])

      expect(result.success).toBe(true)
      expect(result.output).toBeDefined()
      expect(result.output).toContain('Current branch')
    })

    it('should execute /ga command with file paths', async () => {
      const result = await commandMapper.executeCommand('/ga', ['test-file.js'])

      expect(result.success).toBe(true)
      expect(result.output).toBeDefined()
      expect(result.output).toContain('staged')
    })

    it('should execute /ga command with multiple files', async () => {
      const result = await commandMapper.executeCommand('/ga', ['test-file.js', 'src/'])

      expect(result.success).toBe(true)
      expect(result.output).toBeDefined()
      expect(result.output).toContain('staged')
    })

    it('should execute /gc command with commit message', async () => {
      const result = await commandMapper.executeCommand('/gc', ['test commit message'])

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('output')
      expect(typeof result.success).toBe('boolean')
      expect(typeof result.output).toBe('string')
    })
  })

  describe('Argument Validation', () => {
    it('should validate /ga command requires arguments', async () => {
      const result = await commandMapper.executeCommand('/ga', [])

      expect(result.success).toBe(false)
      expect(result.error).toBe('Command /ga requires arguments: /ga <path...>')
    })

    it('should validate /gc command requires arguments', async () => {
      const result = await commandMapper.executeCommand('/gc', [])

      expect(result.success).toBe(false)
      expect(result.error).toBe('Command /gc requires arguments: /gc "<message>"')
    })

    it('should reject unknown commands', async () => {
      const result = await commandMapper.executeCommand('/unknown', [])

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unknown git command: /unknown')
    })
  })

  describe('Command Completion', () => {
    it('should provide completions for git commands', () => {
      const completions = commandMapper.getCompletions('/g')
      
      expect(completions).toContain('/gs')
      expect(completions).toContain('/gd')
      expect(completions).toContain('/gl')
      expect(completions).toContain('/gb')
      expect(completions).toContain('/ga')
      expect(completions).toContain('/gc')
    })

    it('should provide exact match completion', () => {
      const completions = commandMapper.getCompletions('/gs')
      
      expect(completions).toContain('/gs')
      expect(completions.length).toBeGreaterThanOrEqual(1)
    })

    it('should return empty array for non-matching prefixes', () => {
      const completions = commandMapper.getCompletions('/x')
      
      expect(completions).toHaveLength(0)
    })
  })

  describe('Help System', () => {
    it('should provide help for all commands', () => {
      const help = commandMapper.getHelpText()

      expect(help).toContain('Git Commands:')
      expect(help).toContain('/gs - Show git status')
      expect(help).toContain('/gd - Show git diff')
      expect(help).toContain('/gl - Show git log')
      expect(help).toContain('/gb - Show git branches')
      expect(help).toContain('/ga - Add files to staging')
      expect(help).toContain('/gc - Create commit')
    })

    it('should provide help for specific command', () => {
      const help = commandMapper.getHelpText('/gd')

      expect(help).toContain('/gd')
      expect(help).toContain('Show git diff')
      expect(help).toContain('Usage: /gd [<file>] [--staged]')
    })
  })

  describe('Error Handling', () => {
    it('should handle git command failures gracefully', async () => {
      // Test with non-existent file for /gd
      const result = await commandMapper.executeCommand('/gd', ['non-existent-file.xyz'])

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('output')
      expect(typeof result.success).toBe('boolean')
      expect(typeof result.output).toBe('string')
    })

    it('should handle invalid /ga file paths gracefully', async () => {
      const result = await commandMapper.executeCommand('/ga', ['completely-non-existent-file.xyz'])

      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to stage files')
    })
  })
})

describe('ArgValidator', () => {
  describe('parseGitDiffArgs', () => {
    it('should parse file argument correctly', () => {
      const args = ArgValidator.parseGitDiffArgs(['test.js'])
      
      expect(args.file).toBe('test.js')
      expect(args.staged).toBe(false)
    })

    it('should parse --staged flag correctly', () => {
      const args = ArgValidator.parseGitDiffArgs(['--staged'])
      
      expect(args.file).toBeUndefined()
      expect(args.staged).toBe(true)
    })

    it('should parse file and --staged together', () => {
      const args = ArgValidator.parseGitDiffArgs(['test.js', '--staged'])
      
      expect(args.file).toBe('test.js')
      expect(args.staged).toBe(true)
    })

    it('should handle empty args', () => {
      const args = ArgValidator.parseGitDiffArgs([])
      
      expect(args.file).toBeUndefined()
      expect(args.staged).toBe(false)
    })
  })

  describe('parseGitLogArgs', () => {
    it('should parse count argument correctly', () => {
      const args = ArgValidator.parseGitLogArgs(['5'])
      
      expect(args.count).toBe(5)
      expect(args.oneline).toBe(false)
    })

    it('should parse --oneline flag correctly', () => {
      const args = ArgValidator.parseGitLogArgs(['--oneline'])
      
      expect(args.count).toBe(10) // default
      expect(args.oneline).toBe(true)
    })

    it('should parse count and --oneline together', () => {
      const args = ArgValidator.parseGitLogArgs(['3', '--oneline'])
      
      expect(args.count).toBe(3)
      expect(args.oneline).toBe(true)
    })

    it('should handle invalid count gracefully', () => {
      const args = ArgValidator.parseGitLogArgs(['invalid'])
      
      expect(args.count).toBe(10) // default fallback
      expect(args.oneline).toBe(false)
    })
  })

  describe('parseCommitMessage', () => {
    it('should parse quoted message correctly', () => {
      const message = ArgValidator.parseCommitMessage(['"test commit message"'])
      
      expect(message).toBe('test commit message')
    })

    it('should parse unquoted message correctly', () => {
      const message = ArgValidator.parseCommitMessage(['test', 'commit', 'message'])
      
      expect(message).toBe('test commit message')
    })

    it('should handle single word message', () => {
      const message = ArgValidator.parseCommitMessage(['test'])
      
      expect(message).toBe('test')
    })

    it('should handle empty message', () => {
      const message = ArgValidator.parseCommitMessage([])
      
      expect(message).toBe('')
    })
  })
})