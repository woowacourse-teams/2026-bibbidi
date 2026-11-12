import { readFile } from "node:fs/promises";

const stableVersion = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const buildUuid =
  /:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export async function readReleaseVersion({ production = false } = {}) {
  const commit = process.env.CODEBUILD_RESOLVED_SOURCE_VERSION ?? "";
  const buildId = process.env.CODEBUILD_BUILD_ID ?? "";
  const buildNumber = process.env.CODEBUILD_BUILD_NUMBER ?? "";
  const uuid = buildId.match(buildUuid)?.[1];
  if (
    !/^[0-9a-f]{40}$/i.test(commit) ||
    !uuid ||
    (production && !buildId.startsWith("bibbidi-fe-production-build:")) ||
    !/^[1-9][0-9]*$/.test(buildNumber)
  ) {
    throw new Error(
      "A Git commit, CodeBuild run ID and build number are required.",
    );
  }

  const { version: baseVersion } = JSON.parse(
    await readFile("FE/package.json", "utf8"),
  );
  if (typeof baseVersion !== "string" || !stableVersion.test(baseVersion)) {
    throw new Error(
      "FE/package.json must declare a MAJOR.MINOR.PATCH version.",
    );
  }

  const changelog = await readFile("FE/CHANGELOG.md", "utf8");
  if (!changelog.split(/\r?\n/).includes(`## ${baseVersion}`)) {
    throw new Error(
      `FE/CHANGELOG.md must contain a section for ${baseVersion}.`,
    );
  }

  return {
    version: production ? baseVersion : `${baseVersion}-dev.${buildNumber}`,
    commit,
    buildId,
    releaseId: `${commit}-${uuid}`,
    changelogUrl: `https://github.com/woowacourse-teams/2026-bibbidi/blob/${commit}/FE/CHANGELOG.md`,
  };
}
