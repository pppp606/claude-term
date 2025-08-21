---
allowed-tools: [Read, WebFetch, Bash, Grep, Glob, Task, TodoWrite]
description: Github Issueの仕様を分析し、不明点を質問してissueを更新します[/issue-task-review https://github.com/user/repo/issues/123]
---

## 概要

`issue-task-run`実行前の準備段階として、Github IssueのURLを受け取り、内容を詳細分析して仕様の不明瞭な点や実装上の選択肢について質問を生成します。ユーザーからの回答を受け取り、それをissueのbodyに追記して仕様を明確化します。

## 引数

- `$ARGUMENTS`: Github IssueのURL

## context

- 関連コマンド: @.claude/commands/issue-task-run.md
- プロジェクト情報: @CLAUDE.md

## 処理フロー

### 1. Issue内容の取得と分析 (Task Tool使用)
- github issue $ARGUMENTS を参照
- このissueの内容を詳細に分析し、仕様の不明瞭な点を洗い出す

### 2. 質問の生成
以下の観点で不明点を特定：

#### 技術実装
- アーキテクチャパターンの選択肢
- データ構造・インターフェース設計
- エラーハンドリング方針
- テスト戦略

#### 機能要件
- 入力パラメータの詳細仕様
- 出力フォーマット
- パフォーマンス要件
- 既存機能との連携

#### UX・操作性
- コマンドライン引数設計
- ユーザーメッセージ
- 設定項目

### 3. ユーザーへの質問提示
番号付きリストで質問を提示し、回答を待機

### 4. Issue更新 (Task Tool使用)
ユーザーの回答をissueのbodyに追記：

```markdown
---

## 🔍 仕様明確化 (YYYY-MM-DD)

### 質問と回答

1. **[質問内容]**
   - **回答**: [ユーザー回答]
   - **採用方針**: [実装方針]

### 実装ガイドライン
- [明確化された実装指針]
- [注意点・テスト観点]
```

ghコマンドでissueのbody更新を実行

## 使用例

```bash
/issue-task-review https://github.com/owner/repo/issues/123
```