import pino from 'pino';

// ============================================================================
// Logger Configuration
// ============================================================================

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST;

/**
 * Base logger instance
 * - Production: JSON format, info level
 * - Development: Pretty print, debug level
 * - Test: Silent
 */
export const logger = pino({
  level: isTest ? 'silent' : isProduction ? 'info' : 'debug',
  transport: !isProduction && !isTest
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    service: 'lark-bot-agent',
    env: process.env.NODE_ENV || 'development',
  },
});

// ============================================================================
// Request Context Logger
// ============================================================================

interface RequestContext {
  requestId: string;
  userId?: string;
  jobId?: string;
  [key: string]: unknown;
}

/**
 * Create a child logger with request context
 */
export function createRequestLogger(context: RequestContext) {
  return logger.child(context);
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================================
// Specialized Loggers
// ============================================================================

/**
 * Logger for webhook events
 */
export const webhookLogger = logger.child({ module: 'webhook' });

/**
 * Logger for GitHub operations
 */
export const githubLogger = logger.child({ module: 'github' });

/**
 * Logger for GLM AI operations
 */
export const glmLogger = logger.child({ module: 'glm' });

/**
 * Logger for Lark operations
 */
export const larkLogger = logger.child({ module: 'lark' });

/**
 * Logger for job queue operations
 */
export const queueLogger = logger.child({ module: 'queue' });

// ============================================================================
// Log Helpers
// ============================================================================

/**
 * Log API request (for external services)
 */
export function logApiRequest(
  moduleLogger: pino.Logger,
  service: string,
  endpoint: string,
  method: string
) {
  moduleLogger.debug({ service, endpoint, method }, 'API request started');
}

/**
 * Log API response
 */
export function logApiResponse(
  moduleLogger: pino.Logger,
  service: string,
  endpoint: string,
  status: number,
  durationMs: number
) {
  const level = status >= 400 ? 'warn' : 'debug';
  moduleLogger[level](
    { service, endpoint, status, durationMs },
    `API response: ${status}`
  );
}

/**
 * Log error with context
 */
export function logError(
  moduleLogger: pino.Logger,
  error: Error,
  context?: Record<string, unknown>
) {
  moduleLogger.error(
    {
      err: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...context,
    },
    error.message
  );
}

/**
 * Log job lifecycle events
 */
export function logJobEvent(
  jobId: string,
  event: 'created' | 'started' | 'completed' | 'failed' | 'retrying',
  details?: Record<string, unknown>
) {
  const logFn = event === 'failed' ? queueLogger.error : queueLogger.info;
  logFn.call(queueLogger, { jobId, event, ...details }, `Job ${event}`);
}

// ============================================================================
// Performance Logging
// ============================================================================

/**
 * Create a timer for measuring operation duration
 */
export function createTimer(label: string, moduleLogger: pino.Logger = logger) {
  const start = Date.now();

  return {
    end(context?: Record<string, unknown>) {
      const duration = Date.now() - start;
      moduleLogger.debug({ label, duration, ...context }, `${label} completed in ${duration}ms`);
      return duration;
    },
    endWithLevel(level: pino.Level, context?: Record<string, unknown>) {
      const duration = Date.now() - start;
      moduleLogger[level]({ label, duration, ...context }, `${label} completed in ${duration}ms`);
      return duration;
    },
  };
}

// ============================================================================
// Structured Log Types
// ============================================================================

export interface WebhookLogContext {
  eventId: string;
  eventType: string;
  userId?: string;
  chatId?: string;
}

export interface GitHubLogContext {
  owner: string;
  repo: string;
  operation: string;
  branch?: string;
}

export interface GLMLogContext {
  operation: 'generate' | 'analyze' | 'process_answers';
  messageLength: number;
  tokensUsed?: number;
}

export interface JobLogContext {
  jobId: string;
  userId: string;
  status: string;
  mode?: 'create-pr' | 'update-branch';
}

export default logger;
