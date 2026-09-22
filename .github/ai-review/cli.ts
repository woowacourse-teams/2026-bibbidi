import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createGitHubClient, createOpenAIClient, loadReviewPrompts } from "./ai-review-client.ts";
import { runReview } from "./ai-review-service.ts";

const requiredEnvironment = [
  "GITHUB_TOKEN",
  "OPENAI_API_KEY",
  "REVIEW_REPOSITORY",
  "REVIEW_PULL_NUMBER",
  "REVIEW_HEAD_SHA",
] as const;

type ReviewEnvironment = Record<(typeof requiredEnvironment)[number], string> & {
  GITHUB_STEP_SUMMARY?: string;
};

export function validateEnvironment(environment: NodeJS.ProcessEnv): ReviewEnvironment {
  const missing = requiredEnvironment.filter((name) => !environment[name]?.trim());
  if (missing.length > 0) throw new Error(`필수 환경변수가 없습니다: ${missing.join(", ")}`);

  const pullNumber = Number(environment.REVIEW_PULL_NUMBER);
  if (!Number.isSafeInteger(pullNumber) || pullNumber < 1) {
    throw new Error("REVIEW_PULL_NUMBER는 1 이상의 정수여야 합니다.");
  }

  return environment as ReviewEnvironment;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
}

async function appendFailureSummary(path: string | undefined, message: string) {
  if (!path) return;
  await appendFile(path, `## AI 코드 리뷰 실패\n\n${message}\n`, "utf8");
}

export async function main(environment: NodeJS.ProcessEnv = process.env) {
  const values = validateEnvironment(environment);
  const pullNumber = Number(values.REVIEW_PULL_NUMBER);
  const github = createGitHubClient({
    token: values.GITHUB_TOKEN,
    repository: values.REVIEW_REPOSITORY,
  });
  const openai = createOpenAIClient({ apiKey: values.OPENAI_API_KEY });
  const prompts = await loadReviewPrompts(new URL("./ai-review-prompt.yml", import.meta.url));

  try {
    const result = await runReview({
      github,
      openai,
      pullNumber,
      expectedHeadSha: values.REVIEW_HEAD_SHA,
      prompts,
    });
    if (result.skipped) {
      console.log(`AI review already exists for PR #${pullNumber} at ${values.REVIEW_HEAD_SHA}`);
      return;
    }
    console.log(`AI review submitted for PR #${pullNumber}`);
  } catch (error) {
    const message = errorMessage(error);
    await appendFailureSummary(values.GITHUB_STEP_SUMMARY, message);
    console.error(`::error title=AI code review failed::${message}`);
    process.exitCode = 1;
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entrypoint === import.meta.url) await main();
