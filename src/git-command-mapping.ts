import { GitCommandManager } from './git-command-manager.js'

/**
 * Information about a git command mapping
 */
export interface GitCommandInfo {
  /** Human-readable description of what the command does */
  description: string
  /** Usage string showing command syntax and options */
  usage: string
  /** Whether this command requires arguments to function */
  requiresArgs: boolean
}

/**
 * Result of executing a git command
 */
export interface GitCommandResult {
  /** Whether the command succeeded */
  success: boolean
  /** Output text from the command execution */
  output: string
  /** Error message if the command failed */
  error?: string
}

/**
 * Context passed to command execution functions
 */
export interface CommandExecutionContext {
  /** Workspace directory for git operations */
  workspaceFolder?: string
  /** Enable debug output */
  debug?: boolean
}

/**
 * Registry mapping command strings to their configuration
 */
export type GitCommandRegistry = {
  [commandName: string]: GitCommandInfo
}

/**
 * Valid git command names
 */
export type GitCommandName = '/gs' | '/gd' | '/gl' | '/gb' | '/ga' | '/gc'

/**
 * Git diff command arguments
 */
export interface GitDiffArgs {
  file?: string
  staged: boolean
}

/**
 * Git log command arguments  
 */
export interface GitLogArgs {
  count: number
  oneline: boolean
}

/**
 * Utilities for parsing and validating command arguments
 */
export class ArgValidator {
  /**
   * Parse git diff command arguments
   * @param args - Array of command line arguments
   * @returns Parsed diff arguments with file path and staged flag
   */
  static parseGitDiffArgs(args: string[]): GitDiffArgs {
    const result: GitDiffArgs = { file: undefined, staged: false }
    
    for (const arg of args) {
      if (arg === '--staged' || arg === '--cached') {
        result.staged = true
      } else if (!arg.startsWith('-')) {
        result.file = arg
      }
    }
    
    return result
  }

  /**
   * Parse git log command arguments
   * @param args - Array of command line arguments  
   * @returns Parsed log arguments with count and oneline flag
   */
  static parseGitLogArgs(args: string[]): GitLogArgs {
    const result: GitLogArgs = { count: 10, oneline: false }
    
    for (const arg of args) {
      if (arg === '--oneline') {
        result.oneline = true
      } else if (!arg.startsWith('-')) {
        const count = parseInt(arg, 10)
        if (!isNaN(count) && count > 0 && count <= 100) { // Limit to reasonable range
          result.count = count
        }
      }
    }
    
    return result
  }

  /**
   * Parse commit message from arguments
   * @param args - Array of command line arguments
   * @returns Parsed commit message string
   */
  static parseCommitMessage(args: string[]): string {
    if (args.length === 0) {
      return ''
    }
    
    // Join all arguments and remove surrounding quotes if present
    const message = args.join(' ')
    return message.replace(/^["']|["']$/g, '')
  }

  /**
   * Validate that a command is a known git command
   * @param command - Command string to validate
   * @returns True if the command is a valid git command
   */
  static isValidGitCommand(command: string): command is GitCommandName {
    const validCommands: GitCommandName[] = ['/gs', '/gd', '/gl', '/gb', '/ga', '/gc']
    return validCommands.includes(command as GitCommandName)
  }
}

/**
 * Maps CLI git commands to GitCommandManager operations
 * 
 * This class provides a clean interface between CLI command strings
 * (/gs, /gd, etc.) and the underlying git operations. It handles:
 * - Command registration and validation  
 * - Argument parsing and validation
 * - Command execution with error handling
 * - Tab completion support
 * - Help text generation
 */
export class GitCommandMapper {
  private readonly commands: GitCommandRegistry
  private readonly gitManager: GitCommandManager

  /**
   * Create a new GitCommandMapper
   * @param gitManager - GitCommandManager instance for executing git operations
   */
  constructor(gitManager: GitCommandManager) {
    this.gitManager = gitManager
    this.commands = this.initializeCommands()
  }

  private initializeCommands(): GitCommandRegistry {
    return {
      '/gs': {
        description: 'Show git status',
        usage: '/gs',
        requiresArgs: false,
      },
      '/gd': {
        description: 'Show git diff',
        usage: '/gd [<file>] [--staged]',
        requiresArgs: false,
      },
      '/gl': {
        description: 'Show git log',
        usage: '/gl [<count>] [--oneline]',
        requiresArgs: false,
      },
      '/gb': {
        description: 'Show git branches',
        usage: '/gb',
        requiresArgs: false,
      },
      '/ga': {
        description: 'Add files to staging',
        usage: '/ga <path...>',
        requiresArgs: true,
      },
      '/gc': {
        description: 'Create commit',
        usage: '/gc "<message>"',
        requiresArgs: true,
      },
    }
  }

  /**
   * Get all registered git commands
   * @returns Copy of the command registry
   */
  getAllCommands(): GitCommandRegistry {
    return { ...this.commands }
  }

  /**
   * Execute a git command with given arguments
   * @param command - Command string (e.g. '/gs', '/gd')
   * @param args - Array of command arguments
   * @returns Promise resolving to command execution result
   */
  async executeCommand(command: string, args: string[]): Promise<GitCommandResult> {
    const cmdInfo = this.commands[command]
    
    if (!cmdInfo) {
      return {
        success: false,
        output: '',
        error: `Unknown git command: ${command}`
      }
    }

    // Validate arguments
    if (cmdInfo.requiresArgs && args.length === 0) {
      return {
        success: false,
        output: '',
        error: `Command ${command} requires arguments: ${cmdInfo.usage}`
      }
    }

    try {
      switch (command) {
        case '/gs':
          return await this.executeGitStatus()
        
        case '/gd':
          return await this.executeGitDiff(args)
        
        case '/gl':
          return await this.executeGitLog(args)
        
        case '/gb':
          return await this.executeGitBranches()
        
        case '/ga':
          return await this.executeGitAdd(args)
        
        case '/gc':
          return await this.executeGitCommit(args)
        
        default:
          return {
            success: false,
            output: '',
            error: `Command implementation not found: ${command}`
          }
      }
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `Command execution failed: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }

  private async executeGitStatus(): Promise<GitCommandResult> {
    const status = await this.gitManager.getStatus()
    const output = this.gitManager.formatWithColors('status', status)
    
    return {
      success: true,
      output
    }
  }

  private async executeGitDiff(args: string[]): Promise<GitCommandResult> {
    const { file, staged } = ArgValidator.parseGitDiffArgs(args)
    const diff = await this.gitManager.getDiff(file, staged)
    const output = this.gitManager.formatWithColors('diff', diff)
    
    return {
      success: true,
      output
    }
  }

  private async executeGitLog(args: string[]): Promise<GitCommandResult> {
    const { count, oneline } = ArgValidator.parseGitLogArgs(args)
    const log = await this.gitManager.getLog(count, oneline)
    const output = this.gitManager.formatWithColors('log', log)
    
    return {
      success: true,
      output
    }
  }

  private async executeGitBranches(): Promise<GitCommandResult> {
    const branches = await this.gitManager.getBranches()
    const output = this.gitManager.formatWithColors('branches', branches)
    
    return {
      success: true,
      output
    }
  }

  private async executeGitAdd(args: string[]): Promise<GitCommandResult> {
    const result = await this.gitManager.addFiles(args)
    
    return {
      success: result.success,
      output: result.message,
      error: result.success ? undefined : result.message
    }
  }

  private async executeGitCommit(args: string[]): Promise<GitCommandResult> {
    const message = ArgValidator.parseCommitMessage(args)
    const result = await this.gitManager.createCommit(message)
    
    return {
      success: result.success,
      output: result.message + (result.hash ? ` (${result.hash})` : ''),
      error: result.success ? undefined : result.message
    }
  }

  /**
   * Get command completions for tab completion
   * @param prefix - Command prefix to match against
   * @returns Array of matching command names
   */
  getCompletions(prefix: string): string[] {
    const commandNames = Object.keys(this.commands)
    return commandNames.filter(cmd => cmd.startsWith(prefix))
  }

  /**
   * Get help text for commands
   * @param command - Specific command to get help for, or undefined for all commands
   * @returns Formatted help text
   */
  getHelpText(command?: string): string {
    if (command) {
      const cmdInfo = this.commands[command]
      if (cmdInfo) {
        return `${command} - ${cmdInfo.description}\nUsage: ${cmdInfo.usage}`
      } else {
        return `Unknown command: ${command}`
      }
    }

    // Return help for all commands
    let help = 'Git Commands:\n'
    for (const [cmd, info] of Object.entries(this.commands)) {
      help += `  ${cmd} - ${info.description}\n`
    }
    
    return help
  }
}