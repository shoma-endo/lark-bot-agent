import { kv } from '@vercel/kv';
import type { Job, JobStatus } from '@/types';

const JOB_PREFIX = 'job:';
const PENDING_JOBS_KEY = 'jobs:pending';
const USER_JOBS_PREFIX = 'jobs:user:';

// ============================================================================
// Job Queue Operations
// ============================================================================

export async function createJob(job: Omit<Job, 'id' | 'createdAt'>): Promise<Job> {
  const id = crypto.randomUUID();
  const now = Date.now();

  const newJob: Job = {
    ...job,
    id,
    createdAt: now,
  };

  // Store job data
  await kv.set(`${JOB_PREFIX}${id}`, JSON.stringify(newJob));

  // Add to pending queue only if not questioning
  if (job.status !== 'questioning') {
    await kv.zadd(PENDING_JOBS_KEY, { score: now, member: id });
  }

  // Add to user's job history
  await kv.lpush(`${USER_JOBS_PREFIX}${job.userId}`, id);

  return newJob;
}

export async function getJob(jobId: string): Promise<Job | null> {
  const data = await kv.get<string>(`${JOB_PREFIX}${jobId}`);
  if (!data) return null;
  return JSON.parse(data) as Job;
}

export async function updateJob(
  jobId: string,
  updates: Partial<Job>
): Promise<Job | null> {
  const job = await getJob(jobId);
  if (!job) return null;

  const updatedJob: Job = {
    ...job,
    ...updates,
  };

  await kv.set(`${JOB_PREFIX}${jobId}`, JSON.stringify(updatedJob));

  // Update queue if status changed
  if (updates.status && updates.status !== job.status) {
    await removeFromQueue(jobId, job.status);
    if (updates.status === 'pending') {
      await kv.zadd(PENDING_JOBS_KEY, { score: Date.now(), member: jobId });
    }
  }

  return updatedJob;
}

async function removeFromQueue(jobId: string, oldStatus: JobStatus): Promise<void> {
  if (oldStatus === 'pending' || oldStatus === 'processing') {
    await kv.zrem(PENDING_JOBS_KEY, jobId);
  }
}

export async function getNextPendingJob(): Promise<Job | null> {
  // Get the oldest job from the pending queue
  const result = await kv.zpopmin(PENDING_JOBS_KEY);

  if (!result || result.length === 0) return null;

  const firstItem = result[0] as { member: string; score: number } | undefined;
  if (!firstItem) return null;

  const jobId = firstItem.member;
  const job = await getJob(jobId);

  if (!job) return null;

  // Mark as processing
  return await updateJob(jobId, { status: 'processing', startedAt: Date.now() });
}

export async function getUserJobs(userId: string, limit = 10): Promise<Job[]> {
  const jobIds = await kv.lrange(`${USER_JOBS_PREFIX}${userId}`, 0, limit - 1);

  if (!jobIds || jobIds.length === 0) return [];

  const jobs: Job[] = [];
  for (const jobId of jobIds) {
    const job = await getJob(jobId as string);
    if (job) {
      jobs.push(job);
    }
  }

  return jobs.sort((a, b) => b.createdAt - a.createdAt);
}

export async function incrementRetryCount(jobId: string): Promise<number> {
  const job = await getJob(jobId);
  if (!job) return 0;

  const newRetryCount = (job.retryCount || 0) + 1;
  await updateJob(jobId, { retryCount: newRetryCount });

  return newRetryCount;
}

// ============================================================================
// Queue Stats
// ============================================================================

export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  // Count jobs in each status
  const pendingJobs = await kv.zrange(PENDING_JOBS_KEY, 0, -1);

  let processing = 0;
  let completed = 0;
  let failed = 0;

  // For now, we'll estimate based on pending queue
  // In production, you'd want separate sorted sets for each status

  return {
    pending: pendingJobs.length,
    processing,
    completed,
    failed,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

export function shouldRetry(job: Job): boolean {
  const MAX_RETRIES = 3;
  return (job.retryCount || 0) < MAX_RETRIES;
}

export function calculateBackoff(retryCount: number): number {
  // Exponential backoff: 1min, 2min, 4min
  return Math.pow(2, retryCount) * 60 * 1000;
}
