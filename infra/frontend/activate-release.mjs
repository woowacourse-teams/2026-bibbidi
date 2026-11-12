import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { readReleaseVersion } from "./release-version.mjs";

const distributionId = "E3TM3MDSJWPEW5";
const serviceUrl = "https://dev.bibbidi.kr";
const bucket = "techcourse-project-2026";
const prefix = "bibbidi/fe/development";
const activeUri = `s3://${bucket}/${prefix}`;
const revalidate = "public,max-age=0,must-revalidate";

function aws(args) {
  const result = spawnSync("aws", [...args, "--no-cli-pager"], {
    encoding: "utf8",
    timeout: 180_000,
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `AWS ${args.slice(0, 2).join(" ")} failed (${result.status}).`,
    );
  }
  return result.stdout.trim();
}

async function verifyDeployment(expectedVersion, hashes) {
  const options = { redirect: "error", signal: AbortSignal.timeout(10_000) };
  const response = await fetch(`${serviceUrl}/version.json`, options);
  const publicVersion = response.ok ? await response.json() : null;
  if (!matchesVersion(publicVersion, expectedVersion)) {
    throw new Error(
      "The public version.json does not match the staged release.",
    );
  }
  for (const [path, expectedHash] of Object.entries(hashes)) {
    const response = await fetch(`${serviceUrl}/${path}`, options);
    const type = path.endsWith(".txt") ? "text/plain" : "text/html";
    if (
      !response.ok ||
      response.headers.get("content-type")?.split(";")[0] !== type ||
      createHash("sha256")
        .update(Buffer.from(await response.arrayBuffer()))
        .digest("hex") !== expectedHash
    ) {
      throw new Error(`The public ${path} does not match the staged release.`);
    }
  }
}

function matchesVersion(actual, expected) {
  return Object.entries(expected).every(
    ([key, value]) => actual?.[key] === value,
  );
}

async function activate(manifestFile) {
  const env = process.env;
  if (
    env.CLOUDFRONT_DISTRIBUTION_ID !== distributionId ||
    env.FE_SERVICE_URL?.replace(/\/$/, "") !== serviceUrl ||
    env.S3_BUCKET_NAME !== bucket ||
    env.S3_PREFIX !== prefix
  ) {
    throw new Error(
      "Release publication is restricted to Bibbidi development.",
    );
  }

  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  const version = await readReleaseVersion();
  if (!matchesVersion(manifest, version)) {
    throw new Error(
      "Staged release metadata does not match this CodeBuild run.",
    );
  }
  const hashes = {};
  for (const path of ["index.html", "calendar/index.txt"]) {
    const hash = manifest.files?.find((file) => file.path === path)?.sha256;
    if (!/^[0-9a-f]{64}$/.test(hash)) {
      throw new Error(`Missing staged hash for ${path}.`);
    }
    const data = await readFile(join("FE/out", path));
    if (createHash("sha256").update(data).digest("hex") !== hash) {
      throw new Error(`Local ${path} differs from the staged release.`);
    }
    hashes[path] = hash;
  }

  const previous = await fetch(`${serviceUrl}/version.json`, {
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!previous.ok) throw new Error("Could not record the current release.");
  const previousRelease = (await previous.json()).releaseId;
  if (!/^[0-9a-f]{40}-[0-9a-f-]{36}$/i.test(previousRelease)) {
    throw new Error("The current public release ID is invalid.");
  }
  console.log(
    `Previous release archive: ${activeUri}/releases/${previousRelease}/`,
  );

  try {
    // Keep previous hashed assets so tabs opened before deployment can load them.
    const copy = [
      "s3",
      "cp",
      "FE/out/",
      activeUri + "/",
      "--recursive",
      "--only-show-errors",
    ];
    aws([
      ...copy,
      "--cache-control",
      "public,max-age=31536000,immutable",
      "--exclude",
      "*",
      "--include",
      "_next/static/*",
    ]);
    aws([
      ...copy,
      "--cache-control",
      revalidate,
      "--exclude",
      "_next/static/*",
    ]);
    const metadata = [
      "s3",
      "cp",
      "--cache-control",
      revalidate,
      "--content-type",
      "application/json",
      "--only-show-errors",
    ];
    aws([...metadata, manifestFile, activeUri + "/release-manifest.json"]);
    const versionFile = join(dirname(manifestFile), "version.json");
    await writeFile(versionFile, JSON.stringify(version) + "\n");
    // Publish the version marker only after the complete export has been uploaded.
    aws([...metadata, versionFile, activeUri + "/version.json"]);
    const invalidationId = aws([
      "cloudfront",
      "create-invalidation",
      "--distribution-id",
      distributionId,
      "--paths",
      "/*",
      "--query",
      "Invalidation.Id",
      "--output",
      "text",
    ]);
    console.log(`Requested CloudFront invalidation ${invalidationId}.`);

    const deadline = Date.now() + 300_000;
    let lastError;
    while (Date.now() < deadline) {
      try {
        await verifyDeployment(version, hashes);
        console.log(
          `Verified development release ${version.version} (${version.releaseId}).`,
        );
        return;
      } catch (error) {
        lastError = error;
      }
      console.log(`Waiting for public release: ${lastError.message}`);
      await delay(Math.min(20_000, Math.max(0, deadline - Date.now())));
    }
    throw lastError;
  } catch (error) {
    throw new Error(
      `Development publication failed: ${error.message} ` +
        `Previous release archive: ${activeUri}/releases/${previousRelease}/`,
    );
  }
}

await activate(process.argv[2]);
