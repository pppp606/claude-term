# Enhanced File Path Input with @ Prefix Suggestions

## 📋 Issue Description

`/send`等のコマンドでのファイルパス入力を改善し、プロジェクト内ファイルからの
サジェスト機能と@プレフィックスによる直感的なファイル選択を実装する。

## 🎯 Acceptance Criteria

### Core Features
- [ ] `@`プレフィックスによるファイル選択インターフェース
- [ ] プロジェクト内ファイルのfuzzy search
- [ ] 複数ファイル差分表示（選択肢が複数ある場合）
- [ ] Claude Code風のファイルサジェストUX

### User Experience  
- [ ] 高速な入力体験（<100ms response）
- [ ] キーボードナビゲーション（↑↓Enter）
- [ ] ファイルプレビュー機能
- [ ] パス補完とエラーハンドリング

## 🔧 Technical Requirements

### @ Prefix Interface
```bash
# 基本的な@ファイル選択
> /send @
# → ファイル選択UI表示

# 部分マッチング
> /send @app
# → app.js, app.ts, app.config.js等を表示

# ディレクトリ指定
> /send @src/
# → src/配下のファイル一覧

# 複数ファイル選択
> /send @*.js
# → .jsファイル一覧表示、差分も表示
```

### Enhanced Commands
```bash
# 従来の方式も維持
/send path/to/file.js

# 新しい@方式
/send @file.js
/cat @config
/browse @src/

# 複数ファイル操作
/send @*.test.js  # テストファイル一括選択
/send @package.json,@tsconfig.json  # 複数ファイル指定
```

## 📚 Implementation Tasks

### Phase 1: Core File Discovery
- [ ] プロジェクト内ファイル高速検索
- [ ] `.gitignore` ルール適用
- [ ] ファイルタイプ別フィルタリング
- [ ] Fuzzy matching algorithm実装

### Phase 2: @ Prefix Parser
- [ ] `@` プレフィックス検出・解析
- [ ] パターンマッチング（glob対応）
- [ ] 複数ファイル指定パーサー
- [ ] エラーハンドリング（ファイル未発見等）

### Phase 3: Interactive Selection UI
- [ ] ファイル選択インターフェース
- [ ] キーボードナビゲーション
- [ ] ファイルプレビュー（bat統合）
- [ ] 差分表示（複数ファイル選択時）

### Phase 4: Integration & Performance
- [ ] 既存コマンド（/send, /cat, /browse）統合
- [ ] Tab補完との協調
- [ ] パフォーマンス最適化
- [ ] メモリ効率化

## 🔧 Technical Implementation

### File Discovery Engine
```typescript
interface FileDiscovery {
  // 高速ファイル検索
  findFiles(pattern: string): Promise<FileMatch[]>
  
  // Fuzzy matching
  fuzzySearch(query: string, files: string[]): FileMatch[]
  
  // プレビュー生成
  generatePreview(filePath: string): Promise<FilePreview>
  
  // 複数ファイル差分
  compareFiles(files: string[]): FileDiff[]
}

interface FileMatch {
  path: string
  score: number
  preview: string
  lastModified: Date
}
```

### @ Prefix Processing
```typescript
interface PrefixProcessor {
  // @ パターン解析
  parseAtPattern(input: string): AtPattern
  
  // ファイルマッチング
  matchFiles(pattern: AtPattern): Promise<string[]>
  
  // 差分計算
  calculateDiffs(files: string[]): Promise<DiffSummary>
}

interface AtPattern {
  type: 'file' | 'glob' | 'directory'
  pattern: string
  modifiers: string[]
}
```

### Interactive Selection
```typescript  
interface SelectionUI {
  // 選択インターフェース表示
  showFileSelector(files: FileMatch[]): Promise<string[]>
  
  // キーボード処理
  handleKeyNavigation(key: KeyPress): void
  
  // プレビュー表示
  showPreview(file: FileMatch): void
  
  // 複数選択管理
  toggleSelection(file: FileMatch): void
}
```

## 🧪 Testing Strategy

### Unit Testing
- [ ] `file-discovery.test.ts` - ファイル検索機能
- [ ] `at-prefix-parser.test.ts` - @プレフィックス解析
- [ ] `selection-ui.test.ts` - 選択インターフェース
- [ ] `fuzzy-search.test.ts` - Fuzzy matching算法

### Integration Testing
- [ ] コマンド統合テスト（/send, /cat等）
- [ ] パフォーマンステスト（大規模プロジェクト）
- [ ] エラーシナリオテスト
- [ ] UX flow testing

### Build-Test-Execute Cycle
```bash
# 実装後の動作確認
npm run build
node dist/cli.js start --name test-file-input

# 実際のファイル選択テスト
# > /send @
# > /send @*.js
# > /cat @config

# 品質確認
npm run typecheck
npm run lint  
npm test
```

## 🎯 Performance Requirements
- ファイル検索応答時間: <100ms (10,000ファイル以下)
- fuzzy search: <50ms  
- プレビュー生成: <200ms
- メモリ使用量: <50MB (インデックス込み)

## 💡 UX Design Principles

### Claude Code Inspired
- `@` プレフィックスでファイル候補表示
- ファイル名の部分マッチング
- 最近使用ファイルの優先表示
- ディレクトリ構造の視覚的表示

### Terminal-Friendly
- ANSIカラーによる見やすい表示
- キーボード最適化ナビゲーション
- スクリーン幅に応じた表示調整
- Ctrl+C等での適切なキャンセル処理

## 📋 TDD Implementation Plan

### Red-Green-Refactor Cycles
1. **Red**: ファイル検索機能のテスト作成
2. **Green**: 基本的なファイル発見・マッチング実装
3. **Refactor**: パフォーマンス改善とUX調整

### Microcommit Strategy
- File discovery engine実装
- @ prefix parser実装  
- Selection UI基本機能
- Fuzzy search algorithm
- コマンド統合
- Performance optimization
- UX improvements

## 🔗 Dependencies
- `fzf` (optional fallback)
- `bat` (preview generation)
- Node.js `readline` (interaction)
- File system watching (optional)

## 🎯 Success Metrics
- ファイル選択効率: 50%向上（キーストローク削減）
- 検索精度: >90% (desired file in top 3)
- ユーザー満足度: 直感的で高速な操作体験
- Claude Code parity: 同等のUX品質

---
**Priority**: High  
**Complexity**: Medium-High  
**Estimated**: 3-4 days