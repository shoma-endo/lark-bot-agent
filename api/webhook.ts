import type { LarkWebhookEvent } from '@/types';
import { createJob } from '@/lib/queue/kv';
import { verifyWebhook, parseUserMessage, sendCard } from '@/lib/lark/client';
import { createProcessingCard, createWelcomeCard } from '@/lib/lark/cards';

// ============================================================================
// Webhook Handler
// ============================================================================

export async function POST(request: Request): Promise<Response> {
  try {
    const event = (await request.json()) as LarkWebhookEvent;

    // Verify webhook (if token is configured)
    if (!verifyWebhook(event)) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Handle URL verification challenge
    if (event.header.event_type === 'url_verification') {
      return Response.json({
        challenge: event.event?.challenge,
      });
    }

    // Parse user message
    const messageData = parseUserMessage(event);
    if (!messageData) {
      return new Response('No valid message', { status: 400 });
    }

    const { userId, chatId, content } = messageData;

    // Handle help/welcome message
    if (content.match(/^(help|ヘルプ|使い方|about|about)$/i)) {
      await sendCard(chatId, createWelcomeCard());
      return new Response('Welcome card sent', { status: 200 });
    }

    // Parse branch specification (e.g., "branch: feature-xxx タスク内容")
    const branchMatch = content.match(/^branch:\s*(\S+)\s+(.+)/i);
    let targetMessage = content;
    let targetBranch: string | undefined;
    let mode: 'create-pr' | 'update-branch' = 'create-pr';

    if (branchMatch) {
      targetBranch = branchMatch[1];
      targetMessage = branchMatch[2];
      mode = 'update-branch';
    }

    // Default repo URL (can be configured via env or user settings)
    const defaultRepoUrl = process.env.DEFAULT_REPO_URL || 'https://github.com/shoma-endo/lark-bot-agent';

    // Create job
    const job = await createJob({
      userId,
      message: targetMessage,
      context: {
        repoUrl: defaultRepoUrl,
        branch: targetBranch || 'main',
        mode,
      },
      status: 'pending',
    });

    // Send processing card to the chat
    await sendCard(chatId, createProcessingCard(job));

    return new Response('Job created', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// ============================================================================
// Options Handler (for CORS)
// ============================================================================

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
