import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { GitHubApi } from "../github/github-api.ts";
import { RetryingHttp } from "../github/retrying-http.ts";
import { ARTIFACT_NAME_PREFIX, CiArtifactFinder } from "./ci-artifact-finder.ts";
import { SourceFingerprint } from "./source-fingerprint.ts";

const requiredEnvironment = ["GITHUB_TOKEN", "GITHUB_REPOSITORY", "GITHUB_OUTPUT"] as const;

type CliEnvironment = Record<(typeof requiredEnvironment)[number], string>;

function validateEnvironment(environment: NodeJS.ProcessEnv) {
  const missing = requiredEnvironment.filter((name) => !environment[name]?.trim());
  if (missing.length > 0) throw new Error(`필수 환경변수가 없습니다: ${missing.join(", ")}`);
  return environment as CliEnvironment;
}

async function writeOutput(path: string, values: Record<string, string>) {
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  await appendFile(path, `${lines.join("\n")}\n`, "utf8");
}

export async function main(command: string | undefined, environment: NodeJS.ProcessEnv = process.env) {
  try {
    const fingerprint = await new SourceFingerprint().value();
    if (command === "fingerprint") {
      await writeOutput(validateEnvironmentOutput(environment), { name: `${ARTIFACT_NAME_PREFIX}${fingerprint}` });
      return;
    }
    if (command !== "find") throw new Error("명령은 fingerprint 또는 find 여야 합니다.");

    const values = validateEnvironment(environment);
    const api = new GitHubApi(new RetryingHttp(), values.GITHUB_TOKEN, values.GITHUB_REPOSITORY);
    const artifactId = await new CiArtifactFinder(api).findArtifactId(fingerprint);
    await writeOutput(values.GITHUB_OUTPUT, { "artifact-id": artifactId ? String(artifactId) : "" });
    console.log(
      artifactId
        ? `PR CI의 JAR를 재사용합니다. 소스 해시 ${fingerprint}, 아티팩트 ${artifactId}`
        : `재사용할 PR CI JAR가 없어 직접 빌드합니다. 소스 해시 ${fingerprint}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    console.error(`::error title=PR CI 산출물 확인 실패::${message}`);
    process.exitCode = 1;
  }
}

function validateEnvironmentOutput(environment: NodeJS.ProcessEnv) {
  const path = environment.GITHUB_OUTPUT?.trim();
  if (!path) throw new Error("필수 환경변수가 없습니다: GITHUB_OUTPUT");
  return path;
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entrypoint === import.meta.url) await main(process.argv[2]);
