import type { GitHubApi } from "../github/github-api.ts";
import type { TagRepository } from "./tag-cleaner.ts";

/** 태그 정리 도메인(TagRepository)을 공통 GitHubApi에 연결한다. */
export class GitHubTagRepository implements TagRepository {
  private readonly github: GitHubApi;

  constructor(github: GitHubApi) {
    this.github = github;
  }

  listTagNames(prefix: string): Promise<string[]> {
    return this.github.listTagNames(prefix);
  }

  deleteTag(name: string): Promise<void> {
    return this.github.deleteTag(name);
  }
}
