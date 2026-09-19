import { readFile } from "node:fs/promises";
import { load } from "js-yaml";

export type PullRequest = {
  title: string;
  body?: string | null;
  base: { ref: string };
  head: { ref: string; sha?: string };
};

export type PullRequestFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
};

export type ReviewResult = {
  summary: string;
  findings: Finding[];
};

type Finding = {
  severity: "REQUIRED" | "CAUTION" | "ADVICE";
  path: string;
  side: "LEFT" | "RIGHT";
  line: number;
  title: string;
  explanation: string;
  suggestion: string;
};

export type ReviewPrompts = {
  commonInstructions: string;
  stageInputTemplate: string;
  finalInputTemplate: string;
};

const schema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["REQUIRED", "CAUTION", "ADVICE"] },
          path: { type: "string" }, side: { type: "string", enum: ["LEFT", "RIGHT"] },
          line: { type: "integer", minimum: 1 }, title: { type: "string" },
          explanation: { type: "string" }, suggestion: { type: "string" },
        },
        required: ["severity", "path", "side", "line", "title", "explanation", "suggestion"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "findings"], additionalProperties: false,
};

async function request(url: string, options: RequestInit, label: string) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(120_000) });
      if (response.ok) return response;
      if (attempt === 3 || (response.status < 500 && response.status !== 429)) {
        throw new Error(`${label} request failed with HTTP ${response.status}`);
      }
    } catch (error) {
      if (attempt === 3) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000 * 2 ** (attempt - 1)));
  }
  throw new Error(`${label} request failed`);
}

export function createGitHubClient({ token, repository }: { token: string; repository: string }) {
  const baseUrl = `https://api.github.com/repos/${repository}`;
  const headers = { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2026-03-10", "User-Agent": "bibbidi-ai-reviewer" };
  const getJson = async (path: string) => (await request(`${baseUrl}${path}`, { headers }, "GitHub API")).json();

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
    createReview: async (number: number, review: object) => (
      await request(`${baseUrl}/pulls/${number}/reviews`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(review),
      }, "GitHub review")
    ).json(),
  };
}

export function createOpenAIClient({ apiKey }: { apiKey: string }) {
  return {
    async review({ instructions, input, reasoningEffort, cacheKey }: { instructions: string; input: string; reasoningEffort: string; cacheKey: string }) {
      const response = await request("https://api.openai.com/v1/responses", {
        method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-5.6-luna", instructions, input, reasoning: { effort: reasoningEffort },
          max_output_tokens: 8_000, prompt_cache_key: cacheKey, store: false,
          text: { verbosity: "low", format: { type: "json_schema", name: "code_review_findings", strict: true, schema } },
        }),
      }, "OpenAI API");
      const payload = await response.json();
      const output = payload.output_text ?? payload.output?.flatMap((item: { content?: { type: string; text?: string }[] }) => item.content ?? []).filter((item: { type: string }) => item.type === "output_text").map((item: { text?: string }) => item.text).join("");
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
