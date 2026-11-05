import type { Issue, IssueEvent, PullRequest } from "../github/github-types.ts";

const TARGET_BRANCHES = new Set(["dev-be", "dev-fe", "dev-app"]);
const WORK_BRANCH = /^(?:feature|fix|hotfix|docs|chore)\/\d+$/;
// GitHub 종료 키워드만 허용한다. Refs는 Issue를 참조할 뿐 종료하지 않는다.
const CLOSING_KEYWORD = /(?<![#\w])(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)[ \t]*:?[ \t]+(?:(?<owner>[\w-]+)\/(?<repo>[\w.-]+))?#(?<number>\d+)\b/gi;

export type LifecycleApi = {
  getClosingIssueNumbers(number: number): Promise<number[]>;
  getIssue(number: number): Promise<Issue | undefined>;
  getIssueEvents(number: number): Promise<IssueEvent[]>;
  closeIssue(number: number): Promise<void>;
  getBranchRef(name: string): Promise<{ ref: string; object: { sha: string } } | undefined>;
  deleteBranch(name: string): Promise<void>;
};

export function closingIssueNumbers(body: string, repository: string): number[] {
  const withoutFences = body
    .replace(/^[ \t]*```[^\n]*\n[\s\S]*?^[ \t]*```[ \t]*$/gm, "")
    .replace(/^[ \t]*~~~[^\n]*\n[\s\S]*?^[ \t]*~~~[ \t]*$/gm, "");
  return [...withoutFences.matchAll(CLOSING_KEYWORD)]
    .filter((match) => !match.groups?.owner ||
      `${match.groups.owner}/${match.groups.repo}`.toLowerCase() === repository.toLowerCase())
    .map((match) => Number(match.groups!.number))
    .filter((number) => number > 0);
}

export class PullRequestLifecycle {
  private readonly api: LifecycleApi;
  private readonly repository: string;
  private readonly openPullRequests: PullRequest[];

  constructor(
    api: LifecycleApi,
    repository: string,
    openPullRequests: PullRequest[],
  ) {
    this.api = api;
    this.repository = repository;
    this.openPullRequests = openPullRequests;
  }

  async handle(pr: PullRequest, dryRun: boolean): Promise<string[]> {
    if (!pr.merged_at || !TARGET_BRANCHES.has(pr.base.ref)) return [];
    if (pr.head.repo?.full_name.toLowerCase() !== this.repository.toLowerCase()) return [];

    const messages: string[] = [];
    const manuallyLinked = await this.api.getClosingIssueNumbers(pr.number);
    const issueNumbers = new Set([...manuallyLinked, ...closingIssueNumbers(pr.body ?? "", this.repository)]);

    for (const number of issueNumbers) {
      const issue = await this.api.getIssue(number);
      if (!issue || issue.pull_request || issue.state !== "open") continue;
      const events = await this.api.getIssueEvents(number);
      if (events.some((event) => event.event === "reopened" && event.created_at > pr.merged_at!)) {
        messages.push(`Issue #${number}: 병합 후 다시 열려 유지`);
        continue;
      }
      if (this.openPullRequests.some((open) =>
        open.number !== pr.number && (
          closingIssueNumbers(open.body ?? "", this.repository).includes(number) ||
          open.title.includes(`[#${number}]`)
        ))) {
        messages.push(`Issue #${number}: 다른 열린 PR에서 사용 중이므로 유지`);
        continue;
      }
      if (!dryRun) await this.api.closeIssue(number);
      messages.push(`Issue #${number}: ${dryRun ? "종료 대상" : "종료"}`);
    }

    const branch = pr.head.ref;
    if (!WORK_BRANCH.test(branch)) {
      messages.push(`${branch}: 작업 브랜치 형식이 아니므로 유지`);
      return messages;
    }
    if (this.openPullRequests.some((open) =>
      open.base.ref === branch ||
      (open.head.ref === branch && open.head.repo?.full_name.toLowerCase() === this.repository.toLowerCase())
    )) {
      messages.push(`${branch}: 다른 열린 PR에서 사용 중이므로 유지`);
      return messages;
    }
    const ref = await this.api.getBranchRef(branch);
    if (!ref) return messages;
    if (ref.ref !== `refs/heads/${branch}` || ref.object.sha !== pr.head.sha) {
      messages.push(`${branch}: 병합 당시 SHA와 달라 유지`);
      return messages;
    }
    if (!dryRun) await this.api.deleteBranch(branch);
    messages.push(`${branch}: ${dryRun ? "삭제 대상" : "삭제"}`);
    return messages;
  }
}
