export type ReviewerCandidate = {
  github: string;
  reviewer?: boolean;
};

type ReviewerAssignmentInput = {
  candidates: ReviewerCandidate[];
  author: string;
  pullNumber: number;
  existingReviewers: string[];
};

export function selectReviewer({
  candidates,
  author,
  pullNumber,
  existingReviewers,
}: ReviewerAssignmentInput): string | undefined {
  if (existingReviewers.length > 0) return undefined;

  const availableCandidates = candidates.filter((candidate) => candidate.reviewer !== false);
  if (availableCandidates.length === 0) return undefined;

  const startIndex = Math.max(pullNumber - 1, 0) % availableCandidates.length;
  for (let offset = 0; offset < availableCandidates.length; offset += 1) {
    const candidate = availableCandidates[(startIndex + offset) % availableCandidates.length];
    if (candidate.github !== author) return candidate.github;
  }

  return undefined;
}

export function existingReviewerLogins(value: string | undefined): string[] {
  if (!value) return [];

  try {
    const reviewers: unknown = JSON.parse(value);
    if (!Array.isArray(reviewers)) return [];

    return reviewers.flatMap((reviewer) => (
      reviewer && typeof reviewer === "object" && "login" in reviewer && typeof reviewer.login === "string"
        ? [reviewer.login]
        : []
    ));
  } catch {
    console.warn("::warning::기존 PR 리뷰어 정보를 해석하지 못했습니다.");
    return [];
  }
}

export async function main(environment = process.env): Promise<void> {
  const existingReviewers = existingReviewerLogins(environment.REQUESTED_REVIEWERS_JSON);
  const reviewer = selectReviewer({
    candidates: loadMembers(environment.PR_NOTIFICATION_MEMBERS_JSON),
    author: environment.AUTHOR ?? "",
    pullNumber: Number(environment.NUMBER),
    existingReviewers,
  });

  if (!reviewer) {
    if (existingReviewers.length === 0) console.warn("::warning::자동 배정할 리뷰어 후보가 없습니다.");
    return;
  }

  const repository = environment.GITHUB_REPOSITORY;
  const token = environment.GITHUB_TOKEN;
  if (!repository || !token) throw new Error("GitHub 리뷰어 지정을 위한 저장소 정보 또는 토큰이 없습니다.");

  await new GitHubApi(new RetryingHttp(), token, repository).requestReviewers(Number(environment.NUMBER), [reviewer]);

  if (environment.GITHUB_OUTPUT) {
    appendFileSync(environment.GITHUB_OUTPUT, `reviewer=${reviewer}\n`, { encoding: "utf8" });
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
import { appendFileSync } from "node:fs";
import { GitHubApi } from "../github/github-api.ts";
import { RetryingHttp } from "../github/retrying-http.ts";
import { loadMembers } from "./member-configuration-parser.ts";
