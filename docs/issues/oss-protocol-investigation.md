# OSS Protocol Investigation & Claude Prompt Sending

## 📋 Issue Description

OSS実装から`at_mentioned`以外の利用可能なプロトコル・ツールを調査し、
特にclaude-term → Claude へのプロンプト送信機能を実装する。

## 🎯 Acceptance Criteria

### Research & Documentation
- [ ] OSS実装の詳細プロトコル調査
- [ ] 利用可能なMCP events/methods一覧化
- [ ] プロンプト送信手法の特定
- [ ] `docs/protocol-reference.md` 作成

### Implementation
- [ ] Claude へのプロンプト送信機能
- [ ] 双方向コミュニケーション強化
- [ ] 新しいMCP events対応
- [ ] エラーハンドリングとフォールバック

## 🔧 Research Targets

### Primary OSS Sources
- `coder/claudecode.nvim` (完全MCP互換)
- `54yyyu/code-mcp` (Terminal統合)
- `SDGLBL/mcp-claude-code` (Claude Code MCP実装)
- `steipete/claude-code-mcp` (One-shot MCP server)

### Investigation Areas
1. **Prompt Sending Methods**
   ```json
   // 調査対象イベント例
   {
     "method": "sampling/createMessage",
     "method": "prompts/get", 
     "method": "window/showMessage",
     "method": "notifications/user_input"
   }
   ```

2. **Advanced MCP Events**
   - `selection_changed` (テキスト選択)
   - `workspace/didChange` (ワークスペース変更)
   - `textDocument/didOpen` (ファイルオープン)
   - Custom notifications

3. **Authentication & Session Management**
   - Token-based authentication patterns
   - Session persistence mechanisms
   - Connection recovery strategies

## 📚 Implementation Tasks

### Phase 1: Deep OSS Analysis
- [ ] 各OSS実装のプロトコル解析
- [ ] WebSocket message pattern調査
- [ ] 成功/失敗パターンの特定
- [ ] コードサンプル収集

### Phase 2: Documentation Creation  
- [ ] `docs/protocol-reference.md` 作成
  - Available MCP methods一覧
  - Request/Response examples
  - Error handling patterns
  - Best practices
- [ ] `docs/prompt-sending-guide.md` 作成
- [ ] 既存`docs/oss-claude-code-implementations.md`更新

### Phase 3: Prompt Sending Implementation
- [ ] `/prompt <message>` コマンド実装
- [ ] Multiple prompt format support
- [ ] Response handling機能
- [ ] Conversation context管理

### Phase 4: Advanced Features
- [ ] Contextual prompt sending
- [ ] File content + prompt combination
- [ ] Template-based prompt system
- [ ] History/logging機能

## 🔧 Technical Implementation

### New Commands
```bash
# 基本プロンプト送信
/prompt "Explain this code structure"

# ファイルコンテキスト付きプロンプト  
/prompt-with src/app.js "Review this implementation"

# テンプレート使用
/prompt --template code-review "Check for security issues"

# 会話履歴表示
/history
```

### Expected Protocol Extensions
```typescript
interface PromptSendingMethods {
  // 直接プロンプト送信
  sendPrompt(message: string, context?: FileContext[]): Promise<Response>
  
  // 対話的プロンプト
  startConversation(initialPrompt: string): ConversationSession
  
  // コンテキスト付きプロンプト
  sendContextualPrompt(files: string[], prompt: string): Promise<Response>
}
```

## 🧪 Testing Strategy

### Research Validation
- [ ] 各OSS実装での実際のメッセージング確認
- [ ] プロトコル互換性テスト
- [ ] レスポンス形式検証

### Feature Testing  
- [ ] プロンプト送信機能のunit tests
- [ ] WebSocket通信のintegration tests
- [ ] Error scenario testing
- [ ] Performance testing

## 📋 TDD Implementation Plan

### Red-Green-Refactor Cycles
1. **Red**: `prompt-sending.test.ts` - プロンプト送信テスト
2. **Green**: `src/prompt-client.ts` - 基本プロンプト機能
3. **Refactor**: IDE server統合とUX改善

### Build-Test-Execute Cycle
```bash
# 調査・実装後の確認
npm run build
node dist/cli.js start --name test-prompts

# 品質保証
npm run typecheck
npm run lint
npm test

# 実機Claude Code連携テスト
CLAUDE_TERM_DEBUG=1 node dist/cli.js start --name debug-prompts
```

## 🎯 Success Metrics
- 新しいMCP methods/events: 5+ 発見・実装
- プロンプト送信成功率: >95%
- ドキュメント完成度: 包括的なAPI reference
- Claude Code互換性: 既存機能を破綻させない

## 💡 Expected Benefits
- Claude とのより自然な対話
- プロンプトベースのワークフロー構築
- OSS コミュニティへの貢献（知識共有）
- claude-termの差別化機能

---
**Priority**: High  
**Complexity**: High  
**Estimated**: 4-5 days