import type { LarkCard, LarkCardElement, Job } from '@/types';

// ============================================================================
// Card Templates
// ============================================================================

export function createProcessingCard(job: Job): LarkCard {
  return {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: '🤖 タスクを受信しました' },
        template: 'blue',
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**指示:** ${job.message}\n\n**ステータス:** 処理中...\n\n⏳ 推定所要時間: 1-3分`,
          },
        },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '📊 ステータス確認' },
              type: 'primary',
              value: { type: 'check_status', job_id: job.id },
            },
          ],
        },
      ],
    },
  };
}

export function createCompletedCard(job: Job): LarkCard {
  if (!job.result) {
    throw new Error('Job result is required for completed card');
  }

  return {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: '✅ タスク完了' },
        template: 'green',
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**PR:** ${job.result.prUrl}\n\n**変更内容:**\n${job.result.summary}\n\n**反映ブランチ:** ${job.result.branch}`,
          },
        },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '🔗 PRを確認' },
              type: 'primary',
              url: job.result.prUrl,
            },
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '🔄 再実行' },
              value: { type: 'retry', job_id: job.id },
            },
          ],
        },
      ],
    },
  };
}

export function createErrorCard(
  job: Job,
  errorMessage: string,
  details?: string
): LarkCard {
  return {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: '❌ エラーが発生しました' },
        template: 'red',
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**エラー:** ${errorMessage}${details ? `\n\n**詳細:** ${details}` : ''}`,
          },
        },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '🔄 再実行' },
              value: { type: 'retry', job_id: job.id },
            },
          ],
        },
      ],
    },
  };
}

export function createStatusCard(job: Job): LarkCard {
  const statusEmoji = {
    pending: '⏳',
    processing: '🔄',
    completed: '✅',
    failed: '❌',
  }[job.status];

  const baseElements: LarkCardElement[] = [
    {
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: `**指示:** ${job.message}\n\n**ステータス:** ${job.status}\n**作成日時:** ${new Date(job.createdAt).toLocaleString('ja-JP')}${
          job.completedAt ? `\n**完了日時:** ${new Date(job.completedAt).toLocaleString('ja-JP')}` : ''
        }${
          job.error ? `\n\n**エラー:** ${job.error}` : ''
        }${
          job.result ? `\n\n**PR:** ${job.result.prUrl}` : ''
        }`,
      },
    },
  ];

  if (job.status !== 'completed' && job.status !== 'failed') {
    baseElements.push({
      tag: 'action',
      actions: [
        {
          tag: 'button',
          text: { tag: 'plain_text', content: '🔄 更新' },
          type: 'primary',
          value: { type: 'refresh_status', job_id: job.id },
        },
      ],
    });
  }

  return {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: `${statusEmoji} タスクステータス` },
        template: job.status === 'completed' ? 'green' : job.status === 'failed' ? 'red' : 'blue',
      },
      elements: baseElements,
    },
  };
}

export function createConflictCard(
  job: Job,
  conflictingFiles: string[]
): LarkCard {
  return {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: '⚠️ コンフリクトが発生しました' },
        template: 'yellow',
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**コンフリクトが発生したファイル:**\n${conflictingFiles.map((f) => `- ${f}`).join('\n')}\n\n手動でマージ解決後、再度実行してください。`,
          },
        },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '🔄 再実行' },
              value: { type: 'retry', job_id: job.id },
            },
          ],
        },
      ],
    },
  };
}

export function createWelcomeCard(): LarkCard {
  return {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: '👋 Lark Bot AIエージェント' },
        template: 'blue',
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `GitHubリポジトリを操作するAIアシスタントです。

**使い方:**
1. メッセージで実行したいタスクを日本語で入力
2. AIがコードを生成・編集してPRを作成
3. 完了したら通知が届きます

**例:**
- 「src/utils.ts に日付フォーマット関数を追加して」
- 「README.md を更新して、インストール手順を追加して」
- 「バグを修正: ユーザー認証が正しく動かない問題」`,
          },
        },
      ],
    },
  };
}
