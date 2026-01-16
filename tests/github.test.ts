/**
 * Tests for GitHub client operations
 */

import { describe, it, expect } from 'vitest';

describe('GitHub Client', () => {
  describe('parseRepoUrl', () => {
    it('should parse standard HTTPS URL', async () => {
      const { parseRepoUrl } = await import('@/lib/github/client');

      const result = parseRepoUrl('https://github.com/owner/repo');

      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('repo');
    });

    it('should parse SSH URL', async () => {
      const { parseRepoUrl } = await import('@/lib/github/client');

      const result = parseRepoUrl('git@github.com:owner/repo.git');

      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('repo');
    });

    it('should parse HTTPS URL with .git suffix', async () => {
      const { parseRepoUrl } = await import('@/lib/github/client');

      const result = parseRepoUrl('https://github.com/owner/repo.git');

      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('repo');
    });

    it('should throw error for invalid URL', async () => {
      const { parseRepoUrl } = await import('@/lib/github/client');

      expect(() => parseRepoUrl('not-a-valid-url')).toThrow();
    });
  });

  describe('shouldIncludeFile', () => {
    it('should include TypeScript files', async () => {
      const { shouldIncludeFile } = await import('@/lib/github/client');

      expect(shouldIncludeFile('src/index.ts')).toBe(true);
      expect(shouldIncludeFile('src/component.tsx')).toBe(true);
    });

    it('should include JavaScript files', async () => {
      const { shouldIncludeFile } = await import('@/lib/github/client');

      expect(shouldIncludeFile('src/index.js')).toBe(true);
      expect(shouldIncludeFile('src/component.jsx')).toBe(true);
    });

    it('should include config files', async () => {
      const { shouldIncludeFile } = await import('@/lib/github/client');

      expect(shouldIncludeFile('package.json')).toBe(true);
      expect(shouldIncludeFile('tsconfig.json')).toBe(true);
      expect(shouldIncludeFile('.gitignore')).toBe(true);
      expect(shouldIncludeFile('README.md')).toBe(true);
    });

    it('should exclude node_modules', async () => {
      const { shouldIncludeFile } = await import('@/lib/github/client');

      expect(shouldIncludeFile('node_modules/package/index.js')).toBe(false);
      expect(shouldIncludeFile('test/node_modules/file.ts')).toBe(false);
    });

    it('should exclude build artifacts', async () => {
      const { shouldIncludeFile } = await import('@/lib/github/client');

      expect(shouldIncludeFile('dist/index.js')).toBe(false);
      expect(shouldIncludeFile('build/bundle.js')).toBe(false);
      expect(shouldIncludeFile('.next/app.js')).toBe(false);
    });

    it('should exclude lock files', async () => {
      const { shouldIncludeFile } = await import('@/lib/github/client');

      expect(shouldIncludeFile('package-lock.json')).toBe(false);
      expect(shouldIncludeFile('yarn.lock')).toBe(false);
      expect(shouldIncludeFile('pnpm-lock.yaml')).toBe(false);
    });

    it('should exclude binary files', async () => {
      const { shouldIncludeFile } = await import('@/lib/github/client');

      expect(shouldIncludeFile('image.png')).toBe(false);
      expect(shouldIncludeFile('photo.jpg')).toBe(false);
      expect(shouldIncludeFile('data.pdf')).toBe(false);
    });
  });
});
