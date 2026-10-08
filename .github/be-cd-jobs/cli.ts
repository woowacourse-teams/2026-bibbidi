import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { decideImage } from "./image-decision.ts";
import { fetchPullRequestsOfCommit, isCommitOnBranch } from "./release-source-client.ts";

const requiredEnvironment = ["GITHUB_TOKEN", "GITHUB_REPOSITORY", "GITHUB_SHA", "GITHUB_OUTPUT"] as const;

type ReleaseEnvironment = Record<(typeof requiredEnvironment)[number], string>;

export function validateEnvironment(environment: NodeJS.ProcessEnv): ReleaseEnvironment {
  const missing = requiredEnvironment.filter((name) => !environment[name]?.trim());
  if (missing.length > 0) throw new Error(`필수 환경변수가 없습니다: ${missing.join(", ")}`);

  return environment as ReleaseEnvironment;
}

export async function main(environment: NodeJS.ProcessEnv = process.env) {
  try {
    const values = validateEnvironment(environment);
    const decision = await decideImage({
      releaseSha: values.GITHUB_SHA,
      repository: values.GITHUB_REPOSITORY,
      pullRequests: await fetchPullRequestsOfCommit({
        repository: values.GITHUB_REPOSITORY,
        sha: values.GITHUB_SHA,
        token: values.GITHUB_TOKEN,
      }),
      isDevelopmentCommit: (sha) => isCommitOnBranch(sha, "dev-be"),
    });

    await appendFile(
      values.GITHUB_OUTPUT,
      `build-image=${decision.buildImage}\nimage-tag=${decision.imageTag}\n`,
      "utf8",
    );
    console.log(`운영 이미지 태그: ${decision.imageTag} (빌드 필요: ${decision.buildImage})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    console.error(`::error title=운영 이미지 결정 실패::${message}`);
    process.exitCode = 1;
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entrypoint === import.meta.url) await main();
