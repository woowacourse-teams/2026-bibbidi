import { GitHubTagRepository } from "./github-tag-repository.ts";
import { TagCleaner } from "./tag-cleaner.ts";

const requiredEnvironment = ["GITHUB_TOKEN", "GITHUB_REPOSITORY"] as const;

async function main() {
  try {
    const missing = requiredEnvironment.filter((name) => !process.env[name]?.trim());
    if (missing.length > 0) throw new Error(`필수 환경변수가 없습니다: ${missing.join(", ")}`);

    const repository = new GitHubTagRepository(process.env.GITHUB_REPOSITORY!, process.env.GITHUB_TOKEN!);
    const result = await new TagCleaner(repository).clean({ dryRun: process.env.DRY_RUN === "true" });

    console.log(`k6 태그 ${result.dryRun ? "삭제 대상" : "삭제"} ${result.deleted.length}건`);
    for (const name of result.deleted) console.log(`- ${name}`);

    for (const failure of result.failed) {
      console.error(`::error title=k6 태그 삭제 실패::${failure.name}: ${failure.reason}`);
    }
    if (result.failed.length > 0) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    console.error(`::error title=k6 태그 정리 실패::${message}`);
    process.exitCode = 1;
  }
}

await main();
