/**
 * Tests for Lark client utilities
 */

import { describe, it, expect } from 'vitest';
import { getReceiveIdType } from '@/lib/lark/client';
import { mockLarkWebhookEvent } from './utils';

describe('Lark Client', () => {
  describe('getReceiveIdType', () => {
    it('should return chat_id for oc_ prefix', () => {
      expect(getReceiveIdType('oc_123456')).toBe('chat_id');
    });

    it('should return user_id for ou_ prefix', () => {
      expect(getReceiveIdType('ou_123456')).toBe('user_id');
    });

    it('should return open_id for other prefixes', () => {
      expect(getReceiveIdType('on_123456')).toBe('open_id');
      expect(getReceiveIdType('xxx_123456')).toBe('open_id');
      expect(getReceiveIdType('123456')).toBe('open_id');
    });
  });

  describe('parseUserMessage', () => {
    it('should parse valid user message', async () => {
      const { parseUserMessage } = await import('@/lib/lark/client');

      const result = parseUserMessage(mockLarkWebhookEvent);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('test-user-1');
      expect(result?.chatId).toBe('test-chat-1');
      expect(result?.content).toBe('テストメッセージ');
    });

    it('should return null for missing event', async () => {
      const { parseUserMessage } = await import('@/lib/lark/client');

      const result = parseUserMessage({ ...mockLarkWebhookEvent, event: undefined });

      expect(result).toBeNull();
    });

    it('should return null for missing operator', async () => {
      const { parseUserMessage } = await import('@/lib/lark/client');

      const result = parseUserMessage({
        ...mockLarkWebhookEvent,
        event: { ...mockLarkWebhookEvent.event, operator: undefined },
      });

      expect(result).toBeNull();
    });
  });
});
