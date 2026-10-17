import type { CommitStatusState, Finding } from "../../common/ai-review-types.ts";
import type { GitHubApi } from "../../../github/github-api.ts";

const STATUS_CONTEXT = "AI 리뷰";

/** PR 체크 목록에서 리뷰 진행 상태를 볼 수 있게 커밋 상태를 남긴다. 실패해도 리뷰를 막지 않는다. */
export class ReviewStatus {
  private readonly github: GitHubApi;
  private readonly headSha: string;
  private readonly runUrl: string | undefined;

  constructor(github: GitHubApi, headSha: string, runUrl?: string) {
    this.github = github;
    this.headSha = headSha;
    this.runUrl = runUrl;
  }

  pending() {
    return this.post("pending", "AI 리뷰를 진행하고 있습니다");
  }

  completed(findings: Finding[]) {
    const required = findings.filter((finding) => finding.kind === "DEFECT" && finding.severity === "REQUIRED").length;
    const review = findings.length - required;
    return this.post("success", `AI 리뷰 완료: 필수 ${required}건, 검토·참고 ${review}건`);
  }

  skipped(reason: string) {
    return this.post("success", `AI 리뷰 생략: ${reason}`);
  }

  blocked(reason: string) {
    return this.post("failure", `AI 리뷰 안 함: ${reason}`);
  }

  failed(reason: string) {
    return this.post("error", `AI 리뷰 실패: ${reason}`);
  }

  private async post(state: CommitStatusState, description: string) {
    try {
      await this.github.createCommitStatus(this.headSha, {
        state,
        description,
        context: STATUS_CONTEXT,
        targetUrl: this.runUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      console.warn(`::warning title=AI review status failed::${message}`);
    }
  }
}
