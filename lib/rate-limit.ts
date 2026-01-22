import { RateLimitError } from './errors';

// ============================================================================
// Rate Limit Tracker
// ============================================================================

interface RateLimitState {
  remaining: number;
  limit: number;
  resetAt: number; // Unix timestamp in seconds
  lastChecked: number;
}

const rateLimitStates: Map<string, RateLimitState> = new Map();

// ============================================================================
// GitHub Rate Limit
// ============================================================================

/**
 * Parse GitHub rate limit headers from response
 */
export function parseGitHubRateLimitHeaders(headers: Headers): Partial<RateLimitState> {
  const remaining = headers.get('x-ratelimit-remaining');
  const limit = headers.get('x-ratelimit-limit');
  const reset = headers.get('x-ratelimit-reset');

  return {
    remaining: remaining ? parseInt(remaining, 10) : undefined,
    limit: limit ? parseInt(limit, 10) : undefined,
    resetAt: reset ? parseInt(reset, 10) : undefined,
    lastChecked: Date.now(),
  };
}

/**
 * Update GitHub rate limit state
 */
export function updateGitHubRateLimit(headers: Headers): void {
  const parsed = parseGitHubRateLimitHeaders(headers);
  if (parsed.remaining !== undefined && parsed.limit !== undefined) {
    rateLimitStates.set('github', {
      remaining: parsed.remaining,
      limit: parsed.limit ?? 5000,
      resetAt: parsed.resetAt ?? Math.floor(Date.now() / 1000) + 3600,
      lastChecked: Date.now(),
    });
  }
}

/**
 * Check if GitHub rate limit is exceeded or close to limit
 */
export function checkGitHubRateLimit(threshold = 10): void {
  const state = rateLimitStates.get('github');
  if (!state) return;

  // If rate limit data is stale (older than 5 minutes), skip check
  if (Date.now() - state.lastChecked > 5 * 60 * 1000) return;

  if (state.remaining <= 0) {
    const retryAfter = Math.max(0, state.resetAt - Math.floor(Date.now() / 1000));
    throw new RateLimitError('github', retryAfter);
  }

  if (state.remaining <= threshold) {
    console.warn(
      `GitHub rate limit warning: ${state.remaining}/${state.limit} remaining. ` +
      `Resets at ${new Date(state.resetAt * 1000).toISOString()}`
    );
  }
}

/**
 * Get current GitHub rate limit state
 */
export function getGitHubRateLimitState(): RateLimitState | undefined {
  return rateLimitStates.get('github');
}

// ============================================================================
// GLM Rate Limit
// ============================================================================

// GLM uses a simple request-based rate limiting with backoff
interface GLMRateLimitState {
  consecutiveErrors: number;
  lastError: number;
  backoffUntil: number;
}

let glmRateLimitState: GLMRateLimitState = {
  consecutiveErrors: 0,
  lastError: 0,
  backoffUntil: 0,
};

/**
 * Record a GLM rate limit error
 */
export function recordGLMRateLimitError(): void {
  const now = Date.now();
  glmRateLimitState.consecutiveErrors++;
  glmRateLimitState.lastError = now;

  // Exponential backoff: 2^n seconds, max 5 minutes
  const backoffSeconds = Math.min(
    Math.pow(2, glmRateLimitState.consecutiveErrors),
    300
  );
  glmRateLimitState.backoffUntil = now + backoffSeconds * 1000;

  console.warn(
    `GLM rate limit: backing off for ${backoffSeconds}s (attempt ${glmRateLimitState.consecutiveErrors})`
  );
}

/**
 * Record a successful GLM request
 */
export function recordGLMSuccess(): void {
  glmRateLimitState.consecutiveErrors = 0;
  glmRateLimitState.backoffUntil = 0;
}

/**
 * Check if GLM requests should be throttled
 */
export function checkGLMRateLimit(): void {
  const now = Date.now();

  if (now < glmRateLimitState.backoffUntil) {
    const retryAfter = Math.ceil((glmRateLimitState.backoffUntil - now) / 1000);
    throw new RateLimitError('glm', retryAfter);
  }
}

/**
 * Get time until GLM backoff expires (in seconds)
 */
export function getGLMBackoffRemaining(): number {
  const remaining = glmRateLimitState.backoffUntil - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

// ============================================================================
// Generic Rate Limit Utilities
// ============================================================================

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for rate limit to reset if needed
 */
export async function waitForRateLimitReset(
  service: 'github' | 'glm',
  maxWait = 60000
): Promise<boolean> {
  let waitTime = 0;

  if (service === 'github') {
    const state = rateLimitStates.get('github');
    if (state && state.remaining <= 0) {
      waitTime = Math.max(0, state.resetAt * 1000 - Date.now());
    }
  } else if (service === 'glm') {
    waitTime = Math.max(0, glmRateLimitState.backoffUntil - Date.now());
  }

  if (waitTime <= 0) return true;
  if (waitTime > maxWait) return false;

  console.log(`Waiting ${Math.ceil(waitTime / 1000)}s for ${service} rate limit reset...`);
  await sleep(waitTime);
  return true;
}

/**
 * Execute with rate limit awareness
 */
export async function withRateLimitCheck<T>(
  service: 'github' | 'glm',
  fn: () => Promise<T>,
  options: { maxRetries?: number; autoWait?: boolean } = {}
): Promise<T> {
  const { maxRetries = 3, autoWait = true } = options;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check rate limit before attempt
      if (service === 'github') {
        checkGitHubRateLimit();
      } else {
        checkGLMRateLimit();
      }

      const result = await fn();

      // Record success for GLM
      if (service === 'glm') {
        recordGLMSuccess();
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (error instanceof RateLimitError) {
        if (service === 'glm') {
          recordGLMRateLimitError();
        }

        if (autoWait && attempt < maxRetries) {
          const waited = await waitForRateLimitReset(service);
          if (waited) continue;
        }
      }

      if (attempt < maxRetries) {
        // Exponential backoff for other errors
        await sleep(Math.pow(2, attempt - 1) * 1000);
      }
    }
  }

  throw lastError || new Error(`${service} request failed after ${maxRetries} attempts`);
}

// ============================================================================
// Rate Limit Status
// ============================================================================

export interface RateLimitStatus {
  github: {
    remaining: number;
    limit: number;
    resetAt: Date | null;
    healthy: boolean;
  };
  glm: {
    backoffRemaining: number;
    consecutiveErrors: number;
    healthy: boolean;
  };
}

/**
 * Get overall rate limit status for all services
 */
export function getRateLimitStatus(): RateLimitStatus {
  const githubState = rateLimitStates.get('github');

  return {
    github: {
      remaining: githubState?.remaining ?? -1,
      limit: githubState?.limit ?? -1,
      resetAt: githubState?.resetAt ? new Date(githubState.resetAt * 1000) : null,
      healthy: !githubState || githubState.remaining > 10,
    },
    glm: {
      backoffRemaining: getGLMBackoffRemaining(),
      consecutiveErrors: glmRateLimitState.consecutiveErrors,
      healthy: glmRateLimitState.consecutiveErrors === 0,
    },
  };
}
