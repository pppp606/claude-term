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

Since this is a new project in early development, the following commands will need to be set up:

```bash
# Install dependencies (once package.json exists)
npm install

# Run tests (once jest is configured)
npm test

# Run linting (once eslint is configured)
npm run lint

# Format code (once prettier is configured)
npm run format

# Build TypeScript (once configured)
npm run build

# Run in development mode (once configured)
npm run dev
```

## Architecture Overview

The project follows a TDD (Test-Driven Development) approach with Red-Green-Refactor cycles. Key architectural components planned:

1. **MCP Session Discovery**: Scans `/tmp/claude-*.lock` files to find available Claude Code sessions
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
