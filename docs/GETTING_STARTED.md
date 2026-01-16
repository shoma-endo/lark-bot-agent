# Getting Started with lark-bot-agent

Miyabiプロジェクトへようこそ！このガイドでは、ゼロからMiyabiを使い始めるまでの手順を詳しく解説します。

## 📋 前提条件

### 必須

- **Rust**: 1.75.0以上
  ```bash
  rustc --version  # 確認
  ```

- **Git**: バージョン管理用
  ```bash
  git --version
  ```

- **GitHubアカウント**: Issue/PR管理用

### 推奨

- **GitHub CLI (`gh`)**: GitHub操作を簡単に
  ```bash
  brew install gh  # macOS
  gh --version
  ```

## 🚀 セットアップ手順

### Step 1: 環境変数の設定

#### 1.1 GitHub Personal Access Token取得

1. https://github.com/settings/tokens/new にアクセス
2. Token名を入力（例: "Miyabi Local Dev"）
3. 以下のスコープを選択：
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (Update GitHub Action workflows)
4. "Generate token"をクリック
5. トークンをコピー（**一度しか表示されません！**）

#### 1.2 環境変数をシェルプロファイルに追加

**Bash (.bashrc / .bash_profile):**
```bash
echo 'export GITHUB_TOKEN=ghp_xxxxx' >> ~/.bashrc
echo 'export ANTHROPIC_API_KEY=sk-ant-xxxxx' >> ~/.bashrc
source ~/.bashrc
```

**Zsh (.zshrc):**
```bash
echo 'export GITHUB_TOKEN=ghp_xxxxx' >> ~/.zshrc
echo 'export ANTHROPIC_API_KEY=sk-ant-xxxxx' >> ~/.zshrc
source ~/.zshrc
```

#### 1.3 環境変数確認
```bash
echo $GITHUB_TOKEN
echo $ANTHROPIC_API_KEY
```

### Step 2: GitHubリポジトリ作成

#### 2.1 GitHub CLI使用（推奨）
```bash
cd lark-bot-agent
gh repo create lark-bot-agent --private --source=. --remote=origin
```

#### 2.2 手動作成
1. https://github.com/new にアクセス
2. Repository nameに `lark-bot-agent` を入力
3. "Private"を選択
4. "Create repository"をクリック
5. ローカルリポジトリと接続：
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/lark-bot-agent.git
   git branch -M main
   git add .
   git commit -m "feat: initial commit 🚀"
   git push -u origin main
   ```

### Step 3: Label体系のセットアップ

Miyabiは53ラベル体系で自動化を制御します。

#### 3.1 自動セットアップ（将来実装予定）
```bash
miyabi setup labels
```

#### 3.2 手動セットアップ
GitHubリポジトリの設定から、以下のラベルを作成：

**STATE（8個）**:
- `📥 state:pending` (Gray)
- `🔍 state:analyzing` (Blue)
- `🏗️ state:implementing` (Yellow)
- `👀 state:reviewing` (Orange)
- `✅ state:done` (Green)
- `❌ state:blocked` (Red)
- `⏸️ state:on-hold` (Purple)
- `🔄 state:reopened` (Pink)

（残り45ラベルは`.github/labels.yml`を参照）

### Step 4: 最初のIssue作成

#### 4.1 GitHub Web UIで作成
1. リポジトリの"Issues"タブをクリック
2. "New issue"をクリック
3. Title: "✨ Setup project configuration"
4. Body:
   ```markdown
   ## 概要
   プロジェクトの初期設定を行う

   ## タスク
   - [ ] .miyabi.yml の設定確認
   - [ ] GitHub Actionsの設定
   - [ ] 開発環境の準備

   ## 期待される成果
   - プロジェクトが動作可能な状態
   ```
5. Labels:
   - `✨ type:feature`
   - `⚠️ priority:P1-High`
   - `📥 state:pending`
6. "Submit new issue"をクリック

#### 4.2 GitHub CLIで作成
```bash
gh issue create --title "✨ Setup project configuration" \
  --body "初期設定タスク" \
  --label "type:feature,priority:P1-High,state:pending"
```

### Step 5: Agent実行

#### 5.1 ステータス確認
```bash
miyabi status
```

出力例：
```
📊 Project Status

Miyabi Installation:
  ✅ Miyabi is installed
    ✓ .claude/agents
    ✓ .github/workflows

Environment:
  ✅ GITHUB_TOKEN is set
  ✅ DEVICE_IDENTIFIER: YourMac.local

Git Repository:
  ✅ Git repository detected
    Branch: main
    Remotes: origin
```

#### 5.2 CoordinatorAgent実行
```bash
miyabi agent run coordinator --issue 1
```

Agentは以下を実行します：
1. Issue分析
2. Task分解（DAG構築）
3. Worktree作成
4. Specialist Agent割り当て
5. 並列実行
6. 結果統合

## 🎯 よくある使い方

### Issue処理の基本フロー
```bash
# 1. Issue作成（GitHub UI または gh CLI）
gh issue create --title "新機能実装" --label "type:feature"

# 2. Agent実行
miyabi agent run coordinator --issue 2

# 3. ステータス確認
miyabi status

# 4. ログ確認
cat logs/miyabi-*.log
```

### 複数Issue並列処理
```bash
miyabi agent run coordinator --issues 1,2,3 --concurrency 2
```

### Worktree確認
```bash
git worktree list
```

## 📚 次に読むべきドキュメント

1. **CLAUDE.md** - プロジェクトコンテキスト（Claude Codeが自動参照）
2. **.claude/QUICK_START.md** - 3分で始めるクイックガイド
3. **.claude/agents/README.md** - Agent一覧と使い方
4. **docs/TROUBLESHOOTING.md** - トラブルシューティング

## 🆘 困ったときは

### エラーが出た場合
1. `docs/TROUBLESHOOTING.md` を確認
2. `miyabi status` で環境確認
3. GitHub Issuesで質問: https://github.com/ShunsukeHayashi/Miyabi/issues

### ログ確認
```bash
# 最新のログファイル
tail -f logs/miyabi-$(date +%Y%m%d).log

# エラーログのみ抽出
grep -i error logs/miyabi-*.log
```

## 🎉 次のステップ

おめでとうございます！Miyabiのセットアップが完了しました。

次は：
1. **独自のAgent仕様作成**: `.claude/agents/specs/coding/` にカスタムAgent追加
2. **Label体系のカスタマイズ**: プロジェクトに合わせたLabel追加
3. **GitHub Actionsの設定**: `.github/workflows/` でCI/CD自動化
4. **Worktree並列実行**: 複数Issueの同時処理

---

**Miyabi** - Beauty in Autonomous Development 🌸
