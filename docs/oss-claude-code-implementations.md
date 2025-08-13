# OSS Claude Code Implementations Reference

このドキュメントは、claude-termの機能開発における参考として、Claude Code関連のOSS実装をまとめたものです。

## 🚀 主要なVim/Neovim Claude Codeプラグイン

### 1. [coder/claudecode.nvim](https://github.com/coder/claudecode.nvim) ⭐ **最重要**
- **説明**: Claude Code Neovim IDE Extension (公式相当)
- **特徴**: 
  - 100%プロトコル互換性
  - 依存関係なし (pure Lua)
  - PROTOCOL.md でフルドキュメント化
  - `at_mentioned` と `selection_changed` イベント実装
- **重要機能**:
  - `:ClaudeCodeAdd <file-path>` - ファイル送信
  - `:ClaudeCodeSend` - 選択範囲送信
  - WebSocket MCP実装
- **技術詳細**: [PROTOCOL.md](https://github.com/coder/claudecode.nvim/blob/main/PROTOCOL.md)

### 2. [greggh/claude-code.nvim](https://github.com/greggh/claude-code.nvim)
- **説明**: Claude Code AI assistant とNeovimのシームレス統合
- **特徴**:
  - ターミナルウィンドウ統合 (`:ClaudeCode`)
  - 自動ファイルリロード
  - フローティングウィンドウサポート

### 3. [pasky/claude.vim](https://github.com/pasky/claude.vim)
- **説明**: AIペアプログラミング用Claude vimプラグイン
- **特徴**: "hacker's gateway to LLMs"

### 4. [IntoTheNull/claude.nvim](https://github.com/IntoTheNull/claude.nvim)
- **説明**: Neovim内でClaude AIとチャット・コード補完
- **特徴**:
  - Visual modeリファクタリング (`ClaudeCoding`)
  - Normal modeチャット (`Claude`)

### 5. [avifenesh/claucode.nvim](https://github.com/avifenesh/claucode.nvim)
- **説明**: Claude Code CLI用Neovimブリッジプラグイン

## 🤖 関連AIパワードNeovimプラグイン

### [yetone/avante.nvim](https://github.com/yetone/avante.nvim)
- **説明**: Cursor AI IDE風Neovim使用体験
- **Claude対応**: claude-sonnet-4-20250514, claude-3-5-haiku-latest
- **特徴**: トークンカウント、自動提案、diff生成

### [frankroeder/parrot.nvim](https://github.com/frankroeder/parrot.nvim)
- **説明**: 統合プロバイダーシステム
- **Claude対応**: claude-sonnet-4-20250514, claude-3-5-haiku-latest
- **特徴**: OpenAI互換API統一サポート

## 📡 MCPサーバー実装

### 1. [SDGLBL/mcp-claude-code](https://github.com/SDGLBL/mcp-claude-code) ⭐ **重要**
- **説明**: Claude Code機能のMCP実装
- **特徴**: プロジェクトファイル修正・改善指示の直接実行

### 2. [steipete/claude-code-mcp](https://github.com/steipete/claude-code-mcp)
- **説明**: ワンショットMCPサーバーとしてのClaude Code
- **特徴**: 権限バイパス、高速ファイル編集

### 3. [KunihiroS/claude-code-mcp](https://github.com/KunihiroS/claude-code-mcp)
- **説明**: ローカルClaude Codeコマンドとの接続
- **ツール**: explain_code, review_code, fix_code, edit_code, test_code
- **技術**: Node.js + MCP SDK, Base64エンコーディング

### 4. [54yyyu/code-mcp](https://github.com/54yyyu/code-mcp) ⭐ **参考価値高**
- **説明**: 開発環境とClaude AIをMCP経由で接続
- **特徴**:
  - ターミナルアクセス
  - ファイル操作
  - Git統合
  - SSH経由リモート接続

### 5. [auchenberg/claude-code-mcp](https://github.com/auchenberg/claude-code-mcp)
- **説明**: Claude Code codebase解析による自動生成MCP
- **特徴**: フルClaude Code機能のMCPサーバー実装

### 6. [zilliztech/claude-context](https://github.com/zilliztech/claude-context)
- **説明**: コードベース全体をコンテキスト化
- **特徴**: 
  - ハイブリッド検索 (BM25 + dense vector)
  - 数百万行対応
  - Merkle tree増分インデックス

## 🔧 その他有用なツール

### [BeehiveInnovations/zen-mcp-server](https://github.com/BeehiveInnovations/zen-mcp-server)
- **説明**: Claude Code + 複数LLM (Gemini/OpenAI/Grok等) 統合

### [iansinnott/obsidian-claude-code-mcp](https://github.com/iansinnott/obsidian-claude-code-mcp)
- **説明**: Claude CodeとObsidianノートをMCP経由で接続

### [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code)
- **説明**: Claude Code用コマンド・ファイル・ワークフローのキュレーション

## 🛠 claude-termにとって重要な技術詳細

### WebSocketプロトコル (coder/claudecode.nvimより)

#### `at_mentioned` イベント (ファイル送信用) ⭐ **実装予定**
```json
{
  "method": "at_mentioned", 
  "params": {
    "filePath": "/path/to/file",
    "lineStart": 10,
    "lineEnd": 20
  }
}
```

#### `selection_changed` イベント (テキスト選択送信用)
```json
{
  "method": "selection_changed",
  "params": {
    "text": "selected text content", 
    "filePath": "/absolute/path/to/file.js",
    "selection": {
      "start": { "line": 10, "character": 5 },
      "end": { "line": 15, "character": 20 }
    }
  }
}
```

#### 認証ヘッダー
```
x-claude-code-ide-authorization: [UUID_TOKEN]
```

### MCP通信パターン
- JSON-RPC 2.0フォーマット
- WebSocket双方向通信
- リソース更新通知 (`notifications/resources/list_changed`)

## 📚 ドキュメント・ガイド

- [Claude Code Best Practices - Anthropic](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Model Context Protocol Quickstart](https://modelcontextprotocol.io/quickstart/user)
- [Claude Code MCP Configuration](https://docs.anthropic.com/en/docs/claude-code/mcp)

## 🎯 claude-term次期実装で参考にすべきポイント

1. **最優先**: `coder/claudecode.nvim` の `at_mentioned` イベント実装
2. **認証**: UUID トークン + WebSocketヘッダー
3. **MCP統合**: リソース通知システム
4. **ファイル操作**: `54yyyu/code-mcp` のターミナル統合パターン
5. **コード解析**: `zilliztech/claude-context` の検索実装

---

*最終更新: 2025-08-13*
*claude-term開発チーム用リファレンス*