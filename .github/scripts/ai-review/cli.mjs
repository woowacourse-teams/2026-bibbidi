import { createGitHubClient, createOpenAIClient } from "./clients.mjs";
import { runReview } from "./review.mjs";

const requiredEnvironment = [
  "GITHUB_TOKEN",
  "OPENAI_API_KEY",
  "REVIEW_REPOSITORY",
  "REVIEW_PULL_NUMBER",
  "REVIEW_HEAD_SHA",
];

for (const name of requiredEnvironment) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

const pullNumber = Number(process.env.REVIEW_PULL_NUMBER);
if (!Number.isSafeInteger(pullNumber) || pullNumber <= 0) {
  throw new Error("REVIEW_PULL_NUMBER must be a positive integer");
}

const github = createGitHubClient({
  token: process.env.GITHUB_TOKEN,
  repository: process.env.REVIEW_REPOSITORY,
});
const openai = createOpenAIClient({ apiKey: process.env.OPENAI_API_KEY });

try {
  await runReview({
    github,
    openai,
    pullNumber,
    expectedHeadSha: process.env.REVIEW_HEAD_SHA,
  });
  console.log(`AI review submitted for PR #${pullNumber}`);
} catch (error) {
  console.error(`::warning title=AI code review failed::${error.message}`);
  process.exitCode = 1;
}
