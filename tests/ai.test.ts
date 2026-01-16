/**
 * Tests for GLM AI operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockGLMResponse } from './utils';

describe('GLM AI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set required environment variables
    process.env.GLM_API_KEY = 'test-api-key';
  });

  describe('parseCodeGenerationResponse', () => {
    it('should parse valid JSON response', async () => {
      const { parseCodeGenerationResponse } = await import('@/lib/ai/glm');

      const validResponse = JSON.stringify({
        plan: 'テスト計画',
        files: [
          { path: 'test.ts', content: 'export function test() {}' },
        ],
        commitMessage: 'feat: test',
        prTitle: 'Test PR',
        prBody: 'Test body',
      });

      const result = parseCodeGenerationResponse(validResponse);

      expect(result.plan).toBe('テスト計画');
      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('test.ts');
      expect(result.commitMessage).toBe('feat: test');
    });

    it('should extract JSON from markdown code blocks', async () => {
      const { parseCodeGenerationResponse } = await import('@/lib/ai/glm');

      const markdownResponse = '```json\n' + JSON.stringify({
        plan: 'テスト計画',
        files: [{ path: 'test.ts', content: 'content' }],
        commitMessage: 'feat: test',
        prTitle: 'Test PR',
        prBody: 'Test body',
      }) + '\n```';

      const result = parseCodeGenerationResponse(markdownResponse);

      expect(result.plan).toBe('テスト計画');
    });

    it('should provide default values for missing optional fields', async () => {
      const { parseCodeGenerationResponse } = await import('@/lib/ai/glm');

      const minimalResponse = JSON.stringify({
        plan: 'テスト計画',
        files: [{ path: 'test.ts', content: 'content' }],
      });

      const result = parseCodeGenerationResponse(minimalResponse);

      expect(result.commitMessage).toBe('chore: update files');
      expect(result.prTitle).toBe('テスト計画');
      expect(result.prBody).toBe('テスト計画');
    });

    it('should throw error for invalid response', async () => {
      const { parseCodeGenerationResponse } = await import('@/lib/ai/glm');

      expect(() => parseCodeGenerationResponse('invalid json')).toThrow();
    });
  });

  describe('parseQuestioningResponse', () => {
    it('should parse response with questions', async () => {
      const { parseQuestioningResponse } = await import('@/lib/ai/glm');

      const questionsResponse = JSON.stringify({
        needsQuestions: true,
        questions: [
          { id: 'q1', text: 'どのような機能を実装しますか？' },
          { id: 'q2', text: 'ターゲットとするブラウザは？' },
        ],
      });

      const result = parseQuestioningResponse(questionsResponse);

      expect(result.needsQuestions).toBe(true);
      expect(result.questions).toHaveLength(2);
      expect(result.questions?.[0].id).toBe('q1');
      expect(result.questions?.[0].text).toBe('どのような機能を実装しますか？');
    });

    it('should parse response without questions (code changes)', async () => {
      const { parseQuestioningResponse } = await import('@/lib/ai/glm');

      const codeChangesResponse = JSON.stringify({
        needsQuestions: false,
        codeChanges: {
          plan: 'テスト計画',
          files: [{ path: 'test.ts', content: 'content' }],
          commitMessage: 'feat: test',
          prTitle: 'Test PR',
          prBody: 'Test body',
        },
      });

      const result = parseQuestioningResponse(codeChangesResponse);

      expect(result.needsQuestions).toBe(false);
      expect(result.codeChanges).toBeDefined();
      expect(result.codeChanges?.plan).toBe('テスト計画');
    });

    it('should limit questions to 3 max', async () => {
      const { parseQuestioningResponse } = await import('@/lib/ai/glm');

      const tooManyQuestions = JSON.stringify({
        needsQuestions: true,
        questions: [
          { id: 'q1', text: '質問1' },
          { id: 'q2', text: '質問2' },
          { id: 'q3', text: '質問3' },
          { id: 'q4', text: '質問4' },
          { id: 'q5', text: '質問5' },
        ],
      });

      const result = parseQuestioningResponse(tooManyQuestions);

      expect(result.questions).toHaveLength(3);
    });

    it('should extract JSON from markdown code blocks', async () => {
      const { parseQuestioningResponse } = await import('@/lib/ai/glm');

      const markdownResponse = '```json\n' + JSON.stringify({
        needsQuestions: true,
        questions: [{ id: 'q1', text: '質問' }],
      }) + '\n```';

      const result = parseQuestioningResponse(markdownResponse);

      expect(result.needsQuestions).toBe(true);
      expect(result.questions).toHaveLength(1);
    });

    it('should throw error for missing needsQuestions field', async () => {
      const { parseQuestioningResponse } = await import('@/lib/ai/glm');

      const invalidResponse = JSON.stringify({
        questions: [{ id: 'q1', text: '質問' }],
      });

      expect(() => parseQuestioningResponse(invalidResponse)).toThrow();
    });

    it('should throw error when needsQuestions is true but questions array is empty', async () => {
      const { parseQuestioningResponse } = await import('@/lib/ai/glm');

      const invalidResponse = JSON.stringify({
        needsQuestions: true,
        questions: [],
      });

      expect(() => parseQuestioningResponse(invalidResponse)).toThrow();
    });

    it('should throw error when needsQuestions is false but codeChanges is missing', async () => {
      const { parseQuestioningResponse } = await import('@/lib/ai/glm');

      const invalidResponse = JSON.stringify({
        needsQuestions: false,
      });

      expect(() => parseQuestioningResponse(invalidResponse)).toThrow();
    });
  });
});
