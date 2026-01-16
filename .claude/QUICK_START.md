# lark-bot-agent - Quick Start Guide

## 🚀 3分で始めるMiyabi

### 1. 環境変数設定

```bash
export GITHUB_TOKEN=ghp_xxx
export ANTHROPIC_API_KEY=sk-xxx
```

### 2. ステータス確認

```bash
miyabi status
```

### 3. Issue作成

GitHubでIssueを作成し、以下のラベルを付与：
- `type:feature` または `type:bug`
- `priority:P1-High`

### 4. Agent実行

```bash
miyabi agent coordinator --issue 1
```

## 📚 詳細ドキュメント

- [CLAUDE.md](../CLAUDE.md) - プロジェクトコンテキスト
- [.claude/README.md](./README.md) - .claudeディレクトリ説明

---

**Miyabi** - Beauty in Autonomous Development 🌸
