// ============================================================================
// Job Queue Types
// ============================================================================

export type JobStatus = 'pending' | 'questioning' | 'processing' | 'completed' | 'failed';

export interface Question {
  id: string;
  text: string;
  answer?: string;
  askedAt: number;
}

export interface JobContext {
  repoUrl: string;
  branch?: string;
  files?: string[];
  existingFiles?: Record<string, string>;
  mode?: 'create-pr' | 'update-branch';
}

export interface JobResult {
  prUrl: string;
  summary: string;
  branch: string;
  mode?: 'create-pr' | 'update-branch';
}

export interface Job {
  id: string;
  userId: string;
  message: string;
  context: JobContext;
  status: JobStatus;
  result?: JobResult;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  retryCount?: number;
  questions?: Question[];
  threadId?: string;
  parentMessageId?: string;
}

// ============================================================================
// Lark Types
// ============================================================================

export type ReceiveIdType = 'chat_id' | 'user_id' | 'open_id';

export interface LarkMessage {
  msg_type: 'interactive' | 'text';
  content: string;
}

export interface LarkWebhookEvent {
  schema: string;
  header: {
    event_id: string;
    timestamp: string;
    token: string;
    app_id: string;
    tenant_key: string;
    type: string;
    event_type?: string;
  };
  event?: {
    operator?: {
      user_id: string;
    };
    message?: {
      message_id: string;
      chat_id: string;
      chat_type: string;
      content: string;
    };
    challenge?: string;
    action?: {
      value: {
        type: string;
        job_id?: string;
      };
    };
  };
}

export interface LarkCardAction {
  tag: 'button' | 'link';
  text?: { tag: 'plain_text'; content: string };
  type?: 'primary' | 'default';
  url?: string;
  value?: Record<string, unknown>;
}

export interface LarkCardElement {
  tag: 'div' | 'action' | 'hr';
  text?: { tag: 'lark_md' | 'plain_text'; content: string };
  actions?: LarkCardAction[];
}

export interface LarkCard {
  msg_type: 'interactive';
  card: {
    header?: {
      title: { tag: 'plain_text'; content: string };
      template?: 'blue' | 'green' | 'red' | 'yellow';
    };
    elements: LarkCardElement[];
  };
}

// ============================================================================
// GLM Types
// ============================================================================

export interface GLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GLMRequest {
  model: string;
  messages: GLMMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface GLMResponse {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface CodeGenerationResponse {
  plan: string;
  files: Array<{
    path: string;
    content: string;
  }>;
  commitMessage: string;
  prTitle: string;
  prBody: string;
}

export interface QuestioningResponse {
  needsQuestions: boolean;
  questions?: Array<{
    id: string;
    text: string;
  }>;
  codeChanges?: CodeGenerationResponse;
}

// ============================================================================
// GitHub Types
// ============================================================================

export interface GitHubPR {
  html_url: string;
  number: number;
  state: string;
  title: string;
  body: string;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
  };
}

export interface GitHubCreatePRParams {
  owner: string;
  repo: string;
  title: string;
  body: string;
  head: string;
  base: string;
}
