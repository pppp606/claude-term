# Git Diff Review & Auto-push Workflow

## 📋 Issue Description

コミット後の差分確認とapprove機能、および自動pushワークフローを実装する。
IDE連携でのコミットレビュー体験を向上させる。

## 🎯 Acceptance Criteria

### Core Features
- [ ] コミット差分表示機能
- [ ] インタラクティブなapprove/reject機能  
- [ ] approve後の自動push実行
- [ ] 複数コミットの差分まとめ表示

### User Experience
- [ ] 美しいdiff表示（Delta統合）
- [ ] 直感的なコマンドインターフェース
- [ ] エラーハンドリングと rollback機能

## 🔧 Technical Requirements

### New Commands
```bash
# 最新コミットの差分確認
/review

# 特定コミット範囲の差分確認
/review HEAD~3..HEAD

# approve後に自動push
/approve
/approve --push-origin main
```

### Implementation Tasks

#### Phase 1: Core Diff Review
- [ ] `git show` / `git diff` 統合
- [ ] Delta による美しい差分表示
- [ ] コミットメタデータ表示（author, date, message）
- [ ] ファイル別diff表示機能

#### Phase 2: Interactive Approval
- [ ] approve/reject インターフェース
- [ ] コミット修正機能（`git commit --amend`）
- [ ] rollback機能（`git reset`）
- [ ] ステージング状態の管理

#### Phase 3: Auto-push Integration
- [ ] push前の最終確認
- [ ] リモートブランチ存在確認
- [ ] force-push防止機能
- [ ] push失敗時のエラーハンドリング

## 📚 Implementation Guidelines

### TDD Approach
1. **Red**: `git-review.test.ts` でテスト作成
2. **Green**: `src/git-review.ts` で最小実装
3. **Refactor**: IDE server統合とUX改善

### Build-Test-Execute Cycle
```bash
# 各変更後必須
npm run build
node dist/cli.js start --name test-review

# 品質チェック
npm run typecheck
npm run lint  
npm test
```

### Microcommit Strategy
- Git操作系機能の基本実装
- Interactive UI機能
- Delta統合とdiff表示
- Error handling機能
- Auto-push機能

## 🔗 Dependencies
- Delta (already integrated)
- Git CLI commands
- Interactive readline interface

## 💡 Expected Benefits
- 開発効率向上（commit-review-pushフロー自動化）
- コードレビュー品質向上
- GitOpsワークフローとの統合
- ターミナル専用環境での快適なGit体験

## 🧪 Testing Strategy
- Git repository状態のmocking
- Interactive command testing
- Delta統合テスト
- Error scenario testing

---
**Priority**: High  
**Complexity**: Medium  
**Estimated**: 2-3 days