# claude-term

`claude-term` is a lightweight IDE server for Claude Code that enables AI-assisted coding entirely from the terminal. It provides full Claude Code functionality without requiring heavy GUI IDEs.

*Test multiple unpushed commits display*

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
│   Code      │   selection_changed │ IDE Server   │
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
- **Interactive Line Selection**: Select specific lines with fzf and send directly to Claude
- **File Sharing**: Send complete files via `at_mentioned` events  
- **Bidirectional MCP**: Full Model Context Protocol communication
- **CLI Tool Integration**: Native fzf, bat, delta, and ripgrep integration

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
# 📁 File Operations
/browse    # Interactive file picker with fzf
/cat src/app.js    # Interactive line selector - select and send specific lines!
/send src/app.js    # Send complete files to Claude

# 🔍 Search & Discovery
/search "function.*authenticate"    # ripgrep-powered code search
/active    # Show files Claude can access
/help      # Show all available commands
/quit      # Exit the session
```

## Key Feature: Interactive Line Selection

The standout feature of `claude-term` is **interactive line selection** with fzf:

```bash
# Open any file with the interactive selector
/cat src/components/Header.js
```

**What happens:**
1. 📄 **File opens in fzf** with numbered lines
2. 🎯 **Navigate** with ↑↓ arrows or j/k
3. ⭐ **Select lines** with Tab (multi-select supported)
4. 📤 **Send to Claude** with Enter - selected lines sent via `selection_changed` event

**Perfect for:**
- Asking Claude to explain specific code sections
- Getting suggestions for particular functions
- Debugging specific line ranges
- Code reviews on targeted areas

## Features

### Core IDE Server ✅
- **WebSocket MCP Server**: Full Model Context Protocol compatibility
- **Auto-naming**: IDE names based on directory (`claude-term-{dirname}`)
- **Duplicate Detection**: Prevents multiple servers with same name
- **Authentication**: WebSocket header-based authentication support

### Interactive Line Selection ✅ 
- **fzf Integration**: Beautiful, fast fuzzy-finding interface
- **Multi-line Selection**: Select multiple lines with Tab
- **Real-time Sending**: Selected lines sent immediately via `selection_changed`
- **Context Preservation**: Full file content included for context
- **Graceful Fallbacks**: Works without fzf (basic prompt fallback)

### File Operations & Sharing ✅
- **File Sending**: Send complete files via `at_mentioned` events 
- **Resource Management**: Active file tracking for Claude access
- **Interactive File Browser**: fzf integration for file selection
- **Syntax Highlighting**: bat-powered code display

### Search & Discovery ✅
- **ripgrep Integration**: Fast, powerful code search
- **Interactive Results**: Search results with context
- **Pattern Matching**: Full regex support

### Diff & Display ✅
- **Delta Integration**: Beautiful diff rendering
- **File Change Detection**: Automatic diff display for modifications
- **Multiple Fallbacks**: Graceful degradation (delta → diff → cat)

## Command Line Options

```bash
# Basic usage (uses current directory)
node dist/cli.js start

# Custom options
node dist/cli.js start --name my-ide-server
node dist/cli.js start --port 8080  
node dist/cli.js start --workspace /path/to/project

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

# Test core features (once connected)
/send package.json           # File sharing
/browse                     # File browser
/cat src/main.js            # Interactive line selection ⭐
/search "export.*function"  # Code search
```

## Comparison with Traditional IDEs

| Feature | Traditional IDE | claude-term |
|---------|----------------|-------------|
| **Resource Usage** | High (GB of RAM) | Minimal (MB of RAM) |
| **Installation** | Complex setup | Simple npm install |
| **Customization** | IDE-specific | Your terminal, your rules |
| **Remote Work** | X11/VNC required | SSH-friendly |
| **Integration** | IDE extensions | Native CLI tools |
| **Line Selection** | Mouse/keyboard in GUI | fzf-powered terminal interface |

## CLI Tool Dependencies (Recommended)

```bash
# For the best experience, install these tools:

# Interactive file selection and line picker
brew install fzf

# Syntax highlighting  
brew install bat

# Beautiful diffs
brew install git-delta

# Fast search
brew install ripgrep
```

**Without these tools**, claude-term gracefully falls back to basic alternatives, but the experience is significantly enhanced with them.

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

### Line Selection Issues
- Ensure `fzf` is installed: `brew install fzf`
- Check that files exist before opening with `/cat`
- Use `/browse` for guided file selection if needed
- Try basic selection without fzf as fallback

### File Sending Issues  
- Ensure Claude Code is connected (you see the interactive prompt `>`)
- Check that files exist before sending: `ls path/to/file`
- Use `/browse` for interactive file selection with preview

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the TDD approach (write tests first)
4. Ensure all tests pass: `npm test`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.