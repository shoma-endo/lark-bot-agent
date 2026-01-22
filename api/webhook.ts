import type { Question, LarkWebhookEvent } from '@/types';
import { createJob, getJob, getUserJobs, updateJob } from '@/lib/queue/kv';
import { verifyWebhook, parseUserMessage, sendCard, replyToThread } from '@/lib/lark/client';
import { createProcessingCard, createWelcomeCard, createQuestionsCard } from '@/lib/lark/cards';
import { analyzeAndGenerate, processUserAnswers } from '@/lib/ai/glm';
import { getRepositoryFiles } from '@/lib/github/client';
import {
  LarkWebhookEventSchema,
  UserMessageSchema,
  BranchSpecificationSchema,
  GitHubRepoUrlSchema,
} from '@/lib/validation/schemas';
import {
  ValidationError,
  LarkWebhookError,
  AppError,
  formatErrorResponse,
} from '@/lib/errors';

// ============================================================================
// Webhook Handler
// ============================================================================

export async function POST(request: Request): Promise<Response> {
  try {
    // Parse and validate webhook event
    const rawEvent = await request.json();
    const eventResult = LarkWebhookEventSchema.safeParse(rawEvent);

    if (!eventResult.success) {
      console.error('Webhook validation failed:', eventResult.error.issues);
      throw new ValidationError(
        'Webhook イベントの検証に失敗しました',
        eventResult.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }))
      );
    }

    // Cast to LarkWebhookEvent (types are compatible after validation)
    const event = eventResult.data as LarkWebhookEvent;

    // Verify webhook (if token is configured)
    if (!verifyWebhook(event)) {
      throw new LarkWebhookError();
    }

    // Handle URL verification challenge
    if (event.header.event_type === 'url_verification') {
      return Response.json({
        challenge: event.event?.challenge,
      });
    }

    // Parse user message
    const messageData = parseUserMessage(event);
    if (!messageData) {
      return new Response('No valid message', { status: 400 });
    }

    const { userId, chatId, content: rawContent, parentMessageId, rootMessageId } = messageData;

    // Validate and sanitize user content
    const contentResult = UserMessageSchema.safeParse(rawContent);
    if (!contentResult.success) {
      throw new ValidationError(
        'メッセージの検証に失敗しました',
        contentResult.error.issues.map((issue) => ({
          path: 'content',
          message: issue.message,
        }))
      );
    }
    const content = contentResult.data;

    // Handle help/welcome message
    if (content.match(/^(help|ヘルプ|使い方|about|about)$/i)) {
      await sendCard(chatId, createWelcomeCard());
      return new Response('Welcome card sent', { status: 200 });
    }

    // ============================================================================
    // Handle thread replies (answers to questions)
    // ============================================================================
    const threadId = rootMessageId || parentMessageId;
    if (threadId) {
      // Find the questioning job for this thread
      const userJobs = await getUserJobs(userId, 20);

      const questioningJob = userJobs.find(
        job => job.status === 'questioning' && job.parentMessageId === threadId
      );

      if (questioningJob) {
        // Update questions with user's answer
        const updatedQuestions = [...(questioningJob.questions || [])];
        const lastUnansweredIndex = updatedQuestions.findIndex(q => !q.answer);

        if (lastUnansweredIndex !== -1) {
          updatedQuestions[lastUnansweredIndex] = {
            ...updatedQuestions[lastUnansweredIndex],
            answer: content,
          };

          // Check if we still need more questions or can proceed
          const { owner, repo } = (() => {
            const match = questioningJob.context.repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
            return match ? { owner: match[1], repo: match[2].replace('.git', '') } : { owner: '', repo: '' };
          })();

          let contextString = `## リポジトリ情報\nリポジトリ: ${questioningJob.context.repoUrl}\n`;
          if (questioningJob.context.branch) {
            contextString += `ブランチ: ${questioningJob.context.branch}\n`;
          }

          const response = await processUserAnswers(
            content,
            updatedQuestions,
            contextString
          );

          if (response.needsQuestions && response.questions && response.questions.length > 0) {
            // Still have more questions
            const newQuestions: Question[] = response.questions.map(q => ({
              id: q.id,
              text: q.text,
              askedAt: Date.now(),
            }));

            await updateJob(questioningJob.id, {
              questions: [...updatedQuestions, ...newQuestions],
            });

            // Send updated questions card
            const updatedJob = await getJob(questioningJob.id);
            if (updatedJob) {
              await replyToThread(chatId, threadId, createQuestionsCard(updatedJob));
            }
          } else if (response.codeChanges) {
            // All questions answered, proceed to development
            await updateJob(questioningJob.id, {
              questions: updatedQuestions,
              status: 'pending',
              context: {
                ...questioningJob.context,
                codeChanges: response.codeChanges,
              },
            } as any);

            // Send confirmation that development is starting
            await replyToThread(chatId, threadId, {
              msg_type: 'interactive',
              card: {
                header: {
                  title: { tag: 'plain_text', content: '🚀 開発を開始します' },
                  template: 'blue',
                },
                elements: [
                  {
                    tag: 'div',
                    text: {
                      tag: 'lark_md',
                      content: `ご回答ありがとうございます。\n\n**プラン:** ${response.codeChanges.plan}\n\n開発を開始します...`,
                    },
                  },
                ],
              },
            });
          }

          return new Response('Answer processed', { status: 200 });
        }
      }

      // If no questioning job found, treat as normal message
    }

    // ============================================================================
    // Handle new messages
    // ============================================================================

    // Parse branch specification (e.g., "branch: feature-xxx タスク内容")
    const branchSpec = BranchSpecificationSchema.parse(content);
    const targetMessage = branchSpec.message;
    const targetBranch = branchSpec.branch;
    const mode = branchSpec.mode;

    // Default repo URL (can be configured via env or user settings)
    const defaultRepoUrl = process.env.DEFAULT_REPO_URL || 'https://github.com/shoma-endo/lark-bot-agent';

    // Validate repo URL
    const repoUrlResult = GitHubRepoUrlSchema.safeParse(defaultRepoUrl);
    if (!repoUrlResult.success) {
      throw new ValidationError(
        '無効なリポジトリURLが設定されています',
        [{ path: 'DEFAULT_REPO_URL', message: repoUrlResult.error.issues[0]?.message || 'Invalid URL' }]
      );
    }

    // Parse repo URL to get owner and repo for fetching files
    const repoMatch = defaultRepoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    const owner = repoMatch?.[1] || '';
    const repo = repoMatch?.[2]?.replace('.git', '') || '';

    // Fetch existing files for context
    let existingFiles: Record<string, string> = {};
    if (owner && repo) {
      try {
        existingFiles = await getRepositoryFiles(owner, repo, targetBranch || 'main', 10);
      } catch (e) {
        console.error('Failed to fetch repository files:', e);
      }
    }

    // Analyze if questions are needed
    const analysis = await analyzeAndGenerate(targetMessage, {
      repoUrl: defaultRepoUrl,
      branch: targetBranch || 'main',
      mode,
      existingFiles,
    });

    if (analysis.needsQuestions && analysis.questions && analysis.questions.length > 0) {
      // Create job with questioning status
      const questions: Question[] = analysis.questions.map(q => ({
        id: q.id,
        text: q.text,
        askedAt: Date.now(),
      }));

      const job = await createJob({
        userId,
        message: targetMessage,
        context: {
          repoUrl: defaultRepoUrl,
          branch: targetBranch || 'main',
          mode,
          existingFiles,
        },
        status: 'questioning',
        questions,
      });

      // Send the message first (this will create the thread)
      await sendCard(chatId, createQuestionsCard(job));

      // Update job with the message ID for thread tracking
      // Note: In a real implementation, you'd get the message ID from the sendCard response
      // For now, we'll rely on the user replying to the message

      return new Response('Questions sent', { status: 200 });
    }

    // No questions needed, create normal job
    const job = await createJob({
      userId,
      message: targetMessage,
      context: {
        repoUrl: defaultRepoUrl,
        branch: targetBranch || 'main',
        mode,
        existingFiles,
        codeChanges: analysis.codeChanges,
      } as any,
      status: 'pending',
    });

    // Send processing card to the chat
    await sendCard(chatId, createProcessingCard(job));

    return new Response('Job created', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);

    // Handle known error types
    if (error instanceof AppError) {
      return Response.json(formatErrorResponse(error), { status: error.statusCode });
    }

    // Unknown error
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
