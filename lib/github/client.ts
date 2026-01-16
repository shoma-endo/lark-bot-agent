import { Octokit } from 'octokit';
import type { CodeGenerationResponse } from '@/types';

// Initialize GitHub client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

// ============================================================================
// Repository Parsing
// ============================================================================

export interface RepoInfo {
  owner: string;
  repo: string;
}

export function parseRepoUrl(repoUrl: string): RepoInfo {
  // Handle various GitHub URL formats
  // https://github.com/owner/repo
  // git@github.com:owner/repo.git
  // https://github.com/owner/repo.git

  const match =
    repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/) ||
    repoUrl.match(/github\.com[/:]([^/]+)\/([^/]+)/);

  if (!match) {
    throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
  }

  return { owner: match[1], repo: match[2].replace('.git', '') };
}

// ============================================================================
// Branch Operations
// ============================================================================

export async function createBranch(
  owner: string,
  repo: string,
  branchName: string,
  baseBranch = 'main'
): Promise<void> {
  // Get the base branch reference
  const { data: baseRef } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`,
  });

  // Create the new branch
  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: baseRef.object.sha,
  });
}

export async function branchExists(
  owner: string,
  repo: string,
  branchName: string
): Promise<boolean> {
  try {
    await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branchName}`,
    });
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// File Operations
// ============================================================================

export async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  branch?: string
): Promise<{ content: string; sha: string } | null> {
  try {
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });

    if (Array.isArray(response.data)) {
      return null;
    }

    if (response.data.type !== 'file') {
      return null;
    }

    // Content is base64 encoded
    const content = Buffer.from(response.data.content, 'base64').toString('utf-8');

    return {
      content,
      sha: response.data.sha,
    };
  } catch {
    return null;
  }
}

export async function createOrUpdateFiles(
  owner: string,
  repo: string,
  branchName: string,
  files: Array<{ path: string; content: string }>,
  commitMessage: string
): Promise<void> {
  // Get the latest commit SHA of the branch
  const { data: ref } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${branchName}`,
  });

  let latestCommitSha = ref.object.sha;
  const treeItems: Array<{ path: string; mode: '100644'; type: 'blob'; sha?: string }> = [];

  // Create blobs for each file
  for (const file of files) {
    const blob = await octokit.rest.git.createBlob({
      owner,
      repo,
      content: Buffer.from(file.content).toString('base64'),
      encoding: 'base64',
    });

    treeItems.push({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: blob.data.sha,
    });
  }

  // Create a tree
  const { data: tree } = await octokit.rest.git.createTree({
    owner,
    repo,
    tree: treeItems,
    base_tree: latestCommitSha,
  });

  // Create a commit
  const { data: commit } = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: commitMessage,
    tree: tree.sha,
    parents: [latestCommitSha],
  });

  // Update the branch reference
  await octokit.rest.git.updateRef({
    owner,
    repo,
    ref: `heads/${branchName}`,
    sha: commit.sha,
  });
}

// ============================================================================
// Pull Request Operations
// ============================================================================

export async function createPullRequest(
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base = 'main'
): Promise<{ html_url: string; number: number }> {
  const { data } = await octokit.rest.pulls.create({
    owner,
    repo,
    title,
    body,
    head,
    base,
  });

  return {
    html_url: data.html_url,
    number: data.number,
  };
}

export async function pullRequestExists(
  owner: string,
  repo: string,
  head: string,
  base = 'main'
): Promise<boolean> {
  const { data: prs } = await octokit.rest.pulls.list({
    owner,
    repo,
    state: 'open',
    head: `${owner}:${head}`,
    base,
  });

  return prs.length > 0;
}

// ============================================================================
// Conflict Detection
// ============================================================================

export interface ConflictInfo {
  hasConflicts: boolean;
  conflictingFiles?: string[];
}

export async function checkMergeConflicts(
  owner: string,
  repo: string,
  head: string,
  base = 'main'
): Promise<ConflictInfo> {
  try {
    // Compare branches to detect conflicts
    const { data: comparison } = await octokit.rest.repos.compareCommits({
      owner,
      repo,
      base,
      head,
    });

    // Check if merge is possible (ahead indicates can be merged without conflicts)
    if (comparison.status === 'diverged' || comparison.status === 'behind') {
      // Check for specific file conflicts
      const conflictingFiles: string[] = [];

      for (const file of comparison.files || []) {
        // Files that are modified on both sides might have conflicts
        if (file.status === 'modified') {
          conflictingFiles.push(file.filename);
        }
      }

      // Try to verify by checking if a merge would succeed
      try {
        await octokit.rest.repos.merge({
          owner,
          repo,
          base,
          head,
        });
      } catch (mergeError) {
        // If merge fails, there are conflicts
        const errorMsg = mergeError instanceof Error ? mergeError.message : String(mergeError);
        if (errorMsg.includes('conflict') || errorMsg.includes('Merge conflict')) {
          return {
            hasConflicts: true,
            conflictingFiles,
          };
        }
      }
    }

    return { hasConflicts: false };
  } catch {
    // If we can't check, assume no conflicts
    return { hasConflicts: false };
  }
}

// ============================================================================
// High-Level Operations
// ============================================================================

export async function applyCodeChanges(
  repoUrl: string,
  changes: CodeGenerationResponse,
  baseBranch = 'main'
): Promise<{ prUrl: string; branch: string; summary: string }> {
  const { owner, repo } = parseRepoUrl(repoUrl);

  // Generate a unique branch name
  const timestamp = Date.now().toString(36);
  const branchName = `ai/changes-${timestamp}`;

  // Check if base branch exists, otherwise use 'master'
  let targetBranch = baseBranch;
  try {
    await octokit.rest.git.getRef({ owner, repo, ref: `heads/${baseBranch}` });
  } catch {
    targetBranch = 'master';
  }

  // Create the branch
  await createBranch(owner, repo, branchName, targetBranch);

  // Create or update files
  await createOrUpdateFiles(owner, repo, branchName, changes.files, changes.commitMessage);

  // Check for merge conflicts before creating PR
  const conflictCheck = await checkMergeConflicts(owner, repo, branchName, targetBranch);
  if (conflictCheck.hasConflicts) {
    // Delete the conflicting branch
    await octokit.rest.git.deleteRef({
      owner,
      repo,
      ref: `heads/${branchName}`,
    });

    throw new Error(
      `Merge conflicts detected. Conflicting files: ${conflictCheck.conflictingFiles?.join(', ') || 'unknown'}`
    );
  }

  // Create pull request
  const pr = await createPullRequest(
    owner,
    repo,
    changes.prTitle,
    changes.prBody,
    branchName,
    targetBranch
  );

  return {
    prUrl: pr.html_url,
    branch: branchName,
    summary: changes.plan,
  };
}

// ============================================================================
// Repository Info
// ============================================================================

// Common patterns to ignore when fetching repository files
const IGNORE_PATTERNS = [
  'node_modules/',
  'dist/',
  'build/',
  '.next/',
  '.nuxt/',
  'target/',
  'coverage/',
  '.git/',
  '.vscode/',
  '.idea/',
  '*.log',
  '*.lock',
  '*.min.js',
  '*.min.css',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '.DS_Store',
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.gif',
  '*.svg',
  '*.ico',
  '*.pdf',
  '*.zip',
  '*.tar',
  '*.gz',
];

// Only fetch files with these extensions (and files without extension)
const ALLOWED_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.rb',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.swift',
  '.cpp',
  '.c',
  '.h',
  '.cs',
  '.php',
  '.html',
  '.css',
  '.scss',
  '.less',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.md',
  '.txt',
  '.sh',
  '.bash',
  '.zsh',
  '.fish',
  '.env',
  '.example',
  '.gitignore',
  '.dockerfile',
  'dockerfile',
  'makefile',
  'cmakelists',
];

export function shouldIncludeFile(path: string): boolean {
  const lowerPath = path.toLowerCase();

  // Check ignore patterns
  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.endsWith('/')) {
      // Directory pattern - check if path is in this directory anywhere
      const dirPattern = pattern.slice(0, -1); // Remove trailing slash
      if (lowerPath.includes(`/${dirPattern}/`) || lowerPath.startsWith(`${dirPattern}/`)) {
        return false;
      }
    } else if (pattern.startsWith('*')) {
      // Extension pattern (e.g., *.log)
      const ext = pattern.slice(1);
      if (lowerPath.endsWith(ext)) {
        return false;
      }
    } else if (lowerPath.includes(pattern.toLowerCase())) {
      return false;
    }
  }

  // Check allowed extensions or files without extension in common directories
  const hasAllowedExtension = ALLOWED_EXTENSIONS.some(ext => {
    if (ext.startsWith('.')) {
      return lowerPath.endsWith(ext);
    }
    return lowerPath.endsWith(`/${ext}`) || lowerPath === ext.toLowerCase();
  });

  // Also include files in common config directories or root level
  const isInCommonDir = /^src\/|^lib\/|^app\//.test(lowerPath);
  const isRootLevel = !path.includes('/');
  const hasNoExtension = !path.includes('.');

  return hasAllowedExtension || isInCommonDir || (isRootLevel && hasNoExtension);
}

export async function getRepositoryFiles(
  owner: string,
  repo: string,
  branch?: string,
  maxFiles = 20
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  try {
    const { data: treeData } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: branch || 'main',
      recursive: 'true',
    });

    // Filter and collect files first (without content)
    const candidateFiles = treeData.tree.filter(item => {
      return item.type === 'blob' && shouldIncludeFile(item.path);
    });

    // Sort by priority: root files first, then common directories
    candidateFiles.sort((a, b) => {
      const aDepth = a.path.split('/').length;
      const bDepth = b.path.split('/').length;
      return aDepth - bDepth;
    });

    let fileCount = 0;
    for (const item of candidateFiles) {
      if (fileCount >= maxFiles) break;

      const content = await getFileContent(owner, repo, item.path, branch);
      if (content) {
        // Only include reasonably sized text files
        if (content.content.length < 50000) {
          files[item.path] = content.content;
          fileCount++;
        }
      }
    }
  } catch {
    // If we can't get the tree, return empty
  }

  return files;
}

export default octokit;
