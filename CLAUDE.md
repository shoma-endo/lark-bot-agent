# Claude Code プロジェクト設定

このファイルは、Claude Codeが自動的に参照するプロジェクトコンテキストファイルです。

## プロジェクト概要

**lark-bot-agent** - Miyabi自律型開発プロジェクト

## アーキテクチャ

### コアコンポーネント

1. **Agent System** - 自律実行Agent（Miyabi Framework）
2. **GitHub OS Integration** - GitHubをOSとして活用
3. **Label System** - 53ラベル体系による状態管理

### ディレクトリ構造

```
lark-bot-agent/
├── .claude/                    # Claude Code設定
│   ├── agents/                # Agent仕様・プロンプト
│   ├── commands/              # カスタムコマンド
│   └── prompts/               # 実行プロンプト
├── .github/                   # GitHub設定
│   └── workflows/             # GitHub Actions
├── docs/                      # ドキュメント
├── scripts/                   # 自動化スクリプト
├── logs/                      # ログファイル
└── reports/                   # レポート出力
```

## 開発ガイドライン

### コミット規約
- Conventional Commits準拠
- `feat:`, `fix:`, `chore:`, `docs:`, etc.

### セキュリティ
- トークンは環境変数
- `.miyabi.yml`は`.gitignore`に追加済み

## 環境変数

```bash
GITHUB_TOKEN=ghp_xxx        # GitHubアクセストークン
ANTHROPIC_API_KEY=sk-xxx    # Anthropic APIキー（Agent実行時）
```

## 実行例

```bash
# ステータス確認
miyabi status

# Agent実行
miyabi agent coordinator --issue 1

# テスト実行
cargo test --all

# Linter実行
cargo clippy --all-targets
```

---

**このファイルはClaude Codeが自動参照します。プロジェクトのコンテキストとして常に最新に保ってください。**
