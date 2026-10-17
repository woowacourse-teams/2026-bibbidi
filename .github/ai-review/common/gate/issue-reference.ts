import type { GitHubApi } from "../../../github/github-api.ts";
import { LinkedIssue } from "./linked-issue.ts";

/** PR 제목이나 본문에 적힌 Issue 번호. */
export class IssueReference {
  private readonly title: string;
  private readonly body: string;

  constructor(title: string, body: string) {
    this.title = title;
    this.body = body;
  }

  number() {
    const value = `${this.title}\n${this.body}`;
    const match = value.match(/\[#(\d+)]|(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/i);
    return match ? Number(match[1] ?? match[2]) : undefined;
  }

  async load(github: GitHubApi) {
    const number = this.number();
    if (!number) return new LinkedIssue(undefined, undefined, []);

    const issue = await github.getIssue(number);
    if (!issue) return new LinkedIssue(number, undefined, []);
    return new LinkedIssue(number, issue, await github.getIssueComments(number));
  }
}
