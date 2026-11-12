import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const distributionId = "E3TM3MDSJWPEW5";
const serviceHost = "dev.bibbidi.kr";
const serviceUrl = `https://${serviceHost}`;
const originId = "bibbidi-next-dev-release";
const originDomain = "techcourse-project-2026.s3.ap-northeast-2.amazonaws.com";
const releaseRoot = "/bibbidi/fe/development/releases/";
const releaseIdPattern =
  /^[0-9a-f]{40}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function aws(args, timeout = 30_000) {
  const command = args.slice(0, args[0] === "wait" ? 2 : 1).join(" ");
  const result = spawnSync(
    "aws",
    ["cloudfront", ...args, "--output", "json", "--no-cli-pager"],
    { encoding: "utf8", timeout, stdio: ["ignore", "pipe", "inherit"] },
  );
  if (result.error) {
    throw new Error(`CloudFront ${command} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `CloudFront ${command} exited with status ${result.status}.`,
    );
  }
  return result.stdout ? JSON.parse(result.stdout) : undefined;
}

async function verifyDeployment(releaseId, calendarHash) {
  const options = { redirect: "error", signal: AbortSignal.timeout(10_000) };
  const [version, calendar] = await Promise.all([
    fetch(`${serviceUrl}/version.json`, options),
    fetch(`${serviceUrl}/calendar/index.txt`, options),
  ]);
  if (!version.ok || (await version.json()).releaseId !== releaseId) {
    throw new Error(
      "The public version.json does not match the staged release.",
    );
  }
  if (
    !calendar.ok ||
    calendar.headers.get("content-type")?.split(";")[0] !== "text/plain" ||
    createHash("sha256")
      .update(Buffer.from(await calendar.arrayBuffer()))
      .digest("hex") !== calendarHash
  ) {
    throw new Error("The public calendar navigation payload is invalid.");
  }
}

async function activate(manifestFile) {
  const env = process.env;
  if (
    env.CLOUDFRONT_DISTRIBUTION_ID !== distributionId ||
    env.FE_SERVICE_URL?.replace(/\/$/, "") !== serviceUrl ||
    env.S3_BUCKET_NAME !== "techcourse-project-2026" ||
    env.S3_PREFIX !== "bibbidi/fe/development"
  ) {
    throw new Error("Release activation is restricted to Bibbidi development.");
  }

  const { releaseId, commit, buildId, files } = JSON.parse(
    await readFile(manifestFile, "utf8"),
  );
  const calendarHash = files?.find(
    (file) => file.path === "calendar/index.txt",
  )?.sha256;
  if (
    !releaseIdPattern.test(releaseId) ||
    !/^[0-9a-f]{64}$/.test(calendarHash) ||
    commit !== env.CODEBUILD_RESOLVED_SOURCE_VERSION ||
    buildId !== env.CODEBUILD_BUILD_ID ||
    releaseId !== `${commit}-${buildId?.split(":").at(-1)}`
  ) {
    throw new Error(
      "Staged release metadata does not match this CodeBuild run.",
    );
  }

  const target = ["--id", distributionId];
  const { ETag, Distribution } = aws(["get-distribution", ...target]);
  const config = Distribution.DistributionConfig;
  const origin = config.Origins.Items.find((item) => item.Id === originId);
  const aliases = config.Aliases.Items;
  const previousPath = origin?.OriginPath;
  if (
    Distribution.Status !== "Deployed" ||
    !ETag ||
    aliases?.length !== 1 ||
    aliases[0] !== serviceHost ||
    config.DefaultCacheBehavior.TargetOriginId !== originId ||
    origin?.DomainName !== originDomain ||
    !previousPath?.startsWith(releaseRoot) ||
    !releaseIdPattern.test(previousPath.slice(releaseRoot.length))
  ) {
    throw new Error(
      "The development distribution is not ready for release activation.",
    );
  }

  const nextPath = releaseRoot + releaseId;
  console.log(`Development origin path: ${previousPath} -> ${nextPath}`);
  if (previousPath !== nextPath) {
    origin.OriginPath = nextPath;
    const configFile = join(
      dirname(manifestFile),
      "cloudfront-distribution.json",
    );
    await writeFile(configFile, JSON.stringify(config), { mode: 0o600 });
    // Match the version we read so a concurrent configuration edit is preserved.
    aws([
      "update-distribution",
      ...target,
      "--if-match",
      ETag,
      "--distribution-config",
      `file://${configFile}`,
    ]);
  }

  try {
    aws(["wait", "distribution-deployed", ...target], 240_000);
    const distribution = ["--distribution-id", distributionId];
    const { Invalidation } = aws([
      "create-invalidation",
      ...distribution,
      "--paths",
      "/*",
    ]);
    aws(
      [
        "wait",
        "invalidation-completed",
        ...distribution,
        "--id",
        Invalidation.Id,
      ],
      120_000,
    );
    console.log(`CloudFront invalidation ${Invalidation.Id} completed.`);
    await verifyDeployment(releaseId, calendarHash);
  } catch (error) {
    throw new Error(
      `Development release could not be verified: ${error.message} ` +
        `Check CloudFront and restore the previous origin path if needed: ${previousPath}`,
    );
  }
  console.log(`Verified development release ${releaseId}.`);
}

await activate(process.argv[2]);
