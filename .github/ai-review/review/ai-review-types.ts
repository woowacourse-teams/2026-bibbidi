export type BotUser = { login?: string; type?: string };

export type PullRequest = {
  title: string;
  body?: string | null;
  labels?: Array<{ name: string }>;
  base: { ref: string; sha?: string };
  head: { ref: string; sha?: string };
};

export type PullRequestFile = {
  filename: string;
  previous_filename?: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
};

export type Issue = {
  number: number;
  title: string;
  body?: string | null;
  labels?: Array<{ name: string }>;
};

export type IssueComment = {
  id?: number;
  body?: string | null;
  user?: BotUser;
};

export type RepositoryTreeItem = {
  path: string;
  type: "blob" | "tree" | string;
};

export type Finding = {
  kind: "DEFECT" | "QUESTION";
  severity: "REQUIRED" | "CAUTION" | "ADVICE";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  category: "#예외처리" | "#null-safety" | "#트랜잭션" | "#모듈경계" | "#동시성" | "#보안" | "#성능" | "#테스트" | "#네이밍" | "#질문-토론";
  path: string;
  side: "LEFT" | "RIGHT";
  line: number;
  title: string;
  trigger: string;
  impact: string;
  evidence: string;
  explanation: string;
  suggestion: string;
};

export type ReviewResult = {
  summary: string;
  aiSufficientChanges: string[];
  humanReviewChanges: string[];
  designQuestions?: string[];
  findings: Finding[];
};

export type ReviewPrompts = {
  commonInstructions: string;
  stageInputTemplate: string;
  finalInputTemplate: string;
};

export type ReviewValues = {
  conventions: string;
  requirements: string;
  repositoryContext: string;
  title: string;
  body: string;
  labels: string;
  base: string;
  head: string;
  diff: string;
  chunk: string;
};

export type ReviewChunk = {
  text: string;
  files: PullRequestFile[];
};
