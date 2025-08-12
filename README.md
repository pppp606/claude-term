# claude-term

`claude-term` is a lightweight, terminal-based MCP client for [Claude Code](https://www.anthropic.com/news/claude-code),  
enabling developers to interact with Claude Code’s AI-assisted coding features entirely from the command line.

The tool integrates seamlessly with common CLI utilities such as `fzf`, `bat`, and `delta` to view files, browse git diffs, and apply AI-suggested code changes without the need for a GUI IDE.

---

## 🚀 Key Features

- **MCP Connection Management**  
  Automatically scan for running Claude Code MCP servers, list available instances, and connect to the desired session.
  
- **Terminal-First Workflow**  
  Operate entirely in the terminal, integrating with your existing CLI tools.

- **AI-Suggested Diffs**  
  Receive and display diff proposals from Claude Code directly in your terminal, optionally piping through `delta` for syntax-highlighted diffs.

- **Lightweight & Fast**  
  Designed to run with minimal overhead, without requiring tmux or GUI-based environments.

- **Extensible CLI**  
  Built on Node.js + TypeScript with a modular architecture for future extensions such as file sending, watch mode, and interactive code review.

---

## 🧩 Architecture Overview

`claude-term` acts as an **MCP client**:

1. **Claude Code MCP Server**  
   - Runs separately as the Claude Code CLI (`claude code`)  
   - Exposes a WebSocket server for MCP communication
   - Writes `.lock` and `.claude.json` files containing connection metadata

2. **claude-term MCP Client**  
   - Scans for `.lock` files to discover running MCP servers  
   - Allows the user to select an active session to connect to  
   - Sends and receives JSON-RPC messages over WebSocket  
   - Handles incoming AI proposals (e.g., diffs) and displays them in the terminal

---

## 📦 Planned Development Roadmap

### Step 0: Development Environment Setup
- Initialize TypeScript, eslint, prettier, jest
- Configure CLI entry point and basic test

### Step 1: MCP Connection Discovery
- Parse `.lock` files to list available Claude Code MCP servers
- Provide an interactive selection interface (fzf-style)

### Step 2: Diff Proposal Handling
- Receive `claude/provideEdits` JSON-RPC events
- Parse and display diffs in the terminal (optionally using `delta`)

### Step 3: Extended CLI Features
- Send files or selected code to Claude Code
- Implement watch mode to automatically receive diffs
- Provide JSON or pretty-printed outputs

---

## 📜 Usage Example (Planned)

```bash
# List available MCP connections and connect
claude-term connect

# Send a file to Claude Code for review
claude-term send src/index.ts

# Watch for incoming diff proposals and display them
claude-term watch --delta
````

---

## 📂 Planned Directory Structure

```
claude-term/
  ├── src/
  │   ├── index.ts        # CLI entry point
  │   ├── mcp/            # MCP client implementation
  │   ├── utils/          # File & lock parsing utilities
  │   └── commands/       # CLI commands
  ├── tests/
  ├── package.json
  ├── tsconfig.json
  ├── jest.config.js
  ├── .eslintrc.js
  ├── .prettierrc
  └── README.md
```

---

## 📝 License

MIT
