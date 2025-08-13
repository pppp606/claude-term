# claude-term

`claude-term` is a minimal IDE server for Claude Code that enables AI-assisted coding entirely from the terminal, without relying on GUI IDEs.

## What is claude-term?

Instead of using Claude Code through IDEs like VSCode or Cursor, `claude-term` acts as a lightweight IDE server that Claude Code can connect to. This allows you to:

- Use Claude Code features in any terminal environment
- Avoid heavy IDE dependencies
- Work in remote/headless environments
- Maintain full control over your development environment

## Architecture

```
┌─────────────┐    WebSocket     ┌──────────────┐
│   Claude    │ ──────────────► │ claude-term  │
│   Code      │                 │ IDE Server   │
└─────────────┘                 └──────────────┘
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │ Your Project │
                                 │ Files        │
                                 └──────────────┘
```

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
claude-term
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

## Features

### Current Features ✅
- **Minimal IDE Server**: WebSocket-based MCP server
- **Auto-naming**: IDE names based on directory (`claude-term-{dirname}`)
- **Duplicate Detection**: Prevents multiple servers with same name
- **File Operations**: Read, write, and list files
- **Workspace Integration**: Proper workspace folder detection

### Planned Features 🚧
- **Diff Display**: Visual diff rendering with `delta`
- **File Selection**: Interactive file picker with `fzf` 
- **Syntax Highlighting**: Code display with `bat`

## Command Line Options

```bash
# Basic usage (uses current directory)
claude-term

# Custom options
claude-term --name my-ide-server
claude-term --port 8080
claude-term --workspace /path/to/project
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
node dist/cli.js --name test-ide

# In another terminal
claude
# Then /ide and select test-ide
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
# 1. Use the existing session in Claude
# 2. Use a different name:
claude-term --name my-project-v2
# 3. Remove the old lock file:
rm ~/.claude/ide/{port}.lock
```

### Connection Issues
- Ensure `claude-term` is running and shows "Waiting for connection..."
- Check that the IDE name matches what you see in Claude's `/ide` list
- Verify the workspace path is correct

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the TDD approach (write tests first)
4. Ensure all tests pass: `npm test`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.