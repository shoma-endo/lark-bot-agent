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
});
