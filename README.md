# Project Overview: claude-term

`claude-term` is a lightweight MCP client that connects the Anthropic Claude Code (MCP Server) with local CLI tools like `fzf`, `bat`, and `delta`. It allows developers to interact with Claude Code’s AI-assisted coding features entirely from the terminal, without relying on GUI IDEs like VSCode or Cursor.

## Target Environment

* Claude Code CLI runs as an MCP Server
* Multiple Claude Code MCP Servers may run simultaneously
* `claude-term` scans MCP lock/config files to list available sessions for selection
* Receives diff proposals from Claude Code and displays them (e.g., with `delta`)
* Integrates with CLI tools like `bat`/`fzf`/`git diff`
* Once connected, no tmux/session awareness is required — all interaction happens in a single CLI process

## Tech Stack

* **Language:** Node.js (TypeScript)
* **CLI Framework:** commander
* **Testing:** jest + ts-jest (TDD: Red-Green-Refactor)
* **Code Style:** eslint + prettier

## Development Roadmap

### Step 0: Development Environment Setup (TDD)

* Initialize TypeScript + Node.js project
* Set up eslint, prettier, jest
* Create base CLI entry point and sample test

### Step 1: MCP Session Discovery (lock parsing)

* Scan `/tmp/claude-*.lock` files
* Parse session info (port/context/project)
* List sessions via CLI (non-interactive for now)

### Step 2: Interactive Connection & Event Loop

* Select session and open MCP WebSocket
* Stay connected in an interactive loop, printing incoming events
* Accept basic commands (`:quit`, placeholder for `:send`)

### Step 3: Handle Diff Proposals & Basic `:send`

* Parse `claude/provideEdits` events
* Display diffs (raw format; `--delta` integration later)
* Implement `:send <path>` to send file content to MCP

### Step 4: fzf Integration (early)

* Use `fzf` to select MCP session instead of numeric prompt
* Add `:send` with no args → open `fzf` file picker
* Fallback to basic prompt if `fzf` not installed

### Step 5: Delta Integration & Output Modes

* Add `--delta` flag to render diffs via `delta`
* Add `--json` flag for machine-readable output

### Step 6+: Extended Features

* Configuration file support
* Watch mode enhancements
* Additional MCP commands

## Name

**Tool Name:** `claude-term`

* A terminal-based MCP client for Claude Code
* Designed for CLI-first workflows without GUI dependencies

## Minimal Initial Command

* `claude-term connect` — select a session, connect, and start receiving events interactively
