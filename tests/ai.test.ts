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
    process.env.GLM_MODEL = 'glm-4-flash';
  });

  describe('getGLMModel', () => {
    it('should return model from environment variable', async () => {
      const { getGLMModel } = await import('@/lib/ai/glm');

      expect(getGLMModel()).toBe('glm-4-flash');
    });

    it('should return default model when environment variable is not set', async () => {
      delete process.env.GLM_MODEL;
      const { getGLMModel } = await import('@/lib/ai/glm');

      expect(getGLMModel()).toBe('glm-4-flash');
    });

    it('should fall back to default for unknown model', async () => {
      process.env.GLM_MODEL = 'unknown-model';
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { getGLMModel } = await import('@/lib/ai/glm');

      expect(getGLMModel()).toBe('glm-4-flash');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown GLM model')
      );

      consoleSpy.mockRestore();
    });
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
