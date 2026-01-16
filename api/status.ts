import type { LarkWebhookEvent } from '@/types';
import { getJob, getUserJobs } from '@/lib/queue/kv';
import { verifyWebhook } from '@/lib/lark/client';
import { createStatusCard } from '@/lib/lark/cards';
import { sendCard } from '@/lib/lark/client';

// ============================================================================
// Status API (for card button actions)
// ============================================================================

export async function POST(request: Request): Promise<Response> {
  try {
    const event = (await request.json()) as LarkWebhookEvent;

    // Verify webhook
    if (!verifyWebhook(event)) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Parse the action from the event
    const action = event.event as unknown as {
      action?: {
        value: {
          type: string;
          job_id?: string;
        };
      };
    };

    const actionType = action?.action?.value?.type;
    const jobId = action?.action?.value?.job_id;

    if (!jobId) {
      return new Response('Missing job_id', { status: 400 });
    }

    const job = await getJob(jobId);
    if (!job) {
      return new Response('Job not found', { status: 404 });
    }

    // Handle different action types
    switch (actionType) {
      case 'check_status':
      case 'refresh_status':
        await sendCard(job.userId, createStatusCard(job));
        break;

      case 'retry':
        // Re-queue the job
        const { updateJob } = await import('@/lib/queue/kv');
        await updateJob(jobId, {
          status: 'pending',
          error: undefined,
        });
        await sendCard(job.userId, createStatusCard({ ...job, status: 'pending' }));
        break;

      default:
        return new Response('Unknown action type', { status: 400 });
    }

    return new Response('Status sent', { status: 200 });
  } catch (error) {
    console.error('Status API error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// ============================================================================
// Get User Jobs (REST API)
// ============================================================================

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return new Response('Missing userId parameter', { status: 400 });
    }

    const jobs = await getUserJobs(userId);

    return Response.json({
      jobs,
      count: jobs.length,
    });
  } catch (error) {
    console.error('Status GET error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// ============================================================================
// Options Handler (for CORS)
// ============================================================================

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
