import type {
  Issue,
  IssueComment,
  PullRequest,
  PullRequestFile,
  RepositoryTreeItem,
} from "../review/ai-review-types.ts";
import { HttpError } from "./http-error.ts";
import type { RetryingHttp } from "./retrying-http.ts";

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

  async getIssue(number: number) {
    try {
      return (await this.getJson(`/issues/${number}`)) as Issue;
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) return undefined;
      throw error;
    }
  }

  async getIssueComments(number: number) {
    return this.getPages<IssueComment>(`/issues/${number}/comments`, 10);
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

  async createReview(number: number, review: object) {
    return (await this.write(`/pulls/${number}/reviews`, "POST", review, "GitHub review")).json();
  }

  async createIssueComment(number: number, body: string) {
    return (await this.write(`/issues/${number}/comments`, "POST", { body }, "GitHub issue comment")).json();
  }

  async updateIssueComment(commentId: number, body: string) {
    return (await this.write(`/issues/comments/${commentId}`, "PATCH", { body }, "GitHub issue comment update")).json();
  }

  private get baseUrl() {
    return `https://api.github.com/repos/${this.repository}`;
  }

  private get headers() {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${this.token}`,
      "X-GitHub-Api-Version": "2026-03-10",
      "User-Agent": "bibbidi-ai-reviewer",
    };
  }

  private async getJson(path: string) {
    return (await this.http.send(`${this.baseUrl}${path}`, { headers: this.headers }, "GitHub API")).json();
  }

  private write(path: string, method: string, payload: object, label: string) {
    return this.http.send(`${this.baseUrl}${path}`, {
      method,
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }, label);
  }

  private async getPages<T>(path: string, maxPages: number) {
    const items: T[] = [];
    for (let page = 1; page <= maxPages; page += 1) {
      const batch = (await this.getJson(`${path}?per_page=100&page=${page}`)) as T[];
      items.push(...batch);
      if (batch.length < 100) break;
    }
    return items;
  }

  private encodePath(path: string) {
    return path.split("/").map(encodeURIComponent).join("/");
  }
}
