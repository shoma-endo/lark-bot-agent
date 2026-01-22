import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

/**
 * GitHub repository URL schema
 * Supports:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 */
export const GitHubRepoUrlSchema = z.string().refine(
  (url) => {
    const patterns = [
      /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?$/,
      /^git@github\.com:[\w.-]+\/[\w.-]+(?:\.git)?$/,
    ];
    return patterns.some((pattern) => pattern.test(url));
  },
  {
    message: 'URLはgithub.com/owner/repoの形式である必要があります',
  }
);

/**
 * Branch name schema
 * Allows alphanumeric, hyphens, underscores, and slashes
 */
export const BranchNameSchema = z.string()
  .min(1, 'ブランチ名は必須です')
  .max(255, 'ブランチ名は255文字以内である必要があります')
  .regex(
    /^[\w./-]+$/,
    'ブランチ名には英数字、ハイフン、アンダースコア、スラッシュ、ドットのみ使用できます'
  )
  .refine(
    (name) => !name.startsWith('/') && !name.endsWith('/'),
    'ブランチ名はスラッシュで開始・終了できません'
  );

/**
 * File path schema
 * Prevents path traversal attacks
 */
export const FilePathSchema = z.string()
  .min(1, 'ファイルパスは必須です')
  .max(500, 'ファイルパスは500文字以内である必要があります')
  .refine(
    (path) => !path.includes('..'),
    'パストラバーサルは許可されていません'
  )
  .refine(
    (path) => !path.startsWith('/'),
    'パスは相対パスである必要があります'
  );

// ============================================================================
// Lark Webhook Schemas
// ============================================================================

/**
 * Lark webhook event header schema
 */
export const LarkWebhookHeaderSchema = z.object({
  event_id: z.string(),
  timestamp: z.string(),
  token: z.string(),
  app_id: z.string(),
  tenant_key: z.string(),
  type: z.string(),
  event_type: z.string().optional(),
});

/**
 * Lark message content schema
 */
export const LarkMessageContentSchema = z.object({
  text: z.string().optional(),
});

/**
 * Lark webhook event schema
 */
export const LarkWebhookEventSchema = z.object({
  schema: z.string().optional(),
  header: LarkWebhookHeaderSchema,
  event: z.object({
    operator: z.object({
      user_id: z.string(),
    }).optional(),
    message: z.object({
      message_id: z.string(),
      chat_id: z.string(),
      chat_type: z.string(),
      content: z.string(),
      parent_id: z.string().optional(),
      root_id: z.string().optional(),
    }).optional(),
    challenge: z.string().optional(),
    action: z.object({
      value: z.record(z.unknown()),
    }).optional(),
  }).optional(),
});

/**
 * Inferred type from the schema
 */
export type ValidatedLarkWebhookEvent = z.infer<typeof LarkWebhookEventSchema>;

// ============================================================================
// User Input Schemas
// ============================================================================

/**
 * User message schema (from Lark)
 * Sanitizes and validates user input
 */
export const UserMessageSchema = z.string()
  .min(1, 'メッセージは空にできません')
  .max(10000, 'メッセージは10000文字以内である必要があります')
  .transform((msg) => {
    // Remove control characters except newlines and tabs
    return msg.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  });

/**
 * Branch specification pattern
 * e.g., "branch: feature-xxx タスク内容"
 */
export const BranchSpecificationSchema = z.string().transform((content) => {
  const match = content.match(/^branch:\s*(\S+)\s+(.+)/i);
  if (match) {
    return {
      hasBranchSpec: true,
      branch: match[1],
      message: match[2],
      mode: 'update-branch' as const,
    };
  }
  return {
    hasBranchSpec: false,
    branch: undefined,
    message: content,
    mode: 'create-pr' as const,
  };
});

// ============================================================================
// Job Context Schemas
// ============================================================================

/**
 * Job context schema
 */
export const JobContextSchema = z.object({
  repoUrl: GitHubRepoUrlSchema,
  branch: BranchNameSchema.optional(),
  files: z.array(FilePathSchema).optional(),
  existingFiles: z.record(z.string()).optional(),
  mode: z.enum(['create-pr', 'update-branch']).optional(),
});

/**
 * Create job input schema
 */
export const CreateJobInputSchema = z.object({
  userId: z.string().min(1, 'ユーザーIDは必須です'),
  message: UserMessageSchema,
  context: JobContextSchema,
  status: z.enum(['pending', 'questioning']).default('pending'),
  questions: z.array(z.object({
    id: z.string(),
    text: z.string(),
    askedAt: z.number(),
    answer: z.string().optional(),
  })).optional(),
});

// ============================================================================
// GLM Response Schemas
// ============================================================================

/**
 * Code file schema
 */
export const CodeFileSchema = z.object({
  path: FilePathSchema,
  content: z.string(),
});

/**
 * Code generation response schema
 */
export const CodeGenerationResponseSchema = z.object({
  plan: z.string().min(1, 'プランは必須です'),
  files: z.array(CodeFileSchema).min(1, 'ファイルは1つ以上必要です').max(10, 'ファイルは10個以内にしてください'),
  commitMessage: z.string().min(1).max(200).default('chore: update files'),
  prTitle: z.string().min(1).max(100).optional(),
  prBody: z.string().min(1).max(5000).optional(),
}).transform((data) => ({
  ...data,
  prTitle: data.prTitle || data.plan.slice(0, 50),
  prBody: data.prBody || data.plan,
}));

/**
 * Question schema
 */
export const QuestionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(500),
});

/**
 * Questioning response schema (questions are limited to 3 max)
 */
export const QuestioningResponseSchema = z.discriminatedUnion('needsQuestions', [
  z.object({
    needsQuestions: z.literal(true),
    questions: z.array(QuestionSchema).min(1).transform((q) => q.slice(0, 3)),
  }),
  z.object({
    needsQuestions: z.literal(false),
    codeChanges: CodeGenerationResponseSchema,
  }),
]);

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Safe parse with error transformation
 */
export function safeParse<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: true;
  data: T;
} | {
  success: false;
  errors: Array<{ path: string; message: string }>;
} {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

/**
 * Parse and throw ValidationError on failure
 */
export function parseOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}
