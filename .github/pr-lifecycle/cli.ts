import { readFileSync } from "node:fs";
import { GitHubApi } from "../github/github-api.ts";
import { RetryingHttp } from "../github/retrying-http.ts";
import { PullRequestLifecycle } from "./pr-lifecycle.ts";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
if (!token || !repository) throw new Error("GITHUB_TOKEN과 GITHUB_REPOSITORY가 필요합니다.");

const api = new GitHubApi(new RetryingHttp(), token, repository);
const openPullRequests = await api.listOpenPullRequests();
const lifecycle = new PullRequestLifecycle(api, repository, openPullRequests);

if (process.env.GITHUB_EVENT_NAME === "pull_request") {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error("GITHUB_EVENT_PATH가 필요합니다.");
  const event = JSON.parse(readFileSync(eventPath, "utf8")) as {
    action?: string;
    pull_request?: { number: number; merged: boolean };
  };
  if (event.action === "closed" && event.pull_request?.merged) {
    const pr = await api.getPullRequest(event.pull_request.number);
    for (const message of await lifecycle.handle(pr, false)) console.log(message);
  }
} else if (process.env.GITHUB_EVENT_NAME === "workflow_dispatch") {
  const dryRun = process.env.APPLY !== "true";
  console.log(dryRun ? "기존 PR 정리 대상 확인" : "기존 PR 정리 실행");
  for (const pr of await api.listClosedPullRequests()) {
    for (const message of await lifecycle.handle(pr, dryRun)) console.log(`PR #${pr.number}: ${message}`);
  }
} else {
  throw new Error(`지원하지 않는 이벤트: ${process.env.GITHUB_EVENT_NAME}`);
}
