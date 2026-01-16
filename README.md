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
# Lark Bot (Lark Developer Consoleから取得)
LARK_APP_ID=cli_xxxxxxxxxxxxx
LARK_APP_SECRET=xxxxxxxxxxxxxxxxxxxx
LARK_ENCRYPT_KEY=xxxxxxxxxxxxxxxxxxxx
LARK_VERIFICATION_TOKEN=xxxxxxxxxxxxxxxxxxxx

# GLM-4.7 API (https://open.bigmodel.cn/ から取得)
GLM_API_KEY=xxxxxxxxxxxxxxxxxxxx
GLM_MODEL=glm-4-flash  # モデル選択: glm-4-flash | glm-4-plus | glm-4-0520 | glm-4-air | glm-4

# GitHub (https://github.com/settings/tokens から取得)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
DEFAULT_REPO_URL=https://github.com/owner/repo

# Vercel KV (自動設定 - Vercelデプロイ時に有効化してください)
# KV_URL, KV_REST_API_URL, KV_REST_API_TOKEN はVercelが自動設定
```

**APIキー取得先:**
- **Lark**: https://open.larksuite.com/app
- **GLM-4.7**: https://open.bigmodel.cn/
- **GitHub**: https://github.com/settings/tokens

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

デプロイ後にWebhook URLが表示されます（例: `https://lark-bot-agent-xxxxx.vercel.app`）

### 4.1. Vercel KVの有効化

ジョブキュー機能を使用するために、Vercel KVを有効化する必要があります。

1. Vercelプロジェクトダッシュボードを開く
2. **Storage** タブ → **Create Database**
3. **KV** を選択 → **Continue**
4. リージョンを選択（推奨: `ap-southeast-1` シンガポール）
5. **Create** をクリック

環境変数が自動的に設定されます:
- `KV_URL`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_REST_API_READ_ONLY_TOKEN`

### 5. Lark Botの設定

#### 5.1 Lark Developer Consoleでアプリ作成

1. https://open.larksuite.com/app にアクセス
2. 「自建应用」を作成

#### 5.2 必要な情報を取得

アプリ設定ページから以下を取得:
- **App ID**: `LARK_APP_ID` に設定
- **App Secret**: `LARK_APP_SECRET` に設定
- **Encrypt Key**: `LARK_ENCRYPT_KEY` に設定
- **Verification Token**: `LARK_VERIFICATION_TOKEN` に設定

#### 5.3 Webhook URLを設定

イベント → 请求URLに以下を設定:

```
https://あなたのプロジェクト.vercel.app/api/webhook
```

#### 5.4 権限を付与

Botに以下の権限を付与:
- `im:message` (メッセージ送信・受信)
- `im:message:group_at_msg` (グループメッセージ)

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
