import type { Issue, IssueComment } from "../ai-review-types.ts";

const MAX_REQUIREMENTS_CHARACTERS = 30_000;

/** PR에 연결된 Issue와 댓글. 연결이 없거나 찾지 못하면 issue가 비어 있다. */
export class LinkedIssue {
  readonly number: number | undefined;
  readonly issue: Issue | undefined;
  readonly comments: IssueComment[];

  constructor(number: number | undefined, issue: Issue | undefined, comments: IssueComment[]) {
    this.number = number;
    this.issue = issue;
    this.comments = comments;
  }

  requirements() {
    if (!this.issue) return "연결된 Issue를 조회하지 못했다.";

    const text = [
      `<linked_issue number="${this.issue.number}">`,
      `title: ${this.issue.title}`,
      `labels: ${(this.issue.labels ?? []).map((label) => label.name).join(", ") || "(none)"}`,
      this.issue.body ?? "(empty)",
      ...this.comments.map((comment, index) => [
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
}
