import {
  getNextPendingJob,
  updateJob,
  incrementRetryCount,
  shouldRetry,
  calculateBackoff,
} from '@/lib/queue/kv';
import { sendCard } from '@/lib/lark/client';
import { createCompletedCard, createErrorCard, createConflictCard } from '@/lib/lark/cards';
import { generateCodeWithRetry } from '@/lib/ai/glm';
import { applyCodeChanges, parseRepoUrl, getRepositoryFiles } from '@/lib/github/client';
import type { Job } from '@/types';

// ============================================================================
// Cron Worker Handler
// ============================================================================

export async function GET(request: Request): Promise<Response> {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Verify cron secret if configured
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Get the next pending job
    const job = await getNextPendingJob();

    if (!job) {
      return Response.json({ status: 'no_jobs', message: 'No pending jobs' });
    }

    console.log(`Processing job ${job.id}: ${job.message}`);

    // Process the job
    await processJob(job);

    return Response.json({
      status: 'success',
      jobId: job.id,
    });
  } catch (error) {
    console.error('Cron error:', error);
    return Response.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  return GET(request);
}

// ============================================================================
// Job Processing
// ============================================================================

async function processJob(job: Job): Promise<void> {
  const { owner, repo } = parseRepoUrl(job.context.repoUrl);

  try {
    // Fetch existing files for context
    const existingFiles = await getRepositoryFiles(owner, repo, job.context.branch);

    // Generate code using GLM-4.7
    const codeChanges = await generateCodeWithRetry(job.message, {
      repoUrl: job.context.repoUrl,
      branch: job.context.branch,
      files: job.context.files,
      existingFiles,
    });

    // Apply changes to GitHub
    const result = await applyCodeChanges(
      job.context.repoUrl,
      codeChanges,
      job.context.branch
    );

    // Update job as completed
    await updateJob(job.id, {
      status: 'completed',
      result: {
        prUrl: result.prUrl,
        summary: result.summary,
        branch: result.branch,
      },
      completedAt: Date.now(),
    });

    // Send completion notification
    const completedJob = await updateJob(job.id, {});
    if (completedJob) {
      await sendCard(job.userId, createCompletedCard(completedJob));
    }

    console.log(`Job ${job.id} completed successfully`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Job ${job.id} failed:`, errorMessage);

    // Handle merge conflicts specifically (no retry)
    if (errorMessage.includes('Merge conflicts detected')) {
      await updateJob(job.id, {
        status: 'failed',
        error: errorMessage,
        completedAt: Date.now(),
      });

      const failedJob = await updateJob(job.id, {});
      if (failedJob) {
        // Extract conflicting files from error message
        const conflictingFilesMatch = errorMessage.match(/Conflicting files: (.+)/);
        const conflictingFiles = conflictingFilesMatch
          ? conflictingFilesMatch[1].split(', ').map(f => f.trim())
          : ['Unknown files'];

        await sendCard(job.userId, createConflictCard(failedJob, conflictingFiles));
      }
      return;
    }

    // Check if we should retry
    const retryCount = await incrementRetryCount(job.id);

    if (shouldRetry({ ...job, retryCount })) {
      // Re-queue with exponential backoff
      const backoff = calculateBackoff(retryCount);
      await new Promise((resolve) => setTimeout(resolve, backoff));

      await updateJob(job.id, {
        status: 'pending',
        error: errorMessage,
      });

      console.log(`Job ${job.id} requeued for retry ${retryCount}/3`);
    } else {
      // Mark as failed
      await updateJob(job.id, {
        status: 'failed',
        error: errorMessage,
        completedAt: Date.now(),
      });

      // Send error notification
      const failedJob = await updateJob(job.id, {});
      if (failedJob) {
        await sendCard(
          job.userId,
          createErrorCard(failedJob, 'タスクの実行中にエラーが発生しました', errorMessage)
        );
      }

      console.log(`Job ${job.id} marked as failed`);
    }
  }
}

// ============================================================================
// Manual Job Processing (for debugging)
// ============================================================================

export async function PUT(request: Request): Promise<Response> {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = (await request.json()) as { jobId?: string };
    const { jobId } = body;

    if (!jobId) {
      return new Response('Missing jobId', { status: 400 });
    }

    // Import here to avoid circular dependency
    const { getJob } = await import('@/lib/queue/kv');
    const job = await getJob(jobId);

    if (!job) {
      return new Response('Job not found', { status: 404 });
    }

    // Process the specific job
    await processJob(job);

    return Response.json({
      status: 'success',
      jobId: job.id,
    });
  } catch (error) {
    console.error('Manual job processing error:', error);
    return Response.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
