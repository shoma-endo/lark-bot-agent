import { Client, AppType } from '@larksuiteoapi/node-sdk';
import type { LarkWebhookEvent, LarkCard, ReceiveIdType } from '@/types';

// Initialize Lark client
const client = new Client({
  appId: process.env.LARK_APP_ID!,
  appSecret: process.env.LARK_APP_SECRET!,
  appType: AppType.SelfBuild,
});

// ============================================================================
// Utility Functions
// ============================================================================

export function getReceiveIdType(receiveId: string): ReceiveIdType {
  if (receiveId.startsWith('oc_')) return 'chat_id';
  if (receiveId.startsWith('ou_')) return 'user_id';
  return 'open_id';
}

// ============================================================================
// Card Sending
// ============================================================================

export async function sendCard(
  receiveId: string,
  cardContent: LarkCard
): Promise<void> {
  const receiveIdType = getReceiveIdType(receiveId);

  await client.im.message.create({
    params: { receive_id_type: receiveIdType },
    data: {
      receive_id: receiveId,
      msg_type: 'interactive',
      content: JSON.stringify(cardContent),
    },
  });
}

// ============================================================================
// Webhook Verification
// ============================================================================

export function verifyWebhook(
  event: LarkWebhookEvent,
  verificationToken?: string
): boolean {
  const token = verificationToken || process.env.LARK_VERIFICATION_TOKEN;

  if (!token) {
    console.warn('LARK_VERIFICATION_TOKEN not set, skipping verification');
    return true;
  }

  return event.header.token === token;
}

// ============================================================================
// Event Parsing
// ============================================================================

export function parseUserMessage(event: LarkWebhookEvent): {
  userId: string;
  chatId: string;
  content: string;
  parentMessageId?: string;
  rootMessageId?: string;
} | null {
  try {
    const evt = event.event;
    if (!evt) return null;

    const operator = evt.operator;
    const message = evt.message;

    if (!operator?.user_id || !message?.content) {
      return null;
    }

    // Parse message content (JSON string)
    const contentJson = JSON.parse(message.content);

    return {
      userId: operator.user_id,
      chatId: message.chat_id,
      content: contentJson.text || '',
      parentMessageId: message.parent_id,
      rootMessageId: message.root_id,
    };
  } catch (error) {
    console.error('Failed to parse user message:', error);
    return null;
  }
}

// ============================================================================
// Thread Reply
// ============================================================================

export async function replyToThread(
  chatId: string,
  parentMessageId: string,
  cardContent: LarkCard
): Promise<void> {
  await client.im.message.create({
    data: {
      receive_id: chatId,
      msg_type: 'interactive',
      content: JSON.stringify(cardContent),
      reply_in_thread: true,
      root_id: parentMessageId,
    },
  });
}

export default client;
