export const K6_TAG_PREFIX = "k6/";

export interface TagRepository {
  listTagNames(prefix: string): Promise<string[]>;
  deleteTag(name: string): Promise<void>;
}

export type CleanupResult = {
  dryRun: boolean;
  deleted: string[];
  failed: { name: string; reason: string }[];
};

// 부하 테스트 실행용 태그(k6/...)를 지운다. 다른 태그(v1.0.0 같은 릴리스 태그)는 건드리지 않는다.
export class TagCleaner {
  private readonly repository: TagRepository;
  private readonly prefix: string;

  constructor(repository: TagRepository, prefix: string = K6_TAG_PREFIX) {
    this.repository = repository;
    this.prefix = prefix;
  }

  async clean({ dryRun }: { dryRun: boolean }): Promise<CleanupResult> {
    const names = (await this.repository.listTagNames(this.prefix)).filter((name) => name.startsWith(this.prefix));
    const result: CleanupResult = { dryRun, deleted: [], failed: [] };

    for (const name of names) {
      if (dryRun) {
        result.deleted.push(name);
        continue;
      }
      try {
        await this.repository.deleteTag(name);
        result.deleted.push(name);
      } catch (error) {
        result.failed.push({ name, reason: error instanceof Error ? error.message : "알 수 없는 오류" });
      }
    }

    return result;
  }
}
