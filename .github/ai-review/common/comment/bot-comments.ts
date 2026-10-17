import type { IssueComment } from "../ai-review-types.ts";
import { BotAuthor } from "./bot-author.ts";
import { FAILURE_MARKER, REVIEW_MARKER_PREFIX, SUMMARY_MARKER } from "./comment-markers.ts";
import type { GitHubApi } from "../github/github-api.ts";

const MAX_FAILURE_MESSAGE_CHARACTERS = 300;
const RESOLVED_FAILURE_BODY = `${FAILURE_MARKER}\n이전 실행의 AI 리뷰 실패는 이후 실행에서 해결되었습니다.`;

/** PR 대화창에 봇이 남기는 요약·실패 댓글. */
export class BotComments {
  private readonly github: GitHubApi;
  private readonly pullNumber: number;
  private readonly comments: IssueComment[];

  constructor(github: GitHubApi, pullNumber: number, comments: IssueComment[]) {
    this.github = github;
    this.pullNumber = pullNumber;
    this.comments = comments;
  }

  /** 모델이 한 번이라도 리뷰를 마친 PR인지. 비용 때문에 리뷰는 PR당 최초 한 번만 한다. */
  hasCompletedReview() {
    return this.comments.some((comment) => (
      comment.body?.includes(SUMMARY_MARKER)
      && comment.body.includes(REVIEW_MARKER_PREFIX)
      && new BotAuthor(comment.user).isBot()
    ));
  }

  upsertSummary(body: string) {
    return this.upsert(SUMMARY_MARKER, body);
  }

  /** 리뷰 봇이 실패해도 머지를 막지 않도록 안내 댓글만 남긴다. */
  reportFailure(message: string) {
    const reason = message.length > MAX_FAILURE_MESSAGE_CHARACTERS
      ? `${message.slice(0, MAX_FAILURE_MESSAGE_CHARACTERS - 1)}…`
      : message;
    return this.upsert(FAILURE_MARKER, `${FAILURE_MARKER}
## 🤖 AI Code Review

AI 리뷰를 하지 못했습니다. 코드 변경과는 관계없는 리뷰 봇 쪽 문제이고, 머지는 막지 않습니다.

- 원인: ${reason}

새 커밋을 올리거나 워크플로를 다시 실행하면 리뷰를 다시 시도합니다.`);
  }

  /** 이후 실행이 성공하면 남아 있는 실패 안내를 해결됨으로 바꾼다. */
  async settleFailure() {
    const failure = this.find(FAILURE_MARKER);
    if (failure?.id && failure.body !== RESOLVED_FAILURE_BODY) {
      await this.github.updateIssueComment(failure.id, RESOLVED_FAILURE_BODY);
    }
  }

  private upsert(marker: string, body: string) {
    const existing = this.find(marker);
    if (existing?.id) return this.github.updateIssueComment(existing.id, body);
    return this.github.createIssueComment(this.pullNumber, body);
  }

  private find(marker: string) {
    return this.comments.find((comment) => (
      comment.id && comment.body?.includes(marker) && new BotAuthor(comment.user).isBot()
    ));
  }
}
