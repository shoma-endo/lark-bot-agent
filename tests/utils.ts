// Test utilities
export const mockJob = {
  id: 'test-job-1',
  userId: 'test-user-1',
  message: 'テストメッセージ',
  context: {
    repoUrl: 'https://github.com/test/repo',
    branch: 'main',
  },
  status: 'pending' as const,
  createdAt: Date.now(),
};

export const mockGLMResponse = {
  id: 'chatcmpl-123',
  created: 1234567890,
  model: 'glm-4-flash',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant' as const,
        content: JSON.stringify({
          plan: 'テスト計画',
          files: [
            { path: 'test.ts', content: 'export function test() {}' },
          ],
          commitMessage: 'feat: test',
          prTitle: 'Test PR',
          prBody: 'Test body',
        }),
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150,
  },
};

export const mockLarkWebhookEvent = {
  schema: '1.0',
  header: {
    event_id: 'test-event-1',
    timestamp: '1234567890',
    token: 'test-token',
    app_id: 'test-app',
    tenant_key: 'test-tenant',
    type: 'message',
  },
  event: {
    operator: {
      user_id: 'test-user-1',
    },
    message: {
      message_id: 'test-message-1',
      chat_id: 'test-chat-1',
      chat_type: 'direct',
      content: JSON.stringify({ text: 'テストメッセージ' }),
    },
  },
};

export function createMockRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return {
    json: async () => body,
    headers: new Headers(headers),
  } as unknown as Request;
}
