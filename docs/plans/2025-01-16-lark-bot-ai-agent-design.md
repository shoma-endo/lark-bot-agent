# Lark Bot AIエージェント設計書

**日付:** 2025-01-16
**バージョン:** 1.0

## 概要

Lark上でユーザーが自然言語で指示を出すと、AIエージェントがコードを生成・編集してGitHub PRを作成する開発者アシスタント。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│                         Vercel (無料枠)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  Lark Bot    │───→│   Vercel KV  │←───│ Cron Worker  │      │
│  │  /api/webhook│    │   (Job Queue)│    │  /api/cron   │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         ↓                                       ↓               │
│    (202応答)                              GLM-4.7呼び出し       │
│                                                ↓               │
│                                        ┌──────────────┐        │
│                                        │  GitHub API  │        │
│                                        └──────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## データフロー

1. ユーザーがLarkでメッセージ送信
2. `/api/webhook` がイベントを受信 → ジョブをKVに保存 → 即座にLarkに「処理開始」を応答
3. Vercel Cron (1分ごと) が `/api/cron` を実行
4. Workerが未処理ジョブを取得 → GLM-4.7でコード生成 → GitHub PR作成
5. Larkに結果を通知

## ジョブデータ構造

```typescript
interface Job {
  id: string;
  userId: string;
  message: string;
  context: {
    repoUrl: string;
    branch?: string;
    files?: string[];
  };
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: {
    prUrl: string;
    summary: string;
  };
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  retryCount?: number;
}
```

## プロジェクト構成

```
lark-bot-agent/
├── api/
│   ├── webhook.ts           # Lark Webhook受信
│   ├── cron.ts              # ジョブ処理Worker
│   └── status.ts            # ステータス確認API
├── lib/
│   ├── lark/
│   │   ├── client.ts        # Lark SDKクライアント
│   │   └── cards.ts         # カードテンプレート
│   ├── queue/
│   │   └── kv.ts            # Vercel KV操作
│   ├── ai/
│   │   └── glm.ts           # GLM-4.7 API呼び出し
│   └── github/
│       └── client.ts        # GitHub API操作
├── types/
│   └── index.ts             # 型定義
├── vercel.json
└── package.json
```

## 依存パッケージ

- `@larksuiteoapi/node-sdk` - Lark API
- `@vercel/kv` - ジョブキュー
- `octokit` - GitHub API
- `ai` (Vercel SDK) - GLM-4.7連携

## エラーハンドリング

| エラー種類 | 対応 |
|-----------|------|
| GLM-4.7 APIタイムアウト | 最大3回リトライ（指数バックオフ） |
| GitHub APIレート制限 | 429受信時は指数バックオフ |
| 無効なユーザー指示 | エラーカードを表示 |
| ファイルコンフリクト | コンフリクト状態を通知 |

## 環境変数

```bash
LARK_APP_ID=xxx
LARK_APP_SECRET=xxx
LARK_ENCRYPT_KEY=xxx
LARK_VERIFICATION_TOKEN=xxx
GLM_API_KEY=xxx
GITHUB_TOKEN=xxx
KV_URL=xxx
KV_REST_API_URL=xxx
KV_REST_API_TOKEN=xxx
KV_REST_API_READ_ONLY_TOKEN=xxx
```
