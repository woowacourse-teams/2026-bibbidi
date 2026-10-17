import type { IssueComment, PullRequest, PullRequestFile, ScanTarget } from "../ai-review-types.ts";
import { BotAuthor } from "../comment/bot-author.ts";
import { AddedLines } from "./added-lines.ts";
import type { LinkedIssue } from "./linked-issue.ts";

/** 외부 AI에 전달될 수 있는 텍스트를 위치와 함께 모은다. 봇이 쓴 댓글은 뺀다. */
export class ScanTargets {
  private readonly pullRequest: PullRequest;
  private readonly pullRequestComments: IssueComment[];
  private readonly linkedIssue: LinkedIssue;
  private readonly reviewableFiles: PullRequestFile[];

  constructor(
    pullRequest: PullRequest,
    pullRequestComments: IssueComment[],
    linkedIssue: LinkedIssue,
    reviewableFiles: PullRequestFile[],
  ) {
    this.pullRequest = pullRequest;
    this.pullRequestComments = pullRequestComments;
    this.linkedIssue = linkedIssue;
    this.reviewableFiles = reviewableFiles;
  }

  texts() {
    const targets: ScanTarget[] = [
      { location: "PR 제목", text: this.pullRequest.title },
      { location: "PR 본문", text: this.pullRequest.body ?? "" },
      ...this.commentTargets("PR 댓글", this.pullRequestComments),
    ];
    const issue = this.linkedIssue.issue;
    if (issue) {
      targets.push(
        { location: `Issue #${issue.number} 제목`, text: issue.title },
        { location: `Issue #${issue.number} 본문`, text: issue.body ?? "" },
        ...this.commentTargets(`Issue #${issue.number} 댓글`, this.linkedIssue.comments),
      );
    }
    return targets;
  }

  all() {
    return [...this.texts(), ...new AddedLines(this.reviewableFiles).targets()];
  }

  private commentTargets(label: string, comments: IssueComment[]) {
    return comments
      .filter((comment) => !new BotAuthor(comment.user).isBot())
      .map((comment, index) => ({ location: `${label} ${index + 1}`, text: comment.body ?? "" }));
  }
}
