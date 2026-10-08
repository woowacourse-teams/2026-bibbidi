import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { MergedPullRequest } from "./image-decision.ts";

const execFileAsync = promisify(execFile);

type PullRequestResponse = {
  base: { ref: string };
  head: { ref: string; sha: string; repo: { full_name: string } | null };
  labels: { name: string }[];
};

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
  const response = await fetch(`https://api.github.com/repos/${repository}/commits/${sha}/pulls`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(`커밋에 연결된 PR 조회에 실패했습니다. (상태 코드: ${response.status})`);
  }

  const pullRequests = (await response.json()) as PullRequestResponse[];
  return pullRequests.map((pullRequest) => ({
    baseBranch: pullRequest.base.ref,
    headBranch: pullRequest.head.ref,
    headSha: pullRequest.head.sha,
    headRepository: pullRequest.head.repo?.full_name ?? "",
    labels: pullRequest.labels.map((label) => label.name),
  }));
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
