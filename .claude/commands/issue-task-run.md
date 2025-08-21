---
description: Github Issueからタスクを実行し、プルリクエスト作成します[/issue-task-run xxx]
---

## context

- Pull Requestテンプレート
  @.github/pull_request_template.md

## 📋 ルール

### コミット

**重要**: 1コミットの中には一つのコンテキストにマッチするファイルのみを含め、マイクロコミットを意識する

### タスク完了時の手順

**重要**: タスクを完了した際は、必ず以下の手順を実行してください：

1. **タスクをチェック** - `- [ ]` を `- [x]` に変更
2. **完了日を追記** - `✅ **完了** (YYYY-MM-DD)` を追加
3. **関連ファイルを明記** - 作成・修正したファイル名を記載

### TDD実装ルール

1. **Red-Green-Refactorサイクル厳守**
   - テストを先に書く（Red）
   - 最小限の実装でテストを通す（Green）
   - コードを改善する（Refactor）

### 開発ワークフロー - Build-Test-Execute Cycle

**最重要**: コード変更後は必ずこのサイクルを実行する

1. **ビルド・実行・確認**:
   ```bash
   npm run build                    # TypeScriptをコンパイル
   node dist/cli.js [command]      # 実際のCLI動作確認
   ```

2. **品質チェック** (コミット前必須):
   ```bash
   npm run typecheck               # TypeScript型チェック
   npm run lint                    # ESLint準拠確認
   npm test                        # テスト実行
   ```

3. **自動修正** (エラー発生時):
   ```bash
   npm run lint:fix                # Lintエラー自動修正
   npm run format                  # コード整形
   ```

**なぜ必須か**:
- TypeScriptは事前コンパイルが必要
- 実際のCLI動作はテストだけでは検証できない
- ユーザー向け機能は手動確認が不可欠

### テストの実行

**重要**: プロジェクト特有のテスト戦略

**推奨テスト実行方法**:
- 全テストを実行: `npm test` (このプロジェクトでは高速)
- 特定テストのみ: `npm test src/session-discovery.test.ts`
- ウォッチモード: `npm run test:watch`

## 📚 参考ドキュメント

- [関連ドキュメント一覧](@docs/ai)
- [プロジェクト概要とワークフロー](@CLAUDE.md)

## 🔧 プロジェクト特有の重要情報

### Claude Code Session Discovery
- **ロックファイル位置**: `~/.claude/ide/*.lock` (NOT `/tmp/`)
- **実際の形式**: `{pid, workspaceFolders, ideName, transport, runningInWindows, authToken}`
- **ポート抽出**: ファイル名から (`16599.lock` → Port: 16599)

### 技術スタック
- **言語**: Node.js + TypeScript (ES modules)
- **CLI**: commander
- **テスト**: jest + ts-jest
- **品質**: eslint + prettier

### 実行可能コマンド例
```bash
# セッション検出
node dist/cli.js sessions

# カスタムディレクトリ指定
node dist/cli.js sessions --lock-dir /path/to/test

# ヘルプとバージョン
node dist/cli.js --help
node dist/cli.js --version
```

## 処理フロー

### タスク作成 (Task Tool使用)
- github issue #$ARGUMENTS を参照
- **重要**: issueに「🔍 仕様明確化」セクションがある場合、「質問と回答」を必ず参照して実装方針を確認
- このissueの内容を良く理解してタスク化してください
- TDDメソッドを使用してタスク化
- タスクはTodosで保持
- 作成したtodoをissueのコメントに追加
  - すでにissueのコメントにtodoがあった場合、内容を適切に更新
  - 追加でコメントがあり、修正指示の場合、修正指示を反映したtodoをコメント追加

### 初期設定 (Task Tool使用)
- `git fetch -a -p` を実行
- origin/developからブランチを作成
- [skip ci]付きの空コミット作成
- issueにopenされているpull requestが紐づいて存在している場合
  - 実装済み内容を確認し、実装を継続するようにする
- pull request作成（todoをチェックリスト化）
  - pull requestのテンプレート: @.github/PULL_REQUEST_TEMPLATE.md

### タスク実行 (各処理ごとにTask Toolを個別に使用)
- 実行前に `## 📋 ルール` の内容を復唱する
- 各タスクを順次実行
- TDD実装ルールに従い、テストファーストで開発
- **必須**: コード変更毎にBuild-Test-Execute Cycleを実行
  1. `npm run build` でビルド
  2. `node dist/cli.js [command]` で実際動作確認
  3. 品質チェック (`typecheck`, `lint`, `test`) を実行
- 完了後にコミット・プッシュ
- PRチェックリストを更新（ `- [ ]` → `- [x]` ）
- 完了日と関連ファイルを記載
- 未完了タスクがなくなるまで繰り返し
- タスクの戻り値として、実施した内容とPR更新結果を報告
- 次のタスクの実行に必要な情報は、それまでに実行したタスクの戻り値等を適切に使用する

### 終了処理
- 全部終わったらプッシュ
- 完了メッセージをpull requestのコメントに追加
