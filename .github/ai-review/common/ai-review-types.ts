export type {
  BotUser,
  CommitStatusState,
  Issue,
  IssueComment,
  PullRequest,
  PullRequestFile,
  RepositoryTreeItem,
} from "../../github/github-types.ts";
import type { PullRequestFile } from "../../github/github-types.ts";

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

/** 비밀값·프롬프트 인젝션 검사에 쓰는 텍스트 한 덩어리와 그 위치(파일:줄, PR 본문 등). */
export type ScanTarget = {
  location: string;
  text: string;
};

export type ScanHit = {
  location: string;
  kind: string;
};

