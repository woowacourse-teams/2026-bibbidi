import { FINDINGS_SCHEMA } from "./prompts.mjs";
import { MAX_OUTPUT_TOKENS, REVIEW_MODEL } from "./config.mjs";

const GITHUB_API_VERSION = "2026-03-10";

async function requestWithRetry(url, options, label) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let response;
    try {
      response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error) {
      if (attempt === 3) {
        throw new Error(`${label} request failed: ${error.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000 * 2 ** (attempt - 1)));
      continue;
    }

    if (response.ok) {
      return response;
    }

    if (attempt === 3 || (response.status < 500 && response.status !== 429)) {
      throw new Error(`${label} request failed with HTTP ${response.status}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000 * 2 ** (attempt - 1)));
  }

  throw new Error(`${label} request failed`);
}

export function createGitHubClient({ token, repository }) {
  const baseUrl = `https://api.github.com/repos/${repository}`;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "User-Agent": "bibbidi-ai-reviewer",
  };

  async function getJson(path) {
    const response = await requestWithRetry(
      `${baseUrl}${path}`,
      { headers },
      "GitHub API",
    );
    return response.json();
  }

  return {
    getPullRequest(pullNumber) {
      return getJson(`/pulls/${pullNumber}`);
    },

    async getPullRequestFiles(pullNumber) {
      const files = [];
      for (let page = 1; page <= 30; page += 1) {
        const batch = await getJson(`/pulls/${pullNumber}/files?per_page=100&page=${page}`);
        files.push(...batch);
        if (batch.length < 100) {
          break;
        }
      }
      return files;
    },

    async createReview(pullNumber, review) {
      const response = await requestWithRetry(
        `${baseUrl}/pulls/${pullNumber}/reviews`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(review),
        },
        "GitHub review",
      );
      return response.json();
    },
  };
}

function extractOutputText(response) {
  if (response.output_text) {
    return response.output_text;
  }

  return response.output
    ?.flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text")
    .map((content) => content.text)
    .join("");
}

export function createOpenAIClient({ apiKey }) {
  return {
    async review({ instructions, input, reasoningEffort, cacheKey }) {
      const response = await requestWithRetry(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: REVIEW_MODEL,
            instructions,
            input,
            reasoning: { effort: reasoningEffort },
            max_output_tokens: MAX_OUTPUT_TOKENS,
            prompt_cache_key: cacheKey,
            store: false,
            text: {
              verbosity: "low",
              format: {
                type: "json_schema",
                name: "code_review_findings",
                strict: true,
                schema: FINDINGS_SCHEMA,
              },
            },
          }),
        },
        "OpenAI API",
      );

      const payload = await response.json();
      const outputText = extractOutputText(payload);
      if (!outputText) {
        throw new Error("OpenAI API returned no output text");
      }

      try {
        return JSON.parse(outputText);
      } catch {
        throw new Error("OpenAI API returned invalid structured output");
      }
    },
  };
}
