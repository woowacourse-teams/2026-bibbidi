import type { Finding, PullRequest, ReviewPrompts, ReviewValues } from "./ai-review-types.ts";
import { BotComments } from "../comment/bot-comments.ts";
import { ChunkedDiff } from "../context/chunked-diff.ts";
import { CommentableLines } from "../finding/commentable-lines.ts";
import { ConventionDocuments } from "../context/convention-documents.ts";
import { ExcludedPaths } from "../gate/excluded-paths.ts";
import { FindingSelection } from "../finding/finding-selection.ts";
import type { GitHubApi } from "../github/github-api.ts";
import { HeadMarker } from "../comment/head-marker.ts";
import { InlineComment } from "../comment/inline-comment.ts";
import { IssueReference } from "../gate/issue-reference.ts";
import { ModelStages } from "../model/model-stages.ts";
import type { ReviewModel } from "../model/review-model.ts";
import { NoticeComment } from "../comment/notice-comment.ts";
import { ReviewGate } from "../gate/review-gate.ts";
import { SourceContext } from "../context/source-context.ts";
import { StaleHeadError } from "./stale-head-error.ts";
import { SummaryComment } from "../comment/summary-comment.ts";

const MAX_INLINE_COMMENTS = 20;
const MAX_DETACHED_FINDINGS = 5;
const MAX_DESIGN_QUESTIONS = 5;

type ReviewTarget = {
  github: GitHubApi;
  model: ReviewModel;
  pullNumber: number;
  expectedHeadSha: string;
  prompts: ReviewPrompts;
};

/** PR 하나에 대한 리뷰 한 번의 전체 흐름. */
export class PullRequestReview {
  private readonly target: ReviewTarget;

  constructor(target: ReviewTarget) {
    this.target = target;
  }

  async run() {
    const { github, model, pullNumber, expectedHeadSha, prompts } = this.target;
    const headMarker = new HeadMarker(expectedHeadSha);
    const [pullRequest, allFiles, pullRequestComments] = await Promise.all([
      github.getPullRequest(pullNumber),
      github.getPullRequestFiles(pullNumber),
      github.getIssueComments(pullNumber),
    ]);
    const botComments = new BotComments(github, pullNumber, pullRequestComments);

    if (pullRequest.head.sha !== expectedHeadSha) {
      throw new StaleHeadError("리뷰 시작 전에 새 커밋이 올라왔습니다. 최신 커밋에서 다시 실행해 주세요.");
    }
    // 비용 때문에 모델 리뷰는 PR당 최초 한 번만 한다. 이후 커밋에서는 모델을 부르지 않는다.
    if (botComments.hasCompletedReview()) return { skipped: true as const };

    const linkedIssue = await new IssueReference(pullRequest.title, pullRequest.body ?? "").load(github);
    const gate = new ReviewGate({
      pullRequest,
      pullRequestComments,
      issueNumber: linkedIssue.number,
      issue: linkedIssue.issue,
      issueComments: linkedIssue.comments,
    }).decide();
    if (!gate.proceed) {
      // 리뷰 marker를 붙이지 않아야 PR을 고친 뒤 같은 커밋에서 다시 실행할 수 있다.
      const summaryComment = await botComments.upsertSummary(new NoticeComment(gate.message).body());
      return { skipped: false as const, review: undefined, summaryComment };
    }

    const files = new ExcludedPaths().reviewable(allFiles);
    if (files.length === 0) {
      const summaryComment = await botComments.upsertSummary(new NoticeComment(
        "리뷰할 파일이 없어 검토하지 않았습니다. 문서, 락·생성 파일, 도구 설정, 이미지·바이너리는 리뷰에서 제외합니다.",
      ).body());
      return { skipped: false as const, review: undefined, summaryComment };
    }

    const diff = new ChunkedDiff(files);
    const chunks = diff.chunks();
    const tree = await github.getRepositoryTree(expectedHeadSha);
    const sourceContext = new SourceContext(github, pullRequest, tree.items);
    const stages = new ModelStages(model, prompts);
    const requirements = linkedIssue.requirements();

    const candidateFindings: Finding[] = [];
    const aiSufficientChanges: string[] = [];
    const humanReviewChanges: string[] = [];
    const designQuestions: string[] = [];
    for (const [index, chunk] of chunks.entries()) {
      const [conventions, repositoryContext] = await Promise.all([
        new ConventionDocuments(chunk.files).text(),
        sourceContext.load(chunk.files),
      ]);
      const values = this.templateValues(
        pullRequest, conventions, requirements, repositoryContext, chunk.text,
        `${index + 1}/${chunks.length}`,
      );
      const result = await stages.review(
        values,
        `bibbidi-pr-${pullNumber}-${expectedHeadSha}-chunk-${index + 1}`,
      );
      candidateFindings.push(...result.findings);
      aiSufficientChanges.push(...(result.aiSufficientChanges ?? []));
      humanReviewChanges.push(...(result.humanReviewChanges ?? []));
      designQuestions.push(...(result.designQuestions ?? []));
    }

    const latestPullRequest = await github.getPullRequest(pullNumber);
    if (latestPullRequest.head.sha !== expectedHeadSha) {
      throw new StaleHeadError("리뷰 중에 새 커밋이 올라왔습니다. 최신 커밋에서 다시 실행해 주세요.");
    }

    const commentable = new CommentableLines(files);
    const selection = new FindingSelection(candidateFindings);
    const inlineCandidates = selection.inline(commentable);
    const findings = inlineCandidates.slice(0, MAX_INLINE_COMMENTS);
    const body = new SummaryComment({
      findings,
      headMarker,
      inlineLimit: MAX_INLINE_COMMENTS,
      chunks: chunks.length,
      unavailablePatches: diff.unavailablePatches(),
      treeTruncated: tree.truncated,
      aiSufficientChanges: [...new Set(aiSufficientChanges)],
      humanReviewChanges: [...new Set(humanReviewChanges)],
      designQuestions: [...new Set(designQuestions)].slice(0, MAX_DESIGN_QUESTIONS),
      detachedFindings: selection.detached(commentable, MAX_DETACHED_FINDINGS),
      warnings: gate.warnings,
      omittedInlineCount: inlineCandidates.length - findings.length,
    }).body();

    let review;
    if (findings.length > 0) {
      review = await github.createReview(pullNumber, {
        commit_id: expectedHeadSha,
        event: "COMMENT",
        body: headMarker.text(),
        comments: findings.map((finding) => ({
          path: finding.path,
          side: finding.side,
          line: finding.line,
          body: new InlineComment(finding).body(),
        })),
      });
    }
    const summaryComment = await botComments.upsertSummary(body);
    await botComments.settleFailure();
    return { skipped: false as const, review, summaryComment };
  }

  private templateValues(
    pullRequest: PullRequest,
    conventions: string,
    requirements: string,
    repositoryContext: string,
    diff: string,
    chunk: string,
  ): ReviewValues {
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
}
