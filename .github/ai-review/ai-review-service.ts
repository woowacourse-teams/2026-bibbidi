import { readFile } from "node:fs/promises";
import type {
  Finding,
  GitHubClient,
  OpenAIClient,
  PullRequest,
  PullRequestFile,
  RepositoryTreeItem,
  ReviewPrompts,
} from "./ai-review-client.ts";

type ReviewStage = {
  effort: "none" | "low" | "medium";
  focus: string;
};

type ReviewChunk = {
  text: string;
  files: PullRequestFile[];
};

type TemplateValues = {
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

const MAX_DIFF_CHUNK_CHARACTERS = 45_000;
const MAX_CONTEXT_CHARACTERS = 80_000;
const MAX_REQUIREMENTS_CHARACTERS = 30_000;
const MAX_INLINE_COMMENTS = 20;
const SUMMARY_MARKER = "<!-- bibbidi-ai-review:summary -->";
const REVIEW_MARKER_PREFIX = "<!-- bibbidi-ai-review:sha=";
const COMMON_CONVENTION_FILE = "docs/convention/git-convention.md";
const BE_CONVENTION_FILES = [
  "docs/convention/code-convention.md",
  "docs/convention/error-handling.md",
  "docs/convention/test-strategy.md",
];

const CANDIDATE_STAGE: ReviewStage = {
  effort: "medium",
  focus: [
    "1. 언어 관점에서 null-safety, Optional 오용, 불변성, equals/hashCode, 예외 삼킴을 검토한다.",
    "2. 프레임워크·인프라 관점에서 트랜잭션, 영속성, 모듈 경계, 이벤트, HTTP 계약, 빌드와 배포를 검토한다.",
    "3. 도메인·보안 관점에서 상태 규칙, 동시성, 인증·인가, 민감정보, 데이터 무결성과 장애 복구를 검토한다.",
    "각 관점의 후보를 한 번의 구조화된 결과로 반환한다.",
  ].join("\n"),
};

const FINAL_STAGE: ReviewStage = {
  effort: "medium",
  focus: "후보를 원본 diff와 제공된 요구사항·주변 코드로 다시 검증하고, 재현 조건과 영향이 구체적인 항목만 남긴다.",
};

export function reviewMarker(headSha: string) {
  return `${REVIEW_MARKER_PREFIX}${headSha} -->`;
}

export function hasReviewForHead(
  comments: Array<{ body?: string | null }>,
  headSha: string,
) {
  const marker = reviewMarker(headSha);
  return comments.some((comment) => comment.body?.includes(SUMMARY_MARKER) && comment.body.includes(marker));
}

export function collectCommentableLines(files: PullRequestFile[]) {
  const linesByFile = new Map<string, Set<string>>();

  for (const file of files) {
    if (!file.patch) continue;

    const lines = new Set<string>();
    let oldLine = 0;
    let newLine = 0;

    for (const line of file.patch.split("\n")) {
      const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (hunk) {
        oldLine = Number(hunk[1]);
        newLine = Number(hunk[2]);
        continue;
      }

      if (line.startsWith("+") && !line.startsWith("+++")) {
        lines.add(`RIGHT:${newLine++}`);
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        lines.add(`LEFT:${oldLine++}`);
      } else if (line.startsWith(" ")) {
        lines.add(`LEFT:${oldLine++}`);
        lines.add(`RIGHT:${newLine++}`);
      }
    }

    linesByFile.set(file.filename, lines);
  }

  return linesByFile;
}

const severityOrder = { REQUIRED: 0, CAUTION: 1, ADVICE: 2 } as const;
const confidenceOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;

export function selectValidFindings(
  findings: Finding[],
  commentableLines: Map<string, Set<string>>,
  limit = MAX_INLINE_COMMENTS,
) {
  const seen = new Set<string>();

  return [...findings]
    .filter((finding) => finding.confidence !== "LOW")
    .filter((finding) => (
      (finding.kind === "QUESTION") === (finding.category === "#질문-토론")
    ))
    .filter((finding) => {
      const line = `${finding.side}:${finding.line}`;
      const key = [finding.path, line, finding.kind, finding.category].join(":");
      const hasEvidence = finding.trigger.trim() && finding.impact.trim() && finding.evidence.trim();

      if (!hasEvidence || !commentableLines.get(finding.path)?.has(line) || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort((left, right) => (
      severityOrder[left.severity] - severityOrder[right.severity]
      || confidenceOrder[left.confidence] - confidenceOrder[right.confidence]
    ))
    .slice(0, limit);
}

function fileHeader(file: PullRequestFile) {
  return [
    `FILE: ${file.filename}`,
    file.previous_filename ? `PREVIOUS_FILE: ${file.previous_filename}` : "",
    `STATUS: ${file.status}`,
    `CHANGES: +${file.additions} -${file.deletions}`,
  ].filter(Boolean).join("\n");
}

function splitFileIntoUnits(file: PullRequestFile) {
  if (!file.patch) {
    return [`${fileHeader(file)}\n[patch unavailable: binary or GitHub API limit]\n`];
  }

  const hunks: string[][] = [];
  let current: string[] = [];
  for (const line of file.patch.split("\n")) {
    if (line.startsWith("@@") && current.length > 0) {
      hunks.push(current);
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) hunks.push(current);

  return hunks.map((hunk, index) => [
    fileHeader(file),
    `HUNK: ${index + 1}/${hunks.length}`,
    hunk.join("\n"),
    "",
  ].join("\n"));
}

export function buildDiffChunks(
  files: PullRequestFile[],
  maxCharacters = MAX_DIFF_CHUNK_CHARACTERS,
) {
  const chunks: ReviewChunk[] = [];
  let text = "";
  let chunkFiles = new Map<string, PullRequestFile>();

  const flush = () => {
    if (!text) return;
    chunks.push({ text, files: [...chunkFiles.values()] });
    text = "";
    chunkFiles = new Map();
  };

  for (const file of files) {
    for (const unit of splitFileIntoUnits(file)) {
      if (text && text.length + unit.length > maxCharacters) flush();
      text += `${unit}\n`;
      chunkFiles.set(file.filename, file);
      if (text.length >= maxCharacters) flush();
    }
  }
  flush();

  return {
    chunks,
    unavailablePatches: files.filter((file) => !file.patch).length,
  };
}

function scopeGuidance(files: PullRequestFile[]) {
  const paths = files.map((file) => file.filename);
  const guidance: string[] = [];

  if (paths.some((path) => path.startsWith(".github/workflows/") || path.startsWith(".github/ai-review/"))) {
    guidance.push("GitHub Actions: 최소 권한, secret 노출, pull_request_target의 신뢰 경계, 표현식 주입, action 버전, 실패 은폐를 확인한다.");
  }
  if (paths.some((path) => path.startsWith("Infra/"))) {
    guidance.push("인프라: 멱등성, 최소 권한, 비밀정보, 롤백, 부분 실패, 재실행과 장애 복구를 확인한다.");
  }
  if (paths.some((path) => path.startsWith("FE/"))) {
    guidance.push("프론트엔드: 상태 전이, 비동기 경쟁 조건, 접근성, API 계약, 오류·로딩·빈 상태를 확인한다.");
  }
  if (paths.some((path) => path.startsWith("APP/"))) {
    guidance.push("앱: 생명주기, 네트워크 실패, 플랫폼 권한, 백그라운드 전환과 API 계약을 확인한다.");
  }

  return guidance.join("\n") || "기존 코드와 설정에서 확인되는 저장소 패턴을 기준으로 검토한다.";
}

async function loadConventions(files: PullRequestFile[]) {
  const paths = [COMMON_CONVENTION_FILE];
  if (files.some((file) => file.filename.startsWith("BE/"))) paths.push(...BE_CONVENTION_FILES);

  const documents = await Promise.all(
    paths.map(async (path) => `# ${path}\n${await readFile(path, "utf8")}`),
  );
  return `${documents.join("\n\n")}\n\n# 변경 경로별 검토 기준\n${scopeGuidance(files)}`;
}

export function extractLinkedIssueNumber(title: string, body: string) {
  const value = `${title}\n${body}`;
  const match = value.match(/\[#(\d+)]|(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/i);
  return match ? Number(match[1] ?? match[2]) : undefined;
}

async function loadRequirementsContext(github: GitHubClient, pullRequest: PullRequest) {
  const issueNumber = extractLinkedIssueNumber(pullRequest.title, pullRequest.body ?? "");
  if (!issueNumber) return "연결된 Issue 번호를 PR 제목이나 본문에서 찾지 못했다.";

  const issue = await github.getIssue(issueNumber);
  if (!issue) return `Issue #${issueNumber}를 조회하지 못했다.`;
  const comments = await github.getIssueComments(issueNumber);
  const text = [
    `<linked_issue number="${issue.number}">`,
    `title: ${issue.title}`,
    `labels: ${(issue.labels ?? []).map((label) => label.name).join(", ") || "(none)"}`,
    issue.body ?? "(empty)",
    ...comments.map((comment, index) => [
      `<issue_comment index="${index + 1}" author="${comment.user?.login ?? "unknown"}">`,
      comment.body ?? "(empty)",
      "</issue_comment>",
    ].join("\n")),
    "</linked_issue>",
  ].join("\n");

  return text.length > MAX_REQUIREMENTS_CHARACTERS
    ? `${text.slice(0, MAX_REQUIREMENTS_CHARACTERS)}\n[Issue context truncated]`
    : text;
}

function changedRightLines(patch: string | undefined) {
  const lines: number[] = [];
  let newLine = 0;
  for (const line of patch?.split("\n") ?? []) {
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      newLine = Number(hunk[1]);
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      lines.push(newLine++);
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      // Deleted lines do not advance the right side.
    } else if (line.startsWith(" ")) {
      newLine += 1;
    }
  }
  return lines;
}

export function excerptAroundLines(content: string, targets: number[], radius = 25) {
  const source = content.split("\n");
  if (targets.length === 0 || source.length <= radius * 4) return content;

  const ranges = targets
    .map((line) => ({ start: Math.max(1, line - radius), end: Math.min(source.length, line + radius) }))
    .sort((left, right) => left.start - right.start)
    .reduce<Array<{ start: number; end: number }>>((merged, range) => {
      const previous = merged.at(-1);
      if (previous && range.start <= previous.end + 1) previous.end = Math.max(previous.end, range.end);
      else merged.push({ ...range });
      return merged;
    }, []);

  return ranges.map((range) => [
    `LINES ${range.start}-${range.end}`,
    ...source.slice(range.start - 1, range.end).map((line, index) => `${range.start + index}: ${line}`),
  ].join("\n")).join("\n...\n");
}

function relatedTestPaths(file: PullRequestFile, tree: RepositoryTreeItem[]) {
  const filename = file.filename.split("/").at(-1) ?? "";
  const stem = filename.replace(/\.(java|kt|ts|tsx|js|jsx)$/, "");
  if (!stem || stem === filename) return [];

  const patterns = [
    `${stem}Test.java`, `${stem}Test.kt`, `${stem}.test.ts`, `${stem}.test.tsx`,
    `${stem}.spec.ts`, `${stem}.spec.tsx`,
  ];
  return tree
    .filter((item) => item.type === "blob" && item.path !== file.filename)
    .map((item) => item.path)
    .filter((path) => patterns.some((pattern) => path.endsWith(pattern)))
    .slice(0, 4);
}

async function loadRepositoryContext(
  github: GitHubClient,
  pullRequest: PullRequest,
  files: PullRequestFile[],
  tree: RepositoryTreeItem[],
) {
  const sections: string[] = [];
  const includedRelated = new Set<string>();
  let used = 0;
  const append = (section: string) => {
    if (used >= MAX_CONTEXT_CHARACTERS) return;
    const remaining = MAX_CONTEXT_CHARACTERS - used;
    const value = section.length > remaining ? `${section.slice(0, remaining)}\n[context truncated]` : section;
    sections.push(value);
    used += value.length;
  };

  for (const file of files) {
    const ref = file.status === "removed" ? pullRequest.base.sha : pullRequest.head.sha;
    const sourcePath = file.status === "removed" ? file.previous_filename ?? file.filename : file.filename;
    if (!ref) continue;
    const content = await github.getRepositoryFile(sourcePath, ref);
    if (content !== undefined) {
      append(`<changed_file_context path="${sourcePath}">\n${excerptAroundLines(content, changedRightLines(file.patch))}\n</changed_file_context>`);
    }

    for (const relatedPath of relatedTestPaths(file, tree)) {
      if (includedRelated.has(relatedPath) || !pullRequest.head.sha) continue;
      includedRelated.add(relatedPath);
      const relatedContent = await github.getRepositoryFile(relatedPath, pullRequest.head.sha);
      if (relatedContent !== undefined) {
        append(`<related_test path="${relatedPath}">\n${relatedContent}\n</related_test>`);
      }
    }
  }

  return sections.join("\n\n") || "조회 가능한 변경 파일 주변 코드나 관련 테스트가 없다.";
}

function createTemplateValues(
  pullRequest: PullRequest,
  conventions: string,
  requirements: string,
  repositoryContext: string,
  diff: string,
  chunk: string,
): TemplateValues {
  return {
    conventions,
    requirements,
    repositoryContext,
    title: pullRequest.title,
    body: pullRequest.body || "(empty)",
    labels: (pullRequest.labels ?? []).map((label) => label.name).join(", ") || "(none)",
    base: pullRequest.base.ref,
    head: pullRequest.head.ref,
    diff,
    chunk,
  };
}

function fillTemplate(template: string, values: Record<string, string>) {
  return template.replace(/{{(\w+)}}/g, (_, key: string) => values[key] ?? "");
}

async function reviewStage(
  openai: OpenAIClient,
  prompts: ReviewPrompts,
  values: TemplateValues,
  stage: ReviewStage,
  cacheKey: string,
) {
  return openai.review({
    instructions: prompts.commonInstructions,
    input: fillTemplate(prompts.stageInputTemplate, { ...values, stageFocus: stage.focus }),
    reasoningEffort: stage.effort,
    cacheKey,
  });
}

async function reviewFinalStage(
  openai: OpenAIClient,
  prompts: ReviewPrompts,
  values: TemplateValues,
  candidates: Finding[],
  cacheKey: string,
) {
  return openai.review({
    instructions: prompts.commonInstructions,
    input: fillTemplate(prompts.finalInputTemplate, {
      ...values,
      candidates: JSON.stringify(candidates),
      stageFocus: FINAL_STAGE.focus,
    }),
    reasoningEffort: FINAL_STAGE.effort,
    cacheKey,
  });
}

function formatInlineComment(finding: Finding) {
  const severityLabels = {
    REQUIRED: "request",
    CAUTION: "comment",
    ADVICE: "참고",
  } as const;
  const label = finding.kind === "QUESTION" ? "comment" : severityLabels[finding.severity];
  const suggestion = finding.suggestion.trim()
    ? `\n\n<details><summary>💡 제안</summary>\n\n${finding.suggestion.trim()}\n\n</details>`
    : "";
  return `**[${label}] ${finding.category}** — ${finding.title.trim()}

${finding.explanation.trim()}

- **발생 조건**: ${finding.trigger.trim()}
- **영향**: ${finding.impact.trim()}
- **근거**: ${finding.evidence.trim()}

${suggestion}\n\n_확신도: ${finding.confidence}_`;
}

export function deterministicSummary(findings: Finding[]) {
  if (findings.length === 0) return "검증 가능한 재현 조건과 diff 근거를 모두 갖춘 결함을 확인하지 못했습니다.";
  const defects = findings.filter((finding) => finding.kind === "DEFECT");
  const questions = findings.filter((finding) => finding.kind === "QUESTION");
  const required = defects.filter((finding) => finding.severity === "REQUIRED").length;
  return `검증된 지적 ${defects.length}개${required ? ` 중 필수 대응 ${required}개` : ""}와 사람의 판단이 필요한 질문 ${questions.length}개를 남겼습니다.`;
}

function verdict(findings: Finding[]) {
  if (findings.some((finding) => finding.kind === "DEFECT" && finding.severity === "REQUIRED")) {
    return { tag: "request", text: "반영 필요" } as const;
  }
  if (findings.some((finding) => finding.kind === "QUESTION" || finding.severity === "CAUTION")) {
    return { tag: "comment", text: "조건부 통과" } as const;
  }
  return { tag: "참고", text: "통과" } as const;
}

function severityLabel(finding: Finding) {
  if (finding.kind === "QUESTION") return "comment";
  return finding.severity === "REQUIRED" ? "request" : finding.severity === "CAUTION" ? "comment" : "참고";
}

function briefExplanation(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 220 ? `${normalized.slice(0, 219).trimEnd()}…` : normalized;
}

export function formatReviewBody(
  findings: Finding[],
  headSha: string,
  chunks: number,
  unavailablePatches: number,
  treeTruncated: boolean,
  aiSufficientChanges: string[] = [],
  humanReviewChanges: string[] = [],
) {
  const count = (severity: Finding["severity"]) => findings.filter((finding) => (
    finding.kind === "DEFECT" && finding.severity === severity
  )).length;
  const questions = findings.filter((finding) => finding.kind === "QUESTION").length;
  const decision = verdict(findings);
  const requests = findings.filter((finding) => finding.kind === "DEFECT" && finding.severity === "REQUIRED");
  const humanReview = findings.filter((finding) => finding.kind === "QUESTION");
  const suggestions = findings.filter((finding) => finding.kind === "DEFECT" && finding.severity !== "REQUIRED");
  const categoryCounts = Object.fromEntries(
    [...new Set(findings.map((finding) => finding.category))]
      .sort()
      .map((category) => [category, findings.filter((finding) => finding.category === category).length]),
  );
  const findingList = (values: Finding[]) => values.length > 0
    ? values.map((finding) => [
        `- **[${severityLabel(finding)}] ${finding.category}** (\`${finding.path}:${finding.line}\`): ${finding.title}`,
        `  ${briefExplanation(finding.explanation)} **영향:** ${briefExplanation(finding.impact)}`,
      ].join("\n")).join("\n")
    : "- 없음";
  const coverage = [
    `diff 청크: ${chunks}`,
    `patch 미제공 파일: ${unavailablePatches}`,
    treeTruncated ? "저장소 트리: GitHub API 제한으로 일부만 조회" : "저장소 트리: 전체 조회",
  ].join(" · ");
  const changeList = (values: string[], emptyMessage: string) => values.length > 0
    ? values.map((value) => `- ${briefExplanation(value)}`).join("\n")
    : `- ${emptyMessage}`;

  return `${SUMMARY_MARKER}
${reviewMarker(headSha)}
## 🤖 AI Code Review

${requests.length > 0 ? `### ⚠️ 반영 필요\n\n${findingList(requests)}` : `### ✅ 통과 사유\n\n- 재현 가능한 \`[request]\` 수준의 결함을 확인하지 못했습니다.`}

${suggestions.length > 0 ? `### 💬 개선 의견\n\n${findingList(suggestions)}\n` : ""}
### 🤖 AI만으로 충분한 것

${changeList(aiSufficientChanges, "이번 변경에서 AI와 자동 검증만으로 충분한 항목을 찾지 못했습니다.")}

### 👀 사람이 확인해야 하는 것

${changeList(humanReviewChanges, "이번 변경에서 별도의 사람 판단이 필요한 항목을 찾지 못했습니다.")}

${humanReview.length > 0 ? `#### 리뷰 질문\n\n${findingList(humanReview)}` : ""}

### 🔎 검토 범위

- ${coverage}
- 인라인 코멘트: ${findings.length}/${MAX_INLINE_COMMENTS}

---
**[${decision.tag}] AI 판정: ${decision.text}** — ${deterministicSummary(findings)}

<!-- bibbidi-ai-review:meta ${JSON.stringify({ verdict: decision.text, request: count("REQUIRED"), comment: count("CAUTION") + questions, 참고: count("ADVICE"), categories: categoryCounts })} -->`;
}

async function upsertSummaryComment(
  github: GitHubClient,
  pullNumber: number,
  comments: Array<{ id?: number; body?: string | null; user?: { login?: string; type?: string } }>,
  body: string,
) {
  const existing = comments.find((comment) => (
    comment.id
    && comment.body?.includes(SUMMARY_MARKER)
    && (comment.user?.login === "github-actions[bot]" || comment.user?.type === "Bot")
  ));
  if (existing?.id) return github.updateIssueComment(existing.id, body);
  return github.createIssueComment(pullNumber, body);
}

export async function runReview({
  github,
  openai,
  pullNumber,
  expectedHeadSha,
  prompts,
}: {
  github: GitHubClient;
  openai: OpenAIClient;
  pullNumber: number;
  expectedHeadSha: string;
  prompts: ReviewPrompts;
}) {
  const [pullRequest, files, pullRequestComments] = await Promise.all([
    github.getPullRequest(pullNumber),
    github.getPullRequestFiles(pullNumber),
    github.getIssueComments(pullNumber),
  ]);

  if (pullRequest.head.sha !== expectedHeadSha) {
    throw new Error("리뷰 시작 전에 새 커밋이 올라왔습니다. 최신 커밋에서 다시 실행해 주세요.");
  }
  if (hasReviewForHead(pullRequestComments, expectedHeadSha)) return { skipped: true as const };

  const [{ chunks, unavailablePatches }, requirements, tree] = await Promise.all([
    Promise.resolve(buildDiffChunks(files)),
    loadRequirementsContext(github, pullRequest),
    github.getRepositoryTree(expectedHeadSha),
  ]);

  const candidateFindings: Finding[] = [];
  const aiSufficientChanges: string[] = [];
  const humanReviewChanges: string[] = [];
  for (const [index, chunk] of chunks.entries()) {
    const [conventions, repositoryContext] = await Promise.all([
      loadConventions(chunk.files),
      loadRepositoryContext(github, pullRequest, chunk.files, tree.items),
    ]);
    const values = createTemplateValues(
      pullRequest,
      conventions,
      requirements,
      repositoryContext,
      chunk.text,
      `${index + 1}/${chunks.length}`,
    );
    const cacheKey = `bibbidi-pr-${pullNumber}-${expectedHeadSha}-chunk-${index + 1}`;
    const candidateResult = await reviewStage(openai, prompts, values, CANDIDATE_STAGE, cacheKey);
    const finalResult = await reviewFinalStage(
      openai,
      prompts,
      values,
      candidateResult.findings,
      cacheKey,
    );
    candidateFindings.push(...finalResult.findings);
    aiSufficientChanges.push(...(finalResult.aiSufficientChanges ?? []));
    humanReviewChanges.push(...(finalResult.humanReviewChanges ?? []));
  }

  const latestPullRequest = await github.getPullRequest(pullNumber);
  if (latestPullRequest.head.sha !== expectedHeadSha) {
    throw new Error("리뷰 중에 새 커밋이 올라왔습니다. 최신 커밋에서 다시 실행해 주세요.");
  }

  const findings = selectValidFindings(candidateFindings, collectCommentableLines(files));
  const body = formatReviewBody(
    findings,
    expectedHeadSha,
    chunks.length,
    unavailablePatches,
    tree.truncated,
    [...new Set(aiSufficientChanges)],
    [...new Set(humanReviewChanges)],
  );

  let review;
  if (findings.length > 0) {
    review = await github.createReview(pullNumber, {
      commit_id: expectedHeadSha,
      event: "COMMENT",
      body: reviewMarker(expectedHeadSha),
      comments: findings.map((finding) => ({
        path: finding.path,
        side: finding.side,
        line: finding.line,
        body: formatInlineComment(finding),
      })),
    });
  }
  const summaryComment = await upsertSummaryComment(github, pullNumber, pullRequestComments, body);
  return { skipped: false as const, review, summaryComment };
}
