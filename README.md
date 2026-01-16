# Lark Bot AI Agent

Lark上で自然言語指示により、AIがコードを生成・編集してGitHub PRを作成する開発者アシスタント。

## 特徴

- 🤖 **自然言語処理**: 日本語での指示でコード生成・編集
- 🔄 **GitHub連携**: 自動でブランチ作成・コミット・PR作成
- 💬 **Lark統合**: インタラクティブカードでステータス確認・再実行
- ⚡ **非同期処理**: Vercel Cron Jobsによるジョブキュー処理
- 🧠 **GLM-4.7**: 智谱AIの高性能LLMを使用

## アーキテクチャ

```
Lark → Webhook → Vercel KV ← Cron Worker
                ↓           ↓
            即時応答    GLM-4.7生成
                            ↓
                        GitHub PR
```

## セットアップ

### 1. 環境変数の設定

`.env.local` ファイルを作成:

```bash
# Lark Bot
LARK_APP_ID=cli_xxxxxxxxxxxxx
LARK_APP_SECRET=xxxxxxxxxxxxxxxxxxxx
LARK_ENCRYPT_KEY=xxxxxxxxxxxxxxxxxxxx
LARK_VERIFICATION_TOKEN=xxxxxxxxxxxxxxxxxxxx

# GLM-4.7 API
GLM_API_KEY=xxxxxxxxxxxxxxxxxxxx

# GitHub
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
DEFAULT_REPO_URL=https://github.com/owner/repo

# Vercel KV (自動設定)
# KV_URL, KV_REST_API_URL, KV_REST_API_TOKEN はVercelが自動設定
```

### 2. 依存パッケージのインストール

```bash
npm install
```

### 3. ローカル開発

```bash
npm run dev
```

### 4. Vercelへのデプロイ

```bash
npm run build
vercel deploy
```

## APIエンドポイント

| エンドポイント | 説明 |
|---------------|------|
| `POST /api/webhook` | Lark Webhook受信 |
| `GET/POST /api/cron` | ジョブ処理Worker |
| `GET /api/status?userId=xxx` | ユーザーのジョブ一覧 |
| `POST /api/status` | ステータス確認ボタン用 |

## 使い方

### Larkでの操作

1. ボットにメッセージを送信:
   ```
   src/utils.ts に日付フォーマット関数を追加して
   ```

2. 処理開始カードが表示される

3. 処理完了後にPRの通知が届く

### コマンド

| コマンド | 説明 |
|---------|------|
| `help`, `使い方` | ヘルプカードを表示 |

## プロジェクト構成

```
lark-bot-agent/
├── api/               # APIルート
│   ├── webhook.ts     # Lark Webhook受信
│   ├── cron.ts        # ジョブ処理Worker
│   └── status.ts      # ステータス確認
├── lib/
│   ├── lark/          # Lark SDKクライアント
│   ├── queue/         # Vercel KV操作
│   ├── ai/            # GLM-4.7 API
│   └── github/        # GitHub API
├── types/             # 型定義
└── docs/              # ドキュメント
```

## 開発

```bash
# 型チェック
npm run type-check

# ローカル実行
npm run dev

# デプロイ
npm run start
```

## ライセンス

MIT
