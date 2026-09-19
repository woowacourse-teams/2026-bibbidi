import { createGitHubClient, createOpenAIClient, loadReviewPrompts } from "./ai-review-client.ts";
import { runReview } from "./ai-review-service.ts";

const requiredEnvironment = [
  "GITHUB_TOKEN",
  "OPENAI_API_KEY",
  "REVIEW_REPOSITORY",
  "REVIEW_PULL_NUMBER",
  "REVIEW_HEAD_SHA",
];

const pullNumber = Number(process.env.REVIEW_PULL_NUMBER);

const github = createGitHubClient({
  token: process.env.GITHUB_TOKEN,
  repository: process.env.REVIEW_REPOSITORY,
});
const openai = createOpenAIClient({ apiKey: process.env.OPENAI_API_KEY });
const prompts = await loadReviewPrompts(
  new URL("./ai-review-prompt.yml", import.meta.url),
);

try {
  await runReview({
    github,
    openai,
    pullNumber,
    expectedHeadSha: process.env.REVIEW_HEAD_SHA,
    prompts,
  });
  console.log(`AI review submitted for PR #${pullNumber}`);
} catch (error) {
  console.error(`::warning title=AI code review failed::${error.message}`);
  process.exitCode = 1;
}
