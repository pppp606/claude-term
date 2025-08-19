# claude-term

`claude-term` is a lightweight IDE server and MCP server for Claude Code that enables AI-assisted coding entirely from the terminal. It provides full Claude Code functionality with custom tools without requiring heavy GUI IDEs.


## What is claude-term?

Instead of using Claude Code through IDEs like VSCode or Cursor, `claude-term` provides both an IDE server and MCP server that Claude Code can connect to. This allows you to:

- **Terminal-native AI coding**: Use Claude Code features in any terminal environment
- **Custom MCP tools**: Specialized git workflow tools via Model Context Protocol
- **Zero GUI dependencies**: No need for VSCode, Cursor, or other heavy IDEs
- **Remote/headless friendly**: Perfect for SSH sessions and server environments  
- **Your terminal, your rules**: Full control with native CLI tools integration

## Architecture

```
┌─────────────┐    WebSocket         ┌──────────────┐
│   Claude    │ ◄─────────────────── │ claude-term  │
│   Code      │   selection_changed  │ IDE Server   │
│             │   file sharing       │              │
│             │                      └──────────────┘
│             │    stdio MCP               │
│             │ ◄─────────────────── ┌──────────────┐
│             │   review_push        │ claude-term  │
│             │   git_status         │ MCP Server   │
└─────────────┘                      └──────────────┘
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
- **MCP Tools**: Custom git workflow tools via Model Context Protocol
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

1. **Start claude-term servers** (both IDE and MCP, in your project directory):
```bash
cd /your/project
node dist/cli.js start
```

Output:
```
🚀 Starting claude-term servers...
📁 Workspace: /your/project
📦 IDE Name: claude-term-myproject

✅ Both servers started successfully!
🔌 IDE Server: Port 54321
🔌 MCP Server: stdio transport

📋 Next steps:
1. In Claude, run: /ide
2. Select: claude-term-myproject
3. Add MCP server: claude mcp add claude-term-myproject-tools node dist/mcp-server.js
4. Start coding!

Waiting for connections...
```

2. **Connect from Claude Code**:
```bash
claude
```

Then in Claude:
```
/ide
```

Select your `claude-term-myproject` from the list.

3. **Add MCP tools** (one-time setup):
```bash
claude mcp add claude-term-myproject-tools node dist/mcp-server.js
```

Now you have both IDE features and custom MCP tools available!

4. **Interactive Commands** (once connected):

**IDE Server Commands:**
```bash
# 📁 File Operations
/browse    # Interactive file picker with fzf
/cat src/app.js    # Interactive line selector - select and send specific lines!
/send src/app.js    # Send complete files to Claude

# 🔍 Search & Discovery
/search "function.*authenticate"    # ripgrep-powered code search
/active    # Show files Claude can access

# 🚀 Git Workflow (IDE server)
/review-push (/rp)    # Review unpushed commits and approve/reject for push

# ℹ️ Help & Control
/help      # Show all available commands
/quit      # Exit the session
```

**MCP Tools** (available directly in Claude Code):
```bash
# 🚀 Git Workflow (MCP tools)
review_push    # Review and push commits via MCP (with interactive review)
git_status     # Get current git status and unpushed commits
```

## Key Features

### Dual Server Architecture

`claude-term` provides both IDE server capabilities and MCP (Model Context Protocol) tools:

- **IDE Server**: File operations, line selection, search, and interactive terminal commands
- **MCP Server**: Custom tools for git workflows that integrate directly with Claude Code
- **Single Command Setup**: Both servers start simultaneously with `node dist/cli.js start`

### Interactive Line Selection

The standout feature of `claude-term` is **interactive line selection** with fzf:

### MCP Tools Integration

`claude-term` provides specialized MCP tools that integrate directly with Claude Code using a **dual-server architecture**:

**Architecture:**
- **IDE Server**: WebSocket server for `/ide` functionality + internal MCP server (port 12345)
- **Standalone MCP Server**: stdio transport MCP server that forwards tool calls to IDE server
- **Tool Forwarding**: MCP tool calls are forwarded via HTTP to execute in the IDE terminal

**Available MCP Tools:**
- **`review_push`**: Review unpushed commits and push after approval
- **`git_status`**: Get current git status and unpushed commit count

**Setup:**
```bash
# 1. Start both servers
node dist/cli.js start

# 2. Add MCP server to Claude Code
claude mcp add claude-term-claude-term-tools node dist/mcp-server.js

# 3. Use in Claude Code conversations
```

**How it works:**
1. Claude Code spawns standalone MCP server process (stdio transport)
2. Standalone MCP server forwards tool calls to running IDE server via HTTP
3. Tools execute in the terminal where `claude-term start` is running
4. Interactive prompts appear in your original terminal
5. Results are forwarded back to Claude Code seamlessly

**Example Usage:**
```
# In Claude Code, you can use:
Can you check the current git status and then review and push any commits?
```
Claude Code will automatically use the `git_status` and `review_push` tools, but execution happens in your terminal.

### Git Review & Push Workflow

`claude-term` includes a comprehensive Git workflow (available both as IDE commands and MCP tools):

```bash
# IDE Server command
/review-push    # or /rp for short

# MCP tool (used automatically by Claude Code)
review_push     # Called directly by Claude
```

**What happens:**
1. 📊 **Commit Analysis** - Automatically detects all unpushed commits
2. 📄 **Less Pager** - Opens scrollable diff view with Delta syntax highlighting  
3. 📋 **Commit List** - Shows all commits to be pushed with hash and message
4. 📁 **File-by-File Diffs** - Beautiful, color-coded diffs for each changed file
5. ✅ **Single Approval** - Simple y/n choice after review (no duplicate prompts)
6. 🚀 **Safe Push** - Pushes to remote if approved
7. 🔄 **Smart Reject** - If rejected, undoes all commits while preserving changes
8. 🧹 **Clean Display** - No temp file paths shown in less status line

**Perfect for:**
- Reviewing code before pushing to shared branches
- Ensuring no debug code or secrets are committed
- Double-checking complex changes
- Safe collaboration workflows
- Clean editing sessions without scattered diff outputs
- AI-assisted code review (via MCP tools)

**Enhanced Workflow:**
- Claude Code edits files → Simple "📝 File modified" notifications
- Use `/review-push` or let Claude use `review_push` MCP tool → Comprehensive diff review
- Single y/n approval → Clean push or smart rollback

### Interactive Line Selection (continued)

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

### Git Review & Push Workflow ✅
- **Unpushed Commit Detection**: Automatically finds commits ahead of origin
- **Less Pager Integration**: Scrollable diff review with clean display (no temp file paths)
- **Delta Syntax Highlighting**: Beautiful, color-coded diff display via stdin
- **Single Approval Flow**: No duplicate confirmation prompts 
- **Smart Reject**: Undo commits while preserving working directory changes
- **Multi-commit Support**: Handles single or multiple unpushed commits
- **Readline Stability**: Robust input handling without buffering issues

### Clean Edit Experience ✅
- **Streamlined File Editing**: Simple file modification notifications
- **Consolidated Diff Review**: All changes reviewed together via `/review-push`
- **No Scattered Diffs**: Clean editing experience without interrupting individual file diffs

## Command Line Options

```bash
# Start both IDE server and MCP server (recommended)
node dist/cli.js start

# Custom options for IDE server
node dist/cli.js start --name my-ide-server
node dist/cli.js start --port 8080  
node dist/cli.js start --workspace /path/to/project

# Start only MCP server (stdio transport)
node dist/cli.js mcp --name my-mcp-server

# Enable debug logging
node dist/cli.js start --debug
```

**Available Commands:**
- `start`: Start both IDE server and MCP server (recommended)
- `mcp`: Start only MCP server with stdio transport

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

# Test core features
# 1. IDE server features (once connected via /ide)
/send package.json           # File sharing
/browse                     # File browser
/cat src/main.js            # Interactive line selection ⭐
/search "export.*function"  # Code search
/rp                         # Git review & push workflow ⭐

# 2. MCP tools (available in Claude Code)
# Ask Claude: "Can you check git status and review any commits?"
# Claude will use git_status and review_push tools automatically
```

## Comparison with Traditional IDEs

| Feature | Traditional IDE | claude-term |
|---------|----------------|-------------|
| **Resource Usage** | High (GB of RAM) | Minimal (MB of RAM) |
| **Installation** | Complex setup | Simple npm install |
| **Customization** | IDE-specific | Your terminal, your rules |
| **Remote Work** | X11/VNC required | SSH-friendly |
| **Integration** | IDE extensions | Native CLI tools + MCP |
| **Line Selection** | Mouse/keyboard in GUI | fzf-powered terminal interface |
| **AI Tools** | IDE-specific extensions | Custom MCP tools + IDE server |

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

### MCP Tools Issues
- Ensure MCP server is added: `claude mcp list` should show your server
- Check MCP server status: Look for "Added stdio MCP server..." message
- Verify MCP server path: `node dist/mcp-server.js` should exist and be executable
- For permission issues: Ensure the workspace directory is accessible
- Debug MCP issues: Use `node dist/cli.js start --debug` for verbose logging

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the TDD approach (write tests first)
4. Ensure all tests pass: `npm test`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.