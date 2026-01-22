import type { GLMRequest, GLMResponse, CodeGenerationResponse, Job, QuestioningResponse, Question } from '@/types';
import { GLMApiError, GLMConfigError, GLMParseError, RateLimitError } from '@/lib/errors';
import { CodeGenerationResponseSchema, QuestioningResponseSchema } from '@/lib/validation/schemas';
import {
  checkGLMRateLimit,
  recordGLMSuccess,
  recordGLMRateLimitError,
} from '@/lib/rate-limit';

const GLM_API_BASE = 'https://api.z.ai/api/paas/v4/chat/completions';

// GLM-4.7 model (fixed as per requirements)
const GLM_MODEL = 'glm-4.7';

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `あなたはGitHubリポジトリを操作するAIエージェントです。

## 役割
- ユーザーの指示を解釈し、適切なファイル変更を計画する
- コードを生成・編集し、Pull Requestを作成する
- 日本語でコミュニケーションする
- 既存コードのスタイルと規約を尊重する

## 制約
- 1回の変更で最大5ファイルまで
- 破壊的変更がある場合は事前に説明する
- エラーが発生した場合は具体的な理由を返す
- セキュリティ脆弱性を作り込まない

## 出力形式
必ずJSON形式で以下の構造を出力してください（コードブロック外）:

{
  "plan": "変更内容の簡単な説明",
  "files": [
    { "path": "src/example.ts", "content": "ファイルの完全な内容" }
  ],
  "commitMessage": "feat: コンベンショナルコミット形式",
  "prTitle": "PRタイトル",
  "prBody": "PRの説明文"
}

## コンベンショナルコミット
- feat: 新機能
- fix: バグ修正
- docs: ドキュメント変更
- style: フォーマット
- refactor: リファクタリング
- test: テスト追加・修正
- chore: その他`;

// ============================================================================
// Questioning System Prompt
// ============================================================================

const QUESTIONING_SYSTEM_PROMPT = `あなたはGitHubリポジトリを操作するAIエージェントのアシスタントです。

## 役割
- ユーザーの開発指示を分析し、不明点があれば質問する
- 十分に情報が揃っている場合は、コード生成を実行する
- 日本語でコミュニケーションする

## 質問すべきケース
以下の場合は質問をしてください：
- 実装内容が曖昧（「〜を実装して」だけ等）
- 技術スタックの選択が必要だが指定がない
- ファイルパスや関数名が特定できない
- 既存コードとの整合性が懸念される

## 質問不要なケース
以下の場合はそのままコード生成に進んでください：
- 具体的なファイルパスと変更内容が指定されている
- バグ修正で場所と内容が明確
- 単純な追加・修正で範囲が明確

## 出力形式
必ずJSON形式で以下の構造を出力してください：

**質問が必要な場合:**
{
  "needsQuestions": true,
  "questions": [
    { "id": "q1", "text": "質問文1" },
    { "id": "q2", "text": "質問文2" }
  ]
}

**質問不要でコード生成する場合:**
{
  "needsQuestions": false,
  "codeChanges": {
    "plan": "変更内容の説明",
    "files": [
      { "path": "src/example.ts", "content": "ファイル内容" }
    ],
    "commitMessage": "feat: コミットメッセージ",
    "prTitle": "PRタイトル",
    "prBody": "PR説明"
  }
}

## 制約
- 質問は最大3つまで
- 1つの質問で1つの事項を聞く
- 技術的に具体的な質問にする`;

// ============================================================================
// GLM API Call
// ============================================================================

export async function callGLM(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<GLMResponse> {
  // Check rate limit before making request
  checkGLMRateLimit();

  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    throw new GLMConfigError();
  }

  const requestBody: GLMRequest = {
    model: GLM_MODEL,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 8192,
  };

  let response: Response;
  try {
    response = await fetch(GLM_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'en-US,en',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    throw new GLMApiError(
      `GLM APIへの接続に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      { endpoint: GLM_API_BASE }
    );
  }

  if (!response.ok) {
    const errorText = await response.text();

    // Handle rate limit errors (429)
    if (response.status === 429) {
      recordGLMRateLimitError();
      const retryAfter = response.headers.get('retry-after');
      throw new RateLimitError('glm', retryAfter ? parseInt(retryAfter, 10) : undefined);
    }

    throw new GLMApiError(
      `GLM API error: ${errorText}`,
      response.status,
      { endpoint: GLM_API_BASE }
    );
  }

  // Record successful request
  recordGLMSuccess();

  return (await response.json()) as GLMResponse;
}

// ============================================================================
// Code Generation
// ============================================================================

export async function generateCode(
  userMessage: string,
  context: {
    repoUrl: string;
    branch?: string;
    files?: string[];
    existingCode?: Record<string, string>;
  }
): Promise<CodeGenerationResponse> {
  // Build context for the AI
  let contextMessage = `## リポジトリ情報\nリポジトリ: ${context.repoUrl}\n`;
  if (context.branch) {
    contextMessage += `ブランチ: ${context.branch}\n`;
  }

  if (context.existingCode && Object.keys(context.existingCode).length > 0) {
    contextMessage += `\n## 既存ファイル\n以下の既存ファイルを参照してください:\n\n`;
    for (const [path, content] of Object.entries(context.existingCode)) {
      const preview = content.length > 2000 ? content.slice(0, 2000) + '\n... (truncated)' : content;
      contextMessage += `### ${path}\n\`\`\`\n${preview}\n\`\`\`\n\n`;
    }
  }

  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    {
      role: 'user' as const,
      content: `${contextMessage}\n\n## ユーザーの指示\n${userMessage}`,
    },
  ];

  const response = await callGLM(messages, {
    temperature: 0.3, // Lower temperature for more structured output
    maxTokens: 8192,
  });

  const content = response.choices[0]?.message?.content || '';
  return parseCodeGenerationResponse(content);
}

// ============================================================================
// Response Parsing
// ============================================================================

export function parseCodeGenerationResponse(content: string): CodeGenerationResponse {
  // Try to extract JSON from the response
  let jsonStr = content;

  // Remove markdown code blocks if present
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1];
  } else {
    // Try to find JSON object boundaries
    const startIdx = content.indexOf('{');
    const endIdx = content.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1) {
      jsonStr = content.slice(startIdx, endIdx + 1);
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse JSON from GLM response:', error);
    throw new GLMParseError('JSONの解析に失敗しました', content);
  }

  // Validate with zod schema
  const result = CodeGenerationResponseSchema.safeParse(parsed);
  if (!result.success) {
    console.error('GLM response validation failed:', result.error.issues);
    throw new GLMParseError(
      result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
      content
    );
  }

  return result.data;
}

// ============================================================================
// Retry Logic
// ============================================================================

export async function generateCodeWithRetry(
  userMessage: string,
  context: Job['context'],
  maxRetries = 3
): Promise<CodeGenerationResponse> {
  let lastError: GLMApiError | GLMParseError | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateCode(userMessage, {
        repoUrl: context.repoUrl,
        branch: context.branch,
        files: context.files,
        existingCode: context.existingFiles,
      });
    } catch (error) {
      if (error instanceof GLMApiError || error instanceof GLMParseError) {
        lastError = error;
      } else {
        lastError = new GLMApiError(
          error instanceof Error ? error.message : String(error),
          undefined,
          { attempt }
        );
      }
      console.error(`GLM attempt ${attempt} failed:`, lastError.message);

      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new GLMApiError('All GLM retry attempts failed');
}

// ============================================================================
// Questioning & Analysis
// ============================================================================

export async function analyzeAndGenerate(
  userMessage: string,
  context: Job['context']
): Promise<QuestioningResponse> {
  // Build context for the AI
  let contextMessage = `## リポジトリ情報\nリポジトリ: ${context.repoUrl}\n`;
  if (context.branch) {
    contextMessage += `ブランチ: ${context.branch}\n`;
  }
  if (context.mode) {
    contextMessage += `モード: ${context.mode}\n`;
  }

  if (context.existingFiles && Object.keys(context.existingFiles).length > 0) {
    contextMessage += `\n## 既存ファイル\n以下の既存ファイルを参照してください:\n\n`;
    for (const [path, content] of Object.entries(context.existingFiles)) {
      const preview = content.length > 2000 ? content.slice(0, 2000) + '\n... (truncated)' : content;
      contextMessage += `### ${path}\n\`\`\`\n${preview}\n\`\`\`\n\n`;
    }
  }

  const messages = [
    { role: 'system' as const, content: QUESTIONING_SYSTEM_PROMPT },
    {
      role: 'user' as const,
      content: `${contextMessage}\n\n## ユーザーの指示\n${userMessage}`,
    },
  ];

  const response = await callGLM(messages, {
    temperature: 0.3,
    maxTokens: 4096,
  });

  const content = response.choices[0]?.message?.content || '';
  return parseQuestioningResponse(content);
}

export function parseQuestioningResponse(content: string): QuestioningResponse {
  let jsonStr = content;

  // Remove markdown code blocks if present
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1];
  } else {
    // Try to find JSON object boundaries
    const startIdx = content.indexOf('{');
    const endIdx = content.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1) {
      jsonStr = content.slice(startIdx, endIdx + 1);
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse JSON from questioning response:', error);
    throw new GLMParseError('JSONの解析に失敗しました', content);
  }

  // Validate with zod schema
  const result = QuestioningResponseSchema.safeParse(parsed);
  if (!result.success) {
    console.error('Questioning response validation failed:', result.error.issues);
    throw new GLMParseError(
      result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
      content
    );
  }

  return result.data;
}

export async function processUserAnswers(
  userMessage: string,
  questions: Question[],
  previousContext: string
): Promise<QuestioningResponse> {
  // Build conversation history with questions and answers
  let qaContext = '## これまでの質問と回答\n\n';
  for (const q of questions) {
    qaContext += `**Q:** ${q.text}\n`;
    if (q.answer) {
      qaContext += `**A:** ${q.answer}\n`;
    } else {
      qaContext += `**A:** (未回答)\n`;
    }
    qaContext += '\n';
  }

  const messages = [
    { role: 'system' as const, content: QUESTIONING_SYSTEM_PROMPT },
    {
      role: 'user' as const,
      content: `${previousContext}\n\n${qaContext}\n## 新しいユーザーの回答\n${userMessage}\n\n回答を踏まえて、まだ不明点があれば質問を、十分であればコード生成を行ってください。`,
    },
  ];

  const response = await callGLM(messages, {
    temperature: 0.3,
    maxTokens: 4096,
  });

  const content = response.choices[0]?.message?.content || '';
  return parseQuestioningResponse(content);
}
