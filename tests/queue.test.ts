/**
 * Tests for Vercel KV queue operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockJob } from './utils';

// Mock Vercel KV
vi.mock('@vercel/kv', () => ({
  kv: {
    set: vi.fn(),
    get: vi.fn(),
    zadd: vi.fn(),
    zpopmin: vi.fn(),
    zrem: vi.fn(),
    lpush: vi.fn(),
    lrange: vi.fn(),
  },
}));

describe('Job Queue Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createJob', () => {
    it('should create a job with generated ID', async () => {
      const { createJob } = await import('@/lib/queue/kv');

      const job = await createJob({
        userId: mockJob.userId,
        message: mockJob.message,
        context: mockJob.context,
        status: mockJob.status,
      });

      expect(job.id).toBeDefined();
      expect(job.userId).toBe(mockJob.userId);
      expect(job.message).toBe(mockJob.message);
      expect(job.status).toBe('pending');
      expect(job.createdAt).toBeDefined();
    });

    it('should generate unique IDs for each job', async () => {
      const { createJob } = await import('@/lib/queue/kv');

      const job1 = await createJob(mockJob);
      const job2 = await createJob(mockJob);

      expect(job1.id).not.toBe(job2.id);
    });
  });

  describe('shouldRetry', () => {
    it('should allow retry when retryCount < maxRetries', async () => {
      const { shouldRetry } = await import('@/lib/queue/kv');

      expect(shouldRetry({ ...mockJob, retryCount: 0 })).toBe(true);
      expect(shouldRetry({ ...mockJob, retryCount: 1 })).toBe(true);
      expect(shouldRetry({ ...mockJob, retryCount: 2 })).toBe(true);
      expect(shouldRetry({ ...mockJob, retryCount: 3 })).toBe(false);
    });
  });

  describe('calculateBackoff', () => {
    it('should calculate exponential backoff', async () => {
      const { calculateBackoff } = await import('@/lib/queue/kv');

      expect(calculateBackoff(0)).toBe(60000); // 1 minute
      expect(calculateBackoff(1)).toBe(120000); // 2 minutes
      expect(calculateBackoff(2)).toBe(240000); // 4 minutes
    });
  });
});
