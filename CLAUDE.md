# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`claude-term` is a lightweight MCP (Model Context Protocol) client that connects Anthropic Claude Code with local CLI tools like `fzf`, `bat`, and `delta`. It enables terminal-only interaction with Claude Code's AI-assisted coding features without requiring GUI IDEs.

## Tech Stack

- **Language:** Node.js with TypeScript
- **CLI Framework:** commander
- **Testing:** jest + ts-jest (TDD approach)
- **Code Style:** eslint + prettier

## Development Commands

The following commands are available and should be used in the development workflow:

```bash
# Install dependencies
npm install

# Build TypeScript to dist/
npm run build

# Run tests with jest
npm test

# Run type checking
npm run typecheck

# Run linting
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code
npm run format

# Run in development mode
npm run dev
```

## Critical Development Workflow

**IMPORTANT**: Always follow this workflow when making code changes:

1. **Build-Test-Execute Cycle**: After any code changes, always run:
   ```bash
   npm run build
   node dist/cli.js [command]  # Test actual functionality
   ```

2. **Quality Checks**: Before committing, ensure all checks pass:
   ```bash
   npm run typecheck  # TypeScript type checking
   npm run lint       # ESLint compliance  
   npm test          # All test suites
   ```

3. **Auto-fix when possible**:
   ```bash
   npm run lint:fix   # Fix linting issues automatically
   npm run format     # Format code with prettier
   ```

4. **Real-world Testing**: Always test the actual CLI commands:
   ```bash
   # Test session discovery
   node dist/cli.js sessions
   
   # Test with custom directory
   node dist/cli.js sessions --lock-dir /path/to/test
   ```

This build-test-execute cycle is essential because:
- TypeScript needs to be compiled to JavaScript before execution
- Real CLI behavior may differ from unit tests
- User-facing functionality must be verified manually

## Architecture Overview

The project follows a TDD (Test-Driven Development) approach with Red-Green-Refactor cycles. Key architectural components:

1. **MCP Session Discovery**: Scans `~/.claude/ide/*.lock` files to find available Claude Code sessions
   - Real format: `{pid, workspaceFolders, ideName, transport, runningInWindows, authToken}`
   - Port extracted from filename (e.g., `16599.lock` → Port: 16599)
2. **WebSocket Connection**: Maintains persistent connection to Claude Code MCP Server
3. **Event Loop**: Interactive CLI loop for receiving and processing MCP events
4. **Diff Handling**: Processes `claude/provideEdits` events and displays diffs
5. **CLI Tool Integration**: Integrates with `fzf` for file selection, `delta` for diff display, and `bat` for syntax highlighting

## Key Implementation Notes

- The tool operates as a single CLI process once connected - no tmux/session awareness required
- Multiple Claude Code MCP Servers may run simultaneously; the client lists and allows selection
- Fallback mechanisms for when CLI tools (fzf, delta, bat) are not installed
- Machine-readable output via `--json` flag for automation
- Main command: `claude-term connect` for session selection and connection

## Development Phases

Currently planning 6+ development steps as outlined in README:

1. Development environment setup (TypeScript, testing, linting)
2. MCP session discovery via lock file parsing
3. Interactive connection and event loop
4. Diff proposal handling and file sending
5. fzf integration for improved UX
6. Delta integration and output modes
