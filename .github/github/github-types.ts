/** GitHub REST API 응답 중 이 저장소의 스크립트가 쓰는 필드만 담은 공통 타입. */

export type BotUser = { login?: string; type?: string };

export type GitHubUser = { login: string; type?: string };

export type PullRequest = {
  number: number;
  title: string;
  body?: string | null;
  html_url: string;
  url: string;
  created_at: string;
  draft: boolean;
  user: GitHubUser;
  labels?: Array<{ name: string }>;
  base: { ref: string; sha: string };
  head: { ref: string; sha: string; repo?: { full_name: string } | null };
  requested_reviewers: GitHubUser[];
  merged_at?: string | null;
};

export type PullRequestFile = {
  filename: string;
  previous_filename?: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
};

export type PullRequestReview = { user: GitHubUser; state: string };

export type Issue = {
  number: number;
  title: string;
  body?: string | null;
  labels?: Array<{ name: string }>;
  state?: "open" | "closed";
  pull_request?: object;
};

export type IssueComment = {
  id?: number;
  body?: string | null;
  user?: BotUser;
};

export type IssueEvent = { event: string; created_at: string; requested_reviewer?: GitHubUser };

export type RepositoryTreeItem = {
  path: string;
  type: "blob" | "tree" | string;
};

export type CommitStatusState = "pending" | "success" | "failure" | "error";

export type WorkflowJob = {
  name: string;
  conclusion: string | null;
  html_url: string;
  steps?: Array<{ name: string; conclusion: string | null }>;
};

export type WorkflowArtifact = {
  id: number;
  name: string;
  expired: boolean;
  workflow_run?: { id: number; head_repository_id?: number };
};
