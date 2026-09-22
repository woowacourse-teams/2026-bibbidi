import { readFile } from "node:fs/promises";
import { load } from "js-yaml";

export type PullRequest = {
  title: string;
  body?: string | null;
  labels?: Array<{ name: string }>;
  base: { ref: string; sha?: string };
  head: { ref: string; sha?: string };
};

export type PullRequestFile = {
  filename: string;
  previous_filename?: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
};

export type Issue = {
  number: number;
  title: string;
  body?: string | null;
  labels?: Array<{ name: string }>;
};

export type IssueComment = {
  id?: number;
  body?: string | null;
  user?: { login?: string; type?: string };
};

export type RepositoryTreeItem = {
  path: string;
  type: "blob" | "tree" | string;
};

export type Finding = {
  kind: "DEFECT" | "QUESTION";
  severity: "REQUIRED" | "CAUTION" | "ADVICE";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  category: "#예외처리" | "#null-safety" | "#트랜잭션" | "#모듈경계" | "#동시성" | "#보안" | "#성능" | "#테스트" | "#네이밍" | "#질문-토론";
  path: string;
  side: "LEFT" | "RIGHT";
  line: number;
  title: string;
  trigger: string;
  impact: string;
  evidence: string;
  explanation: string;
  suggestion: string;
};

export type ReviewResult = {
  summary: string;
  aiSufficientChanges: string[];
  humanReviewChanges: string[];
  findings: Finding[];
};

export type ReviewPrompts = {
  commonInstructions: string;
  stageInputTemplate: string;
  finalInputTemplate: string;
};

const findingProperties = {
  kind: { type: "string", enum: ["DEFECT", "QUESTION"] },
  severity: { type: "string", enum: ["REQUIRED", "CAUTION", "ADVICE"] },
  confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
  category: {
    type: "string",
    enum: [
      "#예외처리", "#null-safety", "#트랜잭션", "#모듈경계", "#동시성",
      "#보안", "#성능", "#테스트", "#네이밍", "#질문-토론",
    ],
  },
  path: { type: "string" },
  side: { type: "string", enum: ["LEFT", "RIGHT"] },
  line: { type: "integer", minimum: 1 },
  title: { type: "string" },
  trigger: { type: "string" },
  impact: { type: "string" },
  evidence: { type: "string" },
  explanation: { type: "string" },
  suggestion: { type: "string" },
};

const schema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    aiSufficientChanges: { type: "array", maxItems: 10, items: { type: "string" } },
    humanReviewChanges: { type: "array", maxItems: 10, items: { type: "string" } },
    findings: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        properties: findingProperties,
        required: Object.keys(findingProperties),
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "aiSufficientChanges", "humanReviewChanges", "findings"],
  additionalProperties: false,
};

class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request(url: string, options: RequestInit, label: string) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(120_000) });
      if (response.ok) return response;
      if (attempt === 3 || (response.status < 500 && response.status !== 429)) {
        throw new HttpError(response.status, `${label} request failed with HTTP ${response.status}`);
      }
    } catch (error) {
      if (attempt === 3 || (error instanceof HttpError && error.status < 500 && error.status !== 429)) {
        throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000 * 2 ** (attempt - 1)));
  }
  throw new Error(`${label} request failed`);
}

function encodeRepositoryPath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

export function createGitHubClient({ token, repository }: { token: string; repository: string }) {
  const baseUrl = `https://api.github.com/repos/${repository}`;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2026-03-10",
    "User-Agent": "bibbidi-ai-reviewer",
  };
  const getJson = async (path: string) => (
    await request(`${baseUrl}${path}`, { headers }, "GitHub API")
  ).json();

  return {
    getPullRequest: async (number: number) => (await getJson(`/pulls/${number}`)) as PullRequest,
    async getPullRequestFiles(number: number) {
      const files: PullRequestFile[] = [];
      for (let page = 1; page <= 30; page += 1) {
        const batch = (await getJson(`/pulls/${number}/files?per_page=100&page=${page}`)) as PullRequestFile[];
        files.push(...batch);
        if (batch.length < 100) break;
      }
      return files;
    },
    async getIssue(number: number) {
      try {
        return (await getJson(`/issues/${number}`)) as Issue;
      } catch (error) {
        if (error instanceof HttpError && error.status === 404) return undefined;
        throw error;
      }
    },
    async getIssueComments(number: number) {
      const comments: IssueComment[] = [];
      for (let page = 1; page <= 10; page += 1) {
        const batch = (await getJson(`/issues/${number}/comments?per_page=100&page=${page}`)) as IssueComment[];
        comments.push(...batch);
        if (batch.length < 100) break;
      }
      return comments;
    },
    async getRepositoryFile(path: string, ref: string) {
      try {
        const payload = await getJson(`/contents/${encodeRepositoryPath(path)}?ref=${encodeURIComponent(ref)}`) as {
          content?: string;
          encoding?: string;
          type?: string;
        };
        if (payload.type !== "file" || payload.encoding !== "base64" || !payload.content) return undefined;
        return Buffer.from(payload.content.replace(/\n/g, ""), "base64").toString("utf8");
      } catch (error) {
        if (error instanceof HttpError && error.status === 404) return undefined;
        throw error;
      }
    },
    async getRepositoryTree(ref: string) {
      const payload = await getJson(`/git/trees/${encodeURIComponent(ref)}?recursive=1`) as {
        tree?: RepositoryTreeItem[];
        truncated?: boolean;
      };
      return { items: payload.tree ?? [], truncated: payload.truncated === true };
    },
    createReview: async (number: number, review: object) => (
      await request(`${baseUrl}/pulls/${number}/reviews`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(review),
      }, "GitHub review")
    ).json(),
    createIssueComment: async (number: number, body: string) => (
      await request(`${baseUrl}/issues/${number}/comments`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      }, "GitHub issue comment")
    ).json(),
    updateIssueComment: async (commentId: number, body: string) => (
      await request(`${baseUrl}/issues/comments/${commentId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      }, "GitHub issue comment update")
    ).json(),
  };
}

export function createOpenAIClient({ apiKey }: { apiKey: string }) {
  return {
    async review({ instructions, input, reasoningEffort, cacheKey }: {
      instructions: string;
      input: string;
      reasoningEffort: string;
      cacheKey: string;
    }) {
      const response = await request("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-5.6-luna",
          instructions,
          input,
          reasoning: { effort: reasoningEffort },
          max_output_tokens: 8_000,
          prompt_cache_key: cacheKey,
          store: false,
          text: {
            verbosity: "low",
            format: { type: "json_schema", name: "code_review_findings", strict: true, schema },
          },
        }),
      }, "OpenAI API");
      const payload = await response.json();
      const output = payload.output_text
        ?? payload.output
          ?.flatMap((item: { content?: { type: string; text?: string }[] }) => item.content ?? [])
          .filter((item: { type: string }) => item.type === "output_text")
          .map((item: { text?: string }) => item.text)
          .join("");
      if (!output) throw new Error("OpenAI API returned no output text");
      return JSON.parse(output) as ReviewResult;
    },
  };
}

export async function loadReviewPrompts(path: URL): Promise<ReviewPrompts> {
  return load(await readFile(path, "utf8")) as ReviewPrompts;
}

export type GitHubClient = ReturnType<typeof createGitHubClient>;
export type OpenAIClient = ReturnType<typeof createOpenAIClient>;
