import type {
  CommitStatusState,
  Issue,
  IssueComment,
  IssueEvent,
  PullRequest,
  PullRequestFile,
  PullRequestReview,
  RepositoryTreeItem,
  WorkflowArtifact,
  WorkflowJob,
  WorkflowRun,
} from "./github-types.ts";
import { HttpError } from "./http-error.ts";
import type { RetryingHttp } from "./retrying-http.ts";

const API_VERSION = "2022-11-28";
const PAGE_SIZE = 100;
const TAG_REF_PREFIX = "refs/tags/";

/** 이 저장소의 GitHub REST API 호출을 한곳에서 맡는다. 인증, API 버전, 재시도, 페이지 순회를 중복해서 쓰지 않기 위해 둔다. */
export class GitHubApi {
  private readonly http: RetryingHttp;
  private readonly token: string;
  private readonly repository: string;

  constructor(http: RetryingHttp, token: string, repository: string) {
    this.http = http;
    this.token = token;
    this.repository = repository;
  }

  async getPullRequest(number: number) {
    return (await this.getJson(`/pulls/${number}`)) as PullRequest;
  }

  async getPullRequestFiles(number: number) {
    return this.getPages<PullRequestFile>(`/pulls/${number}/files`, 30);
  }

  async listOpenPullRequests() {
    return this.getPages<PullRequest>("/pulls?state=open&sort=created&direction=desc", 10);
  }

  async listClosedPullRequests() {
    return this.getPages<PullRequest>("/pulls?state=closed&sort=updated&direction=desc", 20);
  }

  async getClosingIssueNumbers(number: number) {
    const [owner, name] = this.repository.split("/");
    const response = await this.http.send("https://api.github.com/graphql", {
      method: "POST",
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query($owner: String!, $name: String!, $number: Int!) {
          repository(owner: $owner, name: $name) {
            pullRequest(number: $number) {
              closingIssuesReferences(first: 100) {
                nodes { number repository { nameWithOwner } }
                pageInfo { hasNextPage }
              }
            }
          }
        }`,
        variables: { owner, name, number },
      }),
    }, "GitHub closing issue references");
    const result = await response.json() as {
      errors?: Array<{ message: string }>;
      data?: { repository?: { pullRequest?: { closingIssuesReferences?: {
        nodes?: Array<{ number: number; repository: { nameWithOwner: string } }>;
        pageInfo?: { hasNextPage: boolean };
      } } } };
    };
    if (result.errors?.length) throw new Error(`GitHub GraphQL 오류: ${result.errors[0].message}`);
    const references = result.data?.repository?.pullRequest?.closingIssuesReferences;
    if (!references) throw new Error(`PR #${number}의 Issue 연결 정보를 읽지 못했습니다.`);
    if (references.pageInfo?.hasNextPage) throw new Error(`PR #${number}의 Issue 연결이 100개를 초과합니다.`);
    return (references.nodes ?? [])
      .filter((issue) => issue.repository.nameWithOwner.toLowerCase() === this.repository.toLowerCase())
      .map((issue) => issue.number);
  }

  async getPullRequestReviews(number: number) {
    return this.getPages<PullRequestReview>(`/pulls/${number}/reviews`, 10);
  }

  async getCommitPullRequests(sha: string) {
    return this.getPages<PullRequest>(`/commits/${encodeURIComponent(sha)}/pulls`, 10);
  }

  async requestReviewers(number: number, reviewers: string[]) {
    await this.write(`/pulls/${number}/requested_reviewers`, "POST", { reviewers }, "GitHub reviewer request");
  }

  async getIssue(number: number) {
    try {
      return (await this.getJson(`/issues/${number}`)) as Issue;
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) return undefined;
      throw error;
    }
  }

  async closeIssue(number: number) {
    await this.write(`/issues/${number}`, "PATCH", { state: "closed" }, "GitHub issue close");
  }

  async getBranchRef(name: string) {
    try {
      return await this.getJson(`/git/ref/heads/${this.encodePath(name)}`) as {
        ref: string;
        object: { sha: string };
      };
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) return undefined;
      throw error;
    }
  }

  async deleteBranch(name: string) {
    try {
      await this.write(`/git/refs/heads/${this.encodePath(name)}`, "DELETE", undefined, "GitHub branch delete");
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) return;
      throw error;
    }
  }

  async getIssueComments(number: number) {
    return this.getPages<IssueComment>(`/issues/${number}/comments`, 10);
  }

  async getIssueEvents(number: number) {
    return this.getPages<IssueEvent>(`/issues/${number}/events`, 10);
  }

  async getRepositoryFile(path: string, ref: string) {
    try {
      const payload = await this.getJson(`/contents/${this.encodePath(path)}?ref=${encodeURIComponent(ref)}`) as {
        content?: string;
        encoding?: string;
        type?: string;
      };
      if (payload.type !== "file" || payload.encoding !== "base64" || !payload.content) return undefined;
      return Buffer.from(payload.content.replace(/\n/g, ""), "base64").toString("utf8");
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) return undefined;
      throw error;
    }
  }

  async getRepositoryTree(ref: string) {
    const payload = await this.getJson(`/git/trees/${encodeURIComponent(ref)}?recursive=1`) as {
      tree?: RepositoryTreeItem[];
      truncated?: boolean;
    };
    return { items: payload.tree ?? [], truncated: payload.truncated === true };
  }

  async listTagNames(prefix: string) {
    const refs = await this.getPages<{ ref: string }>(`/git/matching-refs/tags/${this.encodePath(prefix)}`, 100);
    return refs.map((ref) => ref.ref.slice(TAG_REF_PREFIX.length));
  }

  async deleteTag(name: string) {
    await this.write(`/git/refs/tags/${this.encodePath(name)}`, "DELETE", undefined, "GitHub tag delete");
  }

  async getWorkflowRunJobs(runId: number) {
    const payload = await this.getJson(`/actions/runs/${runId}/jobs?per_page=${PAGE_SIZE}`) as { jobs?: WorkflowJob[] };
    return payload.jobs ?? [];
  }

  async listSuccessfulWorkflowRuns(workflowFile: string, branch: string, headSha: string) {
    const query = `branch=${encodeURIComponent(branch)}&head_sha=${encodeURIComponent(headSha)}&status=success`;
    const payload = await this.getJson(
      `/actions/workflows/${encodeURIComponent(workflowFile)}/runs?${query}&per_page=${PAGE_SIZE}`,
    ) as { workflow_runs?: WorkflowRun[] };
    return payload.workflow_runs ?? [];
  }

  async getRepositoryId() {
    const payload = await this.getJson("") as { id: number };
    return payload.id;
  }

  async listArtifactsByName(name: string) {
    const payload = await this.getJson(`/actions/artifacts?name=${encodeURIComponent(name)}&per_page=${PAGE_SIZE}`) as {
      artifacts?: WorkflowArtifact[];
    };
    return payload.artifacts ?? [];
  }

  async createReview(number: number, review: object) {
    return (await this.write(`/pulls/${number}/reviews`, "POST", review, "GitHub review")).json();
  }

  async createIssueComment(number: number, body: string) {
    return (await this.write(`/issues/${number}/comments`, "POST", { body }, "GitHub issue comment")).json();
  }

  async updateIssueComment(commentId: number, body: string) {
    return (await this.write(`/issues/comments/${commentId}`, "PATCH", { body }, "GitHub issue comment update")).json();
  }

  async createCommitStatus(sha: string, status: {
    state: CommitStatusState;
    description: string;
    context: string;
    targetUrl?: string;
  }) {
    return (await this.write(`/statuses/${encodeURIComponent(sha)}`, "POST", {
      state: status.state,
      description: status.description.slice(0, 140),
      context: status.context,
      ...(status.targetUrl ? { target_url: status.targetUrl } : {}),
    }, "GitHub commit status")).json();
  }

  private get baseUrl() {
    return `https://api.github.com/repos/${this.repository}`;
  }

  private get headers() {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${this.token}`,
      "X-GitHub-Api-Version": API_VERSION,
      "User-Agent": "bibbidi-github-scripts",
    };
  }

  private async getJson(path: string) {
    return (await this.http.send(`${this.baseUrl}${path}`, { headers: this.headers }, "GitHub API")).json();
  }

  private write(path: string, method: string, payload: object | undefined, label: string) {
    return this.http.send(`${this.baseUrl}${path}`, {
      method,
      headers: { ...this.headers, ...(payload ? { "Content-Type": "application/json" } : {}) },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    }, label);
  }

  private async getPages<T>(path: string, maxPages: number) {
    const separator = path.includes("?") ? "&" : "?";
    const items: T[] = [];
    for (let page = 1; page <= maxPages; page += 1) {
      const batch = (await this.getJson(`${path}${separator}per_page=${PAGE_SIZE}&page=${page}`)) as T[];
      items.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }
    return items;
  }

  private encodePath(path: string) {
    return path.split("/").map(encodeURIComponent).join("/");
  }
}
