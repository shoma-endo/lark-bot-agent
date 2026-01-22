// ============================================================================
// Custom Error Classes
// ============================================================================

/**
 * Base application error class
 * All custom errors should extend this class
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode = 500,
    isOperational = true,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
    };
  }
}

// ============================================================================
// Validation Errors
// ============================================================================

/**
 * Thrown when input validation fails
 */
export class ValidationError extends AppError {
  public readonly errors: Array<{ path: string; message: string }>;

  constructor(
    message: string,
    errors: Array<{ path: string; message: string }> = [],
    context?: Record<string, unknown>
  ) {
    super(message, 'VALIDATION_ERROR', 400, true, context);
    this.errors = errors;
  }

  static fromZodError(error: { issues: Array<{ path: (string | number)[]; message: string }> }): ValidationError {
    const errors = error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return new ValidationError('入力データの検証に失敗しました', errors);
  }
}

// ============================================================================
// Lark API Errors
// ============================================================================

/**
 * Thrown when Lark API operations fail
 */
export class LarkApiError extends AppError {
  constructor(
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'LARK_API_ERROR', 502, true, context);
  }
}

/**
 * Thrown when Lark webhook verification fails
 */
export class LarkWebhookError extends AppError {
  constructor(message = 'Webhook verification failed') {
    super(message, 'LARK_WEBHOOK_ERROR', 401, true);
  }
}

// ============================================================================
// GitHub API Errors
// ============================================================================

/**
 * Thrown when GitHub API operations fail
 */
export class GitHubApiError extends AppError {
  public readonly endpoint?: string;

  constructor(
    message: string,
    endpoint?: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'GITHUB_API_ERROR', 502, true, { ...context, endpoint });
    this.endpoint = endpoint;
  }
}

/**
 * Thrown when GitHub repository URL is invalid
 */
export class InvalidRepoUrlError extends ValidationError {
  constructor(url: string) {
    super(
      `無効なGitHubリポジトリURL: ${url}`,
      [{ path: 'repoUrl', message: 'URLはgithub.com/owner/repoの形式である必要があります' }],
      { url }
    );
  }
}

/**
 * Thrown when a branch does not exist
 */
export class BranchNotFoundError extends AppError {
  constructor(branch: string, repo: string) {
    super(
      `ブランチ '${branch}' はリポジトリ '${repo}' に存在しません`,
      'BRANCH_NOT_FOUND',
      404,
      true,
      { branch, repo }
    );
  }
}

/**
 * Thrown when merge conflicts are detected
 */
export class MergeConflictError extends AppError {
  public readonly conflictingFiles: string[];

  constructor(conflictingFiles: string[] = []) {
    super(
      `マージコンフリクトが検出されました: ${conflictingFiles.join(', ') || '不明なファイル'}`,
      'MERGE_CONFLICT',
      409,
      true,
      { conflictingFiles }
    );
    this.conflictingFiles = conflictingFiles;
  }
}

// ============================================================================
// GLM (AI) API Errors
// ============================================================================

/**
 * Thrown when GLM API operations fail
 */
export class GLMApiError extends AppError {
  public readonly httpStatus?: number;

  constructor(
    message: string,
    httpStatus?: number,
    context?: Record<string, unknown>
  ) {
    super(message, 'GLM_API_ERROR', 502, true, { ...context, httpStatus });
    this.httpStatus = httpStatus;
  }
}

/**
 * Thrown when GLM response parsing fails
 */
export class GLMParseError extends AppError {
  constructor(
    message: string,
    rawContent?: string
  ) {
    super(
      `AI応答の解析に失敗しました: ${message}`,
      'GLM_PARSE_ERROR',
      422,
      true,
      { rawContent: rawContent?.slice(0, 500) }
    );
  }
}

/**
 * Thrown when GLM API key is missing
 */
export class GLMConfigError extends AppError {
  constructor(message = 'GLM_API_KEY is not set') {
    super(message, 'GLM_CONFIG_ERROR', 500, false);
  }
}

// ============================================================================
// Queue Errors
// ============================================================================

/**
 * Thrown when job queue operations fail
 */
export class QueueError extends AppError {
  constructor(
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'QUEUE_ERROR', 500, true, context);
  }
}

/**
 * Thrown when a job is not found
 */
export class JobNotFoundError extends AppError {
  constructor(jobId: string) {
    super(
      `ジョブが見つかりません: ${jobId}`,
      'JOB_NOT_FOUND',
      404,
      true,
      { jobId }
    );
  }
}

// ============================================================================
// Rate Limit Errors (for future P1 implementation)
// ============================================================================

/**
 * Thrown when API rate limit is exceeded
 */
export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(
    service: 'github' | 'glm' | 'lark',
    retryAfter?: number
  ) {
    super(
      `${service.toUpperCase()} APIのレート制限に達しました`,
      'RATE_LIMIT_EXCEEDED',
      429,
      true,
      { service, retryAfter }
    );
    this.retryAfter = retryAfter;
  }
}

// ============================================================================
// Error Utilities
// ============================================================================

/**
 * Check if an error is an operational error (expected and can be handled gracefully)
 */
export function isOperationalError(error: unknown): error is AppError {
  return error instanceof AppError && error.isOperational;
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(
      error.message,
      'INTERNAL_ERROR',
      500,
      false,
      { originalName: error.name }
    );
  }

  return new AppError(
    String(error),
    'UNKNOWN_ERROR',
    500,
    false
  );
}

/**
 * Format error for API response
 */
export function formatErrorResponse(error: unknown): {
  error: string;
  code: string;
  details?: unknown;
} {
  const appError = toAppError(error);

  return {
    error: appError.message,
    code: appError.code,
    details: appError.context,
  };
}
