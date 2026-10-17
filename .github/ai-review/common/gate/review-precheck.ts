import type { IssueComment, PullRequest, PullRequestFile, ScanHit } from "../ai-review-types.ts";
import type { GitHubApi } from "../github/github-api.ts";
import { StaleHeadError } from "../stale-head-error.ts";
import { ExcludedPaths } from "./excluded-paths.ts";
import { InjectionScan } from "./injection-scan.ts";
import { IssueReference } from "./issue-reference.ts";
import type { LinkedIssue } from "./linked-issue.ts";
import { ProtectedPaths } from "./protected-paths.ts";
import { ReviewGate } from "./review-gate.ts";
import { ScanTargets } from "./scan-targets.ts";
import { SecretScan } from "./secret-scan.ts";

const MAX_LISTED_LOCATIONS = 5;

export type PrecheckContext = {
  pullRequest: PullRequest;
  allFiles: PullRequestFile[];
  files: PullRequestFile[];
  pullRequestComments: IssueComment[];
  linkedIssue: LinkedIssue;
};

export type StopReason =
  | "DRAFT"
  | "BOT_AUTHOR"
  | "NO_ISSUE"
  | "INSUFFICIENT_CONTEXT"
  | "PROTECTED_PATHS"
  | "SECRET_FOUND"
  | "INJECTION_SUSPECTED";

export type PrecheckResult =
  | { proceed: true; warnings: string[] }
  | { proceed: false; reason: StopReason; silent: boolean; message: string };

/**
 * 모델을 부르기 전에 PR이 리뷰 대상인지 확인한다.
 * pre 단계는 PR 코드로 실행되어 결과를 믿을 수 없으므로, job 단계가 같은 검사를 한 번 더 한다.
 */
export class ReviewPrecheck {
  private readonly github: GitHubApi;
  private readonly pullNumber: number;
  private readonly expectedHeadSha: string;

  constructor(github: GitHubApi, pullNumber: number, expectedHeadSha: string) {
    this.github = github;
    this.pullNumber = pullNumber;
    this.expectedHeadSha = expectedHeadSha;
  }

  async load(): Promise<PrecheckContext> {
    const [pullRequest, allFiles, pullRequestComments] = await Promise.all([
      this.github.getPullRequest(this.pullNumber),
      this.github.getPullRequestFiles(this.pullNumber),
      this.github.getIssueComments(this.pullNumber),
    ]);
    if (pullRequest.head.sha !== this.expectedHeadSha) {
      throw new StaleHeadError("리뷰 시작 전에 새 커밋이 올라왔습니다. 최신 커밋에서 다시 실행해 주세요.");
    }

    const linkedIssue = await new IssueReference(pullRequest.title, pullRequest.body ?? "").load(this.github);
    return {
      pullRequest,
      allFiles,
      files: new ExcludedPaths().reviewable(allFiles),
      pullRequestComments,
      linkedIssue,
    };
  }

  decide(context: PrecheckContext): PrecheckResult {
    const { pullRequest, allFiles, files, pullRequestComments, linkedIssue } = context;

    if (pullRequest.draft === true) return this.silentStop("DRAFT");
    if (pullRequest.user?.login === "dependabot[bot]") return this.silentStop("BOT_AUTHOR");

    const gate = new ReviewGate({
      pullRequest,
      pullRequestComments,
      issueNumber: linkedIssue.number,
      issue: linkedIssue.issue,
      issueComments: linkedIssue.comments,
    }).decide();
    if (!gate.proceed) return { proceed: false, reason: gate.reason, silent: false, message: gate.message };

    const protectedTouched = new ProtectedPaths().touchedBy(allFiles);
    if (protectedTouched.length > 0) {
      return this.stop("PROTECTED_PATHS", [
        "리뷰 봇 자체를 바꾸는 PR(`.github/ai-review/**`, 리뷰 워크플로)이라 자동 리뷰를 하지 않았습니다. 사람이 직접 확인해 주세요.",
        "",
        ...this.list(protectedTouched.map((path) => `\`${path}\``)),
      ]);
    }

    const targets = new ScanTargets(pullRequest, pullRequestComments, linkedIssue, files).all();
    const secrets = new SecretScan().findIn(targets);
    if (secrets.length > 0) {
      return this.stop("SECRET_FOUND", [
        "비밀값으로 보이는 문자열이 있어 외부 AI로 보내지 않고 리뷰를 하지 않았습니다. 해당 값은 이미 노출된 것으로 보고 폐기한 뒤 새로 발급해 주세요.",
        "",
        ...this.list(this.describe(secrets)),
      ]);
    }

    const injections = new InjectionScan().findIn(targets);
    if (injections.length > 0) {
      return this.stop("INJECTION_SUSPECTED", [
        "AI에게 지시를 내리려는 문구로 보이는 내용이 있어 리뷰를 하지 않았습니다. 문구를 확인하고 필요하면 고쳐 주세요.",
        "",
        ...this.list(this.describe(injections)),
      ]);
    }

    return { proceed: true, warnings: gate.warnings };
  }

  private silentStop(reason: StopReason): PrecheckResult {
    return { proceed: false, reason, silent: true, message: "" };
  }

  private stop(reason: StopReason, lines: string[]): PrecheckResult {
    return { proceed: false, reason, silent: false, message: lines.join("\n") };
  }

  private describe(hits: ScanHit[]) {
    return hits.map((hit) => `\`${hit.location}\` (${hit.kind})`);
  }

  private list(items: string[]) {
    const shown = items.slice(0, MAX_LISTED_LOCATIONS).map((item) => `- ${item}`);
    const rest = items.length - MAX_LISTED_LOCATIONS;
    return rest > 0 ? [...shown, `- 외 ${rest}곳`] : shown;
  }
}
