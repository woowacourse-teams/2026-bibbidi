import type { TagRepository } from "./tag-cleaner.ts";

const PAGE_SIZE = 100;
const TAG_REF_PREFIX = "refs/tags/";

export class GitHubTagRepository implements TagRepository {
  private readonly repository: string;
  private readonly token: string;

  constructor(repository: string, token: string) {
    this.repository = repository;
    this.token = token;
  }

  async listTagNames(prefix: string): Promise<string[]> {
    const names: string[] = [];

    for (let page = 1; ; page += 1) {
      const response = await fetch(
        `https://api.github.com/repos/${this.repository}/git/matching-refs/tags/${prefix}?per_page=${PAGE_SIZE}&page=${page}`,
        { headers: this.headers() },
      );
      if (!response.ok) {
        throw new Error(`태그 목록 조회에 실패했습니다. (상태 코드: ${response.status})`);
      }

      const refs = (await response.json()) as { ref: string }[];
      names.push(...refs.map((ref) => ref.ref.slice(TAG_REF_PREFIX.length)));
      if (refs.length < PAGE_SIZE) return names;
    }
  }

  async deleteTag(name: string): Promise<void> {
    const response = await fetch(`https://api.github.com/repos/${this.repository}/git/refs/tags/${name}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (response.status !== 204) {
      throw new Error(`태그 삭제에 실패했습니다. (상태 코드: ${response.status})`);
    }
  }

  private headers(): Record<string, string> {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${this.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }
}
