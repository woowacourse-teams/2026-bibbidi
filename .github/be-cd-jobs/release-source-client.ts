import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { GitHubApi } from "../github/github-api.ts";
import { RetryingHttp } from "../github/retrying-http.ts";
import type { MergedPullRequest } from "./image-decision.ts";

const execFileAsync = promisify(execFile);

type PullRequestSourceRequest = {
  repository: string;
  sha: string;
  token: string;
};

export async function fetchPullRequestsOfCommit({
  repository,
  sha,
  token,
}: PullRequestSourceRequest): Promise<MergedPullRequest[]> {
  const pullRequests = await new GitHubApi(new RetryingHttp(), token, repository).getCommitPullRequests(sha);
  return pullRequests.map((pullRequest) => ({
    baseBranch: pullRequest.base.ref,
    headBranch: pullRequest.head.ref,
    headSha: pullRequest.head.sha,
    headRepository: pullRequest.head.repo?.full_name ?? "",
    labels: (pullRequest.labels ?? []).map((label) => label.name),
  }));
}

export async function hasSuccessfulDevelopmentDeployment({
  repository,
  sha,
  token,
}: PullRequestSourceRequest): Promise<boolean> {
  const runs = await new GitHubApi(new RetryingHttp(), token, repository).listSuccessfulWorkflowRuns(
    "backend-dev-cd.yml",
    "dev-be",
    sha,
  );
  return runs.length > 0;
}

export async function isCommitOnBranch(sha: string, branch: string): Promise<boolean> {
  await execFileAsync("git", ["fetch", "origin", `${branch}:refs/remotes/origin/${branch}`]);

  try {
    await execFileAsync("git", ["merge-base", "--is-ancestor", sha, `origin/${branch}`]);
    return true;
  } catch {
    return false;
  }
}
