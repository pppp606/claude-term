# claude-term

`claude-term` is a lightweight IDE server for Claude Code that enables AI-assisted coding entirely from the terminal. It provides full Claude Code functionality without requiring heavy GUI IDEs.

## What is claude-term?

Instead of using Claude Code through IDEs like VSCode or Cursor, `claude-term` acts as a minimal IDE server that Claude Code can connect to. This allows you to:

- **Terminal-native AI coding**: Use Claude Code features in any terminal environment
- **Zero GUI dependencies**: No need for VSCode, Cursor, or other heavy IDEs
- **Remote/headless friendly**: Perfect for SSH sessions and server environments  
- **Your terminal, your rules**: Full control with native CLI tools integration

## Architecture

```
┌─────────────┐    WebSocket/MCP    ┌──────────────┐
│   Claude    │ ◄─────────────────► │ claude-term  │
│   Code      │   at_mentioned      │ IDE Server   │
└─────────────┘   file sharing      └──────────────┘
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │ Your Project │
                                    │ (fzf, delta, │
                                    │  bat, rg)    │
                                    └──────────────┘
```

**Key Features:**
- Bidirectional MCP (Model Context Protocol) communication
- File sharing via `at_mentioned` events  
- Interactive terminal commands with CLI tool integration

## Quick Start

### Installation

```bash
# Clone and setup
git clone https://github.com/pppp606/claude-term.git
cd claude-term
npm install
npm run build
```

### Usage

1. **Start claude-term IDE server** (in your project directory):
```bash
cd /your/project
node dist/cli.js start
```

Output:
```
🚀 claude-term IDE server started
📦 IDE Name: claude-term-myproject  
📁 Workspace: /your/project
🔌 Port: 54321

📋 Next steps:
1. In Claude, run: /ide
2. Select: claude-term-myproject
3. Start coding!

Waiting for connection...
```

2. **Connect from Claude Code**:
```bash
claude
```

Then in Claude:
```
/ide
```

Select your `claude-term-myproject` from the list and start coding!

3. **Interactive Commands** (once connected):
```bash
# Browse and send files interactively
/browse

# Send specific files to Claude
/send src/app.js
/send README.md

# Display files with syntax highlighting  
/cat config.json

# Search code with ripgrep
/search "function.*authenticate"

# View active files (resources)
/active

# Get help
/help
```

## Features

### Current Features ✅

#### Core IDE Server
- **WebSocket MCP Server**: Full Model Context Protocol compatibility
- **Auto-naming**: IDE names based on directory (`claude-term-{dirname}`)
- **Duplicate Detection**: Prevents multiple servers with same name
- **Authentication**: WebSocket header-based authentication support

#### File Operations & Sharing
- **File Sending**: Send files to Claude via `at_mentioned` events 
- **Resource Management**: Active file tracking for Claude access
- **Interactive File Browser**: fzf integration for file selection
- **Syntax Highlighting**: bat-powered code display with `--color=always`

#### Interactive Commands
- **`/send <path>`**: Send files directly to Claude Code
- **`/browse`**: Interactive file picker with preview
- **`/cat <path>`**: Display files with syntax highlighting
- **`/search <pattern>`**: ripgrep-powered code search  
- **`/active`**: View active files (resources)
- **Tab Completion**: Smart command and file path completion

#### Diff & Display
- **Delta Integration**: Beautiful diff rendering with Dracula theme
- **File Change Detection**: Automatic diff display for file modifications
- **Multiple Fallbacks**: Graceful degradation (delta → diff → cat)

### Planned Features 🚧
- **Line Range Selection**: Send specific line ranges with `at_mentioned`
- **Selection Events**: `selection_changed` event implementation
- **Enhanced Search**: Multi-line pattern support
- **Custom Themes**: Configurable color schemes

## Command Line Options

```bash
# Basic usage (uses current directory)
node dist/cli.js start

# Custom options
node dist/cli.js start --name my-ide-server
node dist/cli.js start --port 8080  
node dist/cli.js start --workspace /path/to/project

# List available Claude Code sessions
node dist/cli.js sessions

# Connect to existing session (interactive mode)
node dist/cli.js connect

# Connect to specific session
node dist/cli.js connect --port 8080

# Enable debug logging
CLAUDE_TERM_DEBUG=1 node dist/cli.js start --name debug-session
```

## Development

### Tech Stack
- **Language**: Node.js with TypeScript
- **CLI Framework**: commander
- **Testing**: jest + ts-jest
- **Code Style**: eslint + prettier

### Development Commands

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Lint
npm run lint

# Type check
npm run typecheck
```

### Testing Your Changes

```bash
# Build and test
npm run build
node dist/cli.js start --name test-ide

# Test with debug logging
CLAUDE_TERM_DEBUG=1 node dist/cli.js start --name debug-test

# In another terminal  
claude
# Then /ide and select test-ide

# Test file sending
# (once connected in interactive session)
/send package.json
/browse
```

## Comparison with Traditional IDEs

| Feature | Traditional IDE | claude-term |
|---------|----------------|-------------|
| **Resource Usage** | High (GB of RAM) | Minimal (MB of RAM) |
| **Installation** | Complex setup | Simple npm install |
| **Customization** | IDE-specific | Your terminal, your rules |
| **Remote Work** | X11/VNC required | SSH-friendly |
| **Integration** | IDE extensions | Native CLI tools |

## Troubleshooting

### "IDE server already running"
```bash
# If you see this warning, either:
# 1. Use the existing session in Claude (/ide)
# 2. Use a different name:
node dist/cli.js start --name my-project-v2
# 3. Remove the old lock file:
rm ~/.claude/ide/{port}.lock
```

### Connection Issues
- Ensure `claude-term` is running and shows "Waiting for connection..."
- Check that the IDE name matches what you see in Claude's `/ide` list
- Verify the workspace path is correct
- Try debug mode: `CLAUDE_TERM_DEBUG=1 node dist/cli.js start`

### File Sending Issues  
- Ensure Claude Code is connected (you see the interactive prompt `>`)
- Check that files exist before sending: `ls path/to/file`
- Use `/active` to see which files Claude can access
- Try `/browse` for interactive file selection with preview

### CLI Tool Dependencies (Optional)
```bash
# For enhanced experience, install these tools:
# File browsing
brew install fzf

# Syntax highlighting  
brew install bat

# Beautiful diffs
brew install git-delta

# Fast search
brew install ripgrep
```

Without these tools, claude-term will gracefully fall back to basic alternatives.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the TDD approach (write tests first)
4. Ensure all tests pass: `npm test`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.