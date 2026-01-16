# Issue Creation Workflow Example

このファイルは、lark-bot-agentプロジェクトでの標準的なIssue作成フローです。

## ステップ1: Issue作成

### GitHub Web UIで作成
1. リポジトリの"Issues"タブをクリック
2. "New issue"をクリック
3. Issueテンプレートを使用（推奨）

### GitHub CLIで作成（推奨）
```bash
gh issue create \
  --title "✨ Add user authentication" \
  --body "$(cat <<'EOF'
## 概要
ユーザー認証機能を追加する

## 要件
- [ ] JWT トークン認証
- [ ] ログイン/ログアウトエンドポイント
- [ ] トークンリフレッシュ機能

## 期待される成果
- 認証付きAPIエンドポイント
- テストカバレッジ90%以上
- セキュリティ監査パス
EOF
)" \
  --label "type:feature,priority:P1-High,state:pending"
```

## ステップ2: Agent実行

### 方法1: 新しいwork-onコマンド（推奨）
```bash
# Issue番号で実行
miyabi work-on 1

# または作業説明で実行（Issue作成を提案）
miyabi work-on "Add user authentication"
```

### 方法2: 従来のagentコマンド
```bash
miyabi agent run coordinator --issue 1
```

### 方法3: 並列実行
```bash
miyabi parallel --issues 1,2,3 --concurrency 2
```

## ステップ3: 進捗確認

```bash
# プロジェクトステータス確認
miyabi status

# Issue状態確認
gh issue view 1

# Worktree確認
git worktree list

# ログ確認
tail -f logs/miyabi-$(date +%Y%m%d).log
```

## ステップ4: レビュー

Agentが自動的に：
1. コード生成
2. テスト作成
3. Linter実行
4. PR作成

あなたがすべきこと：
1. PRレビュー
2. 追加修正（必要なら）
3. マージ

## 実際の例

### 成功例: Issue #42 "Setup CI/CD pipeline"

```bash
$ miyabi work-on 42

🚀 Let's work on it!
  📋 Issue #42

🤖 CoordinatorAgent starting...
  ✅ Analyzed issue
  ✅ Created 3 tasks
  ✅ Assigned CodeGenAgent, ReviewAgent, DeploymentAgent

⏱️  Estimated time: 15 minutes
🌳 Created worktree: .worktrees/issue-42

[15 minutes later]

✅ All tasks completed!
📊 Quality score: 95/100
🔗 PR created: #43
```

## トラブルシューティング

### Agentがスタックした場合
```bash
# ログ確認
grep -i "error" logs/miyabi-*.log

# Worktreeクリーンアップ
git worktree prune

# 再実行
miyabi work-on 42
```

### より詳しいヘルプ
```bash
# トラブルシューティングガイド
cat docs/TROUBLESHOOTING.md

# Agent仕様確認
cat .claude/agents/README.md
```

---

**lark-bot-agentプロジェクトの標準ワークフロー**
**Miyabi - Beauty in Autonomous Development 🌸**
