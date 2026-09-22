import assert from "node:assert/strict";
import test from "node:test";
import type { Finding, PullRequestFile } from "./ai-review-client.ts";
import {
  buildDiffChunks,
  collectCommentableLines,
  deterministicSummary,
  excerptAroundLines,
  extractLinkedIssueNumber,
  formatReviewBody,
  hasReviewForHead,
  reviewMarker,
  runReview,
  selectValidFindings,
} from "./ai-review-service.ts";

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    kind: "DEFECT",
    severity: "CAUTION",
    confidence: "HIGH",
    category: "#예외처리",
    path: "BE/src/Foo.java",
    side: "RIGHT",
    line: 11,
    title: "잘못된 상태를 저장합니다",
    trigger: "요청 값이 비어 있을 때",
    impact: "잘못된 데이터가 저장됩니다",
    evidence: "11번째 줄에서 검증 없이 저장합니다",
    explanation: "검증이 필요합니다.",
    suggestion: "저장 전에 검증하세요.",
    ...overrides,
  };
}

const files: PullRequestFile[] = [
  {
    filename: "BE/src/Foo.java",
    status: "modified",
    additions: 2,
    deletions: 1,
    patch: "@@ -10,2 +10,3 @@\n context\n-old\n+new\n+added",
  },
];

test("diff에서 GitHub 인라인 댓글을 작성할 수 있는 양쪽 줄을 계산한다", () => {
  const lines = collectCommentableLines(files).get("BE/src/Foo.java");

  assert.deepEqual(lines, new Set(["LEFT:10", "RIGHT:10", "LEFT:11", "RIGHT:11", "RIGHT:12"]));
});

test("diff를 작은 청크로 나눠도 모든 파일과 hunk를 보존한다", () => {
  const second: PullRequestFile = {
    filename: ".github/workflows/ci.yml",
    status: "modified",
    additions: 1,
    deletions: 0,
    patch: "@@ -1 +1,2 @@\n name: CI\n+permissions: {}",
  };

  const result = buildDiffChunks([...files, second], 100);
  const combined = result.chunks.map((chunk) => chunk.text).join("\n");

  assert.ok(result.chunks.length > 1);
  assert.match(combined, /FILE: BE\/src\/Foo\.java/);
  assert.match(combined, /\+added/);
  assert.match(combined, /FILE: \.github\/workflows\/ci\.yml/);
  assert.match(combined, /\+permissions: \{\}/);
  assert.equal(result.unavailablePatches, 0);
});

test("patch가 없는 파일도 검토 청크와 커버리지에 남긴다", () => {
  const result = buildDiffChunks([{ filename: "image.png", status: "modified", additions: 0, deletions: 0 }]);

  assert.equal(result.unavailablePatches, 1);
  assert.match(result.chunks[0].text, /patch unavailable/);
});

test("LOW 확신도와 근거 없는 항목을 제거하고 같은 위치와 분류의 중복을 합친다", () => {
  const lines = collectCommentableLines(files);
  const selected = selectValidFindings([
    finding(),
    finding({ title: "같은 원인의 다른 문장" }),
    finding({ confidence: "LOW", category: "#보안" }),
    finding({ evidence: "", category: "#트랜잭션" }),
    finding({ line: 999, category: "#성능" }),
  ], lines);

  assert.equal(selected.length, 1);
  assert.equal(selected[0].title, "잘못된 상태를 저장합니다");
});

test("검증된 finding만으로 결정론적인 요약을 만든다", () => {
  assert.equal(
    deterministicSummary([]),
    "검증 가능한 재현 조건과 diff 근거를 모두 갖춘 결함을 확인하지 못했습니다.",
  );
  assert.equal(
    deterministicSummary([
      finding({ severity: "REQUIRED" }),
      finding({ kind: "QUESTION", category: "#질문-토론", line: 12 }),
    ]),
    "검증된 지적 1개 중 필수 대응 1개와 사람의 판단이 필요한 질문 1개를 남겼습니다.",
  );
});

test("PR 제목과 종료 키워드에서 연결된 Issue 번호를 찾는다", () => {
  assert.equal(extractLinkedIssueNumber("[#222] CD 분리", ""), 222);
  assert.equal(extractLinkedIssueNumber("CD 분리", "Closes #223"), 223);
  assert.equal(extractLinkedIssueNumber("CD 분리", "관련 문서만 수정"), undefined);
});

test("변경 줄 주변 코드만 줄 번호와 함께 발췌한다", () => {
  const content = Array.from({ length: 100 }, (_, index) => `line-${index + 1}`).join("\n");
  const excerpt = excerptAroundLines(content, [50], 2);

  assert.match(excerpt, /LINES 48-52/);
  assert.match(excerpt, /50: line-50/);
  assert.doesNotMatch(excerpt, /1: line-1/);
});

test("같은 HEAD SHA에 marker가 있는 리뷰만 중복 리뷰로 판단한다", () => {
  const sha = "abc123";
  assert.equal(hasReviewForHead([{ body: `<!-- bibbidi-ai-review:summary -->\n${reviewMarker(sha)}` }], sha), true);
  assert.equal(hasReviewForHead([{ body: `<!-- bibbidi-ai-review:summary -->\n${reviewMarker("old")}` }], sha), false);
});

test("요약 코멘트를 한국어 카테고리와 Markdown 판정 형식으로 만든다", () => {
  const body = formatReviewBody(
    [finding({ severity: "REQUIRED", category: "#트랜잭션" })],
    "abc123",
    2,
    1,
    false,
    ["리네임 결과는 컴파일로 검증할 수 있습니다."],
    ["재시도 정책을 도입할지 사람이 결정해야 합니다."],
  );

  assert.match(body, /## 🤖 AI Code Review/);
  assert.match(body, /\[request]/);
  assert.match(body, /#트랜잭션/);
  assert.match(body, /### ⚠️ 반영 필요/);
  assert.match(body, /### 🤖 AI만으로 충분한 것/);
  assert.match(body, /리네임 결과는 컴파일로 검증할 수 있습니다/);
  assert.match(body, /### 👀 사람이 확인해야 하는 것/);
  assert.match(body, /재시도 정책을 도입할지 사람이 결정해야 합니다/);
  assert.doesNotMatch(body, /분석 완료|지적 사항/);
  assert.match(body, /검증이 필요합니다\. \*\*영향:\*\* 잘못된 데이터가 저장됩니다/);
  assert.match(body, /AI 판정: 반영 필요/);
  assert.match(body, /bibbidi-ai-review:meta/);
});

test("새 HEAD 리뷰가 끝나면 기존 AI 요약 코멘트를 갱신한다", async () => {
  const updates: Array<{ id: number; body: string }> = [];
  let modelCalls = 0;
  const pullRequest = {
    title: "문서 변경",
    body: "연결된 이슈 없음",
    labels: [],
    base: { ref: "dev-be", sha: "base-sha" },
    head: { ref: "chore/222", sha: "head-sha" },
  };
  const github = {
    getPullRequest: async () => pullRequest,
    getPullRequestFiles: async () => files,
    getIssueComments: async () => [{
      id: 10,
      body: "<!-- bibbidi-ai-review:summary -->\nold summary",
      user: { login: "github-actions[bot]", type: "Bot" },
    }],
    getRepositoryTree: async () => ({ items: [], truncated: false }),
    getRepositoryFile: async () => "class Foo {\n  void save() {}\n}",
    updateIssueComment: async (id: number, body: string) => {
      updates.push({ id, body });
      return {};
    },
    createIssueComment: async () => assert.fail("기존 요약이 있으면 새 코멘트를 만들면 안 된다"),
    createReview: async () => assert.fail("finding이 없으면 빈 Review를 만들면 안 된다"),
  };
  const openai = {
    review: async () => {
      modelCalls += 1;
      return { summary: "", findings: [] };
    },
  };
  const prompts = {
    commonInstructions: "review",
    stageInputTemplate: "{{diff}} {{repositoryContext}} {{requirements}} {{stageFocus}}",
    finalInputTemplate: "{{diff}} {{candidates}} {{stageFocus}}",
  };

  const result = await runReview({
    github: github as never,
    openai: openai as never,
    pullNumber: 222,
    expectedHeadSha: "head-sha",
    prompts,
  });

  assert.equal(result.skipped, false);
  assert.equal(modelCalls, 2);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].id, 10);
  assert.match(updates[0].body, /AI 판정: 통과/);
  assert.match(updates[0].body, new RegExp(reviewMarker("head-sha")));
});

test("현재 HEAD의 요약이 있으면 모델을 호출하지 않고 리뷰를 생략한다", async () => {
  let modelCalls = 0;
  const github = {
    getPullRequest: async () => ({
      title: "문서 변경",
      body: "",
      base: { ref: "dev-be", sha: "base-sha" },
      head: { ref: "chore/222", sha: "head-sha" },
    }),
    getPullRequestFiles: async () => files,
    getIssueComments: async () => [{ body: `<!-- bibbidi-ai-review:summary -->\n${reviewMarker("head-sha")}` }],
  };
  const openai = {
    review: async () => {
      modelCalls += 1;
      return { summary: "", findings: [] };
    },
  };

  const result = await runReview({
    github: github as never,
    openai: openai as never,
    pullNumber: 222,
    expectedHeadSha: "head-sha",
    prompts: { commonInstructions: "", stageInputTemplate: "", finalInputTemplate: "" },
  });

  assert.equal(result.skipped, true);
  assert.equal(modelCalls, 0);
});
