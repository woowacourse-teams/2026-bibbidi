import { readFile } from "node:fs/promises";
import {
  FINAL_STAGE,
  MAX_INLINE_COMMENTS,
  REVIEW_MODEL,
  REVIEW_STAGES,
} from "./config.mjs";
import {
  buildDiffBundle,
  collectCommentableLines,
  selectValidFindings,
} from "./diff.mjs";
import {
  buildCommonInstructions,
  buildFinalInput,
  buildStageInput,
} from "./prompts.mjs";

const CONVENTION_FILES = [
  "docs/convention/code-convention.md",
  "docs/convention/error-handling.md",
  "docs/convention/test-strategy.md",
];

async function loadConventions(files) {
  if (!files.some((file) => file.filename.startsWith("BE/"))) {
    return "이 변경 영역에는 별도로 문서화된 코드 컨벤션이 없다. 기존 코드와 패키지 스크립트를 기준으로 검토한다.";
  }

  const documents = await Promise.all(
    CONVENTION_FILES.map(async (path) => {
      try {
        return `# ${path}\n${await readFile(path, "utf8")}`;
      } catch (error) {
        if (error.code === "ENOENT") {
          return "";
        }
        throw error;
      }
    }),
  );
  return documents.filter(Boolean).join("\n\n");
}

function formatInlineComment(finding) {
  const suggestion = finding.suggestion.trim()
    ? `\n\n**제안**\n${finding.suggestion.trim()}`
    : "";
  return `**[${finding.severity}] ${finding.title.trim()}**\n\n${finding.explanation.trim()}${suggestion}`;
}

function formatReviewBody({ summary, findings, omittedFiles, totalFiles }) {
  const counts = Object.fromEntries(
    ["REQUIRED", "CAUTION", "ADVICE"].map((severity) => [
      severity,
      findings.filter((finding) => finding.severity === severity).length,
    ]),
  );
  const coverage = omittedFiles
    ? `\n\n> diff 크기 제한으로 ${totalFiles}개 파일 중 ${omittedFiles}개 파일의 patch가 제외되었습니다.`
    : "";

  return `## 🤖 Bibbidi AI 코드 리뷰 Harness

${summary.trim() || "인라인으로 남길 높은 확신의 지적을 찾지 못했습니다."}

| 심각도 | 개수 |
| --- | ---: |
| REQUIRED | ${counts.REQUIRED} |
| CAUTION | ${counts.CAUTION} |
| ADVICE | ${counts.ADVICE} |

모델: \`${REVIEW_MODEL}\` · 인라인 코멘트: ${findings.length}/${MAX_INLINE_COMMENTS}${coverage}

> AI 리뷰는 참고용입니다. 최종 판단과 승인은 사람 리뷰어가 담당합니다.`;
}

export async function runReview({ github, openai, pullNumber, expectedHeadSha }) {
  const [pullRequest, files] = await Promise.all([
    github.getPullRequest(pullNumber),
    github.getPullRequestFiles(pullNumber),
  ]);
  const conventions = await loadConventions(files);

  if (pullRequest.head.sha !== expectedHeadSha) {
    throw new Error("Pull request head changed before review started");
  }

  const diffBundle = buildDiffBundle(files);
  const instructions = buildCommonInstructions();
  const cacheKey = `bibbidi-pr-${pullNumber}-${expectedHeadSha}`;
  const stageResults = [];
  for (const stage of REVIEW_STAGES) {
    stageResults.push(
      await openai.review({
        instructions,
        input: buildStageInput({
          pullRequest,
          conventions,
          diff: diffBundle.text,
          stage,
        }),
        reasoningEffort: stage.reasoningEffort,
        cacheKey,
      }),
    );
  }

  const candidates = stageResults.flatMap((result) => result.findings);
  const finalResult = await openai.review({
    instructions,
    input: buildFinalInput({
      pullRequest,
      conventions,
      diff: diffBundle.text,
      candidates,
      stage: FINAL_STAGE,
    }),
    reasoningEffort: FINAL_STAGE.reasoningEffort,
    cacheKey,
  });

  const latestPullRequest = await github.getPullRequest(pullNumber);
  if (latestPullRequest.head.sha !== expectedHeadSha) {
    throw new Error("Pull request head changed while review was running");
  }

  const findings = selectValidFindings(
    finalResult.findings,
    collectCommentableLines(files),
  );
  const body = formatReviewBody({
    summary: finalResult.summary,
    findings,
    omittedFiles: diffBundle.omittedFiles,
    totalFiles: files.length,
  });

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
