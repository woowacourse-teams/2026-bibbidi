import type { Finding, PullRequest, ReviewPrompts, ReviewValues } from "../../common/ai-review-types.ts";
import { BotComments } from "../../common/comment/bot-comments.ts";
import { HeadMarker } from "../../common/comment/head-marker.ts";
import { NoticeComment } from "../../common/comment/notice-comment.ts";
import { ReviewPrecheck } from "../../common/gate/review-precheck.ts";
import { SecretScan } from "../../common/gate/secret-scan.ts";
import type { GitHubApi } from "../../common/github/github-api.ts";
import { ReviewStageError } from "../../common/review-stage-error.ts";
import { StaleHeadError } from "../../common/stale-head-error.ts";
import { InlineComment } from "../comment/inline-comment.ts";
import { SummaryComment } from "../comment/summary-comment.ts";
import { ChunkedDiff } from "../context/chunked-diff.ts";
import { ConventionDocuments } from "../context/convention-documents.ts";
import { SourceContext } from "../context/source-context.ts";
import { CommentableLines } from "../finding/commentable-lines.ts";
import { FindingSelection } from "../finding/finding-selection.ts";
import { ModelStages } from "../model/model-stages.ts";
import type { ReviewModel } from "../model/review-model.ts";
import type { ReviewStatus } from "../status/review-status.ts";

const MAX_INLINE_COMMENTS = 20;
const MAX_DETACHED_FINDINGS = 5;
const MAX_DESIGN_QUESTIONS = 5;

type ReviewTarget = {
  github: GitHubApi;
  model: ReviewModel;
  status: ReviewStatus;
  pullNumber: number;
  expectedHeadSha: string;
  prompts: ReviewPrompts;
};

export type ReviewOutcome = "already-reviewed" | "not-applicable" | "stopped" | "reviewed";

/** PR 하나에 대한 리뷰 한 번의 전체 흐름. */
export class PullRequestReview {
  private readonly target: ReviewTarget;
  private stage = "PR 정보 조회";

  constructor(target: ReviewTarget) {
    this.target = target;
  }

  /** 실패하면 어느 단계에서 실패했는지 함께 알린다. */
  async run(): Promise<ReviewOutcome> {
    try {
      return await this.execute();
    } catch (error) {
      if (error instanceof StaleHeadError) throw error;
      throw new ReviewStageError(this.stage, error);
    }
  }

  private async execute(): Promise<ReviewOutcome> {
    const { github, model, status, pullNumber, expectedHeadSha, prompts } = this.target;
    const headMarker = new HeadMarker(expectedHeadSha);
    const precheck = new ReviewPrecheck(github, pullNumber, expectedHeadSha);
    const context = await precheck.load();
    const botComments = new BotComments(github, pullNumber, context.pullRequestComments);

    // 비용 때문에 모델 리뷰는 PR당 최초 한 번만 한다. 이후 커밋에서는 모델을 부르지 않는다.
    if (botComments.hasCompletedReview()) return "already-reviewed";

    this.stage = "사전 검사";
    // pre 단계는 PR 코드로 실행되어 믿을 수 없으므로 같은 검사를 여기서 다시 한다.
    const decision = precheck.decide(context);
    if (!decision.proceed) {
      if (decision.silent) return "not-applicable";
      // 리뷰 marker를 붙이지 않아야 PR을 고친 뒤 같은 커밋에서 다시 실행할 수 있다.
      await botComments.upsertSummary(new NoticeComment(decision.message).body());
      await status.blocked(decision.message.split("\n")[0]);
      return "stopped";
    }

    const { pullRequest, files, linkedIssue } = context;
    if (files.length === 0) {
      await botComments.upsertSummary(new NoticeComment(
        "리뷰할 파일이 없어 검토하지 않았습니다. 문서, 락·생성 파일, 도구 설정, 이미지·바이너리는 리뷰에서 제외합니다.",
      ).body());
      await status.skipped("리뷰할 파일이 없습니다");
      return "stopped";
    }

    await status.pending();
    this.stage = "모델 호출";
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

      // 변경되지 않은 주변 코드에도 비밀값이 있을 수 있어, 모델로 보내기 직전의 내용을 다시 검사한다.
      const leaks = new SecretScan().findIn([
        { location: `청크 ${index + 1}의 diff`, text: values.diff },
        { location: `청크 ${index + 1}의 주변 코드`, text: values.repositoryContext },
        { location: "Issue 내용", text: values.requirements },
      ]);
      if (leaks.length > 0) {
        const message = [
          "비밀값으로 보이는 문자열이 모델로 보낼 내용에 있어 리뷰를 하지 않았습니다. 해당 값은 폐기하고 새로 발급해 주세요.",
          "",
          ...leaks.map((leak) => `- ${leak.location} (${leak.kind})`),
        ].join("\n");
        await botComments.upsertSummary(new NoticeComment(message).body());
        await status.blocked("비밀값이 포함되어 리뷰하지 않았습니다");
        return "stopped";
      }

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

    this.stage = "리뷰 등록";
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
      warnings: decision.warnings,
      omittedInlineCount: inlineCandidates.length - findings.length,
    }).body();

    if (findings.length > 0) {
      await github.createReview(pullNumber, {
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
    await botComments.upsertSummary(body);
    await botComments.settleFailure();
    await status.completed(findings);
    return "reviewed";
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
