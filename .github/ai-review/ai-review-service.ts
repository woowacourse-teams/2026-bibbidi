import { readFile } from "node:fs/promises";
import type {
  GitHubClient,
  OpenAIClient,
  PullRequest,
  PullRequestFile,
  ReviewPrompts,
  ReviewResult,
} from "./ai-review-client.ts";

type Finding = ReviewResult["findings"][number];
type ReviewStage = {
  effort: "none" | "low" | "medium";
  focus: string;
};
type TemplateValues = {
  conventions: string;
  title: string;
  body: string;
  base: string;
  head: string;
  diff: string;
};

const MAX_DIFF_CHARACTERS = 180_000;
const MAX_INLINE_COMMENTS = 20;
const CONVENTION_FILES = [
  "docs/convention/code-convention.md",
  "docs/convention/error-handling.md",
  "docs/convention/test-strategy.md",
];
const REVIEW_STAGES: ReviewStage[] = [
  {
    effort: "none",
    focus:
      "언어 문법, 타입 안정성, null 처리, 자원 정리, 오류 처리 누락과 저장소 컨벤션 위반을 검토한다.",
  },
  {
    effort: "low",
    focus:
      "프레임워크와 인프라 관점에서 트랜잭션, 영속성, HTTP 계약, React 상태 흐름, 빌드와 배포 설정의 문제를 검토한다.",
  },
  {
    effort: "medium",
    focus:
      "도메인 규칙, 동시성, 인증과 인가, 민감정보 노출, 데이터 무결성, 장애 복구와 경계 조건을 검토한다.",
  },
];
const FINAL_STAGE: ReviewStage = {
  effort: "medium",
  focus:
    "앞선 검토 결과를 원본 diff와 다시 대조한다. 오탐과 중복을 제거하고, 실제 변경 줄에 근거한 재현 가능하고 구체적인 지적만 남긴다.",
};

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

export function selectValidFindings(
  findings: Finding[],
  commentableLines: Map<string, Set<string>>,
  limit = MAX_INLINE_COMMENTS,
) {
  const severityOrder = { REQUIRED: 0, CAUTION: 1, ADVICE: 2 };
  const seen = new Set<string>();

  return findings
    .filter((finding) => {
      const line = `${finding.side}:${finding.line}`;
      const key = [finding.path, line, finding.title.trim().toLowerCase()].join(":");

      if (!commentableLines.get(finding.path)?.has(line) || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort((left, right) => severityOrder[left.severity] - severityOrder[right.severity])
    .slice(0, limit);
}

export function buildDiffBundle(
  files: PullRequestFile[],
  maxCharacters = MAX_DIFF_CHARACTERS,
) {
  const sections: string[] = [];
  let usedCharacters = 0;
  let omittedFiles = 0;

  for (const file of files) {
    const section = [
      `FILE: ${file.filename}`,
      `STATUS: ${file.status}`,
      `CHANGES: +${file.additions} -${file.deletions}`,
      file.patch ?? "[binary file or patch unavailable]",
      "",
    ].join("\n");

    if (usedCharacters + section.length > maxCharacters) {
      omittedFiles += 1;
      continue;
    }

    sections.push(section);
    usedCharacters += section.length;
  }

  return { text: sections.join("\n"), omittedFiles, includedFiles: sections.length };
}

async function loadConventions(files: PullRequestFile[]) {
  if (!files.some((file) => file.filename.startsWith("BE/"))) {
    return "이 변경 영역에는 별도로 문서화된 코드 컨벤션이 없다. 기존 코드와 패키지 스크립트를 기준으로 검토한다.";
  }

  const documents = await Promise.all(
    CONVENTION_FILES.map(async (path) => `# ${path}\n${await readFile(path, "utf8")}`),
  );
  return documents.join("\n\n");
}

function createTemplateValues(
  pullRequest: PullRequest,
  conventions: string,
  diff: string,
): TemplateValues {
  return {
    conventions,
    title: pullRequest.title,
    body: pullRequest.body || "(empty)",
    base: pullRequest.base.ref,
    head: pullRequest.head.ref,
    diff,
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
    input: fillTemplate(prompts.stageInputTemplate, {
      ...values,
      stageFocus: stage.focus,
    }),
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
  const suggestion = finding.suggestion.trim()
    ? `\n\n**제안**\n${finding.suggestion.trim()}`
    : "";
  return `**[${finding.severity}] ${finding.title.trim()}**\n\n${finding.explanation.trim()}${suggestion}`;
}

function formatReviewBody(
  summary: string,
  findings: Finding[],
  omittedFiles: number,
  totalFiles: number,
) {
  const count = (severity: Finding["severity"]) =>
    findings.filter((finding) => finding.severity === severity).length;
  const coverage = omittedFiles
    ? `\n\n> diff 크기 제한으로 ${totalFiles}개 파일 중 ${omittedFiles}개 파일의 patch가 제외되었습니다.`
    : "";

  return `## 코드 리뷰

${summary.trim() || "인라인으로 남길 높은 확신의 지적을 찾지 못했습니다."}

| 심각도 | 개수 |
| --- | ---: |
| REQUIRED | ${count("REQUIRED")} |
| CAUTION | ${count("CAUTION")} |
| ADVICE | ${count("ADVICE")} |

인라인 코멘트: ${findings.length}/${MAX_INLINE_COMMENTS}${coverage}`;
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
  const [pullRequest, files] = await Promise.all([
    github.getPullRequest(pullNumber),
    github.getPullRequestFiles(pullNumber),
  ]);
  const conventions = await loadConventions(files);
  const diff = buildDiffBundle(files);
  const values = createTemplateValues(pullRequest, conventions, diff.text);
  const cacheKey = `bibbidi-pr-${pullNumber}-${expectedHeadSha}`;

  const stageResults = [];
  for (const stage of REVIEW_STAGES) {
    stageResults.push(await reviewStage(openai, prompts, values, stage, cacheKey));
  }

  const candidates = stageResults.flatMap((result) => result.findings);
  const finalResult = await reviewFinalStage(
    openai,
    prompts,
    values,
    candidates,
    cacheKey,
  );

  const latestPullRequest = await github.getPullRequest(pullNumber);
  if (latestPullRequest.head.sha !== expectedHeadSha) {
    throw new Error("리뷰 중에 새 커밋이 올라왔어요. 최신 커밋에서 다시 리뷰해 주세요.");
  }

  const findings = selectValidFindings(
    finalResult.findings,
    collectCommentableLines(files),
  );
  const body = formatReviewBody(
    finalResult.summary,
    findings,
    diff.omittedFiles,
    files.length,
  );

  return github.createReview(pullNumber, {
    commit_id: expectedHeadSha,
    event: "COMMENT",
    body,
    comments: findings.map((finding) => ({
      path: finding.path,
      side: finding.side,
      line: finding.line,
      body: formatInlineComment(finding),
    })),
  });
}
